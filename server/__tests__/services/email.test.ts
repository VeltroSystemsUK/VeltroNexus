import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/mailDesk", () => ({
  mailIsSuppressed: vi.fn(),
}));

import { mailIsSuppressed } from "../../services/mailDesk";
import { sendEmail } from "../../services/email";
import { listAgentMail, setAgentMailStorePathForTests } from "../../services/agentMailLog";
import { listUnsubscribeHeaders } from "@shared/listUnsubscribe";

const { sendMail } = vi.hoisted(() => ({
  sendMail: vi.fn().mockResolvedValue({ messageId: "<id@test>" }),
}));
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail }),
  },
}));

const mockedSuppressed = mailIsSuppressed as unknown as ReturnType<typeof vi.fn>;
const storeFiles = new Set<string>();

describe("sendEmail suppression gate", () => {
  beforeEach(() => {
    mockedSuppressed.mockReset();
    mockedSuppressed.mockReturnValue(false);
    const file = path.join(os.tmpdir(), `agent-mail-email-${process.pid}-${Date.now()}.json`);
    setAgentMailStorePathForTests(file);
    storeFiles.add(file);
  });

  afterEach(() => {
    setAgentMailStorePathForTests(null);
    for (const file of storeFiles) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
    storeFiles.clear();
  });

  it("does not send to a suppressed address", async () => {
    mockedSuppressed.mockReturnValue(true);
    const result = await sendEmail({}, "info@lovelouie.co.uk", "Hi", "Please read");
    expect(result.success).toBe(false);
    expect(result.blocked).toBe("suppressed");
    expect(result.mock).not.toBe(true);
  });

  it("still mocks when SMTP is missing for a live address", async () => {
    const result = await sendEmail({}, "ok@joinery.co.uk", "Hi", "Please read");
    expect(result.blocked).toBeUndefined();
    expect(result.mock).toBe(true);
  });
});

describe("sendEmail contactSource stamp", () => {
  beforeEach(() => {
    mockedSuppressed.mockReset();
    mockedSuppressed.mockReturnValue(false);
    const file = path.join(os.tmpdir(), `agent-mail-email-${process.pid}-${Date.now()}.json`);
    setAgentMailStorePathForTests(file);
    storeFiles.add(file);
  });

  afterEach(() => {
    setAgentMailStorePathForTests(null);
    for (const file of storeFiles) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
    storeFiles.clear();
  });

  it("stamps domain contactSource on the Agent Mail row", async () => {
    await sendEmail(
      { contactSource: "domain", dealId: 9, touchId: "sme_1" },
      "adam.taylor@petshop.co.uk",
      "Hi",
      "Please read"
    );
    const row = listAgentMail(10).find((item) => item.to === "adam.taylor@petshop.co.uk");
    expect(row?.contactSource).toBe("domain");
    expect(row?.status).toBe("mock");
  });

  it("does not stamp contactSource when the deal was not a guess", async () => {
    await sendEmail({}, "info@petshop.co.uk", "Hi", "Please read");
    const row = listAgentMail(10).find((item) => item.to === "info@petshop.co.uk");
    expect(row?.contactSource).toBeUndefined();
  });
});

describe("sendEmail List-Unsubscribe", () => {
  const prev = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SESSION_SECRET: process.env.SESSION_SECRET,
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
    APP_URL: process.env.APP_URL,
    HELLO_PUBLIC_URL: process.env.HELLO_PUBLIC_URL,
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
  };

  beforeEach(() => {
    mockedSuppressed.mockReset();
    mockedSuppressed.mockReturnValue(false);
    sendMail.mockClear();
    const file = path.join(os.tmpdir(), `agent-mail-unsub-${process.pid}-${Date.now()}.json`);
    setAgentMailStorePathForTests(file);
    storeFiles.add(file);
    process.env.SMTP_HOST = "smtp.test";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "enquiries@stratafinance.co.uk";
    process.env.SMTP_PASS = "test-pass";
    process.env.SESSION_SECRET = "test-unsubscribe-secret";
    process.env.PUBLIC_APP_URL = "https://leads.stratanexus.co.uk";
    delete process.env.APP_URL;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
  });

  afterEach(() => {
    setAgentMailStorePathForTests(null);
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const file of storeFiles) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
    storeFiles.clear();
  });

  it("sends RFC 8058 List-Unsubscribe headers on live SMTP", async () => {
    const result = await sendEmail(
      { fromEmail: "enquiries@stratafinance.co.uk", fromName: "James Hale", replyTo: "enquiries@stratafinance.co.uk" },
      "ops@northpeak.co.uk",
      "Hi",
      "Please read"
    );
    expect(result.success).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
    const payload = sendMail.mock.calls[0][0];
    const expected = listUnsubscribeHeaders({
      baseUrl: "https://leads.stratanexus.co.uk",
      email: "ops@northpeak.co.uk",
      from: "enquiries@stratafinance.co.uk",
      secret: "test-unsubscribe-secret",
    });
    expect(payload.headers["List-Unsubscribe"]).toBe(expected["List-Unsubscribe"]);
    expect(payload.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("stamps live open and click trackers, never localhost", async () => {
    delete process.env.PUBLIC_APP_URL;
    delete process.env.APP_URL;
    process.env.HELLO_PUBLIC_URL = "https://leads.stratanexus.co.uk";
    const result = await sendEmail(
      { fromEmail: "enquiries@stratafinance.co.uk", fromName: "Shaun Tuhey" },
      "ops@northpeak.co.uk",
      "A private note",
      `<p><a href="https://leads.stratanexus.co.uk/briefing/tok">Open your briefing</a></p>`
    );
    expect(result.success).toBe(true);
    const html = String(sendMail.mock.calls[0][0].html);
    expect(html).toContain("https://leads.stratanexus.co.uk/api/agent-mail/track/");
    expect(html).toContain("https://leads.stratanexus.co.uk/api/agent-mail/click/");
    expect(html).not.toMatch(/127\.0\.0\.1/);
  });

  it("does not SMTP-send if there is no public tracking host", async () => {
    delete process.env.PUBLIC_APP_URL;
    delete process.env.APP_URL;
    delete process.env.HELLO_PUBLIC_URL;
    const result = await sendEmail(
      { fromEmail: "enquiries@stratafinance.co.uk" },
      "ops@northpeak.co.uk",
      "A private note",
      `<p><a href="https://leads.stratanexus.co.uk/briefing/tok">Open your briefing</a></p>`
    );
    expect(result.success).toBe(false);
    expect(result.blocked).toBe("no_public_tracking");
    expect(sendMail).not.toHaveBeenCalled();
  });
});
