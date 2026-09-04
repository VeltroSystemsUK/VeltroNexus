import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentMailItem } from "../../services/agentMailLog";
import {
  attachCompanyNumber,
  enrichOpener,
  hydrateFromAgentMail,
  setOpenersStorePathForTests,
  upsertOpenerFromMail,
  type OpenerChClient,
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

const fakeCh: OpenerChClient = {
  async getCompanyProfile() {
    return {
      company_name: "NORTHPEAK JOINERY LTD",
      company_status: "active",
      sic_codes: ["16230"],
      date_of_creation: "2018-04-01",
      registered_office_address: { address_line_1: "1 Mill Lane", locality: "Leeds", postal_code: "LS1 1AA" },
    };
  },
  async getCompanyOfficers() {
    return { items: [{ name: "PEAK, Nora", officer_role: "director" }, { name: "GONE, Ian", officer_role: "director", resigned_on: "2020-01-01" }] };
  },
  async getCompanyCharges() {
    return {
      items: [
        { status: "outstanding", delivered_on: "2026-01-01", persons_entitled: [{ name: "HIVE INVOICE FINANCE LTD" }] },
        { status: "satisfied", persons_entitled: [{ name: "HSBC UK BANK PLC" }] },
      ],
    };
  },
};

describe("Companies House identity", () => {
  it("enriches CH identity once a number is attached", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail())!;
    const attached = await attachCompanyNumber(created.id, "8765432", fakeCh);
    expect(attached.companyNumber).toBe("08765432");
    expect(attached.companyName).toBe("NORTHPEAK JOINERY LTD");
    expect(attached.directors.map((d) => d.name)).toEqual(["PEAK, Nora"]);
    expect(attached.nonBankChargeCount).toBe(1);
    expect(attached.enrichedAt).toBeTruthy();
    expect(attached.enrichError).toBeUndefined();
  });

  it("stores enrichError when CH fails and keeps the card", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail())!;
    await attachCompanyNumber(created.id, "08765432", {
      async getCompanyProfile() { throw new Error("CH down"); },
      async getCompanyOfficers() { return { items: [] }; },
      async getCompanyCharges() { return { items: [] }; },
    });
    const row = await enrichOpener(created.id, {
      async getCompanyProfile() { throw new Error("CH down"); },
      async getCompanyOfficers() { return { items: [] }; },
      async getCompanyCharges() { return { items: [] }; },
    });
    expect(row.email).toBe("ops@northpeak.co.uk");
    expect(row.enrichError).toMatch(/CH down/);
  });
});
