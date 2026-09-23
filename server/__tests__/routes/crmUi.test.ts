import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("pipeline charge-register dump", () => {
  it("does not list CDFI Charge Register cards on Pipeline", () => {
    const src = fs.readFileSync(path.resolve("server/sqliteStorage.ts"), "utf8");
    expect(src).toMatch(/isChargeRegisterPipelineDump/);
    expect(src).toMatch(/refused CDFI Charge Register dump/);
  });
});

describe("Clients sourced-lead contact markers", () => {
  it("annotates CRM leads from Agent Mail, campaigns, and suppression", () => {
    const crm = fs.readFileSync(path.resolve("server/routes/crm.ts"), "utf8");
    expect(crm).toMatch(/annotateCrmLeads/);
    expect(crm).toMatch(/listAgentMail/);
    expect(crm).toMatch(/listAllCampaignRecipients/);
    expect(crm).toMatch(/loadSuppression/);
    expect(crm).toMatch(/charge-letters/);
    expect(crm).toMatch(/chargeLetterHtml/);
    expect(crm).toMatch(/format/);
    const app = fs.readFileSync(path.resolve("client/src/App.tsx"), "utf8");
    expect(app).toMatch(/\/crm\/letters/);
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

  it("writes sent mailboxes back onto Clients and backfills on boot", () => {
    const email = fs.readFileSync(path.resolve("server/services/email.ts"), "utf8");
    expect(email).toMatch(/writeMailboxToClientsFromDeal/);
    const boot = fs.readFileSync(path.resolve("server/index.ts"), "utf8");
    expect(boot).toMatch(/backfillClientMailboxesFromMail/);
  });

  it("has Harper harvest Clients leads on the factory tick without opening hopper files", () => {
    const workflow = fs.readFileSync(path.resolve("server/services/agenticWorkflow.ts"), "utf8");
    expect(workflow).toMatch(/harvestClientsMailboxes/);
    const harvest = fs.readFileSync(path.resolve("server/services/crmHarvest.ts"), "utf8");
    expect(harvest).toMatch(/createDeal/);
    expect(harvest).toMatch(/isCrmHarvestCandidate/);
    expect(harvest).toMatch(/applyHarvestToCrmLead/);
    expect(harvest).toMatch(/obviousSkipClass/);
    expect(harvest).not.toMatch(/rank: jevHarvestEnabled/);
    expect(harvest).toMatch(/deps\.guessPaused = false/);
    expect(harvest).not.toMatch(/deps\.guessPaused = isGuessPaused/);
    const ranker = fs.readFileSync(path.resolve("server/scripts/rankCrmHarvest.ts"), "utf8");
    expect(ranker).toMatch(/jevRankLead/);
    expect(ranker).toMatch(/cacheCrmHarvestRanks/);
    expect(ranker).toMatch(/uniqueLenderNames/);
    expect(ranker).toMatch(/cacheLenderCosts/);
    expect(ranker).toMatch(/jevRankLender/);
    const crm = fs.readFileSync(path.resolve("server/routes/crm.ts"), "utf8");
    expect(crm).toMatch(/annotateLenderCost/);
    expect(harvest).toMatch(/loadLenderCostCache/);
  });

  it("sorts Clients by lender cost and filters by cost band", () => {
    const page = fs.readFileSync(path.resolve("client/src/pages/GodModeCRM.tsx"), "utf8");
    expect(page).toMatch(/key: "lenderCost"/);
    expect(page).toMatch(/data-testid="filter-lender-cost"/);
    expect(page).toMatch(/data-testid="badge-lender-cost"/);
    expect(page).toMatch(/costFilter/);
    expect(page).toMatch(/setCostFilter\("all"\)/);
  });
});
