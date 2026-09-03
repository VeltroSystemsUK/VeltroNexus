import { describe, expect, it } from "vitest";
import {
  hasExploreEnquiry,
  pickSmeOpenBackfill,
  replySubject,
  shouldSendSmeFollowUp,
  shouldSendSmeOpenFollowUp,
} from "@shared/smeOpenFollowUp";

const firstOpenMail = {
  direction: "outbound" as const,
  status: "sent" as const,
  touchId: "sme_1",
  opens: ["2026-09-03T10:00:00.000Z"],
  dealId: 42,
};

const liveDeal = {
  status: "waiting_timer" as const,
  stage: "fulfilment" as const,
  email: "ops@acmejoinery.co.uk",
  events: [] as Array<{ message?: string }>,
};

describe("shouldSendSmeOpenFollowUp", () => {
  it("sends on the first open of a delivered sme_1", () => {
    expect(shouldSendSmeOpenFollowUp({ mail: firstOpenMail, deal: liveDeal })).toBe(true);
  });

  it("retries a later open only if the quiz follow-up has not gone yet", () => {
    expect(
      shouldSendSmeOpenFollowUp({
        mail: { ...firstOpenMail, opens: ["2026-09-03T10:00:00.000Z", "2026-09-03T10:05:00.000Z"] },
        deal: liveDeal,
      })
    ).toBe(true);
  });

  it("does not send when a later cadence email is opened", () => {
    expect(shouldSendSmeOpenFollowUp({ mail: { ...firstOpenMail, touchId: "sme_2" }, deal: liveDeal })).toBe(false);
    expect(shouldSendSmeOpenFollowUp({ mail: { ...firstOpenMail, touchId: "sme_close" }, deal: liveDeal })).toBe(false);
    expect(shouldSendSmeOpenFollowUp({ mail: { ...firstOpenMail, touchId: "sme_open" }, deal: liveDeal })).toBe(false);
  });

  it("does not send twice if the quiz follow-up already went", () => {
    expect(
      shouldSendSmeOpenFollowUp({
        mail: firstOpenMail,
        deal: { ...liveDeal, smeOpenFollowUpSentAt: "2026-09-03T10:01:00.000Z" },
      })
    ).toBe(false);
  });

  it("does not send after a reply, opt-out, or failed file", () => {
    expect(
      shouldSendSmeOpenFollowUp({
        mail: firstOpenMail,
        deal: { ...liveDeal, events: [{ message: "Inbound reply from ops@acmejoinery.co.uk: Re: thanks" }] },
      })
    ).toBe(false);
    expect(
      shouldSendSmeOpenFollowUp({
        mail: firstOpenMail,
        deal: { ...liveDeal, events: [{ message: "Inbound opt-out from ops@acmejoinery.co.uk. Sequence stopped." }] },
      })
    ).toBe(false);
    expect(shouldSendSmeOpenFollowUp({ mail: firstOpenMail, deal: { ...liveDeal, status: "failed" } })).toBe(false);
    expect(shouldSendSmeOpenFollowUp({ mail: firstOpenMail, deal: { ...liveDeal, stage: "failed" } })).toBe(false);
  });

  it("treats an already-sent sme_1 without a touch stamp as sme_1", () => {
    expect(
      shouldSendSmeOpenFollowUp({
        mail: {
          ...firstOpenMail,
          touchId: undefined,
          subject: "Restructuring Acme Joinery Limited’s monthly debt commitments",
        },
        deal: liveDeal,
      })
    ).toBe(true);
    expect(
      shouldSendSmeOpenFollowUp({
        mail: {
          ...firstOpenMail,
          touchId: undefined,
          subject: "Case Study: Reducing £14,000/mo debt servicing to £3,200/mo",
        },
        deal: liveDeal,
      })
    ).toBe(false);
  });

  it("does not send mock mail, inbound mail, blocked mail, or a missing deal", () => {
    expect(shouldSendSmeOpenFollowUp({ mail: { ...firstOpenMail, status: "mock" }, deal: liveDeal })).toBe(false);
    expect(shouldSendSmeOpenFollowUp({ mail: { ...firstOpenMail, direction: "inbound" }, deal: liveDeal })).toBe(false);
    expect(shouldSendSmeOpenFollowUp({ mail: firstOpenMail, deal: liveDeal, blockedReason: "suppressed — do not contact" })).toBe(false);
    expect(shouldSendSmeOpenFollowUp({ mail: firstOpenMail, deal: null })).toBe(false);
    expect(shouldSendSmeOpenFollowUp({ mail: { ...firstOpenMail, opens: [] }, deal: liveDeal })).toBe(false);
  });
});

describe("pickSmeOpenBackfill", () => {
  it("picks one opened sme_1 per deal and ignores later touches and unopened mail", () => {
    const first = { ...firstOpenMail, dealId: 1, id: "a" };
    const duplicate = { ...firstOpenMail, dealId: 1, id: "b", opens: ["2026-09-03T11:00:00.000Z"] };
    const other = { ...firstOpenMail, dealId: 2, id: "c", subject: "Restructuring Other Ltd’s monthly debt commitments", touchId: undefined };
    const sme2 = { ...firstOpenMail, dealId: 3, id: "d", touchId: "sme_2" };
    const unopened = { ...firstOpenMail, dealId: 4, id: "e", opens: [] };
    const picked = pickSmeOpenBackfill([first, duplicate, other, sme2, unopened]);
    expect(picked.map((item) => item.dealId).sort()).toEqual([1, 2]);
  });
});

describe("replySubject", () => {
  it("threads under the original sme_1 subject without doubling Re:", () => {
    expect(replySubject("Restructuring Acme Joinery Limited’s monthly debt commitments")).toBe(
      "Re: Restructuring Acme Joinery Limited’s monthly debt commitments"
    );
    expect(replySubject("Re: Restructuring Acme Joinery Limited’s monthly debt commitments")).toBe(
      "Re: Restructuring Acme Joinery Limited’s monthly debt commitments"
    );
  });
});

const huntDeal = {
  id: 42,
  status: "waiting_timer" as const,
  stage: "fulfilment" as const,
  email: "ops@acmejoinery.co.uk",
  companyNumber: "12345678",
  source: "distress_scan" as const,
  smeOpenFollowUpSentAt: "2026-09-01T10:00:00.000Z",
  events: [] as Array<{ message?: string }>,
};

const now = "2026-09-03T10:00:00.000Z";

describe("hasExploreEnquiry", () => {
  it("is true when a matching inbound deal shares the email", () => {
    expect(
      hasExploreEnquiry(huntDeal, [
        { id: 99, source: "strata_inbound", email: "OPS@acmejoinery.co.uk", companyNumber: "99999999" },
      ])
    ).toBe(true);
  });

  it("is true when a matching inbound deal shares the company number", () => {
    expect(
      hasExploreEnquiry(huntDeal, [
        { id: 99, source: "strata_inbound", email: "other@firm.co.uk", companyNumber: "12345678" },
      ])
    ).toBe(true);
  });

  it("is false for a click with no inbound submission", () => {
    expect(hasExploreEnquiry(huntDeal, [])).toBe(false);
    expect(
      hasExploreEnquiry(huntDeal, [
        { id: 99, source: "distress_scan", email: "ops@acmejoinery.co.uk", companyNumber: "12345678" },
      ])
    ).toBe(false);
  });

  it("does not treat blank email or company number as a match", () => {
    expect(
      hasExploreEnquiry(
        { ...huntDeal, email: "", companyNumber: "" },
        [{ id: 99, source: "strata_inbound", email: "", companyNumber: "" }]
      )
    ).toBe(false);
  });
});

describe("shouldSendSmeFollowUp", () => {
  it("sends two days after sme_open when they have not enquired on Explore", () => {
    expect(shouldSendSmeFollowUp({ deal: huntDeal, now })).toBe(true);
  });

  it("still sends if they only clicked Explore and did not submit", () => {
    expect(shouldSendSmeFollowUp({ deal: huntDeal, now, inboundDeals: [] })).toBe(true);
  });

  it("waits until two days have passed", () => {
    expect(shouldSendSmeFollowUp({ deal: huntDeal, now: "2026-09-02T09:59:59.000Z" })).toBe(false);
    expect(shouldSendSmeFollowUp({ deal: { ...huntDeal, smeOpenFollowUpSentAt: undefined }, now })).toBe(false);
  });

  it("does not send when a matching Explore enquiry exists", () => {
    expect(
      shouldSendSmeFollowUp({
        deal: huntDeal,
        now,
        inboundDeals: [{ id: 99, source: "strata_inbound", email: "ops@acmejoinery.co.uk" }],
      })
    ).toBe(false);
  });

  it("does not send twice, after a reply, or on a failed file", () => {
    expect(shouldSendSmeFollowUp({ deal: { ...huntDeal, smeFollowupSentAt: now }, now })).toBe(false);
    expect(
      shouldSendSmeFollowUp({
        deal: { ...huntDeal, events: [{ message: "Inbound reply from ops@acmejoinery.co.uk: thanks" }] },
        now,
      })
    ).toBe(false);
    expect(shouldSendSmeFollowUp({ deal: { ...huntDeal, status: "failed" }, now })).toBe(false);
    expect(shouldSendSmeFollowUp({ deal: huntDeal, now, blockedReason: "suppressed — do not contact" })).toBe(false);
    expect(shouldSendSmeFollowUp({ deal: { ...huntDeal, email: "" }, now })).toBe(false);
  });
});
