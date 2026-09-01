import { describe, expect, it } from "vitest";
import {
  compareSendable,
  hopperCounts,
  hopperStatusLine,
  isRoleMailbox,
  isSendableContact,
  isSmeHopperSendable,
  rankSendable,
  sendableShortfall,
  SME_HOPPER_TARGET,
} from "@shared/smeHopper";

describe("sendable contact", () => {
  it("requires named director and corporate mailbox", () => {
    expect(isSendableContact({ email: "adam@petshop.co.uk", contactName: "Adam Taylor", directorNames: ["Adam Taylor"] })).toBe(true);
    expect(isSendableContact({ email: "info@petshop.co.uk", contactName: "Adam Taylor", directorNames: ["Adam Taylor"] })).toBe(false);
    expect(isSendableContact({ email: "adam@gmail.com", contactName: "Adam Taylor", directorNames: ["Adam Taylor"] })).toBe(false);
    expect(isSendableContact({ email: "ops@petshop.co.uk", contactName: "Sam", directorNames: ["Adam Taylor"] })).toBe(false);
    expect(isRoleMailbox("enquiries@joinery.co.uk")).toBe(true);
  });

  it("matches director first token or whole word, not substrings like Ann in Joanna", () => {
    expect(
      isSendableContact({ email: "ann@petshop.co.uk", contactName: "Ann", directorNames: ["Joanna Smith"] })
    ).toBe(false);
    expect(
      isSendableContact({ email: "ann@petshop.co.uk", contactName: "Ann Taylor", directorNames: ["Ann Taylor"] })
    ).toBe(true);
    expect(
      isSendableContact({ email: "ann@petshop.co.uk", contactName: "Ann", directorNames: ["Mary Ann Jones"] })
    ).toBe(true);
  });
});

describe("hopper rank", () => {
  it("orders hearing, petition, charge count, recency, then older company", () => {
    const ranked = rankSendable([
      { id: 1, hopper: "sendable", nonBankChargeCount: 1, lastSignalAt: "2026-08-01", incorporatedAt: "2018-01-01" },
      { id: 2, hopper: "sendable", nonBankChargeCount: 3, lastSignalAt: "2026-07-01", incorporatedAt: "2015-01-01" },
      { id: 3, hopper: "sendable", hasPetition: true, lastSignalAt: "2026-06-01", incorporatedAt: "2010-01-01" },
      { id: 4, hopper: "sendable", hasPetition: true, hearingAt: "2026-10-01", lastSignalAt: "2026-05-01", incorporatedAt: "2012-01-01" },
    ]);
    expect(ranked.map((d) => d.id)).toEqual([4, 3, 2, 1]);
  });

  it("counts states and shortfall against 250", () => {
    expect(SME_HOPPER_TARGET).toBe(250);
    const deals = [
      { hopper: "sendable" as const },
      { hopper: "sendable" as const },
      { hopper: "hunt_contact" as const },
      { hopper: "parked" as const },
      { hopper: "gated" as const },
      { source: "strata_inbound" as const },
    ];
    expect(hopperCounts(deals)).toEqual({ sendable: 2, huntContact: 1, parked: 1, gated: 1 });
    expect(sendableShortfall(deals)).toBe(248);
  });

  it("treats missing hopper as not sendable", () => {
    expect(hopperCounts([{ source: "distress_scan" }])).toEqual({
      sendable: 0,
      huntContact: 0,
      parked: 0,
      gated: 0,
    });
  });

  it("isSmeHopperSendable is true only for sendable hopper files", () => {
    expect(isSmeHopperSendable({ hopper: "sendable" })).toBe(true);
    expect(isSmeHopperSendable({ hopper: "hunt_contact" })).toBe(false);
    expect(isSmeHopperSendable({ hopper: "sendable", source: "strata_inbound" })).toBe(false);
    expect(isSmeHopperSendable({ hopper: "gated" })).toBe(false);
    expect(isSmeHopperSendable({ hopper: "queued" })).toBe(false);
    expect(isSmeHopperSendable({ hopper: "parked" })).toBe(false);
  });

  it("hopperStatusLine formats sendable/hunt-contact/parked counts", () => {
    expect(hopperStatusLine([{ hopper: "sendable" }, { hopper: "hunt_contact" }])).toBe(
      "Hopper 1/250 sendable · 1 hunt-contact · 0 parked"
    );
  });
});
