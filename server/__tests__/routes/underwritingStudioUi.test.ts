import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Underwriting Studio", () => {
  it("declares the proposed-monthly field before using it", () => {
    const src = fs.readFileSync(path.resolve("client/src/components/BankStatementSweep.tsx"), "utf8");
    const state = src.indexOf('useState("")');
    const use = src.indexOf("Number(proposedMonthly)");
    expect(state).toBeGreaterThan(0);
    expect(use).toBeGreaterThan(state);
  });

  it("registers the studio at /prospect/:id/underwriting without a child segment", () => {
    const app = fs.readFileSync(path.resolve("client/src/App.tsx"), "utf8");
    expect(app).toMatch(/path="\/prospect\/:id\/underwriting"/);
  });
});
