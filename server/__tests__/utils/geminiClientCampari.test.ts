import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Auto Write slot constraints", () => {
  it("forbids amounts and working-notes in the CAMPARI prompt", () => {
    const src = fs.readFileSync(path.resolve("server/utils/geminiClient.ts"), "utf8");
    expect(src).toMatch(/Do not write pound amounts/);
    expect(src).toMatch(/note on scope/);
  });

  it("campari-section persists proposal.slots", () => {
    const src = fs.readFileSync(path.resolve("server/routes/prospects.ts"), "utf8");
    expect(src).toMatch(/proposal\.slots/);
    expect(src).toMatch(/hydrateBulletsFromMarkdown/);
  });
});
