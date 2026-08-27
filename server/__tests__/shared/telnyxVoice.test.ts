import { describe, expect, it } from "vitest";
import {
  INBOUND_OPENER,
  outboundOpener,
  telnyxFlags,
  pickAssistant,
  outboundGate,
  warmAutodialGate,
} from "@shared/telnyxVoice";

describe("telnyxVoice copy", () => {
  it("inbound opener includes recording notice", () => {
    expect(INBOUND_OPENER).toBe(
      "Thank you for calling Strata. How can I help you today? This call is recorded for training and compliance purposes."
    );
  });

  it("outbound opener has no recording sentence", () => {
    expect(outboundOpener("Sophie")).toBe(
      "Hello, it’s Sophie calling from Strata. Is now a convenient time?"
    );
    expect(outboundOpener("James")).not.toMatch(/recorded/i);
  });
});

describe("telnyxFlags", () => {
  it("defaults click-to-call, whatsapp, and autodial off", () => {
    expect(telnyxFlags({})).toEqual({
      inbound: false,
      clickToCall: false,
      whatsapp: false,
      warmAutodial: false,
    });
  });

  it("enables inbound only when TELNYX_INBOUND_ENABLED is true", () => {
    expect(telnyxFlags({ TELNYX_INBOUND_ENABLED: "true" }).inbound).toBe(true);
  });
});

describe("pickAssistant", () => {
  it("uses sophie for inbound", () => {
    expect(pickAssistant({ direction: "inbound" })).toBe("sophie");
  });

  it("uses sophie for outbound inbound-source files", () => {
    expect(pickAssistant({ direction: "outbound", source: "strata_inbound" })).toBe("sophie");
  });

  it("uses james for outbound distress_scan", () => {
    expect(pickAssistant({ direction: "outbound", source: "distress_scan" })).toBe("james");
  });
});

describe("outboundGate", () => {
  const okBase = {
    phone: "+441156611616",
    e164: true,
    stopListed: false,
    tpsClear: true,
    ctpsClear: true,
    sig06: false,
    consumerOrSoleTrader: false,
    optedOut: false,
    complaint: false,
    vulnerability: false,
    solicitor: false,
    now: new Date("2026-08-27T10:00:00+01:00"),
  };

  it("allows a weekday morning UK call", () => {
    expect(outboundGate(okBase)).toEqual({ ok: true });
  });

  it("blocks outside 09:00-17:00 Europe/London", () => {
    expect(outboundGate({ ...okBase, now: new Date("2026-08-27T18:30:00+01:00") }).ok).toBe(false);
  });

  it("blocks weekend", () => {
    expect(outboundGate({ ...okBase, now: new Date("2026-08-29T10:00:00+01:00") }).ok).toBe(false);
  });

  it("blocks TPS, stop list, SIG-06, sole trader, opt-out", () => {
    expect(outboundGate({ ...okBase, tpsClear: false }).ok).toBe(false);
    expect(outboundGate({ ...okBase, stopListed: true }).ok).toBe(false);
    expect(outboundGate({ ...okBase, sig06: true }).ok).toBe(false);
    expect(outboundGate({ ...okBase, consumerOrSoleTrader: true }).ok).toBe(false);
    expect(outboundGate({ ...okBase, optedOut: true }).ok).toBe(false);
  });
});

describe("warmAutodialGate", () => {
  const okBase = {
    phone: "+441234567890",
    e164: true,
    stopListed: false,
    tpsClear: true,
    ctpsClear: true,
    sig06: false,
    consumerOrSoleTrader: false,
    optedOut: false,
    complaint: false,
    vulnerability: false,
    solicitor: false,
    now: new Date("2026-08-27T10:00:00+01:00"),
    source: "strata_inbound",
  };

  it("allows inbound source", () => {
    expect(warmAutodialGate(okBase)).toEqual({ ok: true });
  });

  it("never auto-dials distress_scan / Stream A", () => {
    expect(warmAutodialGate({ ...okBase, source: "distress_scan" }).ok).toBe(false);
  });
});
