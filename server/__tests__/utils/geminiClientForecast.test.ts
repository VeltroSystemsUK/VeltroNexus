import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("cashflow forecast extract and critique prompts", () => {
  it("extracts numbers only and forbids inventing zeros", () => {
    const src = fs.readFileSync(path.resolve("server/utils/geminiClient.ts"), "utf8");
    expect(src).toMatch(/export async function extractCashflowForecastJson/);
    expect(src).toMatch(/Never use 0 as a stand-in for unknown/);
    expect(src).toMatch(/No prose/);
  });

  it("critiques optimism against statement run-rate", () => {
    const src = fs.readFileSync(path.resolve("server/utils/geminiClient.ts"), "utf8");
    expect(src).toMatch(/export async function critiqueCashflowForecastJson/);
    expect(src).toMatch(/excessive optimism/);
    expect(src).toMatch(/statement run-rate/);
    expect(src).toMatch(/bullets/);
  });
});
