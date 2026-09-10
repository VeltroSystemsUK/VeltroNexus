import { describe, expect, it } from "vitest";
import {
  evaluateSterlingCompleteness,
  packCategoryForAttachment,
  requiredCustomerPackLabels,
} from "@shared/sterlingCompleteness";
import { buildSfp } from "@shared/sfp";

describe("Sterling completeness gate", () => {
  it("blocks send when required attachments or the SFP are missing", () => {
    const result = evaluateSterlingCompleteness({
      documents: [{ fileName: "june.pdf", category: "bank-statements" }],
      fundingReason: "Refinance",
      companyNumber: "12345678",
      sfpStatus: "PARTIAL",
    });
    expect(result.ok).toBe(false);
    expect(result.missing.map((item) => item.id)).toEqual(
      expect.arrayContaining(["accounts", "cashflow", "debt-schedule", "id"])
    );
  });

  it("passes only when every required item is present and the SFP is COMPLETE", () => {
    const result = evaluateSterlingCompleteness({
      documents: [
        { fileName: "june.pdf", category: "bank-statements" },
        { fileName: "accounts-2024.pdf", category: "accounts" },
        { fileName: "cff.xlsx", category: "cashflow" },
        { fileName: "debts.xlsx", category: "debt-schedule" },
        { fileName: "passport.pdf", category: "id" },
      ],
      fundingReason: "Stacked MCA refinance",
      companyNumber: "12345678",
      sfpStatus: "COMPLETE",
    });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("does not require a separate Companies House search document", () => {
    const result = evaluateSterlingCompleteness({
      documents: [],
      companyNumber: "00445790",
      sfpStatus: "PARTIAL",
    });
    expect(result.present.map((item) => item.id)).not.toContain("company-search");
    expect(result.missing.map((item) => item.id)).not.toContain("company-search");
  });

  it("accepts legacy pack category names", () => {
    expect(packCategoryForAttachment("bank_statements")).toBe("bank-statements");
    expect(packCategoryForAttachment("audited_accounts")).toBe("accounts");
  });

  it("lists the customer-facing required pack in plain English", () => {
    const labels = requiredCustomerPackLabels();
    expect(labels.join(" ")).toMatch(/bank statements/i);
    expect(labels.join(" ")).toMatch(/cash flow/i);
    expect(labels.join(" ")).toMatch(/director/i);
  });
});

describe("SFP from a pack", () => {
  it("is PARTIAL when required files or sourced figures are missing — never COMPLETE on an empty pack", () => {
    const sfp = buildSfp({
      documents: [],
      fundingReason: "",
      companyNumber: undefined,
      extracted: {},
    });
    expect(sfp.status).toBe("PARTIAL");
    expect(sfp.missing.length).toBeGreaterThan(0);
    expect(sfp.figures).toEqual({});
  });

  it("is COMPLETE only when required docs exist and extracted figures are source-tagged", () => {
    const sfp = buildSfp({
      documents: [
        { fileName: "june.pdf", category: "bank-statements" },
        { fileName: "accounts-2024.pdf", category: "accounts" },
        { fileName: "cff.xlsx", category: "cashflow" },
        { fileName: "debts.xlsx", category: "debt-schedule" },
        { fileName: "passport.pdf", category: "id" },
      ],
      fundingReason: "Refinance stacked MCA",
      companyNumber: "12345678",
      extracted: {
        turnoverGbp: { value: 800000, source: "accounts-2024.pdf" },
        netProfitGbp: { value: 42000, source: "accounts-2024.pdf" },
      },
    });
    expect(sfp.status).toBe("COMPLETE");
    expect(sfp.figures.turnoverGbp?.value).toBe(800000);
    expect(sfp.figures.turnoverGbp?.source).toBe("accounts-2024.pdf");
  });

  it("stays PARTIAL if numbers arrived without a source tag", () => {
    const sfp = buildSfp({
      documents: [
        { fileName: "june.pdf", category: "bank-statements" },
        { fileName: "accounts-2024.pdf", category: "accounts" },
        { fileName: "cff.xlsx", category: "cashflow" },
        { fileName: "debts.xlsx", category: "debt-schedule" },
        { fileName: "passport.pdf", category: "id" },
      ],
      fundingReason: "Refinance",
      companyNumber: "12345678",
      extracted: {
        turnoverGbp: { value: 800000, source: "" },
      },
    });
    expect(sfp.status).toBe("PARTIAL");
    expect(sfp.missing.join(" ")).toMatch(/source/i);
  });
});
