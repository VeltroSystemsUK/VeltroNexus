import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Openers UI wiring", () => {
  it("has a status board, drawer promote gate, and nav entry after Agent mail", () => {
    const page = fs.readFileSync(path.resolve("client/src/pages/Openers.tsx"), "utf8");
    expect(page).toMatch(/data-testid="column-new"/);
    expect(page).toMatch(/data-testid="column-nurturing"/);
    expect(page).toMatch(/data-testid="column-not_now"/);
    expect(page).toMatch(/data-testid="column-promoted"/);
    expect(page).toMatch(/data-testid="button-promote-opener"/);
    expect(page).toMatch(/SheetContent/);
    expect(page).toMatch(/DragDropContext/);
    expect(page).toMatch(/touch1Draft\.html/);
    expect(page).toMatch(/srcDoc/);

    const nav = fs.readFileSync(path.resolve("client/src/components/shell/navModel.ts"), "utf8");
    expect(nav).toMatch(/path: "\/openers".*group: "Marketing"/);
    expect(nav).toMatch(/label: "Openers"/);
    expect(nav).toMatch(/path: "\/openers".*roles: \["super_admin", "sales_admin"\]/);
    expect(nav).toMatch(/path: "\/agent-mail".*roles: \["super_admin", "sales_admin"\]/);

    const app = fs.readFileSync(path.resolve("client/src/App.tsx"), "utf8");
    expect(app).toMatch(/path="\/openers"/);

    const crm = fs.readFileSync(path.resolve("client/src/pages/GodModeCRM.tsx"), "utf8");
    expect(crm).not.toMatch(/AgentJobProgress/);
  });
});
