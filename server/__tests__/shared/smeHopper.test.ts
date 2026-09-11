import { describe, expect, it } from "vitest";
import {
  compareSendable,
  gradeMailbox,
  hopperCounts,
  hopperStatusLine,
  isContactableDeal,
  isProtectedFromQuarantine,
  isRoleMailbox,
  isSendableContact,
  isSmeHopperSendable,
  rankSendable,
  sendableShortfall,
  smeHuntNeed,
  SME_HOPPER_TARGET,
} from "@shared/smeHopper";

describe("sendable contact", () => {
  it("prefers a director mailbox and accepts a role mailbox as fallback", () => {
    expect(gradeMailbox({ email: "adam@petshop.co.uk", contactName: "Adam Taylor", directorNames: ["Adam Taylor"] })).toBe("director");
    expect(gradeMailbox({ email: "info@petshop.co.uk", contactName: "Adam Taylor", directorNames: ["Adam Taylor"] })).toBe("role");
    expect(gradeMailbox({ email: "ops@petshop.co.uk", contactName: "Sam", directorNames: ["Adam Taylor"] })).toBe("role");
    expect(gradeMailbox({ email: "adam@gmail.com", contactName: "Adam Taylor", directorNames: ["Adam Taylor"] })).toBe("reject");
    expect(isSendableContact({ email: "adam@petshop.co.uk", contactName: "Adam Taylor", directorNames: ["Adam Taylor"] })).toBe(true);
    expect(isSendableContact({ email: "info@petshop.co.uk", contactName: "Adam Taylor", directorNames: ["Adam Taylor"] })).toBe(true);
    expect(isSendableContact({ email: "adam@gmail.com", contactName: "Adam Taylor", directorNames: ["Adam Taylor"] })).toBe(false);
    expect(isRoleMailbox("enquiries@joinery.co.uk")).toBe(true);
    expect(
      gradeMailbox({
        email: "enquiries@companieshouse.gov.uk",
        contactName: "Jawad Moin MEHROOF",
        directorNames: ["Jawad Moin MEHROOF"],
      })
    ).toBe("reject");
    expect(
      gradeMailbox({
        email: "enquiries@hmrc.gov.uk",
        contactName: "Alex",
        directorNames: ["Alex Director"],
      })
    ).toBe("reject");
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
    expect(
      isSendableContact({
        email: "info@senadgroup.com",
        contactName: "James",
        directorNames: ["James Atkinson"],
        companyName: "WINSLOW COURT LTD",
      })
    ).toBe(false);
    expect(
      isSendableContact({
        email: "p.cobb@slidinghead.com",
        contactName: "Paul Cobb",
        directorNames: ["Paul Cobb"],
        companyName: "Hemlock Engineering Ltd",
      })
    ).toBe(true);
    expect(
      isSendableContact({
        email: "sales@btscars.co.uk",
        contactName: "Csongor",
        directorNames: ["Csongor BOTOS"],
        companyName: "BTS CARS LTD",
      })
    ).toBe(true);
    expect(
      isSendableContact({
        email: "christopher.down@khengineeringservices.co.uk",
        contactName: "Alexandra Nelia BADEL",
        directorNames: ["Alexandra Nelia BADEL", "Christian KEEN"],
        companyName: "KH Engineering Services",
      })
    ).toBe(true);
  });

  it("grades a company-matching named inbox as director when officers do not match the local-part", () => {
    expect(
      gradeMailbox({
        email: "steve.holden@o-i.com",
        contactName: "Unknown",
        directorNames: ["Jane Smith"],
        companyName: "O-I Glass Limited",
      })
    ).toBe("director");
    expect(
      isContactableDeal({
        source: "distress_scan",
        email: "steve.holden@o-i.com",
        contactName: "Unknown",
        directorNames: ["Jane Smith"],
        companyName: "O-I Glass Limited",
      })
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

  it("counts states and shortfall against 240 deliverables", () => {
    expect(SME_HOPPER_TARGET).toBe(240);
    const deals = [
      { hopper: "sendable" as const },
      { hopper: "sendable" as const },
      { hopper: "hunt_contact" as const },
      { hopper: "parked" as const },
      { hopper: "gated" as const },
      { hopper: "quarantine" as const },
      { source: "strata_inbound" as const },
    ];
    expect(hopperCounts(deals)).toEqual({ sendable: 2, huntContact: 1, parked: 1, gated: 1, quarantine: 1 });
    expect(sendableShortfall(deals)).toBe(238);
  });

  it("treats missing hopper as not sendable", () => {
    expect(hopperCounts([{ source: "distress_scan" }])).toEqual({
      sendable: 0,
      huntContact: 0,
      parked: 0,
      gated: 0,
      quarantine: 0,
    });
  });

  it("isSmeHopperSendable is true only for sendable hopper files", () => {
    expect(isSmeHopperSendable({ hopper: "sendable" })).toBe(true);
    expect(isSmeHopperSendable({ hopper: "hunt_contact" })).toBe(false);
    expect(isSmeHopperSendable({ hopper: "sendable", source: "strata_inbound" })).toBe(false);
    expect(isSmeHopperSendable({ hopper: "gated" })).toBe(false);
    expect(isSmeHopperSendable({ hopper: "queued" })).toBe(false);
    expect(isSmeHopperSendable({ hopper: "parked" })).toBe(false);
    expect(isSmeHopperSendable({ hopper: "quarantine" })).toBe(false);
  });

  it("hopperStatusLine formats sendable/hunt-contact/quarantine counts", () => {
    expect(hopperStatusLine([{ hopper: "sendable" }, { hopper: "hunt_contact" }, { hopper: "quarantine" }])).toBe(
      "Hopper 1/240 sendable · 1 hunt-contact · 1 quarantine"
    );
  });
});

describe("quarantine protection", () => {
  it("never quarantines mailed, inbound, pack, or introducer files", () => {
    expect(isProtectedFromQuarantine({ source: "strata_inbound", hopper: "hunt_contact" })).toBe(true);
    expect(isProtectedFromQuarantine({ source: "distress_scan", stream: "introducer", hopper: "gated" })).toBe(true);
    expect(isProtectedFromQuarantine({ source: "distress_scan", stream: "sme", outreachTouch: 1, hopper: "queued" })).toBe(true);
    expect(isProtectedFromQuarantine({ source: "distress_scan", stream: "sme", stage: "fulfilment", hopper: "queued" })).toBe(true);
    expect(isProtectedFromQuarantine({ source: "distress_scan", stream: "sme", packDocuments: [{ id: "1" }], hopper: "hunt_contact" })).toBe(true);
    expect(isProtectedFromQuarantine({ source: "distress_scan", stream: "sme", hopper: "hunt_contact", outreachTouch: 0, stage: "ingest" })).toBe(false);
  });
});

describe("hunt need", () => {
  it("scans until 240 deliverables, counting unsent sendable toward the day", () => {
    expect(smeHuntNeed({ sendableUnsent: 6, remainingSlots: 240 })).toBe(234);
    expect(smeHuntNeed({ sendableUnsent: 0, remainingSlots: 50 })).toBe(50);
    expect(smeHuntNeed({ sendableUnsent: 240, remainingSlots: 240 })).toBe(0);
  });
});
