import { generateKeyPairSync, sign } from "crypto";
import { describe, expect, it } from "vitest";
import type { AgenticDealFile } from "@shared/agenticWorkflow";
import { warmAutodialCandidates } from "@shared/telnyxVoice";
import { createTelnyxVoiceService } from "../../services/telnyxVoice";

function deal(overrides: Partial<AgenticDealFile> = {}): AgenticDealFile {
  return {
    id: 1,
    source: "strata_inbound",
    stage: "fulfilment",
    status: "running",
    ownerUserId: "test",
    companyName: "Acme Joinery Ltd",
    contactName: "Pat Smith",
    phone: "0115 661 1616",
    events: [],
    createdAt: "2026-08-27T10:00:00.000Z",
    updatedAt: "2026-08-27T10:00:00.000Z",
    ...overrides,
  };
}

function memoryStore(initial: AgenticDealFile[]) {
  const deals = new Map(initial.map((row) => [row.id, structuredClone(row)]));
  return {
    listDeals: async () => [...deals.values()],
    getDeal: async (id: number) => deals.get(id),
    saveDeal: async (row: AgenticDealFile) => {
      deals.set(row.id, row);
    },
    snapshot: (id: number) => deals.get(id),
  };
}

function signedHangup(from = "+441156611616") {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const timestamp = "1690000000";
  const rawBody = JSON.stringify({
    data: {
      event_type: "call.hangup",
      payload: { from, call_control_id: "cc-1", direction: "incoming" },
    },
  });
  const signatureB64 = sign(null, Buffer.from(`${timestamp}|${rawBody}`), privateKey).toString("base64");
  return { publicKeyPem, timestamp, signatureB64, rawBody };
}

describe("click-to-call", () => {
  it("rejects click-to-call when flag off", async () => {
    const { clickToCall } = await import("../../routes/telnyxVoice");
    const res = await clickToCall({ flags: { clickToCall: false } });
    expect(res.status).toBe(403);
  });

  it("returns click-to-call disabled body", async () => {
    const { clickToCall } = await import("../../routes/telnyxVoice");
    const res = await clickToCall({ flags: { clickToCall: false } });
    expect(res.body).toEqual({ error: "click-to-call disabled" });
  });

  it("placeOutboundCall throws disabled unless flag on", async () => {
    const { placeOutboundCall } = await import("../../routes/telnyxVoice");
    await expect(placeOutboundCall({ flags: { clickToCall: false }, dealId: 1 })).rejects.toThrow(
      "disabled"
    );
    await expect(placeOutboundCall({ flags: { clickToCall: true }, dealId: 1 })).resolves.toBeUndefined();
  });
});

describe("telnyx webhook", () => {
  it("rejects invalid signature", async () => {
    const { handleTelnyxWebhook } = await import("../../routes/telnyxVoice");
    const keys = signedHangup();
    const res = await handleTelnyxWebhook({
      ...keys,
      signatureB64: Buffer.from("tampered-signature").toString("base64"),
    });
    expect(res.status).toBe(401);
  });

  it("returns 503 when public key is missing", async () => {
    const { handleTelnyxWebhook } = await import("../../routes/telnyxVoice");
    const res = await handleTelnyxWebhook({
      publicKeyPem: "",
      timestamp: "1690000000",
      signatureB64: "AAAA",
      rawBody: `{"data":{"event_type":"call.hangup"}}`,
    });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "telnyx public key missing" });
  });

  it("returns 204 on hangup after appendCallEvent", async () => {
    const { handleTelnyxWebhook } = await import("../../routes/telnyxVoice");
    const store = memoryStore([deal()]);
    const voice = createTelnyxVoiceService(store);
    const res = await handleTelnyxWebhook(signedHangup(), { voice, listDeals: store.listDeals });
    expect(res.status).toBe(204);
    expect(store.snapshot(1)?.events.at(-1)?.message).toBe("connected");
  });
});

describe("telnyx tools", () => {
  it("returns 404 for unknown tool name", async () => {
    const { handleTelnyxTool } = await import("../../routes/telnyxVoice");
    const res = await handleTelnyxTool("notATool", {});
    expect(res.status).toBe(404);
  });

  it("lookupDeal returns found false when no match", async () => {
    const { handleTelnyxTool } = await import("../../routes/telnyxVoice");
    const store = memoryStore([deal({ phone: "07898789313" })]);
    const voice = createTelnyxVoiceService(store);
    const res = await handleTelnyxTool(
      "lookupDeal",
      { from: "0115 661 1616" },
      { voice, listDeals: store.listDeals }
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ found: false });
  });

  it("lookupDeal finds by CLI and company name", async () => {
    const { handleTelnyxTool } = await import("../../routes/telnyxVoice");
    const store = memoryStore([deal()]);
    const voice = createTelnyxVoiceService(store);
    const deps = { voice, listDeals: store.listDeals };
    const byCli = await handleTelnyxTool("lookupDeal", { from: "0115 661 1616" }, deps);
    expect(byCli.body).toMatchObject({
      found: true,
      deal: { id: 1, companyName: "Acme Joinery Ltd" },
    });
    const byName = await handleTelnyxTool("lookupDeal", { companyName: "acme joinery ltd" }, deps);
    expect(byName.body).toMatchObject({ found: true, deal: { id: 1 } });
  });

  it("transferToShaun returns Shaun's number", async () => {
    const { handleTelnyxTool } = await import("../../routes/telnyxVoice");
    const res = await handleTelnyxTool("transferToShaun", {});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ destination: "+447898789313" });
  });

  it("packStatus, logOutcome, and optOut write through the voice service", async () => {
    const { handleTelnyxTool } = await import("../../routes/telnyxVoice");
    const store = memoryStore([
      deal({
        sfp: {
          status: "PARTIAL",
          missing: ["Bank statements"],
          documents: [],
          figures: {},
        },
      }),
    ]);
    const voice = createTelnyxVoiceService(store);
    const deps = { voice, listDeals: store.listDeals };

    const pack = await handleTelnyxTool("packStatus", { dealId: 1 }, deps);
    expect(pack.body).toEqual({ missing: ["Bank statements"] });

    const logged = await handleTelnyxTool(
      "logOutcome",
      { dealId: 1, outcome: "connected", transcript: "hello" },
      deps
    );
    expect(logged.status).toBe(200);
    expect(store.snapshot(1)?.events.some((event) => event.message === "connected")).toBe(true);

    const opted = await handleTelnyxTool("optOut", { dealId: 1 }, deps);
    expect(opted.status).toBe(200);
    expect(store.snapshot(1)?.events.map((event) => event.message)).toContain("telnyx_opt_out");
  });
});

describe("warm autodial candidates", () => {
  it("filters a mixed list to inbound only — Stream A never included", () => {
    const mixed = [
      { id: 1, source: "strata_inbound" },
      { id: 2, source: "distress_scan" },
      { id: 3, source: "strata_inbound" },
    ];
    expect(warmAutodialCandidates(mixed).map((row) => row.id)).toEqual([1, 3]);
  });
});
