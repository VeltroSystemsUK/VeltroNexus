import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  CONVERT_SITE_ORIGIN,
  CONVERT_STOP_LINE,
  CONVERT_WAKE_DAYS,
  buildCloserScript,
  buildConvertEnrolment,
  convertCopyOk,
  convertGreetingName,
  convertOverridesHopperHold,
  convertWakeAt,
  enrolConvertDealPatch,
  isDualOpenConvertEligible,
  isStrataSiteUrl,
  lastSiteClickUrlFromMail,
  lastStrataSiteClick,
  nextOutreachTouchAfterSend,
  pickConvertTouchId,
  planConvertTick,
  shouldHoldN1ForSme2SameDay,
  shouldSkipN2ForContactClick,
  shouldWakeConvert,
  siteClickKind,
  sme2SentAtFromMail,
} from "@shared/smeConvert";
import { nextCadenceStep, nextCadenceStepForDeal, SME_NURTURE_CADENCE } from "@shared/salesOs";
import { isHardBounceMailbox, isOptOutSuppressed } from "@shared/mailDesk";

const sme1 = {
  touchId: "sme_1",
  direction: "outbound",
  status: "sent",
  opens: ["2026-09-01T10:00:00.000Z"],
  dealId: 9,
};
const sme2 = {
  touchId: "sme_2",
  direction: "outbound",
  status: "sent",
  opens: ["2026-09-08T10:00:00.000Z"],
  dealId: 9,
  createdAt: "2026-09-08T09:00:00.000Z",
};
const deal = { id: 9, email: "ops@acme.test", companyName: "Acme Ltd", status: "outreach", stage: "outreach" };

describe("dual-open enrol gate", () => {
  it("enrols only when sme_1 opened and sme_2 opened or clicked, silent, with a deal", () => {
    expect(isDualOpenConvertEligible({ mail: [sme1, sme2], deal })).toBe(true);
    expect(isDualOpenConvertEligible({ mail: [sme1], deal })).toBe(false);
    expect(
      isDualOpenConvertEligible({
        mail: [sme1, { ...sme2, opens: [], clicks: [{ url: `${CONVERT_SITE_ORIGIN}/cdfi-funding.html` }] }],
        deal,
      })
    ).toBe(true);
    expect(isDualOpenConvertEligible({ mail: [sme1, sme2], deal: null })).toBe(false);
    expect(isDualOpenConvertEligible({ mail: [sme1, sme2], deal: { ...deal, status: "failed" } })).toBe(false);
    expect(
      isDualOpenConvertEligible({
        mail: [sme1, sme2],
        deal: { ...deal, convertPlaybook: "sme_nurture" },
      })
    ).toBe(false);
    expect(
      isDualOpenConvertEligible({
        mail: [sme1, sme2],
        deal,
        inboundDeals: [{ source: "strata_inbound", email: "ops@acme.test" }],
      })
    ).toBe(false);
  });
});

describe("same-day N1 hold", () => {
  it("holds N1 on the London calendar day sme_2 was sent", () => {
    expect(
      shouldHoldN1ForSme2SameDay({
        sme2SentAt: "2026-09-08T09:00:00.000Z",
        now: new Date("2026-09-08T15:00:00.000Z"),
      })
    ).toBe(true);
    expect(
      shouldHoldN1ForSme2SameDay({
        sme2SentAt: "2026-09-08T09:00:00.000Z",
        now: new Date("2026-09-09T08:00:00.000Z"),
      })
    ).toBe(false);
  });
});

describe("click branch", () => {
  it("picks N2/N3 variants and skips N2 after a contact click", () => {
    expect(
      pickConvertTouchId({
        stepTouchId: "sme_n2",
        hasHmrcPetition: true,
        lastSiteClickUrl: `${CONVERT_SITE_ORIGIN}/?sf=n1#tools`,
      })
    ).toBe("sme_n2_hmrc");
    expect(
      pickConvertTouchId({
        stepTouchId: "sme_n2",
        hasHmrcPetition: false,
        lastSiteClickUrl: `${CONVERT_SITE_ORIGIN}/?sf=n1#tools`,
      })
    ).toBe("sme_n2_clicked");
    expect(
      pickConvertTouchId({
        stepTouchId: "sme_n3",
        hasHmrcPetition: false,
        lastSiteClickUrl: `${CONVERT_SITE_ORIGIN}/?sf=n2#contact`,
      })
    ).toBe("sme_n3_form");
    expect(shouldSkipN2ForContactClick(`${CONVERT_SITE_ORIGIN}/?sf=n1#contact`)).toBe(true);
    expect(siteClickKind(`${CONVERT_SITE_ORIGIN}/?sf=n1#tools`)).toBe("tools");
    expect(isStrataSiteUrl("https://learn.stratanexus.co.uk")).toBe(false);
  });
});

describe("tick planner", () => {
  it("sends N1 unless same-day hold, then N2/N3/closer", () => {
    const enrolled = { ...deal, convertPlaybook: "sme_nurture" as const, outreachTouch: 0 };
    expect(
      planConvertTick({
        deal: enrolled,
        sme2SentAt: "2026-09-08T09:00:00.000Z",
        now: new Date("2026-09-08T15:00:00.000Z"),
      })
    ).toEqual({ action: "hold", reason: "same_day_sme_2" });
    expect(
      planConvertTick({
        deal: enrolled,
        sme2SentAt: "2026-09-08T09:00:00.000Z",
        now: new Date("2026-09-09T09:00:00.000Z"),
      })
    ).toMatchObject({ action: "send", cadenceTouchId: "sme_n1", renderTouchId: "sme_n1" });
    expect(
      planConvertTick({
        deal: { ...enrolled, outreachTouch: 1 },
        lastSiteClickUrl: `${CONVERT_SITE_ORIGIN}/?sf=n1#contact`,
      })
    ).toMatchObject({ action: "send", cadenceTouchId: "sme_n3", renderTouchId: "sme_n3_form" });
    expect(planConvertTick({ deal: { ...enrolled, outreachTouch: 3 } })).toEqual({
      action: "queue_closer",
    });
  });
});

describe("90-day wake", () => {
  it("does not re-enrol while wakeAt is in the future, and wake_reenrol after 90 days", () => {
    const completed = {
      id: 9,
      email: "ops@acme.test",
      convertStopReason: "completed" as const,
      convertWakeAt: convertWakeAt(new Date("2026-09-20T12:00:00.000Z")),
      convertCycle: 1,
    };
    expect(
      isDualOpenConvertEligible({
        mail: [sme1, sme2],
        deal: completed,
        now: new Date("2026-09-21T10:00:00.000Z"),
      })
    ).toBe(false);
    expect(
      planConvertTick({
        deal: completed,
        now: new Date("2026-12-20T09:00:00.000Z"),
      })
    ).toEqual({ action: "wake_reenrol" });
    expect(
      planConvertTick({
        deal: { ...completed, convertStopReason: "opt_out" },
        now: new Date("2026-12-20T09:00:00.000Z"),
      })
    ).toEqual({ action: "stay_parked", reason: "opt_out" });
    expect(
      planConvertTick({
        deal: { ...completed, convertStopReason: "blocked", phone: "07700900000" },
        now: new Date("2026-12-20T09:00:00.000Z"),
      })
    ).toEqual({ action: "wake_reenrol" });
    expect(
      planConvertTick({
        deal: { ...completed, convertStopReason: "blocked" },
        now: new Date("2026-12-20T09:00:00.000Z"),
      })
    ).toEqual({ action: "stay_parked", reason: "bounce_no_phone" });
  });
});

describe("hard bounce convert tick", () => {
  it("stops email on bounce, queues C1 when a phone exists, and does not treat bounce as opt_out", () => {
    const enrolled = { ...deal, convertPlaybook: "sme_nurture" as const, outreachTouch: 1 };
    expect(
      planConvertTick({ deal: { ...enrolled, phone: "07700900000" }, emailHardBounced: true })
    ).toEqual({ action: "queue_closer" });
    expect(planConvertTick({ deal: enrolled, emailHardBounced: true })).toEqual({
      action: "stay_parked",
      reason: "bounce_no_phone",
    });
    expect(
      planConvertTick({
        deal: { ...enrolled, convertStopReason: "opt_out" },
        emailHardBounced: true,
        now: new Date("2026-09-09T09:00:00.000Z"),
      })
    ).toEqual({ action: "stay_parked", reason: "opt_out" });
    const bounce = [{
      email: "ops@acme.test",
      reason: "hard bounce — address does not exist",
      at: "2026-09-10T10:00:00.000Z",
    }];
    expect(isHardBounceMailbox("ops@acme.test", bounce)).toBe(true);
    expect(isOptOutSuppressed({ email: "ops@acme.test" }, bounce)).toBe(false);
  });
});

describe("wake and copy", () => {
  it("diaries 90 London days and guards copy", () => {
    expect(CONVERT_WAKE_DAYS).toBe(90);
    const wake = convertWakeAt(new Date("2026-09-20T12:00:00.000Z"));
    expect(shouldWakeConvert({ wakeAt: wake, now: new Date("2026-12-20T08:30:00.000Z") })).toBe(true);
    expect(shouldWakeConvert({ wakeAt: wake, now: new Date("2026-09-21T08:30:00.000Z") })).toBe(false);
    expect(convertGreetingName("David Cole")).toBe("David");
    expect(convertGreetingName("")).toBe("");
    expect(convertCopyOk({ subject: "Last note from me", text: `Hi,\n${CONVERT_SITE_ORIGIN}/?sf=n3#contact\nWe do not lend.\n${CONVERT_STOP_LINE}` }).ok).toBe(true);
    expect(convertCopyOk({ subject: "Call?", text: "got 10 minutes Thursday? https://learn.stratanexus.co.uk" }).ok).toBe(false);
    expect(buildCloserScript({ company: "Acme Ltd", name: "David", lastSiteClickUrl: null })).toMatch(/No site click/);
    expect(buildCloserScript({ company: "Acme Ltd", name: "David", lastSiteClickUrl: `${CONVERT_SITE_ORIGIN}/?sf=n2#tools` })).toMatch(/Last site click/);
  });
});

describe("convert cadence", () => {
  it("does not change hunt next step, and convert deals read SME_NURTURE_CADENCE", () => {
    expect(nextCadenceStep("sme", 3)?.touchId).toBe("sme_close");
    expect(SME_NURTURE_CADENCE.map((s) => s.touchId)).toEqual(["sme_n1", "sme_n2", "sme_n3", "sme_c1"]);
    expect(SME_NURTURE_CADENCE[3].autoSend).toBe(false);
    expect(SME_NURTURE_CADENCE[3].queueCall).toBe(false);
    expect(nextCadenceStepForDeal({ convertPlaybook: "sme_nurture" }, 0)?.touchId).toBe("sme_n1");
    expect(nextCadenceStepForDeal({ convertPlaybook: "sme_nurture" }, 3)?.touchId).toBe("sme_c1");
    const yaml = fs.readFileSync(path.resolve("shared/playbooks/sme_nurture.yaml"), "utf8");
    expect(yaml).toMatch(/playbook_id: sme_nurture/);
    expect(yaml).toMatch(/os_touch: sme_c1/);
    expect(yaml).toMatch(/If this isn't useful, reply stop and we won't email again/);
  });
});

describe("convert enrolment", () => {
  it("buildConvertEnrolment resets hunt index and stamps sme_nurture", () => {
    const built = buildConvertEnrolment(
      [sme1, sme2],
      { ...deal, outreachTouch: 3, callPlaybook: { title: "hunt" } as never },
      { id: "op-1", status: "new" },
      new Date("2026-09-09T09:00:00.000Z")
    );
    expect(built?.dealPatch.convertPlaybook).toBe("sme_nurture");
    expect(built?.dealPatch.outreachTouch).toBe(0);
    expect(built?.dealPatch.callPlaybook).toBeUndefined();
    expect(built?.openerId).toBe("op-1");
    expect(
      buildConvertEnrolment([sme1], deal, { id: "op-1" }, new Date("2026-09-09T09:00:00.000Z"))
    ).toBeNull();
  });

  it("returns waiting_human hunt-close deals to waiting_timer/outreach so N1 can tick", () => {
    const closed = {
      ...deal,
      status: "waiting_human",
      stage: "human_call",
      humanReason: "SME close call",
      outreachTouch: 3,
    };
    const patch = enrolConvertDealPatch(closed, { now: new Date("2026-09-09T09:00:00.000Z") });
    expect(patch.status).toBe("waiting_timer");
    expect(patch.stage).toBe("outreach");
    expect(patch.humanReason).toBeUndefined();
    expect(patch.convertPlaybook).toBe("sme_nurture");
    expect(patch.outreachTouch).toBe(0);
    const enrolled = { ...closed, ...patch };
    expect(
      planConvertTick({
        deal: enrolled,
        sme2SentAt: "2026-09-08T09:00:00.000Z",
        now: new Date("2026-09-09T09:00:00.000Z"),
      })
    ).toMatchObject({ action: "send", cadenceTouchId: "sme_n1" });
  });

  it("returns null when inboundDeals has strata_inbound matching the email", () => {
    const now = new Date("2026-09-09T09:00:00.000Z");
    expect(
      buildConvertEnrolment([sme1, sme2], deal, { id: "op-1" }, now, {
        inboundDeals: [{ source: "strata_inbound", email: "ops@acme.test" }],
      })
    ).toBeNull();
    expect(
      buildConvertEnrolment([sme1, sme2], deal, { id: "op-1" }, now, {
        blockedReason: "suppressed — do not contact",
      })
    ).toBeNull();
  });
});

describe("convert tick helpers", () => {
  it("maps completed cadence index after each N-mail, including skip-N2", () => {
    expect(nextOutreachTouchAfterSend("sme_n1")).toBe(1);
    expect(nextOutreachTouchAfterSend("sme_n2")).toBe(2);
    expect(nextOutreachTouchAfterSend("sme_n3")).toBe(3);
  });

  it("lets sme_nurture bypass hopper hold regardless of hopper state", () => {
    expect(convertOverridesHopperHold({ convertPlaybook: "sme_nurture", hopper: "parked" })).toBe(true);
    expect(convertOverridesHopperHold({ convertPlaybook: "sme_nurture", hopper: "sendable" })).toBe(true);
    expect(convertOverridesHopperHold({ hopper: "parked" })).toBe(false);
    expect(convertOverridesHopperHold({ convertPlaybook: "other", hopper: "queued" })).toBe(false);
  });

  it("reads sme_2 sentAt and last strata site click from Agent Mail", () => {
    expect(sme2SentAtFromMail([sme1, sme2])).toBe("2026-09-08T09:00:00.000Z");
    expect(sme2SentAtFromMail([{ ...sme2, touchId: "cold_2" }])).toBe("2026-09-08T09:00:00.000Z");
    expect(sme2SentAtFromMail([sme1])).toBeUndefined();
    expect(
      lastSiteClickUrlFromMail([
        {
          ...sme1,
          clicks: [{ at: "2026-09-08T11:00:00.000Z", url: `${CONVERT_SITE_ORIGIN}/?sf=n1#tools` }],
        },
      ])
    ).toBe(`${CONVERT_SITE_ORIGIN}/?sf=n1#tools`);
    expect(lastSiteClickUrlFromMail([sme1, sme2])).toBeNull();
  });
});
