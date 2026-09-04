import { describe, expect, it } from "vitest";
import {
  OPENER_TOUCH2_DELAY_MS,
  applyOpenEvent,
  approveNurtureSend,
  canDragOpenerTo,
  canPromoteOpener,
  completeTouch2,
  daysSitting,
  emptyNurture,
  failNurtureSend,
  isTouch2Due,
  mergeOpeners,
  normalizeCompanyNumber,
  normalizeEmail,
  normalizeOpener,
  openedMailEvents,
  openerNurtureDraft,
  skipNurtureStep,
  startNurture,
  stopNurture,
  withDerivedNurture,
  type OpenerRecord,
} from "@shared/openers";

function opener(over: Partial<OpenerRecord> = {}): OpenerRecord {
  return normalizeOpener({
    id: "op-1",
    email: "ops@northpeak.co.uk",
    firstOpenedAt: "2026-09-01T10:00:00.000Z",
    lastOpenedAt: "2026-09-01T10:00:00.000Z",
    openCount: 1,
    ...over,
  });
}

describe("identity", () => {
  it("normalises email and company numbers", () => {
    expect(normalizeEmail("  Ops@NorthPeak.co.uk ")).toBe("ops@northpeak.co.uk");
    expect(normalizeCompanyNumber("8765432")).toBe("08765432");
    expect(normalizeCompanyNumber("SC123456")).toBe("SC123456");
  });
});

describe("days sitting", () => {
  it("uses lastTouchAt when set, otherwise lastOpenedAt", () => {
    const now = new Date("2026-09-10T10:00:00.000Z");
    expect(daysSitting(opener(), now)).toBe(9);
    expect(daysSitting(opener({ lastTouchAt: "2026-09-08T10:00:00.000Z" }), now)).toBe(2);
  });
});

describe("opens and merge", () => {
  it("bumps lastOpenedAt and openCount on a later open", () => {
    const next = applyOpenEvent(opener(), "2026-09-03T12:00:00.000Z", 2);
    expect(next.firstOpenedAt).toBe("2026-09-01T10:00:00.000Z");
    expect(next.lastOpenedAt).toBe("2026-09-03T12:00:00.000Z");
    expect(next.openCount).toBe(3);
  });

  it("merges two emails with the same company number into one card", () => {
    const a = opener({ email: "ops@northpeak.co.uk", companyNumber: "08765432", openCount: 2 });
    const b = opener({
      id: "op-2",
      email: "james@northpeak.co.uk",
      companyNumber: "08765432",
      firstOpenedAt: "2026-08-20T10:00:00.000Z",
      openCount: 3,
      prospectId: 99,
      status: "promoted",
    });
    const merged = mergeOpeners(a, b);
    expect(merged.firstOpenedAt).toBe("2026-08-20T10:00:00.000Z");
    expect(merged.openCount).toBe(5);
    expect(merged.emails.sort()).toEqual(["james@northpeak.co.uk", "ops@northpeak.co.uk"]);
    expect(merged.prospectId).toBe(99);
    expect(merged.status).toBe("promoted");
  });
});

describe("nurture", () => {
  it("start only writes a pending draft; approve send is what sets nurturing", () => {
    const draft = openerNurtureDraft(opener({ companyName: "Northpeak Joinery Ltd" }));
    expect(draft.html).toMatch(/We do not lend/i);
    const pending = startNurture(opener(), draft, new Date("2026-09-04T10:00:00.000Z"));
    expect(pending.status).toBe("new");
    expect(pending.nurture.touch1Status).toBe("pending_approval");
    expect(pending.nurture.touch1Draft?.subject).toBe(draft.subject);

    const sent = approveNurtureSend(pending, "mail-1", new Date("2026-09-04T10:05:00.000Z"));
    expect(sent.status).toBe("nurturing");
    expect(sent.nurture.step).toBe(1);
    expect(sent.nurture.touch1MailId).toBe("mail-1");
    expect(sent.lastTouchAt).toBe("2026-09-04T10:05:00.000Z");

    const again = approveNurtureSend(sent, "mail-2", new Date("2026-09-04T11:00:00.000Z"));
    expect(again.nurture.touch1MailId).toBe("mail-1");
  });

  it("failed send does not become nurturing; retry is allowed", () => {
    const pending = startNurture(opener(), openerNurtureDraft(opener()));
    const failed = failNurtureSend(pending);
    expect(failed.status).toBe("new");
    expect(failed.nurture.touch1Status).toBe("failed");
  });

  it("touch 2 is due 3 days after touch 1 send", () => {
    const sent = approveNurtureSend(
      startNurture(opener(), openerNurtureDraft(opener()), new Date("2026-09-04T10:00:00.000Z")),
      "mail-1",
      new Date("2026-09-04T10:00:00.000Z")
    );
    expect(isTouch2Due(sent, new Date("2026-09-06T10:00:00.000Z"))).toBe(false);
    expect(isTouch2Due(sent, new Date("2026-09-07T10:00:00.000Z"))).toBe(true);
    expect(OPENER_TOUCH2_DELAY_MS).toBe(3 * 24 * 60 * 60 * 1000);
    expect(withDerivedNurture(sent, new Date("2026-09-07T10:00:00.000Z")).nurture.touch2Status).toBe("due");
    expect(sent.nurture.touch2Status).toBe("idle");
  });

  it("completing touch 2 stops the sequence", () => {
    const sent = approveNurtureSend(
      startNurture(opener(), openerNurtureDraft(opener())),
      "mail-1",
      new Date("2026-09-04T10:00:00.000Z")
    );
    const done = completeTouch2(sent, "whatsapp", new Date("2026-09-07T10:00:00.000Z"));
    expect(done.nurture.step).toBe(3);
    expect(done.nurture.touch2Status).toBe("done");
    expect(done.nurture.stopReason).toBe("completed");
    expect(done.status).toBe("nurturing");
  });

  it("reply, opt-out, and promote stop nurture", () => {
    const sent = approveNurtureSend(startNurture(opener(), openerNurtureDraft(opener())), "mail-1");
    expect(stopNurture(sent, "reply").nurture.stopReason).toBe("reply");
    expect(stopNurture(sent, "opt_out").nurture.step).toBe(3);
    expect(stopNurture(sent, "promoted").status).not.toBe("promoted");
  });

  it("skip on pending approval skips touch 1 and starts the 3-day clock", () => {
    const skipped = skipNurtureStep(
      startNurture(opener(), openerNurtureDraft(opener()), new Date("2026-09-04T10:00:00.000Z")),
      new Date("2026-09-04T10:00:00.000Z")
    );
    expect(skipped.nurture.touch1Status).toBe("skipped");
    expect(isTouch2Due(skipped, new Date("2026-09-07T10:00:00.000Z"))).toBe(true);
  });
});

describe("gates", () => {
  it("promote requires a company number", () => {
    expect(canPromoteOpener(opener())).toBe(false);
    expect(canPromoteOpener(opener({ companyNumber: "08765432" }))).toBe(true);
  });

  it("drag rules match the spec", () => {
    const fresh = opener();
    expect(canDragOpenerTo(fresh, "new")).toBe(true);
    expect(canDragOpenerTo(fresh, "nurturing")).toBe(false);
    expect(canDragOpenerTo(fresh, "not_now")).toBe(true);
    expect(canDragOpenerTo(fresh, "promoted")).toBe(false);

    const sent = approveNurtureSend(startNurture(fresh, openerNurtureDraft(fresh)), "mail-1");
    expect(canDragOpenerTo(sent, "new")).toBe(false);
    expect(canDragOpenerTo(sent, "nurturing")).toBe(true);
    expect(canDragOpenerTo(sent, "promoted")).toBe(false);
    expect(canDragOpenerTo({ ...sent, companyNumber: "08765432" }, "promoted")).toBe(true);
  });
});

describe("hydrate events", () => {
  it("emits one event per opened outbound, keyed by recipient", () => {
    const events = openedMailEvents([
      {
        id: "m1",
        direction: "outbound",
        to: "ops@northpeak.co.uk",
        subject: "Debt service",
        opens: ["2026-09-01T10:00:00.000Z", "2026-09-01T11:00:00.000Z"],
        dealId: 7,
      },
      { id: "m2", direction: "inbound", from: "ops@northpeak.co.uk", opens: ["x"] },
      { id: "m3", direction: "outbound", to: "ops@northpeak.co.uk", opens: [] },
    ]);
    expect(events).toEqual([
      {
        email: "ops@northpeak.co.uk",
        at: "2026-09-01T11:00:00.000Z",
        openCount: 2,
        subject: "Debt service",
        dealId: 7,
        prospectId: undefined,
        mailId: "m1",
      },
    ]);
  });
});

describe("empty nurture", () => {
  it("starts idle", () => {
    expect(emptyNurture()).toEqual({
      step: 0,
      touch1Status: "idle",
      touch2Status: "idle",
    });
  });
});
