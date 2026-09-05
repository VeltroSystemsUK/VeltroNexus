import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { logAgentMail, clearAgentMail, setAgentMailStorePathForTests } from "../../services/agentMailLog";
import {
  draftJamesReply,
  setJamesDraftAppenderForTests,
  setJamesQueueDirForTests,
} from "../../services/jamesInbound";

function tmpQueue(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "james-queue-"));
  setJamesQueueDirForTests(dir);
  return dir;
}

beforeEach(() => {
  const file = path.join(os.tmpdir(), `agent-mail-${process.pid}-${Date.now()}.json`);
  setAgentMailStorePathForTests(file);
});

afterEach(() => {
  setJamesQueueDirForTests(null);
  setJamesDraftAppenderForTests(null);
  clearAgentMail();
  setAgentMailStorePathForTests(null);
});

describe("draftJamesReply", () => {
  it("writes a packet and RFC822 draft for a hot reply, never calling SMTP", async () => {
    const dir = tmpQueue();
    const appended: string[] = [];
    setJamesDraftAppenderForTests(async (raw) => {
      appended.push(raw);
    });
    const item = logAgentMail({
      direction: "inbound",
      from: "ops@joinery.co.uk",
      to: "enquiries@stratafinance.co.uk",
      subject: "Re: facility",
      text: "Yes interested, what do you need from me?",
      status: "received",
      messageId: "<thread-1@mail>",
    });
    const result = await draftJamesReply(item);
    expect(result.drafted).toBe(true);
    expect(result.cls).toBe("A");
    expect(result.packetPath && fs.existsSync(result.packetPath)).toBe(true);
    const md = fs.readFileSync(result.packetPath!, "utf8");
    expect(md).toMatch(/Class: A/);
    expect(appended.length).toBe(1);
    expect(appended[0]).toMatch(/To: ops@joinery.co.uk/);
    expect(appended[0]).toMatch(/We do not lend/i);
    expect(fs.readdirSync(dir).some((name) => name.endsWith(".md"))).toBe(true);
  });

  it("does not draft a STOP", async () => {
    setJamesQueueDirForTests(tmpQueue());
    const appended: string[] = [];
    setJamesDraftAppenderForTests(async (raw) => {
      appended.push(raw);
    });
    const item = logAgentMail({
      direction: "inbound",
      from: "ops@joinery.co.uk",
      to: "enquiries@stratafinance.co.uk",
      subject: "stop",
      text: "Please unsubscribe",
      status: "received",
    });
    const result = await draftJamesReply(item);
    expect(result.drafted).toBe(false);
    expect(result.cls).toBe("J");
    expect(appended).toEqual([]);
  });
});
