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
