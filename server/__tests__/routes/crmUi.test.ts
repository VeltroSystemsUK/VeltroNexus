import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Clients sourced-lead contact markers", () => {
  it("annotates CRM leads from Agent Mail, campaigns, and suppression", () => {
    const crm = fs.readFileSync(path.resolve("server/routes/crm.ts"), "utf8");
    expect(crm).toMatch(/annotateCrmLeads/);
    expect(crm).toMatch(/listAgentMail/);
    expect(crm).toMatch(/listAllCampaignRecipients/);
    expect(crm).toMatch(/loadSuppression/);
  });

  it("shows contacted, not-sent, and DO NOT CONTACT markers plus a contact filter", () => {
    const page = fs.readFileSync(path.resolve("client/src/pages/GodModeCRM.tsx"), "utf8");
    expect(page).toMatch(/data-testid="badge-lead-contacted"/);
    expect(page).toMatch(/data-testid="badge-lead-not-sent"/);
    expect(page).toMatch(/data-testid="badge-do-not-contact"/);
    expect(page).toMatch(/DO NOT CONTACT/);
    expect(page).toMatch(/data-testid="badge-lead-bounced"/);
    expect(page).toMatch(/lead.bounced/);
    expect(page).toMatch(/data-testid="filter-contact"/);
    expect(page).toMatch(/doNotContact/);
  });
});
