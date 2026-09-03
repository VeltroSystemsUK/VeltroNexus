import { describe, expect, it } from "vitest";
import {
  bounceRecipient,
  classifyInboundMail,
  isHardBounce,
  isSuppressed,
} from "@shared/mailDesk";

describe("classifyInboundMail", () => {
  it("treats STOP and unsubscribe as opt-out", () => {
    expect(classifyInboundMail({ from: "jane@joinery.co.uk", subject: "Re: facility", text: "Please stop contacting us." }).kind).toBe("stop");
    expect(classifyInboundMail({ from: "jane@joinery.co.uk", subject: "unsubscribe", text: "" }).kind).toBe("stop");
  });

  it("reads IONOS delivery-failure bounces and the failed address", () => {
    const bounce = classifyInboundMail({
      from: "mailer-daemon@kundenserver.de",
      subject: "Mail delivery failed: returning message to sender",
      text: "The following recipient address(es) could not be reached:\n\n* declan.blackwood@wearedefy.co.uk\n\nThe email address may no longer exist",
    });
    expect(bounce.kind).toBe("bounce");
    expect(bounce.recipient).toBe("declan.blackwood@wearedefy.co.uk");
    expect(isHardBounce(bounce.reason || "")).toBe(true);
  });

  it("drops IONOS welcome mail and unrelated marketing as spam", () => {
    expect(classifyInboundMail({ from: "support@ionos.co.uk", subject: "Welcome to Mail Basic", text: "Thanks for choosing IONOS" }).kind).toBe("spam");
    expect(classifyInboundMail({ from: "deals@newsletter.example", subject: "Your weekly crypto digest", text: "Unsubscribe" }).kind).toBe("spam");
  });

  it("flags a human customer reply as responsive", () => {
    expect(
      classifyInboundMail({
        from: "customercare@breadltd.co.uk",
        subject: "Thank you for contacting The Bread Factory Customer Care team",
        text: "Thanks for your email. A member of the team will call you.",
      }).kind
    ).toBe("responsive");
    expect(
      classifyInboundMail({
        from: "ops@joinery.co.uk",
        subject: "Re: restructuring",
        text: "Yes, interested — can we book a call Thursday?",
      }).kind
    ).toBe("responsive");
  });

  it("does not treat the operator's own tests as a customer", () => {
    expect(classifyInboundMail({ from: "shaun@veltro.co.uk", subject: "Test", text: "Test" }).kind).toBe("other");
  });

  it("treats Companies House auto-acks as not a customer", () => {
    expect(
      classifyInboundMail({
        from: "enquiries@companieshouse.gov.uk",
        subject: "RE: Your Communication with Companies House, Ref: COH2305305X",
        text: "The Companies House Enquiries Team has received your email. A response will be with you shortly.",
      }).kind
    ).toBe("spam");
  });
});

describe("suppression", () => {
  it("matches email or company number forever", () => {
    const list = [{ email: "jane@joinery.co.uk", companyNumber: "01234567" }];
    expect(isSuppressed({ email: "Jane@Joinery.co.uk" }, list)).toBe(true);
    expect(isSuppressed({ companyNumber: "01234567" }, list)).toBe(true);
    expect(isSuppressed({ email: "other@joinery.co.uk", companyNumber: "999" }, list)).toBe(false);
  });
});

describe("bounceRecipient", () => {
  it("pulls the starred failed address from IONOS copy", () => {
    expect(bounceRecipient("could not be reached:\n* ops@works.co.uk\n")).toBe("ops@works.co.uk");
  });
});
