import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Auto Write slot constraints", () => {
  it("forbids amounts and working-notes in the CAMPARI prompt", () => {
    const src = fs.readFileSync(path.resolve("server/utils/geminiClient.ts"), "utf8");
    expect(src).toMatch(/Do not write pound amounts/);
    expect(src).toMatch(/note on scope/);
    expect(src).not.toMatch(/Loan amount: £\$\{/);
  });

  it("SECTION_GUIDANCE is bullet-only without ledger facts", () => {
    const src = fs.readFileSync(path.resolve("server/utils/geminiClient.ts"), "utf8");
    expect(src).not.toMatch(/one paragraph/);
    const repaymentLine = src
      .split("\n")
      .find((line) => /CAMPARI Repayment:/.test(line));
    expect(repaymentLine).toBeTruthy();
    expect(repaymentLine!).not.toMatch(/DSCR/);
  });

  it("campari-section persists proposal.slots", () => {
    const src = fs.readFileSync(path.resolve("server/routes/prospects.ts"), "utf8");
    expect(src).toMatch(/proposal\.slots/);
    expect(src).toMatch(/hydrateBulletsFromMarkdown/);
  });

  it("does not persist SWOT when every quadrant is empty after validation", () => {
    const src = fs.readFileSync(path.resolve("server/routes/prospects.ts"), "utf8");
    expect(src).toMatch(/swotHasContent/);
    expect(src).toMatch(/SWOT analysis returned no usable content/);
  });
});
