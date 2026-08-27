export const TELNYX_DID = "+441156611616";
export const TELNYX_TRANSFER_NUMBER = "+447898789313";

export const INBOUND_OPENER =
  "Thank you for calling Strata. How can I help you today? This call is recorded for training and compliance purposes.";

export function outboundOpener(name: "Sophie" | "James"): string {
  return `Hello, it’s ${name} calling from Strata. Is now a convenient time?`;
}

export type CallOutcome =
  | "connected"
  | "no_answer"
  | "amd"
  | "callback"
  | "opt_out"
  | "transferred"
  | "pack_promised";

function truthy(v: string | undefined): boolean {
  return v === "true" || v === "1" || v === "yes";
}

export function telnyxFlags(env: NodeJS.Dict<string> = process.env) {
  return {
    inbound: truthy(env.TELNYX_INBOUND_ENABLED),
    clickToCall: truthy(env.TELNYX_CLICK_TO_CALL_ENABLED),
    whatsapp: truthy(env.TELNYX_WHATSAPP_ENABLED),
    warmAutodial: truthy(env.TELNYX_WARM_AUTODIAL_ENABLED),
  };
}

export function pickAssistant(input: {
  direction: "inbound" | "outbound";
  source?: string;
}): "sophie" | "james" {
  if (input.direction === "inbound") return "sophie";
  if (input.source === "strata_inbound") return "sophie";
  return "james";
}

export type OutboundGateInput = {
  phone?: string | null;
  e164?: boolean;
  stopListed?: boolean;
  tpsClear?: boolean;
  ctpsClear?: boolean;
  sig06?: boolean;
  consumerOrSoleTrader?: boolean;
  optedOut?: boolean;
  complaint?: boolean;
  vulnerability?: boolean;
  solicitor?: boolean;
  now?: Date;
  source?: string;
};

function londonParts(now: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function outboundGate(input: OutboundGateInput): { ok: true } | { ok: false; reason: string } {
  if (!input.phone) return { ok: false, reason: "no phone" };
  if (input.e164 === false) return { ok: false, reason: "not e164" };
  if (input.stopListed) return { ok: false, reason: "stop list" };
  if (input.tpsClear === false) return { ok: false, reason: "tps" };
  if (input.ctpsClear === false) return { ok: false, reason: "ctps" };
  if (input.sig06) return { ok: false, reason: "sig-06" };
  if (input.consumerOrSoleTrader) return { ok: false, reason: "consumer" };
  if (input.optedOut) return { ok: false, reason: "opt-out" };
  if (input.complaint) return { ok: false, reason: "complaint" };
  if (input.vulnerability) return { ok: false, reason: "vulnerability" };
  if (input.solicitor) return { ok: false, reason: "solicitor" };
  const { weekday, hour } = londonParts(input.now ?? new Date());
  if (weekday === "Sat" || weekday === "Sun") return { ok: false, reason: "weekend" };
  if (hour < 9 || hour >= 17) return { ok: false, reason: "outside hours" };
  return { ok: true };
}

export function warmAutodialGate(input: OutboundGateInput) {
  if (input.source !== "strata_inbound") return { ok: false as const, reason: "not warm inbound" };
  return outboundGate(input);
}
