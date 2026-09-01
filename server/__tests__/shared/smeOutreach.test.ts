import { describe, expect, it } from "vitest";
import { cadenceAfterOutreach } from "@shared/outreachSend";
import { isSmeHopperSendable, rankSendable } from "@shared/smeHopper";
import {
  INTRODUCER_OUTREACH_PAUSED,
  SME_DAILY_FIRST_TOUCH_CAP,
  isDirectSmeOutreachCandidate,
  isWaitingSmeEmailApproval,
  londonDayKey,
  mergeSmeCandidatePools,
  pickSmeHopperOrLegacy,
  pickSmeOutreachBatch,
  remainingSmeFirstTouchSlots,
  shouldProcessAgenticTick,
  smeEmailNeedsApproval,
} from "@shared/smeOutreach";

describe("introducer pause", () => {
  it("pauses introducer origination and in-flight ticks until the flag is lifted", () => {
    expect(INTRODUCER_OUTREACH_PAUSED).toBe(true);
    expect(
      shouldProcessAgenticTick({
        stage: "outreach",
        status: "waiting_timer",
        source: "distress_scan",
        stream: "introducer",
      })
    ).toBe(false);
    expect(
      shouldProcessAgenticTick({
        stage: "fulfilment",
        status: "waiting_timer",
        source: "distress_scan",
        stream: "introducer",
      })
    ).toBe(false);
  });

  it("still ticks due SME outreach and inbound fulfilment", () => {
    expect(
      shouldProcessAgenticTick({
        stage: "outreach",
        status: "waiting_timer",
        source: "distress_scan",
        stream: "sme",
      })
    ).toBe(true);
    expect(
      shouldProcessAgenticTick({
        stage: "fulfilment",
        status: "waiting_timer",
        source: "strata_inbound",
        stream: "inbound",
      })
    ).toBe(true);
  });
});

describe("SME first-touch cap", () => {
  it("is 50 first-touches per London day", () => {
    expect(SME_DAILY_FIRST_TOUCH_CAP).toBe(50);
    expect(londonDayKey(new Date("2026-09-01T23:30:00.000Z"))).toBe("2026-09-02");
    expect(londonDayKey(new Date("2026-09-01T07:00:00.000Z"))).toBe("2026-09-01");
  });

  it("counts waiting approvals plus Day-1 sends today against the cap, not follow-ups", () => {
    const now = new Date("2026-09-01T12:00:00.000Z");
    const deals = [
      {
        stream: "sme" as const,
        source: "distress_scan" as const,
        status: "waiting_human" as const,
        humanReason: "Approve this email to ops@joinery.co.uk before it sends.",
        outreachTouch: 0,
        createdAt: "2026-09-01T08:00:00.000Z",
        events: [{ at: "2026-09-01T08:00:00.000Z", stage: "outreach" as const, message: "Day 1 email drafted for approval" }],
      },
      {
        stream: "sme" as const,
        source: "distress_scan" as const,
        status: "waiting_timer" as const,
        outreachTouch: 1,
        outreachTouchId: "sme_1",
        createdAt: "2026-09-01T09:00:00.000Z",
        events: [{ at: "2026-09-01T09:05:00.000Z", stage: "outreach" as const, message: "Day 1 email to ops@works.co.uk: first touch" }],
      },
      {
        stream: "sme" as const,
        source: "distress_scan" as const,
        status: "waiting_timer" as const,
        outreachTouch: 3,
        outreachTouchId: "sme_2",
        createdAt: "2026-08-20T09:00:00.000Z",
        events: [{ at: "2026-09-01T10:00:00.000Z", stage: "fulfilment" as const, message: "Day 8 email to old@file.co.uk" }],
      },
      {
        stream: "introducer" as const,
        source: "distress_scan" as const,
        status: "waiting_human" as const,
        humanReason: "Approve this email to partner@accountants.co.uk before it sends.",
        outreachTouch: 0,
        createdAt: "2026-09-01T08:00:00.000Z",
        events: [],
      },
    ];
    expect(remainingSmeFirstTouchSlots({ deals, now })).toBe(48);
  });
});

describe("direct SME candidate picker", () => {
  it("drops introducers, brokers, excluded sectors, personal mailboxes and nameless rows", () => {
    expect(
      isDirectSmeOutreachCandidate({
        companyName: "Smith Accountants Ltd",
        companyNumber: "12345678",
        email: "hello@smithaccountants.co.uk",
        sicCodes: ["69201"],
      })
    ).toBe(false);
    expect(
      isDirectSmeOutreachCandidate({
        companyName: "Midlands Finance Brokers Ltd",
        companyNumber: "12345678",
        email: "deals@mfb.co.uk",
      })
    ).toBe(false);
    expect(
      isDirectSmeOutreachCandidate({
        companyName: "Lets Ltd",
        companyNumber: "12345678",
        email: "info@lets.co.uk",
        sicCodes: ["68209"],
      })
    ).toBe(false);
    expect(
      isDirectSmeOutreachCandidate({
        companyName: "Cafe Ltd",
        companyNumber: "12345678",
        email: "owner@gmail.com",
        sicCodes: ["56101"],
      })
    ).toBe(false);
    expect(
      isDirectSmeOutreachCandidate({
        companyName: "Cafe Ltd",
        companyNumber: "WEB-1",
        email: "ops@cafe.co.uk",
        sicCodes: ["56101"],
      })
    ).toBe(false);
  });

  it("keeps a trading SME with a corporate mailbox, and prefers distressed rows with email", () => {
    expect(
      isDirectSmeOutreachCandidate({
        companyName: "Acme Joinery Ltd",
        companyNumber: "01234567",
        email: "ops@acmejoinery.co.uk",
        sicCodes: ["16230"],
      })
    ).toBe(true);

    const picked = pickSmeOutreachBatch({
      candidates: [
        {
          companyName: "Quiet Ltd",
          companyNumber: "11111111",
          email: "hello@quiet.co.uk",
          sicCodes: ["56101"],
        },
        {
          companyName: "Pressed Ltd",
          companyNumber: "22222222",
          email: "ops@pressed.co.uk",
          sicCodes: ["56101"],
          lenders: ["Iwoca"],
        },
        {
          companyName: "No Mail Ltd",
          companyNumber: "33333333",
          sicCodes: ["56101"],
          lenders: ["Iwoca"],
        },
        {
          companyName: "Already Open Ltd",
          companyNumber: "44444444",
          email: "ops@open.co.uk",
          sicCodes: ["56101"],
        },
      ],
      seenNumbers: new Set(["44444444"]),
      limit: 2,
    });
    expect(picked.map((row) => row.companyNumber)).toEqual(["22222222", "11111111"]);
  });

  it("puts local Leads ahead of the finder scrape among equal-rank rows", () => {
    const local = [
      { companyName: "Fed Ltd", companyNumber: "55555555", email: "ops@fed.co.uk", sicCodes: ["16230"] },
    ];
    const finder = [
      { companyName: "Scraped Ltd", companyNumber: "66666666", email: "ops@scraped.co.uk", sicCodes: ["16230"] },
    ];
    const picked = pickSmeOutreachBatch({
      candidates: mergeSmeCandidatePools(local, finder),
      limit: 1,
    });
    expect(picked.map((row) => row.companyNumber)).toEqual(["55555555"]);
  });

  it("Queue SME emails only drains sendable hopper files", () => {
    expect(isSmeHopperSendable({ hopper: "sendable" })).toBe(true);
    expect(isSmeHopperSendable({ hopper: "hunt_contact" })).toBe(false);
    expect(isSmeHopperSendable({ hopper: "sendable", source: "strata_inbound", email: "a@in.co.uk" })).toBe(false);

    const hopper = rankSendable(
      [
        {
          companyName: "Inbound Ltd",
          companyNumber: "1",
          email: "a@in.co.uk",
          sicCodes: ["16230"],
          hopper: "sendable" as const,
          source: "strata_inbound",
        },
        {
          companyName: "Hunt Ltd",
          companyNumber: "2",
          email: "ops@hunt.co.uk",
          sicCodes: ["16230"],
          hopper: "hunt_contact" as const,
          source: "distress_scan",
        },
        {
          companyName: "Ready Ltd",
          companyNumber: "3",
          email: "ops@ready.co.uk",
          sicCodes: ["16230"],
          hopper: "sendable" as const,
          source: "distress_scan",
          hasPetition: true,
        },
      ].filter(isSmeHopperSendable)
    );
    const picked = pickSmeHopperOrLegacy({
      hopperCandidates: hopper.map((row) => ({
        companyName: row.companyName,
        companyNumber: row.companyNumber,
        email: row.email,
        sicCodes: row.sicCodes,
      })),
      legacyCandidates: [
        { companyName: "Finder Ltd", companyNumber: "4", email: "ops@finder.co.uk", sicCodes: ["16230"] },
      ],
      limit: 50,
    });
    expect(picked.map((row) => row.companyNumber)).toEqual(["3"]);
  });

  it("does not fill from finder/local when hopper sendable is empty", () => {
    const picked = pickSmeHopperOrLegacy({
      hopperCandidates: [],
      legacyCandidates: [
        { companyName: "Finder Ltd", companyNumber: "4", email: "ops@finder.co.uk", sicCodes: ["16230"] },
      ],
      limit: 50,
    });
    expect(picked).toEqual([]);
  });
});

describe("SME email approval gate", () => {
  it("requires director approval before a cold SME email sends", () => {
    expect(smeEmailNeedsApproval({ stream: "sme", isLinkedIn: false })).toBe(true);
    expect(smeEmailNeedsApproval({ stream: "sme", isLinkedIn: true })).toBe(false);
    expect(smeEmailNeedsApproval({ stream: "inbound", isLinkedIn: false })).toBe(false);
    expect(
      cadenceAfterOutreach({
        autoSend: true,
        isLinkedIn: false,
        delivered: false,
        requireApproval: true,
        approved: false,
      })
    ).toBe("hold_approval");
    expect(
      cadenceAfterOutreach({
        autoSend: true,
        isLinkedIn: false,
        delivered: true,
        requireApproval: true,
        approved: true,
      })
    ).toBe("advance");
  });

  it("detects a file waiting for that approval", () => {
    expect(
      isWaitingSmeEmailApproval({
        stream: "sme",
        source: "distress_scan",
        status: "waiting_human",
        humanReason: "Approve this email to ops@joinery.co.uk before it sends.",
      })
    ).toBe(true);
    expect(
      isWaitingSmeEmailApproval({
        stream: "sme",
        source: "distress_scan",
        status: "waiting_human",
        humanReason: "Post the LinkedIn copy, then mark it posted.",
      })
    ).toBe(false);
  });
});
