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

    const routes = fs.readFileSync(path.resolve("server/routes/agentMail.ts"), "utf8");
    expect(routes).toMatch(/\/api\/agent-mail\/:id\/attachments\/:index/);
  });
});
