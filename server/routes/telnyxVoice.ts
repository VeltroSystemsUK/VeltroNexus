import { timingSafeEqual } from "crypto";
import { Router } from "express";
import type { Request, Response } from "express";
import type { AgenticDealFile } from "@shared/agenticWorkflow";
import {
  outboundGate,
  pickAssistant,
  TELNYX_DID,
  telnyxFlags,
  type CallOutcome,
} from "@shared/telnyxVoice";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { verifyTelnyxSignature } from "../services/telnyxSignature";
import {
  createTelnyxVoiceService,
  isTelnyxCallEvent,
  normaliseUkCli,
  packStatusForDeal,
  transferInstruction,
  type LookupResult,
} from "../services/telnyxVoice";
import { handleApiError } from "../utils/errorHandler";

const TOOL_NAMES = ["lookupDeal", "packStatus", "logOutcome", "transferToShaun", "optOut"] as const;
type ToolName = (typeof TOOL_NAMES)[number];

export type TelnyxVoiceHandlerDeps = {
  voice: ReturnType<typeof createTelnyxVoiceService>;
  listDeals: () => Promise<AgenticDealFile[]>;
  toolSecret?: string | null;
  expectedToolSecret?: string | null;
};

const telnyxVoice = createTelnyxVoiceService({
  listDeals: () => storage.listAgenticDeals(),
  getDeal: (id) => storage.getAgenticDeal(id),
  saveDeal: async (deal) => {
    await storage.updateAgenticDeal(deal.id, deal);
  },
});

function defaultDeps(): TelnyxVoiceHandlerDeps {
  return {
    voice: telnyxVoice,
    listDeals: () => storage.listAgenticDeals(),
    expectedToolSecret: process.env.TELNYX_TOOL_SECRET,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function telnyxPublicKeyPem(pem?: string | null): string {
  return String(pem ?? "").replace(/\\n/g, "\n").trim();
}

function requestRawBody(req: Request): string {
  const raw = (req as Request & { rawBody?: unknown }).rawBody;
  if (Buffer.isBuffer(raw)) return raw.toString("utf8");
  if (typeof raw === "string") return raw;
  return "";
}

function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

function isCallOutcome(value: unknown): value is CallOutcome {
  return (
    value === "connected" ||
    value === "no_answer" ||
    value === "amd" ||
    value === "callback" ||
    value === "opt_out" ||
    value === "transferred" ||
    value === "pack_promised"
  );
}

function toLookupResult(deal: AgenticDealFile): LookupResult {
  return {
    id: deal.id,
    companyName: deal.companyName,
    stage: deal.stage,
    source: deal.source,
    contactName: deal.contactName,
    missing: packStatusForDeal(deal).missing,
  };
}

function normaliseCompanyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function lookupByCompanyName(deals: AgenticDealFile[], companyName: string): AgenticDealFile | undefined {
  const needle = normaliseCompanyName(companyName);
  if (!needle) return undefined;
  const matches = deals.filter((row) => normaliseCompanyName(row.companyName) === needle);
  return matches.length === 1 ? matches[0] : undefined;
}

function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function authorizeTelnyxTool(
  provided?: string | null,
  expected?: string | null
): { status: number; body?: unknown } | null {
  const want = String(expected ?? process.env.TELNYX_TOOL_SECRET ?? "");
  if (!want) return { status: 503, body: { error: "telnyx tool secret missing" } };
  if (!secretsEqual(String(provided || ""), want)) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  return null;
}

function requestToolSecret(req: Request): string {
  const header = req.get("x-telnyx-tool-secret") || "";
  if (header) return header;
  const auth = req.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

function isTelnyxDid(cli: string): boolean {
  const normalised = normaliseUkCli(cli);
  return Boolean(normalised) && normalised === normaliseUkCli(TELNYX_DID);
}

function customerCli(from: string, to: string, direction: string): string {
  const outbound = direction.startsWith("out");
  const preferred = outbound ? to : from;
  const fallback = outbound ? from : to;
  if (preferred && !isTelnyxDid(preferred)) return preferred;
  if (fallback && !isTelnyxDid(fallback)) return fallback;
  return "";
}

export function clickToCallStatus(flags: { clickToCall: boolean }): 403 | 200 {
  return flags.clickToCall ? 200 : 403;
}

export async function placeOutboundCall(input: {
  flags?: { clickToCall: boolean };
  dealId: number;
  phone?: string | null;
}): Promise<void> {
  const flags = input.flags ?? telnyxFlags();
  if (!flags.clickToCall) throw new Error("disabled");
  if (input.phone !== undefined) {
    const gate = outboundGate({ phone: input.phone });
    if (!gate.ok) throw new Error(gate.reason);
  }
}

export async function clickToCall(input: {
  flags?: { clickToCall: boolean };
  dealId?: number;
}): Promise<{ status: number; body?: { error: string } | { ok: true } }> {
  const flags = input.flags ?? telnyxFlags();
  if (clickToCallStatus(flags) === 403) {
    return { status: 403, body: { error: "click-to-call disabled" } };
  }
  await placeOutboundCall({ flags, dealId: input.dealId ?? 0 });
  return { status: 200, body: { ok: true } };
}

export async function handleTelnyxWebhook(
  input: {
    publicKeyPem?: string | null;
    timestamp?: string;
    signatureB64?: string;
    rawBody: string;
    body?: unknown;
  },
  deps: TelnyxVoiceHandlerDeps = defaultDeps()
): Promise<{ status: number; body?: unknown }> {
  const publicKeyPem = telnyxPublicKeyPem(input.publicKeyPem);
  if (!publicKeyPem) return { status: 503, body: { error: "telnyx public key missing" } };
  const ok = verifyTelnyxSignature({
    publicKeyPem,
    timestamp: input.timestamp || "",
    signatureB64: input.signatureB64 || "",
    rawBody: input.rawBody ?? "",
  });
  if (!ok) return { status: 401 };
  await persistHangupOrRecording(input.body ?? input.rawBody, deps);
  return { status: 204 };
}

export async function handleTelnyxTool(
  name: string,
  body: Record<string, unknown> = {},
  deps: TelnyxVoiceHandlerDeps = defaultDeps()
): Promise<{ status: number; body?: unknown }> {
  const denied = authorizeTelnyxTool(deps.toolSecret, deps.expectedToolSecret);
  if (denied) return denied;
  if (!isToolName(name)) return { status: 404, body: { error: "unknown tool" } };
  try {
    if (name === "lookupDeal") return { status: 200, body: await lookupDealTool(body, deps) };
    if (name === "packStatus") return await packStatusTool(body, deps);
    if (name === "logOutcome") return await logOutcomeTool(body, deps);
    if (name === "optOut") return await optOutTool(body, deps);
    return { status: 200, body: transferInstruction() };
  } catch (error) {
    if (error instanceof Error && error.message === "Deal file not found") {
      return { status: 404, body: { error: "Deal file not found" } };
    }
    throw error;
  }
}

async function lookupDealTool(
  body: Record<string, unknown>,
  deps: TelnyxVoiceHandlerDeps
): Promise<{ found: boolean; deal?: LookupResult }> {
  const from = typeof body.from === "string" ? body.from : "";
  if (from) {
    const deal = await deps.voice.lookupDealByCli(from);
    if (deal) return { found: true, deal };
  }
  const companyName = typeof body.companyName === "string" ? body.companyName : "";
  if (companyName) {
    const match = lookupByCompanyName(await deps.listDeals(), companyName);
    if (match) return { found: true, deal: toLookupResult(match) };
  }
  return { found: false };
}

async function packStatusTool(body: Record<string, unknown>, deps: TelnyxVoiceHandlerDeps) {
  const deal = await resolveToolDeal(body, deps);
  if (!deal) return { status: 404, body: { error: "Deal file not found" } };
  return { status: 200, body: packStatusForDeal(deal) };
}

async function logOutcomeTool(body: Record<string, unknown>, deps: TelnyxVoiceHandlerDeps) {
  const dealId = Number(body.dealId);
  if (!Number.isFinite(dealId) || dealId <= 0) {
    return { status: 400, body: { error: "dealId required" } };
  }
  if (!isCallOutcome(body.outcome)) {
    return { status: 400, body: { error: "invalid outcome" } };
  }
  const deal = (await deps.listDeals()).find((row) => row.id === dealId);
  const assistant =
    body.assistant === "james" || body.assistant === "sophie"
      ? body.assistant
      : pickAssistant({ direction: "inbound", source: deal?.source });
  await deps.voice.appendCallEvent(dealId, {
    at: new Date().toISOString(),
    assistant,
    outcome: body.outcome,
    callControlId: typeof body.callControlId === "string" ? body.callControlId : undefined,
    recordingUrl: typeof body.recordingUrl === "string" ? body.recordingUrl : undefined,
    transcript: typeof body.transcript === "string" ? body.transcript : undefined,
  });
  return { status: 200, body: { ok: true } };
}

async function optOutTool(body: Record<string, unknown>, deps: TelnyxVoiceHandlerDeps) {
  const dealId = Number(body.dealId);
  if (!Number.isFinite(dealId) || dealId <= 0) {
    return { status: 400, body: { error: "dealId required" } };
  }
  await deps.voice.optOutDeal(dealId);
  return { status: 200, body: { ok: true } };
}

async function resolveToolDeal(
  body: Record<string, unknown>,
  deps: TelnyxVoiceHandlerDeps
): Promise<AgenticDealFile | undefined> {
  const dealId = Number(body.dealId);
  if (Number.isFinite(dealId) && dealId > 0) {
    return (await deps.listDeals()).find((row) => row.id === dealId);
  }
  const from = typeof body.from === "string" ? body.from : "";
  if (!from) return undefined;
  const found = await deps.voice.lookupDealByCli(from);
  if (!found) return undefined;
  return (await deps.listDeals()).find((row) => row.id === found.id);
}

async function persistHangupOrRecording(bodyOrRaw: unknown, deps: TelnyxVoiceHandlerDeps): Promise<void> {
  const root =
    typeof bodyOrRaw === "string"
      ? asRecord(safeJson(bodyOrRaw))
      : asRecord(bodyOrRaw);
  const data = asRecord(root.data);
  const payload = asRecord(data.payload || root.payload);
  const eventType = String(data.event_type || root.event_type || "").toLowerCase();
  if (!isHangupOrRecording(eventType)) return;

  const from = String(payload.from || "");
  const to = String(payload.to || "");
  const directionRaw = String(payload.direction || "").toLowerCase();
  const cli = customerCli(from, to, directionRaw);
  if (!cli || isTelnyxDid(cli)) return;
  const found = await deps.voice.lookupDealByCli(cli);
  if (!found) return;

  const deal = (await deps.listDeals()).find((row) => row.id === found.id);
  const direction: "inbound" | "outbound" = directionRaw.startsWith("out") ? "outbound" : "inbound";
  const lastTelnyx = deal?.events?.slice().reverse().find(isTelnyxCallEvent);
  const assistant =
    lastTelnyx?.assistant ?? pickAssistant({ direction, source: found.source });
  const eventId =
    typeof data.id === "string"
      ? data.id
      : typeof root.id === "string"
        ? root.id
        : undefined;
  await deps.voice.appendCallEvent(found.id, {
    at: String(payload.end_time || data.occurred_at || new Date().toISOString()),
    assistant,
    outcome: outcomeFromPayload(payload),
    callControlId: typeof payload.call_control_id === "string" ? payload.call_control_id : undefined,
    eventId,
    recordingUrl: recordingUrlFromPayload(payload),
    transcript: typeof payload.transcript === "string" ? payload.transcript : undefined,
  });
}

function isHangupOrRecording(eventType: string): boolean {
  return (
    eventType.includes("hangup") ||
    eventType.includes("recording") ||
    eventType.includes("conversation.ended")
  );
}

function outcomeFromPayload(payload: Record<string, unknown>): CallOutcome {
  if (isCallOutcome(payload.outcome)) return payload.outcome;
  const cause = String(payload.hangup_cause || "").toLowerCase();
  if (cause.includes("amd") || cause.includes("machine")) return "amd";
  if (
    cause.includes("no_answer") ||
    cause.includes("timeout") ||
    cause.includes("originator_cancel")
  ) {
    return "no_answer";
  }
  return "connected";
}

function recordingUrlFromPayload(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.recording_url === "string") return payload.recording_url;
  const urls = asRecord(payload.recording_urls);
  if (typeof urls.mp3 === "string") return urls.mp3;
  return undefined;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

async function sendHandlerResult(
  res: Response,
  result: { status: number; body?: unknown }
): Promise<void> {
  if (result.status === 204) {
    res.status(204).end();
    return;
  }
  if (result.body === undefined) {
    res.sendStatus(result.status);
    return;
  }
  res.status(result.status).json(result.body);
}

const router = Router();

router.post("/api/telnyx/voice", async (req: Request, res: Response) => {
  try {
    const result = await handleTelnyxWebhook({
      publicKeyPem: process.env.TELNYX_PUBLIC_KEY,
      timestamp: req.get("telnyx-timestamp") || "",
      signatureB64: req.get("telnyx-signature-ed25519") || "",
      rawBody: requestRawBody(req),
      body: req.body,
    });
    await sendHandlerResult(res, result);
  } catch (error) {
    handleApiError(res, error, "telnyx-voice-webhook");
  }
});

router.post("/api/telnyx/tools/:name", async (req: Request, res: Response) => {
  try {
    const result = await handleTelnyxTool(String(req.params.name || ""), asRecord(req.body), {
      ...defaultDeps(),
      toolSecret: requestToolSecret(req),
    });
    await sendHandlerResult(res, result);
  } catch (error) {
    handleApiError(res, error, "telnyx-voice-tool");
  }
});

router.post("/api/agentic/deals/:id/call", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const flags = telnyxFlags();
    const result = await clickToCall({
      flags,
      dealId: parseInt(req.params.id, 10),
    });
    await sendHandlerResult(res, result);
  } catch (error) {
    if (error instanceof Error && error.message === "disabled") {
      return res.status(403).json({ error: "click-to-call disabled" });
    }
    handleApiError(res, error, "telnyx-click-to-call");
  }
});

export default router;
