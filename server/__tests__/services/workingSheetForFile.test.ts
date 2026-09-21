import { describe, expect, it } from "vitest";
import { workingSheetForFile } from "../../services/sterlingPack";

describe("workingSheetForFile", () => {
  it("puts customer purpose on a copyable quote and Auto Write CAMPARI on a do-not-send draft", () => {
    const items = workingSheetForFile({
      companyName: "PDF REPORT TEST LTD",
      loanAmount: 150000,
      term: 60,
      documents: [{ id: 1, fileName: "FY24-accounts.pdf", category: "accounts" }],
      diligence: {
        applicationData: {
          status: "signed",
          signedName: "Kirsty Bevan",
          signedAt: "2026-09-12",
          answers: { loanPurpose: "Clear the daily MCA so we can pay suppliers on time." },
        },
        underwriting: {
          adviserSummary: { sections: { character: "Directors have a clean credit history." } },
          swotAnalysis: { strengths: ["Repeat trade"] },
          financialAnalysis: { redFlags: ["Returned item — HMRC"] },
        },
      },
    });
    const purpose = items.find((item) => item.text.includes("Clear the daily MCA"));
    expect(purpose).toMatchObject({ kind: "quote", copyable: true });
    const amount = items.find((item) => item.text === "£150,000");
    expect(amount).toMatchObject({ kind: "fact", copyable: true });
    const draft = items.find((item) => item.text.includes("Directors have a clean credit history."));
    expect(draft).toMatchObject({ kind: "draft", copyable: false });
    expect(items.find((item) => item.text === "Repeat trade")).toMatchObject({ kind: "draft", copyable: false });
    expect(items.find((item) => item.text.includes("Returned item"))).toMatchObject({ kind: "flag", copyable: true });
  });
});
