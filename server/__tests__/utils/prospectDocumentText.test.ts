import { describe, expect, it } from "vitest";
import { documentPackCategory, isMcaRateDocument, isPdfDocument } from "../../utils/prospectDocumentText";

describe("documentPackCategory", () => {
  it("treats March statement PDFs as bank statements even without a category", () => {
    expect(documentPackCategory({ fileName: "2026_March_Statement.pdf", category: null })).toBe(
      "bank-statements"
    );
  });

  it("treats statutory accounts filenames as accounts", () => {
    expect(documentPackCategory({ fileName: "FY24-accounts.pdf", category: "general" })).toBe("accounts");
  });

  it("treats yearly profit and loss PDFs as accounts", () => {
    expect(
      documentPackCategory({
        fileName: "Home Crafters yearly profit and loss 2024-03-01 to 2025-02-28.pdf",
        category: "general",
      }),
    ).toBe("accounts");
  });
});

describe("isMcaRateDocument", () => {
  it("treats debt-schedule and existing-facilities PDFs as MCA rate sources", () => {
    expect(
      isMcaRateDocument({ fileName: "1_Home_Crafters_Existing_Business_Finance_Facilities.pdf", category: null }),
    ).toBe(true);
    expect(isMcaRateDocument({ fileName: "pack.pdf", category: "debt-schedule" })).toBe(true);
    expect(isMcaRateDocument({ fileName: "use of funds.pdf", category: "use-of-funds" })).toBe(true);
  });

  it("does not treat bank statements as MCA rate sources", () => {
    expect(isMcaRateDocument({ fileName: "2026_August_Statement.pdf", category: "bank-statements" })).toBe(false);
  });
});

describe("isPdfDocument", () => {
  it("recognises PDFs by type or extension", () => {
    expect(isPdfDocument({ fileName: "x.bin", fileType: "application/pdf" })).toBe(true);
    expect(isPdfDocument({ fileName: "x.pdf", fileType: "application/octet-stream" })).toBe(true);
    expect(isPdfDocument({ fileName: "x.csv", fileType: "text/csv" })).toBe(false);
  });
});
