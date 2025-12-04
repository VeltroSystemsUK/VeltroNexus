import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface FinancialAnalysisResult {
  averageMonthlyRevenue: number;
  averageMonthlyExpenses: number;
  netDisposableIncome: number;
  dscr: number;
  riskScore: string;
  summary: string;
  monthlyBreakdown: {
    month: string;
    income: number;
    expenses: number;
    net: number;
    closingBalance: number;
  }[];
  transactionCount: number;
  profitAndLoss: {
    turnover: number;
    costOfSales: number;
    grossProfit: number;
    expenses: Record<string, number>;
    totalExpenses: number;
    netProfit: number;
    periodMonths: number;
  };
  excludedTransferValue: number;
  excludedTransferCount: number;
  redFlags: { label: string; isActive: boolean }[];
  preliminaryFindings: {
    loans: { date: string; description: string; amount: number; type: string; details: string }[];
    transfers: { date: string; description: string; amount: number; type: string; details: string }[];
    anomalies: { date: string; description: string; amount: number; type: string; details: string }[];
  };
}

const DSCR_THRESHOLD = 1.25;

export async function analyzeFinancials(
  csvData: string,
  loanAmount: number,
  monthlyRepayment: number
): Promise<FinancialAnalysisResult> {
  const prompt = `You are a financial analyst specializing in commercial lending. Analyze this bank statement CSV data and provide a comprehensive financial assessment.

BANK STATEMENT CSV DATA:
${csvData}

LOAN DETAILS:
- Requested Amount: £${loanAmount.toLocaleString()}
- Monthly Repayment: £${monthlyRepayment.toLocaleString()}
- DSCR Threshold: ${DSCR_THRESHOLD}

ANALYSIS REQUIREMENTS:
1. Parse all transactions and categorize them (income vs expenses)
2. Calculate monthly cash flow metrics
3. Identify any red flags (gambling, high-risk transactions, irregular patterns)
4. Calculate DSCR (Debt Service Coverage Ratio) = Net Disposable Income / Monthly Repayment
5. Identify existing loan repayments, large transfers, and anomalies
6. Generate a P&L summary
7. Assess overall credit risk (A=Excellent, B=Good, C=Acceptable, D=Marginal, E=Decline)

Return your analysis as valid JSON with this exact structure:
{
  "averageMonthlyRevenue": number,
  "averageMonthlyExpenses": number,
  "netDisposableIncome": number,
  "dscr": number,
  "riskScore": "A" | "B" | "C" | "D" | "E",
  "summary": "Brief executive summary of financial health",
  "monthlyBreakdown": [
    { "month": "Jan 24", "income": number, "expenses": number, "net": number, "closingBalance": number }
  ],
  "transactionCount": number,
  "profitAndLoss": {
    "turnover": number,
    "costOfSales": number,
    "grossProfit": number,
    "expenses": { "category": amount },
    "totalExpenses": number,
    "netProfit": number,
    "periodMonths": number
  },
  "excludedTransferValue": number,
  "excludedTransferCount": number,
  "redFlags": [
    { "label": "Description of concern", "isActive": true }
  ],
  "preliminaryFindings": {
    "loans": [{ "date": "YYYY-MM-DD", "description": "...", "amount": number, "type": "LOAN_REPAYMENT", "details": "..." }],
    "transfers": [{ "date": "YYYY-MM-DD", "description": "...", "amount": number, "type": "TRANSFER", "details": "..." }],
    "anomalies": [{ "date": "YYYY-MM-DD", "description": "...", "amount": number, "type": "ANOMALY", "details": "..." }]
  }
}

IMPORTANT: Return ONLY valid JSON, no additional text or markdown formatting.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text || "";
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response as JSON");
    }

    const result = JSON.parse(jsonMatch[0]) as FinancialAnalysisResult;
    
    if (monthlyRepayment > 0) {
      result.dscr = result.netDisposableIncome / monthlyRepayment;
    }

    return result;
  } catch (error) {
    console.error("Gemini analysis error:", error);
    throw new Error("Failed to analyze financial data");
  }
}

export function calculateRiskGrade(
  dscr: number,
  redFlagsCount: number,
  netDisposable: number,
  isScenarioActive: boolean,
  ddRisk: 'LOW' | 'MEDIUM' | 'HIGH'
): string {
  if (dscr < 1.0 || ddRisk === 'HIGH') return 'E';
  if (dscr < DSCR_THRESHOLD && redFlagsCount > 3) return 'D';
  if (dscr < DSCR_THRESHOLD || ddRisk === 'MEDIUM') return 'C';
  if (dscr >= 1.5 && redFlagsCount === 0 && ddRisk === 'LOW') return 'A';
  if (dscr >= DSCR_THRESHOLD && redFlagsCount <= 2) return 'B';
  return 'C';
}
