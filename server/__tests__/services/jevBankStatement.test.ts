import { describe, expect, it, vi } from "vitest";
import { jevJudgeTransaction, jevJudgeTransactions, parseJevTransactionAnswers } from "../../services/jevBankStatement";

describe("parseJevTransactionAnswers", () => {
  it("reads category, personal noul and anomaly score from a System One payload", () => {
    const judgment = parseJevTransactionAnswers({
      category: { type: "choice", choice: "drawings" },
      personal: { type: "noul", noul: 0.9 },
      anomaly: { type: "score", score: 3.2 },
    });
    expect(judgment).toEqual({ category: "drawings", personal: true, personalProbability: 0.9, anomalyScore: 3 });
  });

  it("falls back to other/not-personal/zero on an unrecognised category", () => {
    const judgment = parseJevTransactionAnswers({
      category: { choice: "banana" },
      personal: { noul: 0.1 },
    });
    expect(judgment.category).toBe("other");
    expect(judgment.personal).toBe(false);
    expect(judgment.anomalyScore).toBe(0);
  });
});

describe("jevJudgeTransaction", () => {
  it("skips the network call and returns the fallback when no API key is set", async () => {
    const fetchImpl = vi.fn();
    const judgment = await jevJudgeTransaction(
      { date: "1 Jan 24", monthKey: "2024-01", description: "Test", moneyIn: 0, moneyOut: 100 },
      { avgMonthlyOut: 1000, avgMonthlyIn: 1200 },
      {},
      fetchImpl as unknown as typeof fetch,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(judgment.category).toBe("other");
  });
});

describe("jevJudgeTransactions", () => {
  it("judges every transaction in parallel and merges the result onto it", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ answers: { category: { choice: "supplier" }, personal: { noul: 0.1 }, anomaly: { score: 1 } } })),
    );
    const transactions = [
      { date: "1 Jan 24", monthKey: "2024-01", description: "Supplier A", moneyIn: 0, moneyOut: 500 },
      { date: "2 Jan 24", monthKey: "2024-01", description: "Supplier B", moneyIn: 0, moneyOut: 250 },
    ];
    const judged = await jevJudgeTransactions(
      transactions,
      { avgMonthlyOut: 1000, avgMonthlyIn: 1200 },
      { TYPESAFE_API_KEY: "k" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(judged.map((t) => t.category)).toEqual(["supplier", "supplier"]);
    expect(judged[0].description).toBe("Supplier A");
  });
});
