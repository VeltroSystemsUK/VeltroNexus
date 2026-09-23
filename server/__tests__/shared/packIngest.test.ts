import { describe, expect, it } from "vitest";
import { extractSfpFiguresFromPackTexts, mergePackFileDocs } from "@shared/packIngest";

const PNL = `Profit & Loss
Home Crafters
Accounting Year 2023/24
Turnover 121,943
Gross Profit 66,479
Operating Profit £10,174
`;

describe("extractSfpFiguresFromPackTexts", () => {
  it("sources turnover and profit from an accounts P&L, tagged with the filename", () => {
    const figures = extractSfpFiguresFromPackTexts([
      {
        fileName: "Home Crafters yearly profit and loss 2023-03-01 to 2024-02-29.pdf",
        category: "accounts",
        text: PNL,
      },
    ]);
    expect(figures.turnoverGbp).toEqual({
      value: 121943,
      source: "Home Crafters yearly profit and loss 2023-03-01 to 2024-02-29.pdf",
    });
    expect(figures.netProfitGbp).toEqual({
      value: 10174,
      source: "Home Crafters yearly profit and loss 2023-03-01 to 2024-02-29.pdf",
    });
  });

  it("extracts labelled Turnover even when the filename has no date", () => {
    const figures = extractSfpFiguresFromPackTexts([
      {
        fileName: "statutory-accounts.pdf",
        category: "accounts",
        text: "Profit and Loss\nTurnover 800,000\nNet Profit 42,000\n",
      },
    ]);
    expect(figures.turnoverGbp?.value).toBe(800000);
    expect(figures.turnoverGbp?.source).toBe("statutory-accounts.pdf");
    expect(figures.netProfitGbp?.value).toBe(42000);
  });

  it("does not invent figures from the event log or from a guess", () => {
    expect(
      extractSfpFiguresFromPackTexts([
        {
          fileName: "events",
          category: "other",
          text: "Day 1 email to ops@acme.test. Director approved. Likely turnover around 800k.",
        },
      ]),
    ).toEqual({});
  });

  it("prefers the latest year when several P&Ls are on the pack", () => {
    const figures = extractSfpFiguresFromPackTexts([
      {
        fileName: "Home Crafters yearly profit and loss 2023-03-01 to 2024-02-29.pdf",
        category: "accounts",
        text: PNL,
      },
      {
        fileName: "Home Crafters yearly profit and loss 2025-03-01 to 2026-02-28.pdf",
        category: "accounts",
        text: "Profit & Loss\nTurnover 163,080\nGross Profit 54,126\nOperating Profit £12,400\n",
      },
    ]);
    expect(figures.turnoverGbp).toEqual({
      value: 163080,
      source: "Home Crafters yearly profit and loss 2025-03-01 to 2026-02-28.pdf",
    });
    expect(figures.netProfitGbp?.value).toBe(12400);
  });

  it("ignores bank statements even if they mention a payment amount", () => {
    expect(
      extractSfpFiguresFromPackTexts([
        {
          fileName: "june.pdf",
          category: "bank-statements",
          text: "Turnover is not a statement line\nDD 1,250.00 IWOca",
        },
      ]),
    ).toEqual({});
  });
});

describe("mergePackFileDocs", () => {
  it("keeps deal-pack files and adds prospect P&Ls that are not already there", () => {
    const merged = mergePackFileDocs(
      [{ fileName: "10034885_aa_2026-04-03.pdf", category: "accounts", storagePath: "pack/aa.pdf" }],
      [
        { fileName: "10034885_aa_2026-04-03.pdf", category: "accounts", storagePath: ".private/dup.pdf" },
        {
          fileName: "Home Crafters yearly profit and loss 2025-03-01 to 2026-02-28.pdf",
          category: "accounts",
          storagePath: ".private/documents/85/pnl.pdf",
        },
      ],
    );
    expect(merged.map((doc) => doc.fileName)).toEqual([
      "10034885_aa_2026-04-03.pdf",
      "Home Crafters yearly profit and loss 2025-03-01 to 2026-02-28.pdf",
    ]);
    expect(merged[1].storagePath).toBe(".private/documents/85/pnl.pdf");
  });
});

