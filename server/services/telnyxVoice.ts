import type { AgenticDealFile, AgenticEvent } from "@shared/agenticWorkflow";
import { TELNYX_TRANSFER_NUMBER, type CallOutcome } from "@shared/telnyxVoice";

export type LookupResult = {
  id: number;
  companyName: string;
  stage: string;
  source: string;
  contactName?: string;
  missing: string[];
};

export type CallLogEvent = {
  at: string;
  callControlId?: string;
  assistant: "sophie" | "james";
  outcome: CallOutcome;
  recordingUrl?: string;
  transcript?: string;
};

/** AgenticEvent plus Telnyx hangup/tool payload. Narrow deal.events with isTelnyxCallEvent. */
export type TelnyxCallEvent = AgenticEvent & CallLogEvent;

export function isTelnyxCallEvent(event: AgenticEvent): event is TelnyxCallEvent {
  const row = event as Partial<CallLogEvent>;
  return (
    (row.assistant === "sophie" || row.assistant === "james") &&
    typeof row.outcome === "string"
  );
}

export function normaliseUkCli(input: string): string {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("44")) return `+${digits}`;
  if (digits.startsWith("0")) return `+44${digits.slice(1)}`;
  return `+44${digits}`;
}

export function packStatusForDeal(deal: Pick<AgenticDealFile, "sfp" | "events">): {
  missing: string[];
  note?: string;
} {
  if (Array.isArray(deal.sfp?.missing)) {
    return { missing: deal.sfp.missing };
  }
  const fromEvents = missingNamesFromEvents(deal.events);
  if (fromEvents) return { missing: fromEvents };
  return { missing: [], note: "no pack checklist on file" };
}

export function transferInstruction(): { destination: "+447898789313" } {
  return { destination: TELNYX_TRANSFER_NUMBER as "+447898789313" };
}

export function createTelnyxVoiceService(deps: {
  listDeals: () => Promise<AgenticDealFile[]>;
  getDeal: (id: number) => Promise<AgenticDealFile | undefined>;
  saveDeal: (deal: AgenticDealFile) => Promise<void>;
}) {
  return {
    async lookupDealByCli(cli: string): Promise<LookupResult | null> {
      const target = normaliseUkCli(cli);
      if (!target) return null;
      const deals = await deps.listDeals();
      const deal = deals.find((row) => row.phone && normaliseUkCli(row.phone) === target);
      if (!deal) return null;
      return {
        id: deal.id,
        companyName: deal.companyName,
        stage: deal.stage,
        source: deal.source,
        contactName: deal.contactName,
        missing: packStatusForDeal(deal).missing,
      };
    },
    packStatusForDeal,
    async appendCallEvent(dealId: number, event: CallLogEvent): Promise<void> {
      const existing = await requireDeal(deps.getDeal, dealId);
      await deps.saveDeal({
        ...existing,
        events: [...(existing.events || []), callEvent(existing, event)],
        updatedAt: event.at,
      });
    },
    async optOutDeal(dealId: number): Promise<void> {
      const existing = await requireDeal(deps.getDeal, dealId);
      await deps.saveDeal({
        ...existing,
        events: [
          ...(existing.events || []),
          {
            at: new Date().toISOString(),
            stage: existing.stage,
            message: "telnyx_opt_out",
          },
        ],
        updatedAt: new Date().toISOString(),
      });
    },
    transferInstruction,
  };
}

async function requireDeal(
  getDeal: (id: number) => Promise<AgenticDealFile | undefined>,
  dealId: number
): Promise<AgenticDealFile> {
  const deal = await getDeal(dealId);
  if (!deal) throw new Error("Deal file not found");
  return deal;
}

function callEvent(deal: AgenticDealFile, event: CallLogEvent): TelnyxCallEvent {
  return {
    at: event.at,
    stage: deal.stage,
    agent: event.assistant,
    message: event.outcome,
    callControlId: event.callControlId,
    assistant: event.assistant,
    outcome: event.outcome,
    recordingUrl: event.recordingUrl,
    transcript: event.transcript,
  };
}

function missingNamesFromEvents(events: AgenticEvent[] | undefined): string[] | null {
  if (!events?.length) return null;
  for (let i = events.length - 1; i >= 0; i--) {
    const match = String(events[i]?.message || "").match(/missing:\s*(.+)$/i);
    if (!match) continue;
    const names = match[1]
      .split(";")
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length) return names;
  }
  return null;
}
