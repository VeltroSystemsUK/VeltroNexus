import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearAgentMail,
  deleteAgentMail,
  listAgentMail,
  logAgentMail,
  recordClick,
  recordDwell,
  backupAgentMailNow,
  maybeRunDailyMailBackup,
  setAgentMailBackupDirForTests,
  setAgentMailStorePathForTests,
} from "../../services/agentMailLog";
import { listOpeners, setOpenersStorePathForTests } from "../../services/openers";

const LIVE = path.resolve(process.cwd(), "uploads", "agent_mail.json");

afterEach(() => {
  setAgentMailBackupDirForTests(null);
  setAgentMailStorePathForTests(null);
  setOpenersStorePathForTests(null);
});

function tmpPair() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-mail-bak-"));
  const file = path.join(root, "agent_mail.json");
  const backups = path.join(root, "backups");
  setAgentMailStorePathForTests(file);
  setAgentMailBackupDirForTests(backups);
  return { root, file, backups };
}

describe("agentMailLog store isolation", () => {
  it("refuses to clear the live store", () => {
    expect(() => clearAgentMail()).toThrow(/refused/i);
  });

  it("writes and clears only the override path", () => {
    const before = fs.existsSync(LIVE) ? fs.readFileSync(LIVE, "utf8") : "";
    const file = path.join(os.tmpdir(), `agent-mail-iso-${process.pid}-${Date.now()}.json`);
    setAgentMailStorePathForTests(file);
    logAgentMail({
      direction: "outbound",
      from: "james@stratafinance.co.uk",
      to: "ops@example.co.uk",
      subject: "isolation",
      text: "probe",
      status: "sent",
    });
    expect(listAgentMail().length).toBe(1);
    expect(fs.existsSync(file)).toBe(true);
    clearAgentMail();
    expect(listAgentMail()).toEqual([]);
    setAgentMailStorePathForTests(null);
    const after = fs.existsSync(LIVE) ? fs.readFileSync(LIVE, "utf8") : "";
    expect(after).toBe(before);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  it("does not insert a second row for the same message-id and keeps attachments", () => {
    const file = path.join(os.tmpdir(), `agent-mail-dedupe-${process.pid}-${Date.now()}.json`);
    setAgentMailStorePathForTests(file);
    const first = logAgentMail({
      direction: "inbound",
      from: "kirsty@example.co.uk",
      to: "enquiries@stratafinance.co.uk",
      subject: "pack",
      text: "files attached",
      status: "received",
      messageId: "<same@mail>",
    });
    const second = logAgentMail({
      direction: "inbound",
      from: "kirsty@example.co.uk",
      to: "enquiries@stratafinance.co.uk",
      subject: "pack",
      text: "files attached",
      status: "received",
      messageId: "<same@mail>",
      attachments: [
        {
          index: 0,
          filename: "statement.pdf",
          storedName: "0-statement.pdf",
          contentType: "application/pdf",
          size: 12,
        },
      ],
    });
    const rows = listAgentMail();
    expect(rows).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(rows[0].attachments).toEqual([
      {
        index: 0,
        filename: "statement.pdf",
        storedName: "0-statement.pdf",
        contentType: "application/pdf",
        size: 12,
      },
    ]);
    setAgentMailStorePathForTests(null);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  it("does not drop older mail once the store passes 2000", () => {
    const file = path.join(os.tmpdir(), `agent-mail-keep-${process.pid}-${Date.now()}.json`);
    setAgentMailStorePathForTests(file);
    const seed = Array.from({ length: 2000 }, (_, i) => ({
      id: `old-${i}`,
      createdAt: "2026-09-01T00:00:00.000Z",
      direction: "outbound" as const,
      from: "james@stratafinance.co.uk",
      to: "ops@example.co.uk",
      subject: "seed",
      text: "x",
      status: "sent" as const,
    }));
    fs.writeFileSync(file, JSON.stringify(seed));
    logAgentMail({
      direction: "outbound",
      from: "james@stratafinance.co.uk",
      to: "ops@example.co.uk",
      subject: "newest",
      text: "x",
      status: "sent",
    });
    const rows = listAgentMail(10000);
    expect(rows).toHaveLength(2001);
    expect(rows.some((row) => row.id === "old-0")).toBe(true);
    setAgentMailStorePathForTests(null);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  it("recordClick upserts clickCount onto the opener", () => {
    const file = path.join(os.tmpdir(), `agent-mail-click-${process.pid}-${Date.now()}.json`);
    const openerFile = path.join(os.tmpdir(), `openers-click-${process.pid}-${Date.now()}.json`);
    setAgentMailStorePathForTests(file);
    setOpenersStorePathForTests(openerFile);
    const item = logAgentMail({
      direction: "outbound",
      from: "james@stratafinance.co.uk",
      to: "ops@example.co.uk",
      subject: "click me",
      text: "probe",
      status: "sent",
    });
    recordClick(item.id, "https://example.com/pack");
    expect(listOpeners()[0]?.email).toBe("ops@example.co.uk");
    expect(listOpeners()[0]?.clickCount).toBe(1);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    if (fs.existsSync(openerFile)) fs.unlinkSync(openerFile);
  });

  it("recordDwell upserts dwellCount onto the opener", () => {
    const file = path.join(os.tmpdir(), `agent-mail-dwell-${process.pid}-${Date.now()}.json`);
    const openerFile = path.join(os.tmpdir(), `openers-dwell-${process.pid}-${Date.now()}.json`);
    setAgentMailStorePathForTests(file);
    setOpenersStorePathForTests(openerFile);
    const item = logAgentMail({
      direction: "outbound",
      from: "james@stratafinance.co.uk",
      to: "ops@example.co.uk",
      subject: "dwell me",
      text: "probe",
      status: "sent",
    });
    recordDwell(item.id, { path: "/#tools", sf: "n1" });
    expect(listOpeners()[0]?.email).toBe("ops@example.co.uk");
    expect(listOpeners()[0]?.dwellCount).toBe(1);
    expect(listAgentMail(10).find((row) => row.id === item.id)?.dwells?.[0]?.sf).toBe("n1");
    if (fs.existsSync(file)) fs.unlinkSync(file);
    if (fs.existsSync(openerFile)) fs.unlinkSync(openerFile);
  });
});

describe("agentMailLog local backups", () => {
  it("does not copy to the backup folder on an ordinary write", () => {
    const { backups } = tmpPair();
    logAgentMail({
      direction: "outbound",
      from: "james@stratafinance.co.uk",
      to: "ops@example.co.uk",
      subject: "first",
      text: "x",
      status: "sent",
    });
    expect(fs.existsSync(backups) ? fs.readdirSync(backups) : []).toEqual([]);
  });

  it("copies the live file next to itself before a shrinking write", () => {
    const { file } = tmpPair();
    const first = logAgentMail({
      direction: "outbound",
      from: "james@stratafinance.co.uk",
      to: "ops@example.co.uk",
      subject: "keep",
      text: "x",
      status: "sent",
    });
    logAgentMail({
      direction: "outbound",
      from: "james@stratafinance.co.uk",
      to: "ops@example.co.uk",
      subject: "drop",
      text: "y",
      status: "sent",
    });
    deleteAgentMail(first.id);
    const prev = path.join(path.dirname(file), "agent_mail.prev.json");
    expect(fs.existsSync(prev)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(prev, "utf8")) as Array<{ id: string }>;
    expect(saved.some((row) => row.id === first.id)).toBe(true);
  });

  it("writes one London-dated copy at 03:00 and prunes files older than 14 days", () => {
    const { backups } = tmpPair();
    logAgentMail({
      direction: "outbound",
      from: "james@stratafinance.co.uk",
      to: "ops@example.co.uk",
      subject: "a",
      text: "x",
      status: "sent",
    });
    const beforeThree = new Date("2026-09-04T01:59:00.000Z");
    const atThree = new Date("2026-09-04T02:00:00.000Z");
    expect(maybeRunDailyMailBackup(beforeThree)).toBeNull();
    const dest = maybeRunDailyMailBackup(atThree);
    expect(dest).toMatch(/agent_mail-2026-09-04\.json$/);
    expect(maybeRunDailyMailBackup(new Date("2026-09-04T02:04:00.000Z"))).toBeNull();
    const stale = path.join(backups, "agent_mail-2000-01-01.json");
    fs.writeFileSync(stale, "[]");
    const old = new Date("2000-01-01T00:00:00Z");
    fs.utimesSync(stale, old, old);
    backupAgentMailNow(atThree);
    expect(fs.existsSync(stale)).toBe(false);
    expect(fs.readdirSync(backups).filter((name) => name.startsWith("agent_mail-"))).toEqual([
      "agent_mail-2026-09-04.json",
    ]);
  });
});
