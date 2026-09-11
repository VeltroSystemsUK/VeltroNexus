import { describe, expect, it } from "vitest";
import {
  coldEmailBlockedReason,
  emailMatchesCompany,
  isBlockedOutreachHost,
  isClearCompanyMismatch,
} from "@shared/pecrSend";
import {
  wasEmailDelivered,
  cadenceAfterOutreach,
  isWaitingLinkedInHold,
  linkedInHoldReleasePatch,
} from "@shared/outreachSend";

describe("PECR at send time", () => {
  it("blocks cold email to a personal mailbox", () => {
    expect(coldEmailBlockedReason("director@gmail.com", "sme")).toMatch(/personal/i);
    expect(coldEmailBlockedReason("jane@hotmail.co.uk", "introducer")).toMatch(/personal/i);
  });

  it("allows a corporate mailbox on a hunt file and any mailbox on inbound", () => {
    expect(coldEmailBlockedReason("accounts@acmejoinery.co.uk", "sme")).toBeNull();
    expect(coldEmailBlockedReason("dave@gmail.com", "inbound")).toBeNull();
  });

  it("blocks send when there is no address", () => {
    expect(coldEmailBlockedReason(undefined, "sme")).toMatch(/no email/i);
  });

  it("blocks Companies House and other .gov.uk mailboxes on hunt files", () => {
    expect(coldEmailBlockedReason("enquiries@companieshouse.gov.uk", "sme")).toMatch(/government|registry/i);
    expect(coldEmailBlockedReason("enquiries@hmrc.gov.uk", "sme")).toMatch(/government|registry/i);
    expect(coldEmailBlockedReason("info@endole.co.uk", "sme", "IHSAN PHARMA LTD")).toMatch(/registry|government/i);
    expect(isBlockedOutreachHost("find-and-update.company-information.service.gov.uk")).toBe(true);
    expect(isBlockedOutreachHost("open.endole.co.uk")).toBe(true);
    expect(isBlockedOutreachHost("daynurseries.co.uk")).toBe(true);
    expect(isBlockedOutreachHost("hemlock.co.uk")).toBe(false);
  });

  it("blocks a clear mismatch and allows a practical same-business domain", () => {
    expect(isClearCompanyMismatch("enquiries@peterboroughflyingschool.com", "MANOR ESTATES (SIBSON) LIMITED")).toBe(true);
    expect(isClearCompanyMismatch("precision@amfengineering.co.uk", "Phoenix C N C Engineering Ltd")).toBe(true);
    expect(isClearCompanyMismatch("info@newgensolutions.co.uk", "GET GENERATION ONE LTD")).toBe(true);
    expect(isClearCompanyMismatch("info@senadgroup.com", "WINSLOW COURT LTD")).toBe(true);
    expect(isClearCompanyMismatch("enquiries@hydegroup.com", "Manchester Precision Engineering Ltd")).toBe(true);
    expect(isClearCompanyMismatch("p.cobb@slidinghead.com", "Hemlock Engineering Ltd")).toBe(false);
    expect(isClearCompanyMismatch("enquiries@woodborough-hall.co.uk", "RJD INVESTMENTS LIMITED")).toBe(false);
    expect(
      coldEmailBlockedReason("enquiries@peterboroughflyingschool.com", "sme", "MANOR ESTATES (SIBSON) LIMITED")
    ).toMatch(/company/i);
    expect(coldEmailBlockedReason("p.cobb@slidinghead.com", "sme", "Hemlock Engineering Ltd")).toBeNull();
  });

  it("allows a mailbox whose domain is this company", () => {
    expect(emailMatchesCompany("sales@btscars.co.uk", "BTS CARS LTD")).toBe(true);
    expect(emailMatchesCompany("info@sbtengineering.co.uk", "SBT Engineering Services Ltd")).toBe(true);
    expect(emailMatchesCompany("contact@cleone.co.uk", "Cleone Foods Ltd")).toBe(true);
    expect(emailMatchesCompany("info@britishcables.com", "British Cables Company")).toBe(true);
    expect(emailMatchesCompany("customercare@breadltd.co.uk", "The Bread Factory")).toBe(true);
    expect(emailMatchesCompany("sales@glazerite.net", "GLAZERITE (EAST) LTD")).toBe(true);
    expect(emailMatchesCompany("catherine@pfms-online.co.uk", "PETERBOROUGH FINISHING & MAILING SERVICES LIMITED")).toBe(
      true
    );
    expect(emailMatchesCompany("info@h2hcare.co.uk", "H2H Community Care")).toBe(true);
    expect(emailMatchesCompany("sales@ae-uk.net", "Advanced Engineering (UK) Ltd")).toBe(true);
    expect(emailMatchesCompany("info@emsuk.net", "ELECTRICAL & MECHANICAL SERVICES (UK) LTD")).toBe(true);
    expect(emailMatchesCompany("enquiries@pep-ltd.co.uk", "Precision Engineering Plastics Ltd")).toBe(true);
    expect(emailMatchesCompany("christopher.down@khengineeringservices.co.uk", "KH Engineering Services")).toBe(true);
    expect(emailMatchesCompany("steve.holden@o-i.com", "O-I Glass Limited")).toBe(true);
    expect(emailMatchesCompany("anton.borg@osjct.co.uk", "The Orders of St John Care Trust - Head Office")).toBe(true);
    expect(emailMatchesCompany("quote@cdsconsulting.co.uk", "Construction Design Solutions")).toBe(true);
    expect(emailMatchesCompany("joanne.august@thefca.co.uk", "Foster Care Associates Nottingham")).toBe(true);
    expect(coldEmailBlockedReason("sales@btscars.co.uk", "sme", "BTS CARS LTD")).toBeNull();
  });
});

describe("email delivery vs mock", () => {
  it("does not treat a mock or failed send as delivered", () => {
    expect(wasEmailDelivered({ success: true, mock: true })).toBe(false);
    expect(wasEmailDelivered({ success: false, mock: true })).toBe(false);
    expect(wasEmailDelivered({ success: false })).toBe(false);
    expect(wasEmailDelivered(null)).toBe(false);
  });

  it("treats a real SMTP success as delivered", () => {
    expect(wasEmailDelivered({ success: true, messageId: "abc" })).toBe(true);
  });
});

describe("cadence after outreach", () => {
  it("holds the file when the auto-send did not actually leave the box", () => {
    expect(
      cadenceAfterOutreach({
        autoSend: true,
        isLinkedIn: false,
        delivered: false,
        blockReason: null,
      })
    ).toBe("hold_undelivered");
  });

  it("stages LinkedIn and starts the next email timer instead of parking on the director", () => {
    expect(
      cadenceAfterOutreach({
        autoSend: false,
        isLinkedIn: true,
        delivered: false,
        blockReason: null,
      })
    ).toBe("advance");
  });

  it("recognises a LinkedIn hold that is blocking the cadence", () => {
    expect(
      isWaitingLinkedInHold({
        status: "waiting_human",
        humanReason: "Post the LinkedIn copy, then mark it posted. The next email will not send until you do.",
        outreachTouchId: "sme_linkedin",
      })
    ).toBe(true);
    expect(
      isWaitingLinkedInHold({
        status: "waiting_human",
        humanReason: "They replied — you own the thread. Open Agent Mail.",
      })
    ).toBe(false);
  });

  it("releases a LinkedIn hold onto the Day 8 timer without sending now", () => {
    const now = new Date("2026-09-10T12:00:00.000Z");
    const patch = linkedInHoldReleasePatch(
      {
        status: "waiting_human",
        stage: "outreach",
        stream: "sme",
        source: "distress_scan",
        outreachTouch: 2,
        outreachTouchId: "sme_linkedin",
        humanReason: "Post the LinkedIn copy, then mark it posted. The next email will not send until you do.",
        updatedAt: "2026-09-07T09:00:00.000Z",
        events: [
          {
            at: "2026-09-07T09:00:00.000Z",
            stage: "outreach",
            agent: "outreach-sales",
            message: "Day 4 LinkedIn copy staged. Waiting for you to post.",
          },
        ],
      },
      now
    );
    expect(patch).toMatchObject({
      status: "waiting_timer",
      humanReason: undefined,
    });
    expect(patch?.waitUntil).toBe("2026-09-11T09:00:00.000Z");
  });

  it("makes an overdue LinkedIn hold due immediately so the next tick can send Day 8", () => {
    const now = new Date("2026-09-10T12:00:00.000Z");
    const patch = linkedInHoldReleasePatch(
      {
        status: "waiting_human",
        stage: "outreach",
        stream: "sme",
        outreachTouch: 2,
        humanReason: "Post the LinkedIn copy, then mark it posted.",
        updatedAt: "2026-09-04T09:00:00.000Z",
        events: [
          {
            at: "2026-09-04T09:00:00.000Z",
            stage: "outreach",
            message: "Day 4 LinkedIn copy staged. Waiting for you to post.",
          },
        ],
      },
      now
    );
    expect(patch?.status).toBe("waiting_timer");
    expect(patch?.waitUntil).toBe(now.toISOString());
  });

  it("holds on PECR rather than sending", () => {
    expect(
      cadenceAfterOutreach({
        autoSend: true,
        isLinkedIn: false,
        delivered: false,
        blockReason: "personal mailbox — PECR",
      })
    ).toBe("hold_pecr");
  });

  it("advances after a real email send", () => {
    expect(
      cadenceAfterOutreach({
        autoSend: true,
        isLinkedIn: false,
        delivered: true,
        blockReason: null,
      })
    ).toBe("advance");
  });
});
