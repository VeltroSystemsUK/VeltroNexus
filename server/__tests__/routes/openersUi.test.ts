import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Openers UI wiring", () => {
  it("has a status board, drawer promote gate, and nav entry after Agent mail", () => {
    const page = fs.readFileSync(path.resolve("client/src/pages/Openers.tsx"), "utf8");
    expect(page).toMatch(/data-testid="column-new"/);
    expect(page).toMatch(/data-testid="column-nurturing"/);
    expect(page).toMatch(/data-testid="column-not_now"/);
    expect(page).toMatch(/not_now: "Unsubscribed"/);
    expect(page).not.toMatch(/not_now: "Not now"/);
    expect(page).toMatch(/data-testid="badge-do-not-contact"/);
    expect(page).toMatch(/DO NOT CONTACT/);
    expect(page).toMatch(/data-testid="badge-opener-clicks"/);
    expect(page).toMatch(/HotClickDot/);
    expect(page).toMatch(/isHotClickOpener/);
    const hotDot = fs.readFileSync(path.resolve("client/src/components/mail/HotClickDot.tsx"), "utf8");
    expect(hotDot).toMatch(/data-testid="dot-hot-clicks"/);
    expect(page).toMatch(/data-testid="column-promoted"/);
    expect(page).toMatch(/OPENER_BOARD_STATUSES/);
    expect(page).toMatch(/desk === "non_responsive"/);
    expect(page).toMatch(/data-testid="column-non_responsive"/);
    expect(page).toMatch(/non_responsive: "Non Responsive"/);
    expect(page).toMatch(/data-testid="button-promote-opener"/);
    expect(page).toMatch(/SheetContent/);
    expect(page).toMatch(/DragDropContext/);
    expect(page).toMatch(/compareOpenersByOpenCount/);
    expect(page).not.toMatch(/b\.daysSitting - a\.daysSitting/);
    expect(page).toMatch(/touch1Draft\.html/);
    expect(page).toMatch(/srcDoc/);

    const nav = fs.readFileSync(path.resolve("client/src/components/shell/navModel.ts"), "utf8");
    expect(nav).toMatch(/path: "\/openers".*group: "Marketing"/);
    expect(nav).toMatch(/label: "Openers"/);
    expect(nav).toMatch(/path: "\/openers".*roles: \["super_admin", "sales_admin"\]/);
    expect(nav).toMatch(/path: "\/agent-mail".*roles: \["super_admin", "sales_admin"\]/);
    expect(nav).toMatch(/path: "\/non-responsive".*group: "Marketing"/);
    expect(nav).toMatch(/label: "Non Responsive"/);
    expect(nav).toMatch(/path: "\/non-responsive".*roles: \["super_admin", "sales_admin"\]/);

    const app = fs.readFileSync(path.resolve("client/src/App.tsx"), "utf8");
    expect(app).toMatch(/path="\/openers"/);
    expect(app).toMatch(/path="\/non-responsive"/);
    expect(app).toMatch(/desk="non_responsive"/);

    const sidebar = fs.readFileSync(path.resolve("client/src/components/Sidebar.tsx"), "utf8");
    expect(sidebar).toMatch(/path: "\/non-responsive", label: "Non Responsive"/);

    const crm = fs.readFileSync(path.resolve("client/src/pages/GodModeCRM.tsx"), "utf8");
    expect(crm).not.toMatch(/AgentJobProgress/);
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
