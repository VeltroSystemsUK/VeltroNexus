import { describe, expect, it } from "vitest";
import type { AgenticDealFile } from "@shared/agenticWorkflow";
import {
  createTelnyxVoiceService,
  isTelnyxCallEvent,
  normaliseUkCli,
  packStatusForDeal,
} from "../../services/telnyxVoice";

describe("normaliseUkCli", () => {
  it("turns 0115 661 1616 into +441156611616", () => {
    expect(normaliseUkCli("0115 661 1616")).toBe("+441156611616");
  });
  it("keeps E.164", () => {
    expect(normaliseUkCli("+441156611616")).toBe("+441156611616");
  });
  it("maps 07 mobiles to +447", () => {
    expect(normaliseUkCli("07898789313")).toBe("+447898789313");
  });
});

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

describe("createTelnyxVoiceService", () => {
  it("lookupDealByCli finds by normalised phone", async () => {
    const store = memoryStore([deal()]);
    const voice = createTelnyxVoiceService(store);
    const found = await voice.lookupDealByCli("+441156611616");
    expect(found).toEqual({
      id: 1,
      companyName: "Acme Joinery Ltd",
      stage: "fulfilment",
      source: "strata_inbound",
      contactName: "Pat Smith",
      missing: [],
    });
  });

  it("lookupDealByCli returns null when no phone matches", async () => {
    const store = memoryStore([deal({ phone: "07898789313" })]);
    const voice = createTelnyxVoiceService(store);
    expect(await voice.lookupDealByCli("0115 661 1616")).toBeNull();
  });

  it("optOutDeal appends an event with message telnyx_opt_out", async () => {
    const store = memoryStore([deal()]);
    const voice = createTelnyxVoiceService(store);
    await voice.optOutDeal(1);
    expect(store.snapshot(1)?.events.map((event) => event.message)).toContain("telnyx_opt_out");
  });

  it("appendCallEvent appends outcome", async () => {
    const store = memoryStore([deal()]);
    const voice = createTelnyxVoiceService(store);
    await voice.appendCallEvent(1, {
      at: "2026-08-27T10:05:00.000Z",
      assistant: "sophie",
      outcome: "connected",
      callControlId: "cc-1",
      recordingUrl: "https://example/rec",
      transcript: "hello",
    });
    const last = store.snapshot(1)?.events.at(-1);
    expect(last?.message).toBe("connected");
    expect(last?.at).toBe("2026-08-27T10:05:00.000Z");
    expect(last && isTelnyxCallEvent(last)).toBe(true);
    if (!last || !isTelnyxCallEvent(last)) return;
    expect(last.outcome).toBe("connected");
    expect(last.assistant).toBe("sophie");
    expect(last.callControlId).toBe("cc-1");
    expect(last.recordingUrl).toBe("https://example/rec");
    expect(last.transcript).toBe("hello");
  });

  it("transferInstruction destination is +447898789313", () => {
    const voice = createTelnyxVoiceService(memoryStore([]));
    expect(voice.transferInstruction().destination).toBe("+447898789313");
  });
});

describe("packStatusForDeal", () => {
  it("does not invent pack items when no checklist is on the file", () => {
    expect(packStatusForDeal(deal())).toEqual({
      missing: [],
      note: "no pack checklist on file",
    });
  });

  it("returns names already stored on the file", () => {
    expect(
      packStatusForDeal(
        deal({
          sfp: {
            status: "PARTIAL",
            missing: ["Bank statements", "Cashflow forecast"],
            documents: [],
            figures: {},
          },
        })
      )
    ).toEqual({ missing: ["Bank statements", "Cashflow forecast"] });
  });
});
