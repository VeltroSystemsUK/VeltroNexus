import { describe, expect, it } from "vitest";
import {
  agentMailInFolder,
  bounceRecipient,
  classifyInboundMail,
  isHardBounce,
  isHardBounceMailbox,
  isMailerDaemonAddress,
  isOptOutSuppressed,
  isSuppressed,
  normalizeSuppression,
} from "@shared/mailDesk";

describe("classifyInboundMail", () => {
  it("treats STOP and unsubscribe as opt-out", () => {
    expect(classifyInboundMail({ from: "jane@joinery.co.uk", subject: "Re: facility", text: "Please stop contacting us." }).kind).toBe("stop");
    expect(classifyInboundMail({ from: "jane@joinery.co.uk", subject: "unsubscribe", text: "" }).kind).toBe("stop");
  });

  it("treats STOP at the top of a long quoted reply as opt-out", () => {
    const quoted = `STOP\n\nSent from my iPhone\n\nOn 7 Sep 2026, at 08:31, James Hale wrote:\n\n> Hi Shaina,\n>${"x".repeat(2000)}`;
    expect(
      classifyInboundMail({
        from: "sales@scottswiftlimited.co.uk",
        subject: "Re: Restructuring GALVIN SCOTT LTD",
        text: quoted,
      }).kind
    ).toBe("stop");
    expect(
      classifyInboundMail({
        from: "sales@scottswiftlimited.co.uk",
        subject: "Re: Restructuring GALVIN SCOTT LTD",
        text: "",
        html: "<div>STOP</div><div>Sent from my iPhone</div><blockquote>On 7 Sep 2026 James wrote:<p>" + "x".repeat(2000) + "</p></blockquote>",
      }).kind
    ).toBe("stop");
  });

  it("treats not interested, wrong company, and do-not-contact-again as opt-out", () => {
    expect(
      classifyInboundMail({ from: "admin@musicindustrygroup.com", text: "We are not interested and don't require this service." }).kind
    ).toBe("stop");
    expect(
      classifyInboundMail({ from: "contact@vipersolution.co.uk", text: "You're emailing the wrong company mate." }).kind
    ).toBe("stop");
    expect(
      classifyInboundMail({ from: "admin@musicindustrygroup.com", text: "I already told you not to contact me" }).kind
    ).toBe("stop");
  });

  it("files automatic replies as other, not a live customer thread", () => {
    expect(
      classifyInboundMail({
        from: "accounts@vwflowers.co.uk",
        subject: "Automatic reply: Restructuring VAN WONDEREN FLOWERS LTD",
        text: "Thank you for contacting van Wonderen Flowers. We are not always at our PC.",
      }).kind
    ).toBe("other");
    expect(
      classifyInboundMail({
        from: "info@immigrationsecure.co.uk",
        subject: "Thank You for Contacting Us - Response Within 24 Hours",
        text: "A member of our team will be in touch.",
      }).kind
    ).toBe("other");
    expect(
      classifyInboundMail({
        from: "info@speedyfasteners.com",
        subject: "Re: Restructuring SPEEDY FASTENERS LTD",
        text: "Hi James, Thanks for your email, I’ll look in to it.",
      }).kind
    ).toBe("responsive");
  });

  it("does not treat a live customer reply as opt-out", () => {
    expect(
      classifyInboundMail({
        from: "homecraftersuk@gmail.com",
        subject: "Re: Thanks for your enquiry",
        text: "I’m pleased to hear that you may be able to help. I have attached the information.",
      }).kind
    ).not.toBe("stop");
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

  it("treats Microsoft 365 unknown-recipient undeliverable mail as a hard bounce", () => {
    const bounce = classifyInboundMail({
      from: "postmaster@netorgft5702276.onmicrosoft.com",
      subject: "Undeliverable: Restructuring Underground Bakery’s monthly debt commitments",
      text: "Your message to marcus.fisk@theundergroundbakery.co.uk couldn't be delivered.\nmarcus.fisk wasn't found at theundergroundbakery.co.uk.\nUnknown To address",
    });
    expect(bounce.kind).toBe("bounce");
    expect(bounce.recipient).toBe("marcus.fisk@theundergroundbakery.co.uk");
    expect(isHardBounce(bounce.reason || "")).toBe(true);
    expect(bounce.reason).toMatch(/wasn't found/i);
  });

  it("does not treat sender-blocked 5.7.1 as a hard bounce", () => {
    const bounce = classifyInboundMail({
      from: "mailer-daemon@fr-int-smtpin21.hostinger.io",
      subject: "Undelivered Mail Returned to Sender",
      text: "<shopryansretail@gmail.com>: host smtp.mailchannels.net said: 550 5.7.1 [ESA] Sender blocked.",
    });
    expect(bounce.kind).toBe("bounce");
    expect(isHardBounce(bounce.reason || "")).toBe(false);
    expect(isHardBounce("550 5.7.1 [ESA] Sender blocked.")).toBe(false);
  });

  it("does not treat mailbox-full as a hard bounce", () => {
    const bounce = classifyInboundMail({
      from: "mailer-daemon@s12.tarhelyadmin.com",
      subject: "Mail delivery failed: returning message to sender",
      text: "This is a permanent error. The following address(es) failed:\n\n  mail@gopkft.com\n    LMTP error after RCPT TO:<mail@gopkft.com>: 452 4.2.2 Mailbox is full",
    });
    expect(bounce.kind).toBe("bounce");
    expect(isHardBounce(bounce.reason || "")).toBe(false);
    expect(isHardBounce("452 4.2.2 Mailbox is full")).toBe(false);
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
  });

  it("blocks every mailbox at the same corporate domain after one opt-out", () => {
    const list = [{ email: "admin@northpeak.co.uk", reason: "opt-out", at: "2026-09-07T18:19:27.000Z" }];
    expect(isSuppressed({ email: "accounts@northpeak.co.uk" }, list)).toBe(true);
    expect(isSuppressed({ email: "ops@joinery.co.uk" }, list)).toBe(false);
  });

  it("does not treat a personal-domain opt-out as blocking every Gmail address", () => {
    const list = [{ email: "jane@gmail.com", reason: "opt-out", at: "2026-09-07T18:19:27.000Z" }];
    expect(isSuppressed({ email: "jane@gmail.com" }, list)).toBe(true);
    expect(isSuppressed({ email: "other@gmail.com" }, list)).toBe(false);
  });

  it("never contacts admin@musicindustrygroup.com even with an empty list", () => {
    expect(isSuppressed({ email: "Admin@MusicIndustryGroup.com" }, [])).toBe(true);
    expect(isSuppressed({ email: "accounts@musicindustrygroup.com" }, [])).toBe(true);
    expect(isSuppressed({ companyNumber: "OC421480" }, [])).toBe(true);
  });

  it("strips company number from hard-bounce rows so old files stop painting the firm", () => {
    const [row] = normalizeSuppression([{
      email: "dean.cook@bapp.co.uk",
      companyNumber: "03049757",
      reason: "hard bounce — address does not exist",
      at: "2026-09-02T05:23:49.000Z",
    }]);
    expect(row.companyNumber).toBeUndefined();
    expect(row.email).toBe("dean.cook@bapp.co.uk");
  });

  it("hard bounce suppresses that mailbox only, not the company or domain", () => {
    const list = [{
      email: "dean.cook@bapp.co.uk",
      companyNumber: "03049757",
      reason: "hard bounce — address does not exist",
      at: "2026-09-02T05:23:49.000Z",
    }];
    expect(isSuppressed({ email: "dean.cook@bapp.co.uk" }, list)).toBe(true);
    expect(isSuppressed({ email: "sales@bapp.co.uk" }, list)).toBe(false);
    expect(isSuppressed({ companyNumber: "03049757" }, list)).toBe(false);
    expect(isHardBounceMailbox("dean.cook@bapp.co.uk", list)).toBe(true);
    expect(isOptOutSuppressed({ email: "dean.cook@bapp.co.uk" }, list)).toBe(false);
    expect(isOptOutSuppressed({ email: "sales@bapp.co.uk" }, list)).toBe(false);
  });

  it("does not treat bounce-only suppression as organisation STOP", () => {
    const bounce = [{
      email: "ops@acme.test",
      reason: "hard bounce — address does not exist",
      at: "2026-09-10T10:00:00.000Z",
    }];
    const optOut = [{
      email: "ops@acme.test",
      companyNumber: "08765432",
      reason: "opt-out",
      at: "2026-09-10T10:00:00.000Z",
    }];
    expect(isOptOutSuppressed({ email: "ops@acme.test" }, bounce)).toBe(false);
    expect(isOptOutSuppressed({ email: "ops@acme.test", companyNumber: "08765432" }, optOut)).toBe(true);
    expect(isOptOutSuppressed({ email: "accounts@acme.test", companyNumber: "08765432" }, optOut)).toBe(true);
  });
});

describe("bounceRecipient", () => {
  it("pulls the starred failed address from IONOS copy", () => {
    expect(bounceRecipient("could not be reached:\n* ops@works.co.uk\n")).toBe("ops@works.co.uk");
  });

  it("pulls the address from Microsoft 365 undeliverable copy", () => {
    expect(
      bounceRecipient("Your message to marcus.fisk@theundergroundbakery.co.uk couldn't be delivered.")
    ).toBe("marcus.fisk@theundergroundbakery.co.uk");
  });

  it("pulls the address from an Exchange mailto line", () => {
    expect(
      bounceRecipient("jackie.doe@endotec.co.uk<mailto:jackie.doe@endotec.co.uk>\nThe email address you entered couldn't be found.")
    ).toBe("jackie.doe@endotec.co.uk");
  });
});

describe("isMailerDaemonAddress", () => {
  it("matches mailer-daemon in the from address, including display names", () => {
    expect(isMailerDaemonAddress("mailer-daemon@kundenserver.de")).toBe(true);
    expect(isMailerDaemonAddress("Mail Delivery System <MAILER-DAEMON@ionos.co.uk>")).toBe(true);
    expect(isMailerDaemonAddress("ops@joinery.co.uk")).toBe(false);
    expect(isMailerDaemonAddress("postmaster@ionos.co.uk")).toBe(false);
  });
});

describe("agentMailInFolder", () => {
  const bounce = { from: "mailer-daemon@kundenserver.de", direction: "inbound" as const };
  const inbound = { from: "ops@joinery.co.uk", direction: "inbound" as const };
  const sent = {
    from: "enquiries@stratafinance.co.uk",
    direction: "outbound" as const,
    opens: ["2026-09-01T00:00:00.000Z"],
  };

  it("files mailer-daemon only in quarantine and hides it from inbox and all", () => {
    expect(agentMailInFolder(bounce, "quarantine")).toBe(true);
    expect(agentMailInFolder(bounce, "inbox")).toBe(false);
    expect(agentMailInFolder(bounce, "all")).toBe(false);
    expect(agentMailInFolder(bounce, "sent")).toBe(false);
    expect(agentMailInFolder(bounce, "opened")).toBe(false);
  });

  it("keeps ordinary mail in inbox and all, not quarantine", () => {
    expect(agentMailInFolder(inbound, "inbox")).toBe(true);
    expect(agentMailInFolder(inbound, "all")).toBe(true);
    expect(agentMailInFolder(inbound, "quarantine")).toBe(false);
    expect(agentMailInFolder(sent, "sent")).toBe(true);
    expect(agentMailInFolder(sent, "opened")).toBe(true);
    expect(agentMailInFolder(sent, "quarantine")).toBe(false);
  });
});
