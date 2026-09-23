import { describe, expect, it } from "vitest";
import { ingestSfpFromPack, readPackDocumentTexts } from "../../services/packIngest";

const PNL = `Profit & Loss
Turnover 121,943
Gross Profit 66,479
Operating Profit £10,174
`;

describe("readPackDocumentTexts", () => {
  it("uses the injected reader and skips missing files", async () => {
    const texts = await readPackDocumentTexts(
      [
        { fileName: "accounts.pdf", category: "accounts", fileType: "application/pdf", storagePath: "/tmp/missing.pdf" },
        { fileName: "notes.txt", category: "accounts", storagePath: "/tmp/notes.txt" },
      ],
      async (storagePath) => (storagePath.endsWith("notes.txt") ? Buffer.from(PNL, "utf8") : null),
    );
    expect(texts).toEqual([{ fileName: "notes.txt", category: "accounts", text: PNL }]);
  });
});

describe("ingestSfpFromPack", () => {
  const requiredDocs = [
    { fileName: "june.pdf", category: "bank-statements", storagePath: "/tmp/june.pdf" },
    { fileName: "accounts-2024.txt", category: "accounts", storagePath: "/tmp/accounts.txt" },
    { fileName: "cff.xlsx", category: "cashflow", storagePath: "/tmp/cff.xlsx" },
    { fileName: "debts.xlsx", category: "debt-schedule", storagePath: "/tmp/debts.xlsx" },
    { fileName: "passport.pdf", category: "id", storagePath: "/tmp/id.pdf" },
  ];

  it("is COMPLETE when the accounts file yields sourced figures", async () => {
    const sfp = await ingestSfpFromPack(
      { documents: requiredDocs, fundingReason: "Refinance stacked MCA", companyNumber: "12345678" },
      {
        readBytes: async (storagePath) =>
          storagePath.endsWith("accounts.txt") ? Buffer.from(PNL, "utf8") : Buffer.from("x"),
      },
    );
    expect(sfp.status).toBe("COMPLETE");
    expect(sfp.figures.turnoverGbp).toEqual({ value: 121943, source: "accounts-2024.txt" });
    expect(sfp.figures.netProfitGbp?.value).toBe(10174);
  });

  it("stays PARTIAL when the pack files have no labelled figures", async () => {
    const sfp = await ingestSfpFromPack(
      { documents: requiredDocs, fundingReason: "Refinance", companyNumber: "12345678" },
      { readBytes: async () => Buffer.from("no numbers here") },
    );
    expect(sfp.status).toBe("PARTIAL");
    expect(sfp.figures).toEqual({});
    expect(sfp.missing.some((item) => /sourced figures/i.test(item))).toBe(true);
  });
});
