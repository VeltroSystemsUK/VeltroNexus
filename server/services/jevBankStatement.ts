import type { StatementTransaction } from "@shared/bankStatementSweep";
import { noulProbability, scoreValue } from "./jevHarvestRank";

export type TransactionCategory =
  | "rent"
  | "payroll"
  | "supplier"
  | "drawings"
  | "loan_repayment"
  | "tax_hmrc"
  | "gambling"
  | "cash_withdrawal"
  | "bank_charges"
  | "sales_income"
  | "other";

const CATEGORIES: TransactionCategory[] = [
  "rent",
  "payroll",
  "supplier",
  "drawings",
  "loan_repayment",
  "tax_hmrc",
  "gambling",
  "cash_withdrawal",
  "bank_charges",
  "sales_income",
  "other",
];

export type TransactionJudgment = {
  category: TransactionCategory;
  personal: boolean;
  personalProbability: number;
  anomalyScore: number;
};

const FALLBACK: TransactionJudgment = { category: "other", personal: false, personalProbability: 0, anomalyScore: 0 };

function categoryValue(answer: unknown): TransactionCategory {
  const row = answer as { choice?: unknown; value?: unknown } | null;
  const value = String(row?.choice ?? row?.value ?? "");
  return CATEGORIES.includes(value as TransactionCategory) ? (value as TransactionCategory) : "other";
}

export function parseJevTransactionAnswers(answers: Record<string, unknown> | null | undefined): TransactionJudgment {
  const row = answers || {};
  const personalProbability = noulProbability(row.personal);
  return {
    category: categoryValue(row.category),
    personal: personalProbability >= 0.5,
    personalProbability,
    anomalyScore: scoreValue(row.anomaly),
  };
}

export async function jevJudgeTransaction(
  tx: StatementTransaction,
  context: { avgMonthlyOut: number; avgMonthlyIn: number },
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<TransactionJudgment> {
  const key = env.TYPESAFE_API_KEY?.trim();
  if (!key) return FALLBACK;
  try {
    const res = await fetchImpl("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "jev-latest",
        state: {
          description: tx.description,
          date: tx.date,
          moneyOut: tx.moneyOut,
          moneyIn: tx.moneyIn,
          accountAvgMonthlyOut: Math.round(context.avgMonthlyOut),
          accountAvgMonthlyIn: Math.round(context.avgMonthlyIn),
        },
        questions: {
          category: {
            type: "choice",
            instructions:
              "Categorize this UK business bank transaction for a commercial-finance broker's affordability review.",
            criteria: {
              rent: "Property rent or lease of business premises",
              payroll: "Wages, salaries, or PAYE payroll run",
              supplier: "Payment to a trade supplier for goods or services used in the business",
              drawings: "Owner/director drawings or dividend, not a business expense",
              loan_repayment: "Repayment of a loan, MCA, HP, or lease finance facility",
              tax_hmrc: "HMRC payment: VAT, PAYE, NIC, or corporation tax",
              gambling: "Gambling or betting spend",
              cash_withdrawal: "ATM or counter cash withdrawal",
              bank_charges: "Bank fees, overdraft interest, or card charges",
              sales_income: "Incoming customer payment or sales income",
              other: "Does not clearly fit another category",
            },
          },
          personal: {
            type: "noul",
            instructions:
              "Is this a personal or related-party payment (e.g. to/from a director, family member, or personal expense) rather than a genuine business operating cost?",
          },
          anomaly: {
            type: "score",
            instructions:
              "How anomalous is this transaction relative to the account's typical monthly money in/out shown in state? Score 0 for a routine, expected-size transaction and 4 for a one-off, unusually large, or out-of-pattern transaction.",
            criteria: [
              "Routine, in line with the account's normal pattern",
              "Slightly larger or less usual than typical",
              "Noticeably unusual in size or nature",
              "Highly unusual, well outside the account's normal pattern",
              "Extreme outlier relative to the account's normal pattern",
            ],
          },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return FALLBACK;
    const payload = await res.json();
    return parseJevTransactionAnswers(payload?.answers || payload);
  } catch {
    return FALLBACK;
  }
}

export async function jevJudgeTransactions(
  transactions: StatementTransaction[],
  context: { avgMonthlyOut: number; avgMonthlyIn: number },
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<(StatementTransaction & TransactionJudgment)[]> {
  const judged = await Promise.all(transactions.map((tx) => jevJudgeTransaction(tx, context, env, fetchImpl)));
  return transactions.map((tx, i) => ({ ...tx, ...judged[i] }));
}
