import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentMailItem } from "../../services/agentMailLog";
import {
  hydrateFromAgentMail,
  setOpenersStorePathForTests,
  upsertOpenerFromMail,
} from "../../services/openers";

const storeFiles = new Set<string>();

function tmpStore(): string {
  const file = path.join(os.tmpdir(), `openers-${process.pid}-${Date.now()}.json`);
  setOpenersStorePathForTests(file);
  storeFiles.add(file);
  return file;
}

afterEach(() => {
  for (const file of storeFiles) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      // ignore tmp cleanup
    }
  }
  storeFiles.clear();
  setOpenersStorePathForTests(null);
});

function mail(over: Partial<AgentMailItem> = {}): AgentMailItem {
  return {
    id: "mail-1",
    direction: "outbound",
    from: "james@stratanexus.co.uk",
    to: "ops@northpeak.co.uk",
    subject: "Debt service",
    text: "hi",
    status: "sent",
    createdAt: "2026-09-01T09:00:00.000Z",
    opens: ["2026-09-01T10:00:00.000Z"],
    ...over,
  };
}

describe("upsertOpenerFromMail", () => {
  it("creates a new card on the first open", () => {
    tmpStore();
    const row = upsertOpenerFromMail(mail());
    expect(row?.email).toBe("ops@northpeak.co.uk");
    expect(row?.status).toBe("new");
    expect(row?.openCount).toBe(1);
    expect(row?.companyNumber).toBeUndefined();
  });

  it("bumps the same email instead of duplicating", () => {
    tmpStore();
    upsertOpenerFromMail(mail());
    const row = upsertOpenerFromMail(
      mail({ opens: ["2026-09-01T10:00:00.000Z", "2026-09-03T10:00:00.000Z"] })
    );
    expect(row?.openCount).toBe(2); // second call is the second pixel (+1)
    expect(hydrateFromAgentMail([]).length).toBe(1);
  });

  it("merges two emails once the resolver returns the same company number", () => {
    tmpStore();
    upsertOpenerFromMail(mail());
    upsertOpenerFromMail(mail({ id: "mail-2", to: "james@northpeak.co.uk", opens: ["2026-09-02T10:00:00.000Z"] }));
    const resolve = (email: string) => ({ companyNumber: "08765432", companyName: "Northpeak Joinery Ltd" });
    upsertOpenerFromMail(mail({ opens: ["2026-09-01T10:00:00.000Z", "2026-09-04T10:00:00.000Z"] }), resolve);
    upsertOpenerFromMail(
      mail({ id: "mail-2", to: "james@northpeak.co.uk", opens: ["2026-09-02T10:00:00.000Z"] }),
      resolve
    );
    const all = hydrateFromAgentMail([]);
    expect(all.length).toBe(1);
    expect(all[0].companyNumber).toBe("08765432");
    expect(all[0].emails.sort()).toEqual(["james@northpeak.co.uk", "ops@northpeak.co.uk"]);
  });

  it("ignores inbound and unopened outbound", () => {
    tmpStore();
    expect(upsertOpenerFromMail(mail({ direction: "inbound", from: "ops@northpeak.co.uk", opens: undefined }))).toBeUndefined();
    expect(upsertOpenerFromMail(mail({ opens: [] }))).toBeUndefined();
  });
});

describe("hydrateFromAgentMail", () => {
  it("backfills unique companies from existing opened outbound", () => {
    tmpStore();
    const rows = hydrateFromAgentMail([
      mail(),
      mail({ id: "mail-2", to: "ops@northpeak.co.uk", opens: ["2026-09-03T10:00:00.000Z"] }),
      mail({ id: "mail-3", to: "other@hale.co.uk", opens: ["2026-09-02T10:00:00.000Z"] }),
    ]);
    expect(rows.length).toBe(2);
  });
});
