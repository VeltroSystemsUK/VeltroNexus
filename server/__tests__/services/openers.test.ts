import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentMailItem } from "../../services/agentMailLog";
import { enrolConvertOpener, OPENER_TOUCH2_DELAY_MS } from "@shared/openers";
import {
  attachCompanyNumber,
  autoPromoteEligibleOpeners,
  enrichOpener,
  flushOpenerIdentityFollowUps,
  hydrateFromAgentMail,
  listOpenerPipelineCompanyNumbers,
  logOpenerCall,
  markOpenerNurturingOnOutbound,
  patchOpener,
  promoteOpener,
  refreshOpenerIdentitySnapshot,
  runNurtureAction,
  sendOpenerWhatsApp,
  setOpenerIdentityDepsForTests,
  setOpenersStorePathForTests,
  stopOpenerNurtureByEmail,
  suppressionFanoutForEmail,
  deleteOpenerByEmail,
  upsertOpenerFromMail,
  upsertOpenerClickFromMail,
  upsertNonResponsiveFromMail,
  writeOpeners,
  type OpenerChClient,
  type OpenerIdentityDeps,
  type PromoteDeps,
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
  setOpenerIdentityDepsForTests(null);
});

function identityDeps(over: Partial<OpenerIdentityDeps> = {}): OpenerIdentityDeps {
  return {
    async getAgenticDeal() { return undefined; },
    async listAgenticDeals() { return []; },
    async getProspectById() { return undefined; },
    async listProspects() { return []; },
    async listContacts() { return []; },
    async listInternalLeads() { return []; },
    async resolvePipelineOwnerUserId() { return "owner-1"; },
    ...over,
  };
}

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

describe("upsertOpenerClickFromMail", () => {
  it("records a click on the existing opener", () => {
    tmpStore();
    upsertOpenerFromMail(mail());
    const row = upsertOpenerClickFromMail(
      mail({ clicks: [{ at: "2026-09-01T11:00:00.000Z", url: "https://example.com" }] })
    );
    expect(row?.clickCount).toBe(1);
    expect(row?.openCount).toBe(1);
  });

  it("creates an opener from a click even without an open", () => {
    tmpStore();
    const row = upsertOpenerClickFromMail(
      mail({
        opens: [],
        clicks: [{ at: "2026-09-01T11:00:00.000Z", url: "https://example.com" }],
      })
    );
    expect(row?.email).toBe("ops@northpeak.co.uk");
    expect(row?.status).toBe("new");
    expect(row?.clickCount).toBe(1);
    expect(row?.openCount).toBe(0);
  });

  it("ignores inbound", () => {
    tmpStore();
    expect(
      upsertOpenerClickFromMail(
        mail({
          direction: "inbound",
          from: "ops@northpeak.co.uk",
          clicks: [{ at: "2026-09-01T11:00:00.000Z", url: "https://example.com" }],
        })
      )
    ).toBeUndefined();
  });
});

describe("non-responsive from sent unopened mail", () => {
  it("creates a non_responsive card on a successful unopened send", () => {
    tmpStore();
    const row = upsertNonResponsiveFromMail(mail({ opens: [] }));
    expect(row?.status).toBe("non_responsive");
    expect(row?.email).toBe("ops@northpeak.co.uk");
    expect(row?.openCount).toBe(0);
    expect(row?.lastTouchAt).toBe("2026-09-01T09:00:00.000Z");
  });

  it("ignores failed, mock, opened, and clicked sends", () => {
    tmpStore();
    expect(upsertNonResponsiveFromMail(mail({ status: "failed", opens: [] }))).toBeUndefined();
    expect(upsertNonResponsiveFromMail(mail({ status: "mock", opens: [] }))).toBeUndefined();
    expect(upsertNonResponsiveFromMail(mail())).toBeUndefined();
    expect(
      upsertNonResponsiveFromMail(
        mail({ opens: [], clicks: [{ at: "2026-09-01T10:05:00.000Z", url: "https://example.com" }] })
      )
    ).toBeUndefined();
  });

  it("does not overwrite an existing opener with non_responsive", () => {
    tmpStore();
    upsertOpenerFromMail(mail());
    const row = upsertNonResponsiveFromMail(mail({ id: "mail-2", opens: [], createdAt: "2026-09-02T09:00:00.000Z" }));
    expect(row?.status).toBe("new");
    expect(hydrateFromAgentMail([]).map((item) => item.status)).toEqual(["new"]);
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

  it("sets clickCount from outbound mail clicks without double-counting", () => {
    tmpStore();
    upsertOpenerFromMail(mail());
    upsertOpenerClickFromMail(
      mail({ clicks: [{ at: "2026-09-01T11:00:00.000Z", url: "https://a.example" }] })
    );
    const rows = hydrateFromAgentMail([
      mail({
        opens: ["2026-09-01T10:00:00.000Z"],
        clicks: [
          { at: "2026-09-01T11:00:00.000Z", url: "https://a.example" },
          { at: "2026-09-01T12:00:00.000Z", url: "https://b.example" },
        ],
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].clickCount).toBe(2);
    expect(rows[0].openCount).toBe(1);
  });

  it("still applies identity when the mail id is already recorded, without bumping openCount", () => {
    tmpStore();
    upsertOpenerFromMail(mail());
    const first = hydrateFromAgentMail([])[0];
    expect(first.openCount).toBe(1);
    expect(first.companyNumber).toBeUndefined();

    const resolve = () => ({
      companyNumber: "08765432",
      companyName: "Northpeak Joinery Ltd",
      phone: "07111111111",
      prospectId: 9,
      dealId: 7,
    });
    const rows = hydrateFromAgentMail([mail()], resolve);
    expect(rows).toHaveLength(1);
    expect(rows[0].openCount).toBe(1);
    expect(rows[0].companyNumber).toBe("08765432");
    expect(rows[0].phone).toBe("07111111111");
    expect(rows[0].prospectId).toBe(9);
    expect(rows[0].dealId).toBe(7);
  });

  it("moves inbound stop and suppression opt-outs to not_now", () => {
    tmpStore();
    upsertOpenerFromMail(mail())!;
    upsertOpenerFromMail(mail({ id: "mail-2", to: "keep@hale.co.uk", opens: ["2026-09-02T10:00:00.000Z"] }));

    const fromInbound = hydrateFromAgentMail([
      mail(),
      mail({
        id: "in-1",
        direction: "inbound",
        from: "ops@northpeak.co.uk",
        to: "james@stratanexus.co.uk",
        subject: "unsubscribe",
        text: "Please remove me from your mailing list",
        status: "received",
        createdAt: "2026-09-06T10:00:00.000Z",
        opens: undefined,
      }),
    ]);
    expect(fromInbound.find((row) => row.email === "ops@northpeak.co.uk")?.status).toBe("not_now");
    expect(fromInbound.find((row) => row.email === "keep@hale.co.uk")?.status).toBe("new");

    tmpStore();
    upsertOpenerFromMail(mail())!;
    const fromList = hydrateFromAgentMail([], undefined, { optOutEmails: ["OPS@northpeak.co.uk"] });
    expect(fromList).toHaveLength(1);
    expect(fromList[0].status).toBe("not_now");
    expect(fromList[0].nurture.stopReason).toBe("opt_out");
  });

  it("backfills non_responsive from successfully sent unopened outbound", () => {
    tmpStore();
    const rows = hydrateFromAgentMail([
      mail({ opens: [] }),
      mail({ id: "mail-fail", to: "fail@hale.co.uk", status: "failed", opens: [] }),
      mail({ id: "mail-mock", to: "mock@hale.co.uk", status: "mock", opens: [] }),
      mail({ id: "mail-open", to: "keep@hale.co.uk", opens: ["2026-09-02T10:00:00.000Z"] }),
    ]);
    const byEmail = Object.fromEntries(rows.map((row) => [row.email, row]));
    expect(byEmail["ops@northpeak.co.uk"]?.status).toBe("non_responsive");
    expect(byEmail["fail@hale.co.uk"]).toBeUndefined();
    expect(byEmail["mock@hale.co.uk"]).toBeUndefined();
    expect(byEmail["keep@hale.co.uk"]?.status).toBe("new");
  });

  it("moves a later open from non_responsive onto Openers as new", () => {
    tmpStore();
    upsertNonResponsiveFromMail(mail({ opens: [] }));
    const rows = hydrateFromAgentMail([
      mail({ opens: ["2026-09-03T12:00:00.000Z"] }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("new");
    expect(rows[0].openCount).toBe(1);
    expect(rows[0].firstOpenedAt).toBe("2026-09-03T12:00:00.000Z");
  });

  it("parks a never-opened unsubscribe on Openers as not_now", () => {
    tmpStore();
    const rows = hydrateFromAgentMail(
      [
        mail({ opens: [] }),
        mail({
          id: "in-1",
          direction: "inbound",
          from: "ops@northpeak.co.uk",
          to: "james@stratanexus.co.uk",
          subject: "unsubscribe",
          text: "Please remove me from your mailing list",
          status: "received",
          createdAt: "2026-09-06T10:00:00.000Z",
          opens: undefined,
        }),
      ]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("not_now");
    expect(rows[0].nurture.stopReason).toBe("opt_out");
  });

  it("does not create non_responsive for a hard-bounced address", () => {
    tmpStore();
    const rows = hydrateFromAgentMail([mail({ opens: [] })], undefined, {
      bounceEmails: ["ops@northpeak.co.uk"],
    });
    expect(rows).toEqual([]);
  });

  it("keeps a clicker off Non Responsive even without an open pixel", () => {
    tmpStore();
    const rows = hydrateFromAgentMail([
      mail({
        opens: [],
        clicks: [{ at: "2026-09-01T10:05:00.000Z", url: "https://example.com" }],
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("new");
    expect(rows[0].status).not.toBe("non_responsive");
  });
});

describe("production identity resolver", () => {
  it("attaches deal identity after a non-blocking follow-up and does not double-count the open", async () => {
    tmpStore();
    const deal = {
      id: 7,
      companyNumber: "08765432",
      companyName: "Northpeak Joinery Ltd",
      phone: "07111111111",
      prospectId: 9,
      email: "ops@northpeak.co.uk",
    };
    setOpenerIdentityDepsForTests(identityDeps({
      async getAgenticDeal(id) { return id === 7 ? deal : undefined; },
      async listAgenticDeals() { return [deal]; },
    }));
    const row = upsertOpenerFromMail(mail({ dealId: 7 }));
    expect(row?.openCount).toBe(1);
    await flushOpenerIdentityFollowUps();
    const stored = hydrateFromAgentMail([])[0];
    expect(stored.openCount).toBe(1);
    expect(stored.companyNumber).toBe("08765432");
    expect(stored.companyName).toBe("Northpeak Joinery Ltd");
    expect(stored.phone).toBe("07111111111");
    expect(stored.prospectId).toBe(9);
    expect(stored.dealId).toBe(7);
  });

  it("attaches prospect identity from mail.prospectId", async () => {
    tmpStore();
    setOpenerIdentityDepsForTests(identityDeps({
      async getProspectById(id) {
        if (id !== 44) return undefined;
        return { id: 44, companyId: 1, company: { companyNumber: "SC123456", companyName: "Hale Ltd" } };
      },
      async listContacts(prospectId) {
        if (prospectId !== 44) return [];
        return [{ email: "ops@northpeak.co.uk", phone: "07222", prospectId: 44 }];
      },
    }));
    upsertOpenerFromMail(mail({ prospectId: 44 }));
    await flushOpenerIdentityFollowUps();
    const stored = hydrateFromAgentMail([])[0];
    expect(stored.companyNumber).toBe("SC123456");
    expect(stored.prospectId).toBe(44);
    expect(stored.phone).toBe("07222");
    expect(stored.openCount).toBe(1);
  });

  it("matches agentic deal, prospect contact, then internal lead by email", async () => {
    tmpStore();
    setOpenerIdentityDepsForTests(identityDeps({
      async listAgenticDeals() {
        return [{ id: 3, email: "ops@northpeak.co.uk", companyNumber: "08765432", companyName: "Northpeak Joinery Ltd", phone: "07000" }];
      },
    }));
    upsertOpenerFromMail(mail());
    await flushOpenerIdentityFollowUps();
    expect(hydrateFromAgentMail([])[0].companyNumber).toBe("08765432");

    tmpStore();
    setOpenerIdentityDepsForTests(identityDeps({
      async resolvePipelineOwnerUserId() { return "owner-1"; },
      async listProspects(userId) {
        if (userId !== "owner-1") return [];
        return [{ id: 44, companyId: 1, company: { companyNumber: "SC123456", companyName: "Hale Ltd" } }];
      },
      async listContacts(prospectId) {
        if (prospectId !== 44) return [];
        return [{ email: "ops@northpeak.co.uk", phone: "07222", prospectId: 44 }];
      },
    }));
    upsertOpenerFromMail(mail());
    await flushOpenerIdentityFollowUps();
    const fromContact = hydrateFromAgentMail([])[0];
    expect(fromContact.companyNumber).toBe("SC123456");
    expect(fromContact.prospectId).toBe(44);
    expect(fromContact.phone).toBe("07222");

    tmpStore();
    setOpenerIdentityDepsForTests(identityDeps({
      async listInternalLeads() {
        return [{ email: "ops@northpeak.co.uk", companyNumber: "11111111", companyName: "Lead Co", phone: "07333" }];
      },
    }));
    upsertOpenerFromMail(mail());
    await flushOpenerIdentityFollowUps();
    const fromLead = hydrateFromAgentMail([])[0];
    expect(fromLead.companyNumber).toBe("11111111");
    expect(fromLead.phone).toBe("07333");
  });

  it("onPipeline company numbers come from the pipeline owner, not only the request user", async () => {
    setOpenerIdentityDepsForTests(identityDeps({
      async resolvePipelineOwnerUserId() { return "owner-1"; },
      async listProspects(userId) {
        if (userId === "owner-1") {
          return [{ id: 1, companyId: 10, company: { companyNumber: "08765432" } }];
        }
        return [];
      },
    }));
    await refreshOpenerIdentitySnapshot();
    const numbers = await listOpenerPipelineCompanyNumbers("req-user");
    expect(numbers.has("08765432")).toBe(true);
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

describe("nurture send and promote", () => {
  it("approve send marks nurturing only when delivered", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail())!;
    await runNurtureAction(created.id, "start");
    const failed = await runNurtureAction(created.id, "approve", {
      send: async () => ({ success: false, mock: true }),
    });
    expect(failed.status).toBe("new");
    const sent = await runNurtureAction(created.id, "approve", {
      send: async () => ({ success: true, id: "mail-logged-1" }),
    });
    expect(sent.status).toBe("nurturing");
    expect(sent.nurture.touch1MailId).toBe("mail-logged-1");
  });

  it("approve send-as stamps that desk on From and signature", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail())!;
    await runNurtureAction(created.id, "start");
    let captured: { agentId?: string; fromName?: string; html?: string } = {};
    await runNurtureAction(created.id, "approve", {
      agentId: "inbound-intake",
      send: async (credentials, _to, _subject, html) => {
        captured = { agentId: credentials?.agentId, fromName: credentials?.fromName, html };
        return { success: true, id: "mail-maya-1" };
      },
    });
    expect(captured.agentId).toBe("inbound-intake");
    expect(captured.fromName).toMatch(/Maya Hart/);
    expect(captured.html).toMatch(/Maya Hart/);
    expect(captured.html).not.toMatch(/James Hale/);
  });

  it("promote creates once and jumps the second time", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail())!;
    await attachCompanyNumber(created.id, "08765432", fakeCh);
    const companies = new Map<string, { id: number; companyNumber: string }>();
    const prospects: Array<{ id: number; companyId: number }> = [];
    const deps: PromoteDeps = {
      async getCompanyByNumber(n) { return companies.get(n); },
      async createCompany(data) {
        const row = { id: 1, companyNumber: data.companyNumber };
        companies.set(data.companyNumber, row);
        return row;
      },
      async listProspects() { return prospects; },
      async createProspect() {
        const row = { id: 55, companyId: 1 };
        prospects.push(row);
        return row;
      },
      async createContact() { return {}; },
    };
    const first = await promoteOpener(created.id, "user-1", deps);
    expect(first.created).toBe(true);
    expect(first.prospectId).toBe(55);
    expect(first.opener.status).toBe("promoted");
    const second = await promoteOpener(created.id, "user-1", deps);
    expect(second.created).toBe(false);
    expect(second.prospectId).toBe(55);
    expect(prospects.length).toBe(1);
  });

  it("promote jumps a pipeline-owner prospect even when the request user has none", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail())!;
    await attachCompanyNumber(created.id, "08765432", fakeCh);
    const deps: PromoteDeps = {
      async getCompanyByNumber() { return { id: 1, companyNumber: "08765432" }; },
      async createCompany() { return { id: 1 }; },
      async resolvePipelineOwnerUserId() { return "owner-1"; },
      async listProspects(userId) {
        if (userId === "owner-1") return [{ id: 99, companyId: 1 }];
        return [];
      },
      async createProspect() { throw new Error("should not create"); },
      async createContact() { return {}; },
    };
    const result = await promoteOpener(created.id, "user-1", deps);
    expect(result.created).toBe(false);
    expect(result.prospectId).toBe(99);
    expect(result.opener.status).toBe("promoted");
    expect(result.opener.prospectId).toBe(99);
  });

  it("start nurture after stop, skip T2 only when due, and inbound stop only while in flight", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail())!;
    await runNurtureAction(created.id, "start");
    const sentAt = new Date("2026-09-04T10:00:00.000Z");
    await runNurtureAction(created.id, "approve", {
      now: sentAt,
      send: async () => ({ success: true, id: "mail-logged-1" }),
    });
    await runNurtureAction(created.id, "stop", { now: new Date("2026-09-05T10:00:00.000Z") });
    expect(stopOpenerNurtureByEmail("ops@northpeak.co.uk", "reply")).toBeUndefined();

    const restarted = await runNurtureAction(created.id, "start");
    expect(restarted.nurture.step).toBe(0);
    expect(restarted.nurture.touch1Status).toBe("pending_approval");
    expect(restarted.nurture.stopReason).toBeUndefined();
    expect(stopOpenerNurtureByEmail("ops@northpeak.co.uk", "reply")).toBeUndefined();

    const skippedT1 = await runNurtureAction(created.id, "skip", { now: sentAt });
    expect(skippedT1.nurture.touch1Status).toBe("skipped");
    const earlySkip = await runNurtureAction(created.id, "skip", { now: new Date("2026-09-05T10:00:00.000Z") });
    expect(earlySkip.nurture.step).toBe(1);
    expect(earlySkip.nurture.stopReason).toBeUndefined();

    const dueSkip = await runNurtureAction(created.id, "skip", {
      now: new Date(sentAt.getTime() + OPENER_TOUCH2_DELAY_MS),
    });
    expect(dueSkip.nurture.touch2Status).toBe("skipped");
    expect(dueSkip.nurture.stopReason).toBe("manual");
  });

  it("inbound reply stops nurture only after touch 1 is in flight", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail())!;
    expect(stopOpenerNurtureByEmail("ops@northpeak.co.uk", "reply")).toBeUndefined();
    await runNurtureAction(created.id, "start");
    expect(stopOpenerNurtureByEmail("ops@northpeak.co.uk", "reply")).toBeUndefined();
    await runNurtureAction(created.id, "approve", {
      send: async () => ({ success: true, id: "mail-logged-1" }),
    });
    const stopped = stopOpenerNurtureByEmail("ops@northpeak.co.uk", "reply");
    expect(stopped?.nurture.stopReason).toBe("reply");
    expect(stopped?.status).toBe("nurturing");
    const unsubscribed = stopOpenerNurtureByEmail("ops@northpeak.co.uk", "opt_out");
    expect(unsubscribed?.status).toBe("not_now");
    expect(unsubscribed?.nurture.stopReason).toBe("opt_out");
  });

  it("opt-out moves the opener to not_now even when nurture is not in flight", () => {
    tmpStore();
    upsertOpenerFromMail(mail())!;
    const moved = stopOpenerNurtureByEmail("ops@northpeak.co.uk", "opt_out");
    expect(moved?.status).toBe("not_now");
    expect(moved?.nurture.stopReason).toBe("opt_out");
    expect(moved?.nurture.step).toBe(3);
  });

  it("refuses nurture send, whatsapp, and call on an unsubscribed opener", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail())!;
    stopOpenerNurtureByEmail("ops@northpeak.co.uk", "opt_out");
    patchOpener(created.id, { phone: "07123456789" });
    let sent = false;
    await expect(runNurtureAction(created.id, "approve", {
      send: async () => {
        sent = true;
        return { success: true, id: "should-not-send" };
      },
    })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/do not contact/i) });
    expect(sent).toBe(false);
    await expect(sendOpenerWhatsApp(created.id, "hi", async () => {
      sent = true;
      return "ok";
    })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/do not contact/i) });
    await expect(logOpenerCall(created.id, "called")).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/do not contact/i),
    });
    expect(sent).toBe(false);
  });

  it("hard bounce deletes the opener record", () => {
    tmpStore();
    upsertOpenerFromMail(mail())!;
    expect(deleteOpenerByEmail("ops@northpeak.co.uk")).toBe(true);
    expect(hydrateFromAgentMail([])).toEqual([]);
  });

  it("promote without a company number is 400", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail())!;
    await expect(promoteOpener(created.id, "user-1", {
      async getCompanyByNumber() { return undefined; },
      async createCompany() { return { id: 1 }; },
      async listProspects() { return []; },
      async createProspect() { return { id: 1 }; },
      async createContact() { return {}; },
    })).rejects.toMatchObject({ status: 400 });
  });

  it("whatsapp without phone is 400", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail())!;
    await expect(sendOpenerWhatsApp(created.id, "hi", async () => "ok")).rejects.toMatchObject({ status: 400 });
    await expect(logOpenerCall(created.id, "tried")).rejects.toMatchObject({ status: 400 });
  });

  it("whatsapp and call before touch 2 is due only stamp lastTouchAt", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail())!;
    patchOpener(created.id, { phone: "07123456789" });
    await runNurtureAction(created.id, "start");
    const sentAt = new Date("2026-09-04T10:00:00.000Z");
    await runNurtureAction(created.id, "approve", {
      now: sentAt,
      send: async () => ({ success: true, id: "mail-logged-1" }),
    });

    const early = new Date("2026-09-05T10:00:00.000Z");
    const wa = await sendOpenerWhatsApp(created.id, "hi", async () => "ok", early);
    expect(wa.nurture.touch2Status).not.toBe("done");
    expect(wa.lastTouchAt).toBe(early.toISOString());

    const called = await logOpenerCall(created.id, "left voicemail", early);
    expect(called.nurture.touch2Status).not.toBe("done");
    expect(called.lastTouchAt).toBe(early.toISOString());

    const dueAt = new Date(sentAt.getTime() + OPENER_TOUCH2_DELAY_MS);
    const due = await sendOpenerWhatsApp(created.id, "follow up", async () => "ok", dueAt);
    expect(due.nurture.touch2Status).toBe("done");
    expect(due.nurture.stopReason).toBe("completed");
    expect(due.lastTouchAt).toBe(dueAt.toISOString());
  });

  it("convert start and approve do not send 3-touch", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail())!;
    writeOpeners([enrolConvertOpener(created)]);
    let sent = false;
    const started = await runNurtureAction(created.id, "start");
    expect(started.nurture.stream).toBe("convert");
    expect(started.nurture.touch1Status).toBe("idle");
    expect(started.nurture.touch1Draft).toBeUndefined();
    const approved = await runNurtureAction(created.id, "approve", {
      send: async () => {
        sent = true;
        return { success: true, id: "should-not-send" };
      },
    });
    expect(sent).toBe(false);
    expect(approved.nurture.touch1MailId).toBeUndefined();
    expect(approved.nurture.stream).toBe("convert");
  });
});

describe("second-email auto-nurture", () => {
  it("hydrate moves new openers to nurturing after sme_open is sent", () => {
    tmpStore();
    upsertOpenerFromMail(mail({ touchId: "sme_1" }));
    expect(hydrateFromAgentMail([])[0].status).toBe("new");

    const rows = hydrateFromAgentMail([
      mail({ id: "mail-1", touchId: "sme_1" }),
      mail({
        id: "mail-2",
        touchId: "sme_open",
        subject: "Re: Debt service",
        opens: [],
        createdAt: "2026-09-01T11:00:00.000Z",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("nurturing");
    expect(rows[0].nurture.step).toBe(0);
  });

  it("hydrate uses the deal sme_open flag when the send has been wiped from Agent Mail", async () => {
    tmpStore();
    const deal = {
      id: 7,
      email: "ops@northpeak.co.uk",
      companyNumber: "08765432",
      companyName: "Northpeak Joinery Ltd",
      smeOpenFollowUpSentAt: "2026-09-04T07:25:26.052Z",
    };
    setOpenerIdentityDepsForTests(identityDeps({
      async getAgenticDeal(id) { return id === 7 ? deal : undefined; },
      async listAgenticDeals() { return [deal]; },
    }));
    upsertOpenerFromMail(mail({ dealId: 7 }));
    await refreshOpenerIdentitySnapshot();
    const rows = hydrateFromAgentMail([mail({ dealId: 7 })]);
    expect(rows[0].status).toBe("nurturing");
  });

  it("hydrate leaves not_now and first-email-only cards alone", () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail({ touchId: "sme_1" }))!;
    patchOpener(created.id, { status: "not_now" });
    const parked = hydrateFromAgentMail([
      mail({ id: "mail-1", touchId: "sme_1" }),
      mail({ id: "mail-2", touchId: "sme_open", opens: [] }),
    ]);
    expect(parked[0].status).toBe("not_now");

    tmpStore();
    upsertOpenerFromMail(mail({ touchId: "sme_1" }));
    const firstOnly = hydrateFromAgentMail([mail({ touchId: "sme_1" })]);
    expect(firstOnly[0].status).toBe("new");
  });

  it("logging a second outbound moves the matching new opener", () => {
    tmpStore();
    upsertOpenerFromMail(mail({ touchId: "sme_1" }));
    const moved = markOpenerNurturingOnOutbound(
      mail({
        id: "mail-2",
        touchId: "sme_open",
        opens: [],
        createdAt: "2026-09-01T11:00:00.000Z",
      }),
      [
        mail({ id: "mail-1", touchId: "sme_1" }),
        mail({ id: "mail-2", touchId: "sme_open", opens: [] }),
      ]
    );
    expect(moved?.status).toBe("nurturing");
    expect(hydrateFromAgentMail([])[0].status).toBe("nurturing");
  });
});

describe("sixth-email auto-promote", () => {
  function sentMails(n: number) {
    return Array.from({ length: n }, (_, i) =>
      mail({
        id: `mail-${i + 1}`,
        opens: i === 0 ? ["2026-09-01T10:00:00.000Z"] : [],
        createdAt: `2026-09-01T09:0${i}:00.000Z`,
      })
    );
  }

  function promoteDeps() {
    const companies = new Map<string, { id: number; companyNumber: string }>();
    const prospects: Array<{ id: number; companyId: number }> = [];
    const deps: PromoteDeps = {
      async getCompanyByNumber(n) { return companies.get(n); },
      async createCompany(data) {
        const row = { id: 1, companyNumber: data.companyNumber };
        companies.set(data.companyNumber, row);
        return row;
      },
      async listProspects() { return prospects; },
      async createProspect() {
        const row = { id: 55, companyId: 1 };
        prospects.push(row);
        return row;
      },
      async createContact() { return {}; },
    };
    return { deps, prospects };
  }

  it("promotes a numbered opener after the sixth unique sent email", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(sentMails(1)[0])!;
    await attachCompanyNumber(created.id, "08765432", fakeCh);
    const { deps, prospects } = promoteDeps();
    expect(await autoPromoteEligibleOpeners(sentMails(5), { deps })).toEqual([]);
    expect(hydrateFromAgentMail([])[0].status).not.toBe("promoted");

    const promoted = await autoPromoteEligibleOpeners(sentMails(6), { deps, userId: "user-1" });
    expect(promoted).toHaveLength(1);
    expect(promoted[0].status).toBe("promoted");
    expect(promoted[0].prospectId).toBe(55);
    expect(prospects).toHaveLength(1);
    expect(hydrateFromAgentMail([])[0].status).toBe("promoted");
  });

  it("fans an opt-out out to every email on the opener card", () => {
    tmpStore();
    const created = upsertOpenerFromMail(mail())!;
    patchOpener(created.id, {
      emails: ["ops@northpeak.co.uk", "admin@northpeak.co.uk"],
      companyNumber: "08765432",
    });
    const fanout = suppressionFanoutForEmail("admin@northpeak.co.uk");
    expect(fanout.companyNumber).toBe("08765432");
    expect(fanout.emails.sort()).toEqual(["admin@northpeak.co.uk", "ops@northpeak.co.uk"]);
  });

  it("does not promote opted-out or unnumbered cards at six emails", async () => {
    tmpStore();
    const created = upsertOpenerFromMail(sentMails(1)[0])!;
    await attachCompanyNumber(created.id, "08765432", fakeCh);
    expect(stopOpenerNurtureByEmail("ops@northpeak.co.uk", "opt_out")?.status).toBe("not_now");
    const { deps } = promoteDeps();
    expect(await autoPromoteEligibleOpeners(sentMails(6), { deps })).toEqual([]);

    tmpStore();
    upsertOpenerFromMail(sentMails(1)[0]);
    expect(await autoPromoteEligibleOpeners(sentMails(6), { deps: promoteDeps().deps })).toEqual([]);
    expect(hydrateFromAgentMail([])[0].status).toBe("new");
  });
});
