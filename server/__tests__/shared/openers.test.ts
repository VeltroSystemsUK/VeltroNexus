import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  OPENER_CONVERT_CLOSER_DELAY_MS,
  OPENER_TOUCH2_DELAY_MS,
  DIRECT_OUTREACH_DWELL_MIN,
  applyClickEvent,
  applyDwellEvent,
  applyConvertStop,
  applyOpenerDemote,
  convertReasonFromInboundKind,
  applyOpenEvent,
  applySecondEmailNurturing,
  approveNurtureSend,
  canDragOpenerTo,
  canPromoteOpener,
  compareOpenersByOpenCount,
  completeConvertCloser,
  completeTouch2,
  convertStepBadge,
  applyDirectOutreach,
  eligibleDirectOutreach,
  keepConvertOpenerOnHardBounce,
  daysSitting,
  emptyNurture,
  enrolConvertOpener,
  resumeJamesFromDirectOutreach,
  failNurtureSend,
  isConvertCloserDue,
  isConvertOpener,
  isDirectOutreachOpener,
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
  openerOnOpenersBoard,
  openerOnPipeline,
  openerOutboundSentCount,
  recordConvertSend,
  shouldAutoPromoteOpener,
  isDoNotContactOpener,
  isHotClickOpener,
  openerClickHeat,
  clickHeatCounts,
  closerSiteClickUrl,
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

  it("ranks session heat before raw click count", () => {
    const coldMany = {
      ...opener({ id: "cold", companyName: "Zebra", clickCount: 12, openCount: 20 }),
      timeline: [
        {
          clicks: [
            { at: "2026-09-10T10:00:00.000Z", url: "https://stratafinance.co.uk" },
            { at: "2026-09-10T10:00:00.200Z", url: "https://stratafinance.co.uk/strata-solution.html" },
          ],
        },
      ],
    };
    const warmFew = {
      ...opener({ id: "warm", companyName: "Acme", clickCount: 1, openCount: 1 }),
      timeline: [
        {
          clicks: [{ at: "2026-09-10T10:00:00.000Z", url: "https://stratafinance.co.uk/strata-solution.html" }],
        },
      ],
    };
    const hot = {
      ...opener({ id: "hot", companyName: "Nadir", clickCount: 2, openCount: 1 }),
      timeline: [
        {
          clicks: [
            { at: "2026-09-10T08:00:00.000Z", url: "https://stratafinance.co.uk/strata-solution.html" },
            { at: "2026-09-10T08:01:00.000Z", url: "https://stratafinance.co.uk/#tools" },
            { at: "2026-09-10T12:00:00.000Z", url: "https://stratafinance.co.uk/cdfi-funding.html" },
            { at: "2026-09-10T12:02:00.000Z", url: "https://stratafinance.co.uk/#contact" },
          ],
        },
      ],
    };
    const none = opener({ id: "none", companyName: "Beta", clickCount: 0, openCount: 40 });
    expect([coldMany, none, warmFew, hot].sort(compareOpenersByOpenCount).map((row) => row.id)).toEqual([
      "hot",
      "warm",
      "cold",
      "none",
    ]);
  });

  it("ranks on-site dwell above hotter mail clicks", () => {
    const onSite = opener({
      id: "site",
      companyName: "Zebra",
      clickCount: 1,
      openCount: 1,
      dwellCount: 1,
    });
    const hottest = {
      ...opener({ id: "hot", companyName: "Acme", clickCount: 2, openCount: 8, dwellCount: 0 }),
      timeline: [
        {
          clicks: [
            { at: "2026-09-10T08:00:00.000Z", url: "https://stratafinance.co.uk/strata-solution.html" },
            { at: "2026-09-10T12:00:00.000Z", url: "https://stratafinance.co.uk/cdfi-funding.html" },
          ],
        },
      ],
    };
    expect([hottest, onSite].sort(compareOpenersByOpenCount).map((row) => row.id)).toEqual([
      "site",
      "hot",
    ]);
  });

  it("ranks more on-site dwells first even when heat matches", () => {
    const seven = opener({ id: "seven", companyName: "Zed", dwellCount: 7, clickCount: 2, openCount: 1 });
    const two = opener({ id: "two", companyName: "Acme", dwellCount: 2, clickCount: 8, openCount: 9 });
    expect([two, seven].sort(compareOpenersByOpenCount).map((row) => row.id)).toEqual(["seven", "two"]);
  });

  it("ranks Veltro interest after dwell inside Direct Outreach", () => {
    const a = opener({
      id: "a",
      companyName: "Zebra",
      dwellCount: 5,
      veltroInterestAt: "2026-09-14T10:00:00.000Z",
    });
    const b = opener({ id: "b", companyName: "Acme", dwellCount: 5 });
    expect(compareOpenersByOpenCount(a, b)).toBeLessThan(0);
  });
});

describe("click heat", () => {
  function withClicks(clicks: Array<{ at: string; url: string }>, extra: Partial<OpenerRecord> = {}) {
    return { ...opener({ clickCount: clicks.length, ...extra }), timeline: [{ clicks }] };
  }

  it("is null when there are no clicks", () => {
    expect(openerClickHeat(opener({ clickCount: 0 }))).toBeNull();
  });

  it("treats a sub-2s pair of homepage + product page as cold (gateway burst)", () => {
    const row = withClicks([
      { at: "2026-09-10T13:18:58.510Z", url: "https://www.stratafinance.co.uk/#tools" },
      { at: "2026-09-10T13:18:59.342Z", url: "https://stratafinance.co.uk" },
      { at: "2026-09-10T13:18:59.560Z", url: "https://stratafinance.co.uk" },
      { at: "2026-09-10T13:18:59.828Z", url: "https://www.stratafinance.co.uk/#tools" },
    ]);
    expect(openerClickHeat(row)).toBe("cold");
  });

  it("treats homepage-only clicks as cold", () => {
    const row = withClicks([
      { at: "2026-09-10T10:00:00.000Z", url: "https://stratafinance.co.uk" },
      { at: "2026-09-10T10:00:00.300Z", url: "https://www.stratafinance.co.uk/" },
    ]);
    expect(openerClickHeat(row)).toBe("cold");
  });

  it("treats one non-burst product-page session as warm", () => {
    const row = withClicks([
      { at: "2026-09-10T13:40:02.735Z", url: "https://stratafinance.co.uk/strata-solution.html" },
      { at: "2026-09-10T13:40:41.060Z", url: "https://stratafinance.co.uk" },
      { at: "2026-09-10T13:41:08.632Z", url: "https://www.stratafinance.co.uk/#tools" },
      { at: "2026-09-10T13:42:52.453Z", url: "https://stratafinance.co.uk" },
    ]);
    expect(openerClickHeat(row)).toBe("warm");
  });

  it("treats a single product-page click as warm", () => {
    const row = withClicks([
      { at: "2026-09-10T10:00:00.000Z", url: "https://stratafinance.co.uk/cdfi-funding.html" },
    ]);
    expect(openerClickHeat(row)).toBe("warm");
  });

  it("treats two product-page sessions hours apart as hot", () => {
    const row = withClicks([
      { at: "2026-09-07T07:32:45.405Z", url: "https://stratafinance.co.uk/strata-solution.html" },
      { at: "2026-09-07T07:34:00.000Z", url: "https://stratafinance.co.uk/strata-solution.html" },
      { at: "2026-09-07T10:08:31.090Z", url: "https://stratafinance.co.uk/strata-solution.html" },
      { at: "2026-09-07T10:10:00.000Z", url: "https://stratafinance.co.uk/cdfi-funding.html" },
    ]);
    expect(openerClickHeat(row)).toBe("hot");
  });

  it("does not promote two gateway bursts hours apart to hot", () => {
    const row = withClicks([
      { at: "2026-09-07T07:32:45.405Z", url: "https://stratafinance.co.uk/strata-solution.html" },
      { at: "2026-09-07T07:32:45.800Z", url: "https://stratafinance.co.uk" },
      { at: "2026-09-07T10:08:31.090Z", url: "https://stratafinance.co.uk/strata-solution.html" },
      { at: "2026-09-07T10:08:31.540Z", url: "https://stratafinance.co.uk" },
    ]);
    expect(openerClickHeat(row)).toBe("cold");
  });

  it("counts heat bands across a list", () => {
    const none = opener({ id: "none", clickCount: 0 });
    const cold = withClicks(
      [
        { at: "2026-09-10T10:00:00.000Z", url: "https://stratafinance.co.uk" },
        { at: "2026-09-10T10:00:00.200Z", url: "https://stratafinance.co.uk/strata-solution.html" },
      ],
      { id: "cold" }
    );
    const warm = withClicks(
      [{ at: "2026-09-10T10:00:00.000Z", url: "https://stratafinance.co.uk/strata-solution.html" }],
      { id: "warm" }
    );
    const hot = withClicks(
      [
        { at: "2026-09-10T08:00:00.000Z", url: "https://stratafinance.co.uk/strata-solution.html" },
        { at: "2026-09-10T08:01:00.000Z", url: "https://stratafinance.co.uk/#tools" },
        { at: "2026-09-10T12:00:00.000Z", url: "https://stratafinance.co.uk/cdfi-funding.html" },
        { at: "2026-09-10T12:02:00.000Z", url: "https://stratafinance.co.uk/#contact" },
      ],
      { id: "hot" }
    );
    expect(clickHeatCounts([none, cold, warm, hot])).toEqual({ hot: 1, warm: 1, cold: 1 });
  });

  it("treats a 10s dwell as a confirmed visit even when the clicks were a burst", () => {
    const burst = withClicks([
      { at: "2026-09-10T13:18:58.510Z", url: "https://www.stratafinance.co.uk/#tools" },
      { at: "2026-09-10T13:18:59.342Z", url: "https://stratafinance.co.uk" },
    ]);
    expect(openerClickHeat(burst)).toBe("cold");
    expect(openerClickHeat({ ...burst, dwellCount: 1 })).toBe("warm");
    expect(openerClickHeat({ ...burst, dwellCount: 2 })).toBe("hot");
  });

  it("gives C1 a product-page URL when a dwell confirms the visit", () => {
    const burst = [
      { at: "2026-09-10T13:18:58.510Z", url: "https://www.stratafinance.co.uk/#tools" },
      { at: "2026-09-10T13:18:59.342Z", url: "https://stratafinance.co.uk" },
    ];
    expect(closerSiteClickUrl(burst)).toBeNull();
    expect(closerSiteClickUrl(burst, 1)).toBe("https://www.stratafinance.co.uk/#tools");
  });

  it("gives C1 a product-page URL only on yellow or green heat", () => {
    expect(
      closerSiteClickUrl([
        { at: "2026-09-10T13:18:58.510Z", url: "https://www.stratafinance.co.uk/#tools" },
        { at: "2026-09-10T13:18:59.342Z", url: "https://stratafinance.co.uk" },
      ])
    ).toBeNull();
    expect(
      closerSiteClickUrl([{ at: "2026-09-10T10:00:00.000Z", url: "https://stratafinance.co.uk" }])
    ).toBeNull();
    expect(
      closerSiteClickUrl([
        { at: "2026-09-10T10:00:00.000Z", url: "https://stratafinance.co.uk/strata-solution.html" },
      ])
    ).toBe("https://stratafinance.co.uk/strata-solution.html");
    expect(
      closerSiteClickUrl([
        { at: "2026-09-10T08:00:00.000Z", url: "https://stratafinance.co.uk/strata-solution.html" },
        { at: "2026-09-10T08:01:00.000Z", url: "https://stratafinance.co.uk/#tools" },
        { at: "2026-09-10T12:00:00.000Z", url: "https://stratafinance.co.uk/cdfi-funding.html" },
        { at: "2026-09-10T12:02:00.000Z", url: "https://www.stratafinance.co.uk/#contact" },
      ])
    ).toBe("https://www.stratafinance.co.uk/#contact");
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

describe("direct outreach gate", () => {
  it("requires 5 dwells, not clicks", () => {
    expect(eligibleDirectOutreach(opener({ dwellCount: 4, clickCount: 12, status: "new" }))).toBe(false);
    expect(eligibleDirectOutreach(opener({ dwellCount: 5, status: "new" }))).toBe(true);
    expect(DIRECT_OUTREACH_DWELL_MIN).toBe(5);
  });

  it("rejects promoted, non_responsive, and do-not-contact", () => {
    expect(eligibleDirectOutreach(opener({ dwellCount: 9, status: "promoted", companyNumber: "08765432" }))).toBe(false);
    expect(eligibleDirectOutreach(opener({ dwellCount: 9, status: "non_responsive" }))).toBe(false);
    expect(eligibleDirectOutreach(opener({ dwellCount: 9, status: "not_now" }))).toBe(false);
  });

  it("does not re-pull at the dismissed dwell count", () => {
    const row = opener({
      dwellCount: 5,
      status: "nurturing",
      nurture: { ...opener().nurture, step: 1, directOutreachDismissedDwellCount: 5 },
    });
    expect(eligibleDirectOutreach(row)).toBe(false);
    expect(eligibleDirectOutreach({ ...row, dwellCount: 6 })).toBe(true);
  });

  it("hides zero-dwell cards from the Openers desk", () => {
    expect(openerOnOpenersBoard(opener({ dwellCount: 0, status: "new", clickCount: 12 }))).toBe(false);
    expect(openerOnOpenersBoard(opener({ dwellCount: 1, status: "new" }))).toBe(true);
    expect(openerOnOpenersBoard(opener({ dwellCount: 9, status: "not_now" }))).toBe(false);
    expect(openerOnOpenersBoard(opener({ dwellCount: 2, status: "non_responsive" }))).toBe(false);
  });

  it("identifies Direct Outreach status", () => {
    expect(isDirectOutreachOpener(opener({ status: "direct_outreach" }))).toBe(true);
    expect(isDirectOutreachOpener(opener({ status: "new" }))).toBe(false);
  });
});

describe("applyDirectOutreach", () => {
  it("moves a 5-dwell nurturing convert card and stops James", () => {
    const row = recordConvertSend(
      enrolConvertOpener(opener({ dwellCount: 5, companyNumber: "08765432" })),
      "sme_n1",
      "mail-n1"
    );
    const next = applyDirectOutreach(row);
    expect(next.status).toBe("direct_outreach");
    expect(next.nurture.stopReason).toBe("direct_outreach");
    expect(next.nurture.wakeAt).toBeUndefined();
    expect(next.nurture.n1At).toBeTruthy();
  });

  it("is a no-op when ineligible", () => {
    const row = opener({ dwellCount: 4, status: "new" });
    expect(applyDirectOutreach(row)).toBe(row);
  });
});

describe("resumeJamesFromDirectOutreach", () => {
  it("resumes convert at the next unsent step", () => {
    const stopped = applyDirectOutreach(
      recordConvertSend(enrolConvertOpener(opener({ dwellCount: 5 })), "sme_n1", "mail-n1")
    );
    const next = resumeJamesFromDirectOutreach(stopped, { now: new Date("2026-09-14T12:00:00.000Z") });
    expect(next.status).toBe("nurturing");
    expect(next.nurture.stopReason).toBeUndefined();
    expect(next.nurture.directOutreachDismissedDwellCount).toBe(5);
    expect(next.nurture.n1At).toBeTruthy();
    expect(next.nurture.n2At).toBeUndefined();
    expect(next.nurture.wakeAt).toBeTruthy();
  });

  it("enrols convert when they never started and dual-open is eligible", () => {
    const desk = applyDirectOutreach(opener({ dwellCount: 5, status: "new" }));
    const next = resumeJamesFromDirectOutreach(desk, { dualOpenEligible: true });
    expect(next.nurture.stream).toBe("convert");
    expect(next.status).toBe("nurturing");
    expect(next.nurture.stopReason).toBeUndefined();
  });

  it("starts 3-touch when they never started and convert does not apply", () => {
    const desk = applyDirectOutreach(opener({ dwellCount: 5, status: "new" }));
    const next = resumeJamesFromDirectOutreach(desk, {
      dualOpenEligible: false,
      draft: { subject: "Next", html: "<p>Hi</p>" },
    });
    expect(next.nurture.stream).toBe("opener_3touch");
    expect(next.nurture.touch1Status).toBe("pending_approval");
    expect(next.nurture.directOutreachDismissedDwellCount).toBe(5);
  });

  it("does not restart do-not-contact", () => {
    const parked = stopNurture(opener({ dwellCount: 9 }), "opt_out");
    expect(resumeJamesFromDirectOutreach(parked).status).toBe("not_now");
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
    expect(canDragOpenerTo(fresh, "direct_outreach")).toBe(false);

    const desk = opener({ status: "direct_outreach", dwellCount: 5, companyNumber: "08765432" });
    expect(canDragOpenerTo(desk, "direct_outreach")).toBe(false);
    expect(canDragOpenerTo(desk, "nurturing")).toBe(true);
    expect(canDragOpenerTo(desk, "not_now")).toBe(true);
    expect(canDragOpenerTo(desk, "promoted")).toBe(true);
    expect(canDragOpenerTo(desk, "new")).toBe(false);

    const parked = stopNurture(opener(), "opt_out");
    expect(canDragOpenerTo(parked, "direct_outreach")).toBe(false);
  });

  it("promoted cards can be dragged back off the Pipeline", () => {
    const promoted = {
      ...stopNurture(opener({ companyNumber: "08765432", prospectId: 9 }), "promoted"),
      status: "promoted" as const,
    };
    expect(canDragOpenerTo(promoted, "nurturing")).toBe(true);
    expect(canDragOpenerTo(promoted, "new")).toBe(true);
    expect(canDragOpenerTo(promoted, "not_now")).toBe(true);
    expect(canDragOpenerTo(promoted, "non_responsive")).toBe(false);
  });

  it("demote returns a warm opener and blocks sixth-email auto-promote", () => {
    const now = new Date("2026-09-11T10:00:00.000Z");
    const promoted = {
      ...stopNurture(opener({ companyNumber: "08765432", prospectId: 87, status: "promoted" }), "promoted"),
      status: "promoted" as const,
      prospectId: 87,
    };
    const demoted = applyOpenerDemote(promoted, "nurturing", now);
    expect(demoted.status).toBe("nurturing");
    expect(demoted.prospectId).toBeUndefined();
    expect(demoted.nurture.stopReason).toBeUndefined();
    expect(demoted.nurture.promoteBlocked).toBe(true);
    expect(demoted.nurture.step).toBe(0);
    expect(demoted.updatedAt).toBe(now.toISOString());
    expect(openerOnPipeline(demoted)).toBe(false);
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
    expect(
      shouldAutoPromoteOpener(
        applyOpenerDemote(opener({ companyNumber: "08765432", status: "promoted", prospectId: 1 })),
        sent(6)
      )
    ).toBe(false);
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
    expect(canDragOpenerTo(row, "new")).toBe(true);
    expect(keepConvertOpenerOnHardBounce({ ...row, phone: "07700900000" })).toBe(true);
    expect(keepConvertOpenerOnHardBounce(row)).toBe(false);
    row = recordConvertSend(row, "sme_n1", "mail-n1", now);
    expect(canDragOpenerTo(row, "new")).toBe(false);
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
    const refinance = inbound.slice(inbound.indexOf('router.post("/refinance"'));
    const application = inbound.slice(inbound.indexOf('router.post("/application"'));
    const portal = inbound.slice(inbound.indexOf('router.post("/portal-submit"'));
    expect(refinance).toMatch(/stopConvertAfterInboundLead\(email\)/);
    expect(application).toMatch(/stopConvertAfterInboundLead\(data\.email\)/);
    expect(portal).toMatch(/stopConvertAfterInboundLead\(data\.email\)/);
    const mail = fs.readFileSync(path.resolve("server/routes/agentMail.ts"), "utf8");
    expect(mail).toMatch(/stopConvertAndPromote/);
    expect(mail).toMatch(/convertReasonFromInboundKind/);
    expect(mail).not.toMatch(/kind === "stop" \? "opt_out" : "reply"/);
  });

  it("only promotes convert on a human reply, not bounce or spam", () => {
    expect(convertReasonFromInboundKind("stop")).toBe("opt_out");
    expect(convertReasonFromInboundKind("responsive")).toBe("reply");
    expect(convertReasonFromInboundKind("bounce")).toBeUndefined();
    expect(convertReasonFromInboundKind("spam")).toBeUndefined();
    expect(convertReasonFromInboundKind("other")).toBeUndefined();
  });
});

describe("convert step badge", () => {
  it("labels N1 queued, N2/N3 in n days from cadence gaps, and C1 while waiting", () => {
    const now = new Date("2026-09-20T10:00:00.000Z");
    const enrolled = enrolConvertOpener(opener(), now);
    expect(convertStepBadge(enrolled, now)).toBe("N1 queued");

    const afterN1 = recordConvertSend(enrolled, "sme_n1", "mail-n1", now);
    expect(convertStepBadge(afterN1, now)).toBe("N2 in 4 days");
    expect(convertStepBadge(afterN1, new Date("2026-09-22T10:00:00.000Z"))).toBe("N2 in 2 days");
    expect(convertStepBadge(afterN1, new Date("2026-09-23T10:00:00.000Z"))).toBe("N2 in 1 day");

    const afterN2 = recordConvertSend(afterN1, "sme_n2", "mail-n2", now);
    expect(convertStepBadge(afterN2, now)).toBe("N3 in 5 days");

    const skipN2 = recordConvertSend(afterN1, "sme_n3", "mail-n3", now);
    expect(convertStepBadge(skipN2, now)).toBe("C1 in 3 days");

    const afterN3 = recordConvertSend(afterN2, "sme_n3", "mail-n3", now);
    expect(convertStepBadge(afterN3, now)).toBe("C1 in 3 days");
    expect(convertStepBadge(afterN3, new Date(now.getTime() + OPENER_CONVERT_CLOSER_DELAY_MS))).toBe(
      "C1 due"
    );
  });
});

describe("convert 3-touch send gate", () => {
  it("runNurtureAction refuses start and approve on convert openers", () => {
    const service = fs.readFileSync(path.resolve("server/services/openers.ts"), "utf8");
    expect(service).toMatch(/isConvertOpener\(opener\) && \(action === "start" \|\| action === "approve"\)/);
  });
});

describe("applyDwellEvent path", () => {
  it("persists lastDwellPath so Generate can see a tools dwell", () => {
    const next = applyDwellEvent(opener({ dwellCount: 4 }), 1, "/#tools");
    expect(next.dwellCount).toBe(5);
    expect(next.lastDwellPath).toBe("/#tools");
    expect(applyDwellEvent(next, 1).lastDwellPath).toBe("/#tools");
  });
});
