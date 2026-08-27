/**
 * Talks to the standalone Strata app.
 * Nexus does not embed Strata's product code — F:\Shaun\Desktop\Strata stays the
 * runnable standalone copy. This service only creates/updates a case and
 * returns workspace / launch URLs for the Underwriting Studio.
 */
import type { DueDiligenceData } from "@shared/schema";
import { storage } from "../storage";
import { buildStrataPayload } from "./strataPayload";
import { embedPathFromLaunch } from "../strataEmbed";

export type StrataPackagingRecord = {
  caseId: string;
  title: string;
  status: "ready" | "error" | "disabled";
  workspaceUrl?: string;
  launchUrl?: string;
  embedPath?: string;
  completeness?: { ready?: boolean; common?: { label: string }[]; lenders?: Record<string, { label: string }[]> };
  lastError?: string;
  updatedAt: string;
  triggeredBy: "underwriting-submit" | "studio";
};

type StrataCaseResponse = {
  id: string;
  title: string;
  completeness?: StrataPackagingRecord["completeness"];
  launch_url?: string;
  workspace_url?: string;
  detail?: string;
};

function config() {
  return {
    enabled: (process.env.STRATA_ENABLED || "true").toLowerCase() !== "false",
    apiUrl: (process.env.STRATA_API_URL || "http://127.0.0.1:8000").replace(/\/$/, ""),
    webUrl: (process.env.STRATA_WEB_URL || "http://127.0.0.1:3000").replace(/\/$/, ""),
    token: (process.env.STRATA_INTEGRATION_TOKEN || "").trim(),
    email: process.env.STRATA_EMAIL || "advisor@sterlingcapitalreserve.co.uk",
    password: process.env.STRATA_PASSWORD || "StrataTest1!",
  };
}

export function isStrataConfigured() {
  const { enabled, apiUrl, token, email, password } = config();
  return enabled && Boolean(apiUrl) && (Boolean(token) || Boolean(email && password));
}

async function fileToPayload(opts: {
  prospectId: number;
  userId: string;
  notes?: string;
  submissionId?: number;
}) {
  const prospect = await storage.getProspectById(opts.prospectId);
  if (!prospect) throw new Error("Prospect not found");
  const [contacts, diligence, documents, exceptions] = await Promise.all([
    storage.listContacts(opts.prospectId, prospect.userId),
    storage.getDueDiligence(opts.prospectId, prospect.userId),
    storage.listProspectDocuments(opts.prospectId, prospect.userId),
    storage.listExceptionsForProspect(opts.prospectId),
  ]);
  return {
    prospect,
    payload: buildStrataPayload({
      prospect,
      contacts,
      diligence: diligence?.data,
      documents,
      exceptions,
      notes: opts.notes,
      submissionId: opts.submissionId,
    }),
  };
}

async function strataFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { apiUrl, token, email, password } = config();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    const login = await fetch(`${apiUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!login.ok) {
      throw new Error("Could not sign in to standalone Strata");
    }
    const cookie = login.headers.get("set-cookie");
    if (cookie) headers.set("Cookie", cookie.split(";")[0]);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${apiUrl}${path}`, { ...init, headers });
}

export async function startStrataPackaging(opts: {
  prospectId: number;
  userId: string;
  submissionId?: number;
  notes?: string;
  triggeredBy: StrataPackagingRecord["triggeredBy"];
}): Promise<StrataPackagingRecord> {
  const now = new Date().toISOString();
  if (!isStrataConfigured()) {
    return {
      caseId: "",
      title: "",
      status: "disabled",
      lastError: "Set STRATA_API_URL and STRATA_INTEGRATION_TOKEN to enable packaging",
      updatedAt: now,
      triggeredBy: opts.triggeredBy,
    };
  }

  const { prospect, payload } = await fileToPayload(opts);
  const title = prospect.company?.companyName || `Prospect ${opts.prospectId}`;

  let record: StrataPackagingRecord;
  try {
    const res = await strataFetch("/api/v1/integrations/nexus/cases", {
      method: "POST",
      body: JSON.stringify({
        nexus_prospect_id: opts.prospectId,
        nexus_submission_id: opts.submissionId ?? null,
        title,
        payload,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as StrataCaseResponse;
    if (!res.ok) {
      throw new Error(typeof body.detail === "string" ? body.detail : `Strata returned ${res.status}`);
    }
    record = {
      caseId: body.id,
      title: body.title || title,
      status: "ready",
      workspaceUrl: body.workspace_url,
      launchUrl: body.launch_url,
      embedPath: embedPathFromLaunch(body.launch_url),
      completeness: body.completeness,
      updatedAt: now,
      triggeredBy: opts.triggeredBy,
    };
  } catch (error) {
    record = {
      caseId: "",
      title,
      status: "error",
      lastError: error instanceof Error ? error.message : "Strata packaging failed",
      updatedAt: now,
      triggeredBy: opts.triggeredBy,
    };
  }

  const existing = await storage.getDueDiligence(opts.prospectId, prospect.userId);
  const data = { ...(existing?.data || {}), strataPackaging: record } as DueDiligenceData & {
    strataPackaging: StrataPackagingRecord;
  };
  await storage.upsertDueDiligence(opts.prospectId, prospect.userId, data);

  const { ensureSterlingHandoff } = await import("./sterlingHandoff");
  await ensureSterlingHandoff({
    prospectId: opts.prospectId,
    userId: opts.userId,
    submissionId: opts.submissionId,
  }).catch((error) => {
    console.warn("Sterling handoff skipped:", error instanceof Error ? error.message : error);
  });

  return record;
}

export async function refreshStrataPackaging(prospectId: number, userId: string) {
  const existing = await storage.getDueDiligence(prospectId, userId);
  const current = (existing?.data as { strataPackaging?: StrataPackagingRecord } | undefined)?.strataPackaging;
  if (!current?.caseId || !isStrataConfigured()) return current;
  const res = await strataFetch(`/api/v1/integrations/nexus/cases/${current.caseId}`);
  if (!res.ok) return current;
  const body = (await res.json()) as StrataCaseResponse;
  const record: StrataPackagingRecord = {
    ...current,
    title: body.title || current.title,
    workspaceUrl: body.workspace_url || current.workspaceUrl,
    launchUrl: body.launch_url || current.launchUrl,
    embedPath: embedPathFromLaunch(body.launch_url) || current.embedPath,
    completeness: body.completeness,
    status: "ready",
    updatedAt: new Date().toISOString(),
  };
  await storage.upsertDueDiligence(prospectId, userId, {
    ...(existing?.data || {}),
    strataPackaging: record,
  } as DueDiligenceData);
  return record;
}

export async function getStrataCase(caseId: string) {
  const res = await strataFetch(`/api/v1/integrations/nexus/cases/${caseId}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail || `Strata case ${res.status}`);
  }
  return body;
}

export async function patchStrataCase(caseId: string, payload: Record<string, unknown>, title?: string) {
  const res = await strataFetch(`/api/v1/integrations/nexus/cases/${caseId}`, {
    method: "PATCH",
    body: JSON.stringify({ payload, title }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail || `Strata save ${res.status}`);
  }
  return body;
}

export async function generateStrataPack(caseId: string) {
  const res = await strataFetch(`/api/v1/integrations/nexus/cases/${caseId}/pack`, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail || `Pack failed (${res.status})`);
  }
  return {
    ...(body as { filename: string; download: string }),
    download: `/api/v1/integrations/nexus/cases/${caseId}/pack/download?file=${encodeURIComponent((body as { filename?: string }).filename || "")}`,
  };
}

export async function downloadStrataPack(caseId: string, file: string) {
  const res = await strataFetch(
    `/api/v1/integrations/nexus/cases/${caseId}/pack/download?file=${encodeURIComponent(file)}`
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail || `Download failed (${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return { filename: file, buffer, contentType: res.headers.get("content-type") || "application/zip" };
}
