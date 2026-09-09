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
});
