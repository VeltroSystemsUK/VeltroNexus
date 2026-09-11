import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Agent Mail attachments UI", () => {
  it("lists downloadable attachments on the reading pane", () => {
    const page = fs.readFileSync(path.resolve("client/src/pages/AgentMail.tsx"), "utf8");
    expect(page).toMatch(/attachments\?:/);
    expect(page).toMatch(/Paperclip/);
    expect(page).toMatch(/\/api\/agent-mail\/\$\{selected\.id\}\/attachments\/\$\{file\.index\}/);
    expect(page).toMatch(/data-testid="link-mail-attachment"/);
    expect(page).toMatch(/HotClickDot/);
    const hotDot = fs.readFileSync(path.resolve("client/src/components/mail/HotClickDot.tsx"), "utf8");
    expect(hotDot).toMatch(/data-testid="dot-hot-clicks"/);

    const routes = fs.readFileSync(path.resolve("server/routes/agentMail.ts"), "utf8");
    expect(routes).toMatch(/\/api\/agent-mail\/:id\/attachments\/:index/);
  });

  it("reply lets you pick send-as so the signature follows the desk", () => {
    const page = fs.readFileSync(path.resolve("client/src/pages/AgentMail.tsx"), "utf8");
    expect(page).toMatch(/SendAsSelect/);
    expect(page).toMatch(/agentId: sendAs/);
    const select = fs.readFileSync(path.resolve("client/src/components/mail/SendAsSelect.tsx"), "utf8");
    expect(select).toMatch(/data-testid="select-send-as"/);

    const routes = fs.readFileSync(path.resolve("server/routes/agentMail.ts"), "utf8");
    expect(routes).toMatch(/resolveSendAsMailbox/);
    expect(routes).toMatch(/req\.body\?\.agentId/);
    expect(routes).toMatch(/composeAgentReplyHtml/);
  });

  it("compose sends a new message through sendEmail", () => {
    const page = fs.readFileSync(path.resolve("client/src/pages/AgentMail.tsx"), "utf8");
    expect(page).toMatch(/data-testid="button-compose"/);
    expect(page).toMatch(/data-testid="input-compose-to"/);
    expect(page).toMatch(/\/api\/agent-mail\/compose/);
    const routes = fs.readFileSync(path.resolve("server/routes/agentMail.ts"), "utf8");
    expect(routes).toMatch(/\/api\/agent-mail\/compose/);
    expect(routes).toMatch(/composeAgentMailHtml/);
    expect(routes).toMatch(/sendEmail/);
  });

  it("deal-file approve send still exists on the backend for leftover drafts", () => {
    const panel = fs.readFileSync(path.resolve("client/src/components/agentic/DealFilesPanel.tsx"), "utf8");
    expect(panel).toMatch(/SME_FIRST_TOUCH_PER_HOUR/);
    expect(panel).toMatch(/weekdays 08:30–20:30 London/);
    expect(panel).not.toMatch(/Nothing sends until you approve it/);
    expect(panel).not.toMatch(/Approve & send/);

    const human = fs.readFileSync(path.resolve("server/routes/agenticWorkflow.ts"), "utf8");
    expect(human).toMatch(/req\.body\?\.agentId/);
    const workflow = fs.readFileSync(path.resolve("server/services/agenticWorkflow.ts"), "utf8");
    expect(workflow).toMatch(/resolveSendAsMailbox/);
    expect(workflow).toMatch(/deskAgentForOutreach/);
    expect(workflow).toMatch(/approveSmeSend/);
  });
});
