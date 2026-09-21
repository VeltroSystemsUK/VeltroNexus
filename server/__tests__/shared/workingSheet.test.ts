import { describe, expect, it } from "vitest";
import {
  buildWorkingSheet,
  isWorkingSheetCopyable,
  workingSheetHtml,
} from "@shared/workingSheet";

const input = {
  companyName: "PDF REPORT TEST LTD",
  application: {
    signedName: "Kirsty Bevan",
    signedAt: "2026-09-12",
    loanPurpose: "Clear the daily MCA so we can pay suppliers on time.",
    natureOfBusiness: "Bakery supplying regional multiples.",
    declineReasons: "Bank said the MCA already on the account was the issue.",
    jobsProtected: "8",
  },
  facts: [
    { label: "Loan amount", value: "£150,000" },
    { label: "Term", value: "60 months" },
  ],
  flags: ["Returned item — HMRC", "YouLend daily"],
  fileResearch: ["On file: filed accounts, bank statements.", "Missing: cashflow forecast."],
  historicCommentary: ["Net assets £59,817 (2026)."],
  drafts: [
    { label: "C – Character", lines: ["Directors have a clean credit history."] },
    { label: "SWOT strengths", lines: ["Repeat trade"] },
  ],
};

describe("working sheet", () => {
  it("lists customer quotes and file facts as copyable, Auto Write as do-not-send drafts", () => {
    const sheet = buildWorkingSheet(input);
    const purpose = sheet.items.find((item) => item.text.includes("Clear the daily MCA"));
    expect(purpose).toMatchObject({
      kind: "quote",
      section: "Customer",
      copyable: true,
    });
    expect(purpose?.label).toMatch(/purpose/i);

    const amount = sheet.items.find((item) => item.text === "£150,000");
    expect(amount).toMatchObject({ kind: "fact", copyable: true });

    const flag = sheet.items.find((item) => item.text.includes("YouLend daily"));
    expect(flag).toMatchObject({ kind: "flag", copyable: true });

    const draft = sheet.items.find((item) => item.text.includes("Directors have a clean credit history."));
    expect(draft).toMatchObject({
      kind: "draft",
      copyable: false,
      label: "C – Character",
    });
    expect(isWorkingSheetCopyable("quote")).toBe(true);
    expect(isWorkingSheetCopyable("fact")).toBe(true);
    expect(isWorkingSheetCopyable("flag")).toBe(true);
    expect(isWorkingSheetCopyable("draft")).toBe(false);
  });

  it("renders an internal sheet David can pick from, never labelled as a lender document", () => {
    const html = workingSheetHtml(input);
    expect(html).toMatch(/INTERNAL/);
    expect(html).toMatch(/not for lenders/i);
    expect(html).toContain("PDF REPORT TEST LTD");
    expect(html).toContain("Clear the daily MCA so we can pay suppliers on time.");
    expect(html).toContain("Kirsty Bevan");
    expect(html).toContain("£150,000");
    expect(html).toContain("YouLend daily");
    expect(html).toContain("Directors have a clean credit history.");
    expect(html).toMatch(/do not send/i);
    expect(html).toContain('data-copy="1"');
    expect(html).not.toContain("FUNDING PROPOSAL");
  });
});
