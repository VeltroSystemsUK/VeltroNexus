import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("sterling pack proposal gate", () => {
  it("refuses a conflicted proposal before zip", () => {
    const src = fs.readFileSync(path.resolve("server/services/sterlingPack.ts"), "utf8");
    expect(src).toMatch(/assertProposalReady/);
    expect(src).toMatch(/status: 400/);
    const pdfIdx = src.indexOf("renderFundingProposalPdf");
    const gateIdx = src.indexOf("assertProposalReady");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(pdfIdx);
  });
});
