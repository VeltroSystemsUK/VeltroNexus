import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Openers UI wiring", () => {
  it("has a status board, drawer promote gate, and nav entry after Agent mail", () => {
    const page = fs.readFileSync(path.resolve("client/src/pages/Openers.tsx"), "utf8");
    expect(page).toMatch(/data-testid="column-new"/);
    expect(page).toMatch(/data-testid="column-nurturing"/);
    expect(page).toMatch(/data-testid="column-direct-outreach"/);
    expect(page).toMatch(/data-testid="btn-generate-briefing"/);
    expect(page).toMatch(/data-testid="btn-send-briefing"/);
    expect(page).toMatch(/data-testid="badge-veltro-interest"/);
    expect(page).not.toMatch(/data-testid="column-not_now"/);
    expect(page).toMatch(/data-testid="badge-do-not-contact"/);
    expect(page).toMatch(/DO NOT CONTACT/);
    expect(page).toMatch(/data-testid="badge-opener-clicks"/);
    expect(page).toMatch(/data-testid="badge-opener-dwell"/);
    expect(page).not.toMatch(/HotClickDot/);
    expect(page).not.toMatch(/isHotClickOpener/);
    expect(page).toMatch(/data-heat=\{heat \?\? undefined\}/);
    expect(page).toMatch(/data-testid="click-heat-strip"/);
    expect(page).toMatch(/filter-click-heat-hot/);
    expect(page).toMatch(/filter-click-heat-warm/);
    expect(page).toMatch(/filter-click-heat-cold/);
    expect(page).toMatch(/openerClickHeat/);
    expect(page).toMatch(/clickHeatCounts/);
    const hotDot = fs.readFileSync(path.resolve("client/src/components/mail/HotClickDot.tsx"), "utf8");
    expect(hotDot).toMatch(/data-testid="dot-hot-clicks"/);
    expect(page).toMatch(/data-testid="column-promoted"/);
    expect(page).toMatch(/OPENER_BOARD_STATUSES/);
    expect(page).toMatch(/desk === "non_responsive"/);
    expect(page).toMatch(/data-testid="column-non_responsive"/);
    expect(page).toMatch(/non_responsive: "Non Responsive"/);
    expect(page).toMatch(/data-testid="button-promote-opener"/);
    expect(page).toMatch(/data-testid="button-demote-opener"/);
    expect(page).toMatch(/\/api\/openers\/\$\{id\}\/demote/);
    expect(page).toMatch(/SheetContent/);
    expect(page).toMatch(/DragDropContext/);
    expect(page).toMatch(/compareOpenersByOpenCount/);
    expect(page).not.toMatch(/b\.daysSitting - a\.daysSitting/);
    expect(page).toMatch(/touch1Draft\.html/);
    expect(page).toMatch(/srcDoc/);

    const unsub = fs.readFileSync(path.resolve("client/src/pages/Unsubscribed.tsx"), "utf8");
    expect(unsub).toMatch(/data-testid="page-unsubscribed"/);
    expect(unsub).not.toMatch(/btn-generate-briefing/);
    expect(unsub).not.toMatch(/\/api\/campaigns/);

    const nav = fs.readFileSync(path.resolve("client/src/components/shell/navModel.ts"), "utf8");
    expect(nav).toMatch(/path: "\/openers".*group: "Marketing"/);
    expect(nav).toMatch(/label: "Openers"/);
    expect(nav).toMatch(/path: "\/openers".*roles: \["super_admin", "sales_admin"\]/);
    expect(nav).toMatch(/path: "\/agent-mail".*roles: \["super_admin", "sales_admin"\]/);
    expect(nav).toMatch(/path: "\/non-responsive".*group: "Marketing"/);
    expect(nav).toMatch(/label: "Non Responsive"/);
    expect(nav).toMatch(/path: "\/non-responsive".*roles: \["super_admin", "sales_admin"\]/);
    expect(nav).toMatch(/path: "\/unsubscribed".*group: "Marketing"/);
    expect(nav).toMatch(/label: "Unsubscribed"/);

    const app = fs.readFileSync(path.resolve("client/src/App.tsx"), "utf8");
    expect(app).toMatch(/path="\/openers"/);
    expect(app).toMatch(/path="\/non-responsive"/);
    expect(app).toMatch(/desk="non_responsive"/);
    expect(app).toMatch(/path="\/unsubscribed"/);

    const sidebar = fs.readFileSync(path.resolve("client/src/components/Sidebar.tsx"), "utf8");
    expect(sidebar).toMatch(/path: "\/non-responsive", label: "Non Responsive"/);

    const crm = fs.readFileSync(path.resolve("client/src/pages/GodModeCRM.tsx"), "utf8");
    expect(crm).not.toMatch(/AgentJobProgress/);
  });

  it("public Veltro page is concierge-only and not on staff nav", () => {
    const veltro = fs.readFileSync(path.resolve("client/src/pages/Veltro.tsx"), "utf8");
    expect(veltro).toMatch(/data-testid="btn-veltro-concierge"/);
    expect(veltro.toLowerCase()).toMatch(/email verification/);
    expect(veltro.toLowerCase()).toMatch(/lead/);
    expect(veltro.toLowerCase()).not.toMatch(/we lend/);
    expect(veltro.toLowerCase()).not.toMatch(/ai workforce|ares/);
    const app = fs.readFileSync(path.resolve("client/src/App.tsx"), "utf8");
    expect(app).toMatch(/path="\/veltro"/);
    const nav = fs.readFileSync(path.resolve("client/src/components/shell/navModel.ts"), "utf8");
    expect(nav).not.toMatch(/path: "\/veltro"/);
  });

  it("Direct Outreach drawer hides James nurture and requires a staff preview before Send", () => {
    const page = fs.readFileSync(path.resolve("client/src/pages/Openers.tsx"), "utf8");
    expect(page).toMatch(/selected.status !== "direct_outreach"/);
    expect(page).toMatch(/data-testid="iframe-briefing-preview"/);
    expect(page).toMatch(/briefingPreviewReady/);
    expect(page).toMatch(/\/api\/openers\/\$\{selected\.id\}\/briefing\/preview/);
    expect(page).toMatch(/previewHtml/);
    const briefingBlock = page.slice(
      page.indexOf("btn-generate-briefing"),
      page.indexOf("btn-send-briefing") + 400
    );
    expect(briefingBlock).not.toMatch(/Start nurture/);
    const service = fs.readFileSync(path.resolve("server/services/openers.ts"), "utf8");
    expect(service).toMatch(/status === "direct_outreach"/);
    expect(service).toMatch(/James is stopped on Direct Outreach/);
  });

  it("nurture approve sends as the chosen desk", () => {
    const page = fs.readFileSync(path.resolve("client/src/pages/Openers.tsx"), "utf8");
    expect(page).toMatch(/SendAsSelect/);
    expect(page).toMatch(/agentId: sendAs/);
    const select = fs.readFileSync(path.resolve("client/src/components/mail/SendAsSelect.tsx"), "utf8");
    expect(select).toMatch(/data-testid="select-send-as"/);

    const routes = fs.readFileSync(path.resolve("server/routes/openers.ts"), "utf8");
    expect(routes).toMatch(/agentId: req\.body\?\.agentId/);
    const service = fs.readFileSync(path.resolve("server/services/openers.ts"), "utf8");
    expect(service).toMatch(/resolveSendAsMailbox/);
    expect(service).toMatch(/signatureHtml/);
  });

  it("convert cards hide 3-touch start/approve and show closer script", () => {
    const page = fs.readFileSync(path.resolve("client/src/pages/Openers.tsx"), "utf8");
    expect(page).toMatch(/data-testid="badge-convert-step"/);
    expect(page).toMatch(/data-testid="convert-closer-script"/);
    expect(page).toMatch(/data-testid="button-skip-closer"/);
    expect(page).toMatch(/isConvertOpener/);
    expect(page).toMatch(/data-testid="badge-opener-clicks"/);
    const routes = fs.readFileSync(path.resolve("server/routes/openers.ts"), "utf8");
    expect(routes).toMatch(/closer/);
    const service = fs.readFileSync(path.resolve("server/services/openers.ts"), "utf8");
    expect(service).toMatch(/completeConvertCloser/);
    const workflow = fs.readFileSync(path.resolve("server/services/agenticWorkflow.ts"), "utf8");
    expect(workflow).toMatch(/closerSiteClickUrl/);
    expect(service).toMatch(/convertStopReason: "completed"/);
    expect(service).toMatch(/waitUntil: wakeAt/);
    expect(service).toMatch(/isConvertOpener\(opener\) && \(action === "start" \|\| action === "approve"\)/);
  });

  it("corporate structure mentions convert after dual-open", () => {
    const doc = fs.readFileSync(path.resolve("docs/agentic-org/corporate_structure.md"), "utf8");
    expect(doc).toMatch(/sme_nurture|dual-open|convert playbook/i);
    expect(doc).toMatch(/SAL-2-convert/);
  });
});
