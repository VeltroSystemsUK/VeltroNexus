import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Generate Report UI gate", () => {
  it("disables download while proposal conflicts exist", () => {
    const src = fs.readFileSync(path.resolve("client/src/pages/ProspectDetail.tsx"), "utf8");
    expect(src).toMatch(/buildProposal/);
    expect(src).toMatch(/proposal-conflicts/);
    expect(src).toMatch(/disabled=\{!proposal\.ready\}/);
    expect(src).toMatch(/status === 409/);
  });

  it("downloads the working sheet as a second PDF on Generate Report", () => {
    const src = fs.readFileSync(path.resolve("client/src/pages/ProspectDetail.tsx"), "utf8");
    expect(src).toMatch(/\/working-sheet/);
    expect(src).toMatch(/Working_Sheet/);
    const route = fs.readFileSync(path.resolve("server/routes/prospects.ts"), "utf8");
    expect(route).toMatch(/\/prospects\/:id\/working-sheet/);
    expect(route).toMatch(/streamWorkingSheet/);
  });
});
