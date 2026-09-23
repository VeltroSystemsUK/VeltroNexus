import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const src = fs.readFileSync(path.resolve("server/routes/brokerPortal.ts"), "utf8");

describe("broker portal pack is the sterling rail", () => {
  it("compiles through compileSterlingRailPack, not a second zip builder", () => {
    expect(src).toMatch(/compileSterlingRailPack/);
    expect(src).toMatch(/markDealCompleteFromSterlingPack/);
    expect(src).not.toMatch(/buildSterlingPackZip\(\{\s*handoff,\s*lenderId,\s*signedBy\s*\}\)/);
  });
});
