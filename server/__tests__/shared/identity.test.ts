import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  CLIENT_LEGAL_NAME,
  CLIENT_TRADING_NAME,
  COMPANY_LEGAL_NAME,
  DIRECTOR_NAME,
  OS_NAME,
  PACKAGING_OPERATOR,
  STERLING_RECEIVER_NAME,
} from "@shared/identity";
import { PACKAGING_FRAMEWORK } from "@shared/salesOs";

const root = process.cwd();
function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("identity lock", () => {
  it("names the company, OS, client legal, and trading name", () => {
    expect(COMPANY_LEGAL_NAME).toBe("Veltro Ltd");
    expect(OS_NAME).toBe("Nexus");
    expect(CLIENT_LEGAL_NAME).toBe("Sterling Commercial Finance Ltd");
    expect(CLIENT_TRADING_NAME).toBe("Strata Finance");
    expect(PACKAGING_OPERATOR).toBe("Sterling Commercial Finance Ltd");
    expect(DIRECTOR_NAME).toBe("Shaun");
    expect(STERLING_RECEIVER_NAME).toBe("David");
  });

  it("Sales OS packaging operator is Sterling Commercial Finance Ltd", () => {
    expect(PACKAGING_FRAMEWORK.operator).toBe("Sterling Commercial Finance Ltd");
  });

  it("CLAUDE.md says agents work for Veltro Ltd on Nexus, not for Strata as the company", () => {
    const text = read("docs/agentic-org/CLAUDE.md");
    expect(text).toMatch(/You work for \*\*Veltro Ltd\*\*/);
    expect(text).toMatch(/\*\*Nexus\*\*/);
    expect(text).toMatch(/Sterling Commercial Finance Ltd/);
    expect(text).toMatch(/Strata Finance/);
    expect(text).not.toMatch(/You work for \*\*Strata Finance\*\*/);
    expect(text).not.toMatch(/Sterling Capital Reserve/);
  });

  it("corporate_structure.md names the Veltro–Sterling contract, not Sterling Capital Reserve", () => {
    const text = read("docs/agentic-org/corporate_structure.md");
    expect(text).toMatch(/Veltro Ltd/);
    expect(text).toMatch(/Sterling Commercial Finance Ltd/);
    expect(text).toMatch(/trades as Strata Finance|trading as Strata Finance/);
    expect(text).not.toMatch(/Sterling Capital Reserve/);
  });

  it("README presents Nexus as the OS and Veltro Ltd as the company", () => {
    const text = read("README.md");
    expect(text).toMatch(/^# Nexus/m);
    expect(text).toMatch(/Veltro Ltd/);
    expect(text).toMatch(/operating system/i);
    expect(text).not.toMatch(/Sterling Capital Reserve/);
  });
});

describe("retired names in operator copy", () => {
  const files = [
    "docs/agentic-org/corporate_structure.md",
    "docs/agentic-org/CLAUDE.md",
    "README.md",
    "shared/salesOs.ts",
    "server/utils/reportPdf.ts",
    "server/routes/submissions.ts",
    "server/Lead Agent/src/strategyAgent.ts",
  ];

  it("does not say Sterling Capital Reserve", () => {
    for (const rel of files) {
      expect(read(rel), rel).not.toMatch(/Sterling Capital Reserve/);
    }
  });
});
