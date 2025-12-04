import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
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

IMPORTANT: Return ONLY valid JSON, no additional text or markdown formatting. Ensure all arrays and objects are properly closed.`;

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const text = response.text || "";
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to extract JSON from AI response");
      }

      let jsonStr = jsonMatch[0];
      
      // Try to repair truncated JSON by balancing brackets
      jsonStr = repairJson(jsonStr);
      
      const result = JSON.parse(jsonStr) as FinancialAnalysisResult;
      
      // Ensure required fields exist with defaults
      result.averageMonthlyRevenue = result.averageMonthlyRevenue || 0;
      result.averageMonthlyExpenses = result.averageMonthlyExpenses || 0;
      result.netDisposableIncome = result.netDisposableIncome || 0;
      result.monthlyBreakdown = result.monthlyBreakdown || [];
      result.transactionCount = result.transactionCount || 0;
      result.redFlags = result.redFlags || [];
      result.preliminaryFindings = result.preliminaryFindings || { loans: [], transfers: [], anomalies: [] };
      result.profitAndLoss = result.profitAndLoss || {
        turnover: 0, costOfSales: 0, grossProfit: 0, expenses: {}, totalExpenses: 0, netProfit: 0, periodMonths: 0
      };
      
      if (monthlyRepayment > 0) {
        result.dscr = result.netDisposableIncome / monthlyRepayment;
      }

      return result;
    } catch (error) {
      console.error(`Gemini analysis attempt ${attempt}/${maxRetries} error:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  console.error("All Gemini analysis attempts failed");
  throw new Error("Failed to analyze financial data after multiple attempts");
}

function repairJson(jsonStr: string): string {
  let result = jsonStr.trim();
  
  // Remove any markdown code fences
  result = result.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  result = result.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  
  // Count brackets to check balance
  const openBraces = (result.match(/\{/g) || []).length;
  const closeBraces = (result.match(/\}/g) || []).length;
  const openBrackets = (result.match(/\[/g) || []).length;
  const closeBrackets = (result.match(/\]/g) || []).length;
  
  // If unbalanced, try to fix by removing incomplete trailing data
  if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
    // Find the last complete property (ends with comma, closing bracket, or closing brace)
    const lastCompleteMatch = result.match(/^([\s\S]*[}\],"])\s*[^}\],"]*$/);
    if (lastCompleteMatch) {
      result = lastCompleteMatch[1];
    }
    
    // Remove trailing incomplete content after last valid structure
    result = result.replace(/,\s*[^}\]]*$/, '');
    result = result.replace(/:\s*"[^"]*$/, ': ""');
    result = result.replace(/:\s*\[[^\]]*$/, ': []');
    result = result.replace(/:\s*\{[^}]*$/, ': {}');
    
    // Add missing closing brackets/braces
    const newOpenBraces = (result.match(/\{/g) || []).length;
    const newCloseBraces = (result.match(/\}/g) || []).length;
    const newOpenBrackets = (result.match(/\[/g) || []).length;
    const newCloseBrackets = (result.match(/\]/g) || []).length;
    
    result += ']'.repeat(Math.max(0, newOpenBrackets - newCloseBrackets));
    result += '}'.repeat(Math.max(0, newOpenBraces - newCloseBraces));
  }
  
  return result;
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
