import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  OPENER_CONVERT_CLOSER_DELAY_MS,
  OPENER_TOUCH2_DELAY_MS,
  applyClickEvent,
  applyConvertStop,
  applyOpenEvent,
  applySecondEmailNurturing,
  approveNurtureSend,
  canDragOpenerTo,
  canPromoteOpener,
  compareOpenersByOpenCount,
  completeConvertCloser,
  completeTouch2,
  daysSitting,
  emptyNurture,
  enrolConvertOpener,
  failNurtureSend,
  isConvertCloserDue,
  isConvertOpener,
  isNurtureInFlight,
  isTouch2Due,
  mergeOpeners,
  normalizeCompanyNumber,
  normalizeEmail,
  normalizeOpener,
  openedMailEvents,
  openerBelongsToDesk,
  openerHasReceivedSecondEmail,
  openerNurtureDraft,
  openerOnPipeline,
  openerOutboundSentCount,
  recordConvertSend,
  shouldAutoPromoteOpener,
  isDoNotContactOpener,
  isHotClickOpener,
  OPENER_AUTO_PROMOTE_AFTER_EMAILS,
  sentUnopenedMailEvents,
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

  it("unions primary email with input.emails uniquely", () => {
    const row = normalizeOpener({
      id: "op-1",
      email: "  Ops@NorthPeak.co.uk ",
      emails: ["james@northpeak.co.uk", "ops@northpeak.co.uk", "JAMES@northpeak.co.uk"],
    });
    expect(row.email).toBe("ops@northpeak.co.uk");
    expect(row.emails.sort()).toEqual(["james@northpeak.co.uk", "ops@northpeak.co.uk"]);
  });
});

describe("days sitting", () => {
  it("uses lastTouchAt when set, otherwise lastOpenedAt", () => {
    const now = new Date("2026-09-10T10:00:00.000Z");
    expect(daysSitting(opener(), now)).toBe(9);
    expect(daysSitting(opener({ lastTouchAt: "2026-09-08T10:00:00.000Z" }), now)).toBe(2);
  });
});

describe("board ranking", () => {
  it("ranks higher openCount first even when the name would sort later", () => {
    const low = opener({ id: "low", companyName: "Acme", openCount: 2 });
    const high = opener({ id: "high", companyName: "Zebra", openCount: 9 });
    expect([low, high].sort(compareOpenersByOpenCount).map((row) => row.id)).toEqual(["high", "low"]);
  });

  it("breaks equal openCount ties alphabetically by company name, falling back to email", () => {
    const zebra = opener({ id: "z", companyName: "Zebra Ltd", openCount: 3 });
    const acme = opener({ id: "a", companyName: "acme ltd", openCount: 3 });
    const unnamed = opener({ id: "e", companyName: "  ", email: "beta@x.com", openCount: 3 });
    expect([zebra, unnamed, acme].sort(compareOpenersByOpenCount).map((row) => row.id)).toEqual([
      "a",
      "e",
      "z",
    ]);
  });

  it("ranks a clicker above a higher-open card with no clicks", () => {
    const openedALot = opener({ id: "opens", companyName: "Acme", openCount: 12, clickCount: 0 });
    const clickedOnce = opener({ id: "click", companyName: "Zebra", openCount: 1, clickCount: 1 });
    expect([openedALot, clickedOnce].sort(compareOpenersByOpenCount).map((row) => row.id)).toEqual([
      "click",
      "opens",
    ]);
  });

  it("ranks more clicks first, then more opens, then name", () => {
    const twoClicks = opener({ id: "two", companyName: "Zed", openCount: 1, clickCount: 2 });
    const oneClickLowOpens = opener({ id: "one-low", companyName: "Acme", openCount: 1, clickCount: 1 });
    const oneClickHighOpens = opener({ id: "one-high", companyName: "Beta", openCount: 8, clickCount: 1 });
    expect(
      [oneClickLowOpens, twoClicks, oneClickHighOpens]
        .sort(compareOpenersByOpenCount)
        .map((row) => row.id)
    ).toEqual(["two", "one-high", "one-low"]);
  });

  it("marks a record hot only after more than two clicks", () => {
    expect(isHotClickOpener(opener({ clickCount: 2 }))).toBe(false);
    expect(isHotClickOpener(opener({ clickCount: 3 }))).toBe(true);
  });
});

describe("opens and merge", () => {
  it("bumps lastOpenedAt and openCount on a later open", () => {
    const next = applyOpenEvent(opener(), "2026-09-03T12:00:00.000Z", 2);
    expect(next.firstOpenedAt).toBe("2026-09-01T10:00:00.000Z");
    expect(next.lastOpenedAt).toBe("2026-09-03T12:00:00.000Z");
    expect(next.openCount).toBe(3);
  });

  it("records clicks on the opener without changing openCount", () => {
    const next = applyClickEvent(opener({ openCount: 4, clickCount: 1 }), 2);
    expect(next.clickCount).toBe(3);
    expect(next.openCount).toBe(4);
  });

  it("merges two emails with the same company number into one card", () => {
    const a = opener({
      email: "ops@northpeak.co.uk",
      companyNumber: "08765432",
      openCount: 2,
      clickCount: 2,
    });
    const b = opener({
      id: "op-2",
      email: "james@northpeak.co.uk",
      companyNumber: "08765432",
      firstOpenedAt: "2026-08-20T10:00:00.000Z",
      openCount: 3,
      clickCount: 3,
      prospectId: 99,
      status: "promoted",
    });
    const merged = mergeOpeners(a, b);
    expect(merged.firstOpenedAt).toBe("2026-08-20T10:00:00.000Z");
    expect(merged.openCount).toBe(5);
    expect(merged.clickCount).toBe(5);
    expect(merged.emails.sort()).toEqual(["james@northpeak.co.uk", "ops@northpeak.co.uk"]);
    expect(merged.prospectId).toBe(99);
    expect(merged.status).toBe("promoted");
  });

  it("unions mail ids when merging cards", () => {
    const a = opener({ mailIds: ["mail-1"] });
    const b = opener({
      id: "op-2",
      email: "james@northpeak.co.uk",
      mailIds: ["mail-2"],
    });
    expect(mergeOpeners(a, b).mailIds?.sort()).toEqual(["mail-1", "mail-2"]);
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

  it("opt-out parks the card as not_now even when nurture never started", () => {
    const sent = approveNurtureSend(startNurture(opener(), openerNurtureDraft(opener())), "mail-1");
    expect(stopNurture(sent, "opt_out").status).toBe("not_now");
    expect(stopNurture(sent, "reply").status).toBe("nurturing");
    expect(stopNurture(opener(), "opt_out").status).toBe("not_now");
    expect(stopNurture(opener(), "opt_out").nurture.stopReason).toBe("opt_out");
  });

  it("skip on pending approval skips touch 1 and starts the 3-day clock", () => {
    const skipped = skipNurtureStep(
      startNurture(opener(), openerNurtureDraft(opener()), new Date("2026-09-04T10:00:00.000Z")),
      new Date("2026-09-04T10:00:00.000Z")
    );
    expect(skipped.nurture.touch1Status).toBe("skipped");
    expect(isTouch2Due(skipped, new Date("2026-09-07T10:00:00.000Z"))).toBe(true);
  });

  it("start after stop resets to the pending path", () => {
    const sent = approveNurtureSend(startNurture(opener(), openerNurtureDraft(opener())), "mail-1");
    const stopped = stopNurture(sent, "manual", new Date("2026-09-05T10:00:00.000Z"));
    const restarted = startNurture(
      stopped,
      openerNurtureDraft(stopped),
      new Date("2026-09-06T10:00:00.000Z")
    );
    expect(restarted.status).toBe("nurturing");
    expect(restarted.nurture.step).toBe(0);
    expect(restarted.nurture.touch1Status).toBe("pending_approval");
    expect(restarted.nurture.touch2Status).toBe("idle");
    expect(restarted.nurture.stopReason).toBeUndefined();
    expect(restarted.nurture.stoppedAt).toBeUndefined();
    expect(restarted.nurture.touch1MailId).toBeUndefined();
  });

  it("second skip after touch-1 skip is a no-op until touch 2 is due", () => {
    const t1At = new Date("2026-09-04T10:00:00.000Z");
    const skippedT1 = skipNurtureStep(startNurture(opener(), openerNurtureDraft(opener()), t1At), t1At);
    const early = skipNurtureStep(skippedT1, new Date("2026-09-05T10:00:00.000Z"));
    expect(early.nurture.step).toBe(1);
    expect(early.nurture.touch2Status).toBe("idle");
    expect(early.nurture.stopReason).toBeUndefined();

    const skippedT2 = skipNurtureStep(early, new Date("2026-09-07T10:00:00.000Z"));
    expect(skippedT2.nurture.touch2Status).toBe("skipped");
    expect(skippedT2.nurture.step).toBe(3);
    expect(skippedT2.nurture.stopReason).toBe("manual");
  });

  it("inbound stop only applies while nurture is in flight", () => {
    const fresh = opener();
    expect(isNurtureInFlight(fresh)).toBe(false);
    const pending = startNurture(fresh, openerNurtureDraft(fresh));
    expect(isNurtureInFlight(pending)).toBe(false);
    const sent = approveNurtureSend(pending, "mail-1");
    expect(isNurtureInFlight(sent)).toBe(true);
    expect(isNurtureInFlight(stopNurture(sent, "reply"))).toBe(false);
  });
});

describe("gates", () => {
  it("promote requires a company number", () => {
    expect(canPromoteOpener(opener())).toBe(false);
    expect(canPromoteOpener(opener({ companyNumber: "08765432" }))).toBe(true);
  });

  it("onPipeline is true when prospectId is set or the company is on the Deck", () => {
    expect(openerOnPipeline(opener())).toBe(false);
    expect(openerOnPipeline(opener({ prospectId: 9 }))).toBe(true);
    expect(openerOnPipeline(opener({ companyNumber: "8765432" }), ["08765432"])).toBe(true);
    expect(openerOnPipeline(opener({ companyNumber: "08765432" }), ["SC123456"])).toBe(false);
  });

  it("unsubscribed cards are do-not-contact", () => {
    expect(isDoNotContactOpener(opener())).toBe(false);
    expect(isDoNotContactOpener(opener({ status: "not_now" }))).toBe(true);
    expect(isDoNotContactOpener(stopNurture(opener(), "opt_out"))).toBe(true);
    expect(isDoNotContactOpener(stopNurture(opener(), "reply"))).toBe(false);
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

  it("do-not-contact cards cannot leave Unsubscribed", () => {
    const parked = stopNurture(opener({ companyNumber: "08765432" }), "opt_out");
    expect(canDragOpenerTo(parked, "not_now")).toBe(true);
    expect(canDragOpenerTo(parked, "new")).toBe(false);
    expect(canDragOpenerTo(parked, "nurturing")).toBe(false);
    expect(canDragOpenerTo(parked, "promoted")).toBe(false);
  });
});

describe("non-responsive desk", () => {
  it("lists successfully sent unopened outbound and skips opens, clicks, failed, and mock", () => {
    const events = sentUnopenedMailEvents([
      {
        id: "m1",
        direction: "outbound",
        status: "sent",
        to: "ops@northpeak.co.uk",
        subject: "Debt service",
        createdAt: "2026-09-01T09:00:00.000Z",
        opens: [],
        dealId: 7,
      },
      { id: "m2", direction: "outbound", status: "sent", to: "keep@hale.co.uk", opens: ["2026-09-01T10:00:00.000Z"] },
      {
        id: "m3",
        direction: "outbound",
        status: "sent",
        to: "click@hale.co.uk",
        opens: [],
        clicks: [{ at: "2026-09-01T10:05:00.000Z", url: "https://example.com" }],
      },
      { id: "m4", direction: "outbound", status: "failed", to: "fail@hale.co.uk", opens: [] },
      { id: "m5", direction: "outbound", status: "mock", to: "mock@hale.co.uk", opens: [] },
      { id: "m6", direction: "inbound", status: "received", to: "james@stratanexus.co.uk", from: "ops@northpeak.co.uk" },
    ]);
    expect(events).toEqual([
      {
        email: "ops@northpeak.co.uk",
        at: "2026-09-01T09:00:00.000Z",
        subject: "Debt service",
        dealId: 7,
        prospectId: undefined,
        mailId: "m1",
      },
    ]);
  });

  it("moves a non-responsive card onto Openers on the first real open", () => {
    const cold = opener({
      status: "non_responsive",
      openCount: 0,
      firstOpenedAt: "",
      lastOpenedAt: "",
      lastTouchAt: "2026-09-01T09:00:00.000Z",
    });
    const next = applyOpenEvent(cold, "2026-09-03T12:00:00.000Z", 1);
    expect(next.status).toBe("new");
    expect(next.firstOpenedAt).toBe("2026-09-03T12:00:00.000Z");
    expect(next.lastOpenedAt).toBe("2026-09-03T12:00:00.000Z");
    expect(next.openCount).toBe(1);
  });

  it("parks a non-responsive unsubscribe on Openers as not_now", () => {
    const parked = stopNurture(
      opener({ status: "non_responsive", openCount: 0, firstOpenedAt: "", lastOpenedAt: "" }),
      "opt_out"
    );
    expect(parked.status).toBe("not_now");
    expect(parked.nurture.stopReason).toBe("opt_out");
    expect(openerBelongsToDesk(parked, "openers")).toBe(true);
    expect(openerBelongsToDesk(parked, "non_responsive")).toBe(false);
  });

  it("splits desks: non_responsive stays off the Openers board until they open or unsubscribe", () => {
    const cold = opener({ status: "non_responsive" });
    const warm = opener({ status: "new" });
    expect(openerBelongsToDesk(cold, "non_responsive")).toBe(true);
    expect(openerBelongsToDesk(cold, "openers")).toBe(false);
    expect(openerBelongsToDesk(warm, "openers")).toBe(true);
    expect(openerBelongsToDesk(warm, "non_responsive")).toBe(false);
  });

  it("does not auto-promote a never-opened card", () => {
    const cold = opener({
      status: "non_responsive",
      companyNumber: "08765432",
      openCount: 0,
    });
    expect(
      shouldAutoPromoteOpener(
        cold,
        Array.from({ length: 6 }, (_, i) => ({
          id: `mail-${i + 1}`,
          to: "ops@northpeak.co.uk",
          direction: "outbound",
          status: "sent",
        }))
      )
    ).toBe(false);
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

describe("second-email nurturing", () => {
  const sme1 = {
    to: "ops@northpeak.co.uk",
    direction: "outbound",
    status: "sent",
    touchId: "sme_1",
  };
  const smeOpen = {
    to: "ops@northpeak.co.uk",
    direction: "outbound",
    status: "sent",
    touchId: "sme_open",
  };

  it("detects a second email from sme_open, sme_followup, or two outbound sends", () => {
    expect(openerHasReceivedSecondEmail(opener(), { mail: [sme1] })).toBe(false);
    expect(openerHasReceivedSecondEmail(opener(), { mail: [sme1, smeOpen] })).toBe(true);
    expect(openerHasReceivedSecondEmail(opener(), { mail: [smeOpen] })).toBe(true);
    expect(
      openerHasReceivedSecondEmail(opener(), {
        mail: [{ ...sme1, touchId: "sme_followup" }],
      })
    ).toBe(true);
    expect(
      openerHasReceivedSecondEmail(opener(), {
        mail: [sme1, { ...sme1, touchId: undefined }],
      })
    ).toBe(true);
    expect(
      openerHasReceivedSecondEmail(opener(), { smeOpenFollowUpSentAt: "2026-09-04T10:00:00.000Z" })
    ).toBe(true);
    expect(
      openerHasReceivedSecondEmail(opener(), { smeFollowupSentAt: "2026-09-06T10:00:00.000Z" })
    ).toBe(true);
  });

  it("moves new cards to nurturing without starting the desk sequence", () => {
    const moved = applySecondEmailNurturing(opener(), new Date("2026-09-06T10:00:00.000Z"));
    expect(moved.status).toBe("nurturing");
    expect(moved.nurture).toEqual(emptyNurture());
    expect(moved.updatedAt).toBe("2026-09-06T10:00:00.000Z");
  });

  it("does not override not_now or promoted", () => {
    expect(applySecondEmailNurturing(opener({ status: "not_now" })).status).toBe("not_now");
    expect(applySecondEmailNurturing(opener({ status: "promoted" })).status).toBe("promoted");
    expect(applySecondEmailNurturing(opener({ status: "nurturing" })).status).toBe("nurturing");
  });

  it("keeps a second-email card in nurturing when the desk sequence starts", () => {
    const pending = startNurture(
      applySecondEmailNurturing(opener()),
      openerNurtureDraft(opener())
    );
    expect(pending.status).toBe("nurturing");
    expect(pending.nurture.touch1Status).toBe("pending_approval");
  });
});

describe("empty nurture", () => {
  it("starts idle", () => {
    expect(emptyNurture()).toEqual({
      step: 0,
      touch1Status: "idle",
      touch2Status: "idle",
      stream: "opener_3touch",
      closerStatus: "idle",
    });
  });
});

describe("sixth-email auto-promote", () => {
  function sent(n: number, to = "ops@northpeak.co.uk") {
    return Array.from({ length: n }, (_, i) => ({
      id: `mail-${i + 1}`,
      to,
      direction: "outbound" as const,
      status: "sent" as const,
    }));
  }

  it("counts unique outbound sent mail to the opener, including aliases", () => {
    const row = opener({ emails: ["ops@northpeak.co.uk", "james@northpeak.co.uk"] });
    expect(openerOutboundSentCount(row, sent(3))).toBe(3);
    expect(
      openerOutboundSentCount(row, [
        ...sent(2),
        { id: "mail-3", to: "james@northpeak.co.uk", direction: "outbound", status: "sent" },
        { id: "mail-1", to: "ops@northpeak.co.uk", direction: "outbound", status: "sent" },
        { id: "in-1", to: "james@stratanexus.co.uk", direction: "inbound", status: "received" },
        { id: "fail-1", to: "ops@northpeak.co.uk", direction: "outbound", status: "failed" },
      ])
    ).toBe(3);
  });

  it("promotes after more than 5 unique sent emails when the company can be promoted", () => {
    expect(OPENER_AUTO_PROMOTE_AFTER_EMAILS).toBe(5);
    const ready = opener({ companyNumber: "08765432", status: "nurturing" });
    expect(shouldAutoPromoteOpener(ready, sent(5))).toBe(false);
    expect(shouldAutoPromoteOpener(ready, sent(6))).toBe(true);
    expect(shouldAutoPromoteOpener(opener({ status: "nurturing" }), sent(6))).toBe(false);
    expect(shouldAutoPromoteOpener(opener({ companyNumber: "08765432", status: "promoted" }), sent(6))).toBe(false);
    expect(shouldAutoPromoteOpener(stopNurture(ready, "opt_out"), sent(6))).toBe(false);
    expect(shouldAutoPromoteOpener(opener({ companyNumber: "08765432", status: "not_now" }), sent(6))).toBe(false);
    expect(shouldAutoPromoteOpener(ready, sent(6), ["ops@northpeak.co.uk"])).toBe(false);
  });
});

describe("convert stream", () => {
  it("blocks 3-touch and sixth-email promote, and parks after closer", () => {
    const now = new Date("2026-09-20T10:00:00.000Z");
    let row = enrolConvertOpener(opener({ companyNumber: "08765432", status: "new" }), now);
    expect(isConvertOpener(row)).toBe(true);
    expect(row.status).toBe("nurturing");
    expect(row.nurture.convertCycle).toBe(1);
    expect(startNurture(row, { subject: "x", html: "y" }, now)).toEqual(row);
    expect(shouldAutoPromoteOpener(row, Array.from({ length: 8 }, (_, i) => ({
      id: `m${i}`,
      to: "ops@northpeak.co.uk",
      direction: "outbound",
      status: "sent",
    })))).toBe(false);
    expect(canDragOpenerTo(row, "nurturing")).toBe(true);
    row = recordConvertSend(row, "sme_n3", "mail-n3", now);
    expect(isConvertCloserDue(row, new Date(now.getTime() + OPENER_CONVERT_CLOSER_DELAY_MS))).toBe(true);
    const done = completeConvertCloser(row, "call", new Date(now.getTime() + OPENER_CONVERT_CLOSER_DELAY_MS));
    expect(done.status).toBe("non_responsive");
    expect(done.nurture.stopReason).toBe("completed");
    expect(done.nurture.wakeAt).toBeTruthy();
  });
});

describe("convert auto-promote", () => {
  it("stops convert on inbound refinance even without a company number, and promotes when a number exists", () => {
    const withNumber = enrolConvertOpener(opener({ companyNumber: "08765432", email: "ops@acme.test" }));
    const blocked = enrolConvertOpener(opener({ email: "ops@acme.test", companyNumber: undefined }));
    const promoted = applyConvertStop(withNumber, "promoted");
    expect(promoted.status).toBe("promoted");
    expect(promoted.nurture.stopReason).toBe("promoted");
    expect(promoted.nurture.wakeAt).toBeUndefined();
    expect(promoted.nurture.stream).toBe("convert");

    const parked = applyConvertStop(blocked, "blocked");
    expect(parked.nurture.promoteBlocked).toBe(true);
    expect(parked.status).toBe("nurturing");
    expect(parked.nurture.stopReason).toBe("blocked");
    expect(parked.nurture.stream).toBe("convert");
    expect(parked.nurture.wakeAt).toBeUndefined();
    expect(parked.nurture.step).toBe(blocked.nurture.step);
    expect(startNurture(parked, { subject: "x", html: "y" })).toEqual(parked);
  });

  it("parks convert on opt-out without promoting, and stops on reply", () => {
    const enrolled = enrolConvertOpener(opener({ companyNumber: "08765432", email: "ops@acme.test" }));
    const opted = applyConvertStop(enrolled, "opt_out");
    expect(opted.status).toBe("not_now");
    expect(opted.nurture.stopReason).toBe("opt_out");
    expect(opted.nurture.wakeAt).toBeUndefined();
    expect(opted.status).not.toBe("promoted");

    const replied = applyConvertStop(enrolled, "reply");
    expect(replied.nurture.stopReason).toBe("reply");
    expect(replied.nurture.wakeAt).toBeUndefined();
    expect(replied.status).not.toBe("promoted");
  });

  it("inbound refinance and agent-mail inbound call stopConvertAndPromote", () => {
    const inbound = fs.readFileSync(path.resolve("server/routes/inbound.ts"), "utf8");
    expect(inbound).toMatch(/stopConvertAndPromote/);
    const mail = fs.readFileSync(path.resolve("server/routes/agentMail.ts"), "utf8");
    expect(mail).toMatch(/stopConvertAndPromote/);
    expect(mail).toMatch(/opt_out/);
  });
});
