import { describe, expect, it } from "vitest";
import {
  JAMES_SIGNATURE,
  classifyJamesInbound,
  composeJamesDraft,
  jamesPacketMarkdown,
  jamesRfc822,
  jamesShouldDraft,
  jamesReplySubject,
} from "@shared/jamesInbound";

describe("classifyJamesInbound", () => {
  it("never drafts STOP, bounces, or vendor pitches", () => {
    expect(classifyJamesInbound({ from: "ops@joinery.co.uk", text: "Please stop contacting us." })).toBe("J");
    expect(
      classifyJamesInbound({
        from: "mailer-daemon@kundenserver.de",
        subject: "Mail delivery failed",
        text: "* ops@joinery.co.uk",
      })
    ).toBe("K");
    expect(classifyJamesInbound({ from: "sales@lender.com", text: "Partnership opportunity to white-label our lending." })).toBe("L");
    expect(jamesShouldDraft("J")).toBe(false);
    expect(jamesShouldDraft("K")).toBe(false);
    expect(jamesShouldDraft("L")).toBe(false);
  });

  it("classes hot, warm, introducer, scheduling, distress", () => {
    expect(classifyJamesInbound({ from: "ops@joinery.co.uk", text: "Yes interested, what do you need from me?" })).toBe("A");
    expect(classifyJamesInbound({ from: "ops@joinery.co.uk", text: "Are you a lender? Are you FCA authorised?" })).toBe("B");
    expect(classifyJamesInbound({ from: "jane@accountants.co.uk", text: "I am an accountant. My client needs refinance." })).toBe("C");
    expect(classifyJamesInbound({ from: "ops@joinery.co.uk", text: "Can we talk Tuesday afternoon?" })).toBe("E");
    expect(
      classifyJamesInbound({
        from: "ops@joinery.co.uk",
        text: "Bailiffs are due and we have a winding-up hearing this week.",
      })
    ).toBe("H");
  });
});

describe("composeJamesDraft", () => {
  it("answers, stays packager, and signs as James", () => {
    const draft = composeJamesDraft({ from: "ops@joinery.co.uk", text: "Are you a lender?" }, "B");
    expect(draft).toMatch(/We do not lend/i);
    expect(draft).toContain(JAMES_SIGNATURE);
    expect(draft).not.toMatch(/you will qualify|pre-approved|we can definitely help/i);
    expect(jamesReplySubject("Restructuring the monthly debt")).toBe("Re: Restructuring the monthly debt");
  });
});

describe("packet and rfc822", () => {
  it("writes the approval packet shape and a Drafts-safe RFC822 with no SMTP fields of send", () => {
    const mail = { from: "Kirsty <ops@joinery.co.uk>", subject: "Re: facility", text: "What do you need?", messageId: "<abc@mail>" };
    const draft = composeJamesDraft(mail, "A");
    const md = jamesPacketMarkdown({
      mail,
      cls: "A",
      draft,
      receivedAt: "2026-09-04T10:00:00.000Z",
      draftReadyAt: "2026-09-04T10:05:00.000Z",
      sla: "met",
    });
    expect(md).toMatch(/Class: A Hot borrower/);
    expect(md).toMatch(/Flags: HOT/);
    expect(md).toContain(draft);

    const raw = jamesRfc822({
      fromAddress: "enquiries@stratafinance.co.uk",
      fromName: "James Hale · Business Consultant",
      to: "ops@joinery.co.uk",
      subject: "Re: facility",
      body: draft,
      inReplyTo: "<abc@mail>",
    });
    expect(raw).toMatch(/^From: James Hale/m);
    expect(raw).toMatch(/In-Reply-To: <abc@mail>/);
    expect(raw).not.toMatch(/SMTP/);
  });
});
