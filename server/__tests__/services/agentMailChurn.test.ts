import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deleteAgentMail,
  inboundMessageIds,
  logAgentMail,
  setAgentMailBackupDirForTests,
  setAgentMailStorePathForTests,
} from "../../services/agentMailLog";

afterEach(() => {
  setAgentMailStorePathForTests(null);
  setAgentMailBackupDirForTests(null);
});

describe("agent mail churn guards", () => {
  it("a deleted inbound message stays 'known' so the IMAP poll does not re-ingest it", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-mail-churn-"));
    setAgentMailStorePathForTests(path.join(root, "agent_mail.json"));
    setAgentMailBackupDirForTests(path.join(root, "backups"));

    const bounce = logAgentMail({
      direction: "inbound",
      from: "postmaster@example.co.uk",
      to: "enquiries@stratafinance.co.uk",
      subject: "Undeliverable: hello",
      text: "550 5.1.1 user unknown",
      messageId: "<bounce-1@example.co.uk>",
    } as any);
    expect(inboundMessageIds().has("<bounce-1@example.co.uk>")).toBe(true);

    expect(deleteAgentMail(bounce.id)).toBe(true);
    // Gone from the store, but still known to the poll.
    expect(inboundMessageIds().has("<bounce-1@example.co.uk>")).toBe(true);
    expect(deleteAgentMail(bounce.id)).toBe(false);
  });

  it("GET /api/agent-mail no longer re-runs inbox processing", () => {
    const src = fs.readFileSync(path.resolve("server/routes/agentMail.ts"), "utf8");
    const handler = src.slice(src.indexOf('router.get("/api/agent-mail"'), src.indexOf('router.post("/api/agent-mail/sync"'));
    expect(handler).not.toMatch(/processAgentInbox\(/);
  });

  it("prospects router (mounted at /api) never repeats the /api prefix", () => {
    const src = fs.readFileSync(path.resolve("server/routes/prospects.ts"), "utf8");
    expect(src).not.toMatch(/^\s+"\/api\//m);
    expect(src).toMatch(/"\/due-diligence\/summaries"/);
  });
});
