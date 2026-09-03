import { describe, expect, it } from "vitest";
import {
  MAILBOX_SEND_FLOOR,
  catchAllStatus,
  mailboxConfidence,
  mxFamily,
  smtpTrusted,
} from "@shared/mailboxScore";
import { harvestFromSearchSnippets } from "@shared/mailboxOsint";

describe("MX fingerprint", () => {
  it("treats Google, Microsoft, Mimecast and Proofpoint as untrusted for RCPT TO", () => {
    expect(mxFamily("aspmx.l.google.com")).toBe("google");
    expect(mxFamily("example-com.mail.protection.outlook.com")).toBe("microsoft");
    expect(mxFamily("eu-smtp-inbound-1.mimecast.com")).toBe("mimecast");
    expect(mxFamily("mx0a-000.pphosted.com")).toBe("proofpoint");
    expect(mxFamily("mx.ionos.co.uk")).toBe("other");
    expect(smtpTrusted("google")).toBe(false);
    expect(smtpTrusted("other")).toBe(true);
  });
});

describe("catch-all status", () => {
  it("needs two clean probes before calling a domain catch-all or not", () => {
    expect(catchAllStatus(["deliverable", "deliverable"])).toBe("catch_all");
    expect(catchAllStatus(["user_unknown", "user_unknown"])).toBe("not_catch_all");
    expect(catchAllStatus(["unknown", "user_unknown"])).toBe("unknown");
    expect(catchAllStatus(["deliverable"])).toBe("unknown");
  });
});

describe("mailbox confidence", () => {
  it("scores a cited company-domain mailbox with MX at 95 even when SMTP is unknown", () => {
    expect(
      mailboxConfidence({ source: "firecrawl", mx: true, smtp: "unknown", citedOnDomain: 1 })
    ).toBe(95);
    expect(
      mailboxConfidence({ source: "osint", mx: true, smtp: "unknown", citedOnDomain: 1 })
    ).toBe(95);
  });

  it("scores a guessed mailbox 95 only on SMTP 250 for a proven non-catch-all", () => {
    expect(
      mailboxConfidence({
        source: "domain",
        mx: true,
        smtp: "deliverable",
        catchAll: "not_catch_all",
        citedOnDomain: 0,
      })
    ).toBe(95);
    expect(
      mailboxConfidence({
        source: "domain",
        mx: true,
        smtp: "unknown",
        catchAll: "unknown",
        citedOnDomain: 0,
      })
    ).toBe(50);
    expect(
      mailboxConfidence({
        source: "domain",
        mx: true,
        smtp: "deliverable",
        catchAll: "catch_all",
        citedOnDomain: 0,
      })
    ).toBe(50);
    expect(
      mailboxConfidence({
        source: "domain",
        mx: true,
        smtp: "deliverable",
        catchAll: "catch_all",
        citedOnDomain: 2,
      })
    ).toBe(80);
  });

  it("does not attach below the send floor", () => {
    expect(MAILBOX_SEND_FLOOR).toBe(75);
    expect(mailboxConfidence({ source: "domain", mx: true, smtp: "user_unknown", citedOnDomain: 0 })).toBeLessThan(
      MAILBOX_SEND_FLOOR
    );
  });
});

describe("OSINT snippets", () => {
  it("keeps company-domain emails and websites from search text, dropping registries", () => {
    const hit = harvestFromSearchSnippets({
      companyName: "RammSanderson Ecology Limited",
      snippets: [
        "Specialist Ecological Consultants. info@rammsanderson.com www.rammsanderson.com",
        "Companies House https://find-and-update.company-information.service.gov.uk/company/08999992",
      ],
    });
    expect(hit.emails).toContain("info@rammsanderson.com");
    expect(hit.websites.some((url) => url.includes("rammsanderson.com"))).toBe(true);
    expect(hit.emails.some((email) => email.includes("companieshouse"))).toBe(false);
  });
});
