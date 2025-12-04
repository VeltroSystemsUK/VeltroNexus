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

CRITICAL INSTRUCTIONS:
- You MUST analyze the data provided and produce meaningful financial metrics
- Do NOT reject data due to format inconsistencies - work with what you have
- Different banks use different CSV formats - adapt to the format provided
- If balance columns don't reconcile perfectly, ignore them and focus on transaction amounts
- Treat credits/deposits/IN as income, and debits/withdrawals/OUT as expenses
- If columns are unclear, make reasonable assumptions based on transaction descriptions and amounts
- ALWAYS provide numeric values - never return error messages in place of numbers

BANK STATEMENT CSV DATA:
${csvData}

LOAN DETAILS:
- Requested Amount: £${loanAmount.toLocaleString()}
- Monthly Repayment: £${monthlyRepayment.toLocaleString()}
- DSCR Threshold: ${DSCR_THRESHOLD}

ANALYSIS REQUIREMENTS:
1. Parse all transactions - identify credits (income) vs debits (expenses) from amount signs, column headers, or descriptions
2. Calculate monthly cash flow metrics based on actual transaction amounts
3. Identify any red flags (gambling transactions, high-risk activity, irregular patterns, bounced payments)
4. Calculate DSCR = Net Disposable Income / Monthly Repayment (use absolute values)
5. Identify existing loan repayments, large inter-account transfers, and unusual transactions
6. Generate a P&L summary from the transaction categories
7. Assess overall credit risk: A=Excellent (DSCR>2.0), B=Good (DSCR>1.5), C=Acceptable (DSCR>1.25), D=Marginal (DSCR>1.0), E=Decline (DSCR<1.0)

Return your analysis as valid JSON with this exact structure:
{
  "averageMonthlyRevenue": number,
  "averageMonthlyExpenses": number,
  "netDisposableIncome": number,
  "dscr": number,
  "riskScore": "A" | "B" | "C" | "D" | "E",
  "summary": "Brief executive summary of financial health based on actual transactions analyzed",
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
    { "label": "Description of specific concern found", "isActive": true }
  ],
  "preliminaryFindings": {
    "loans": [{ "date": "YYYY-MM-DD", "description": "...", "amount": number, "type": "LOAN_REPAYMENT", "details": "..." }],
    "transfers": [{ "date": "YYYY-MM-DD", "description": "...", "amount": number, "type": "TRANSFER", "details": "..." }],
    "anomalies": [{ "date": "YYYY-MM-DD", "description": "...", "amount": number, "type": "ANOMALY", "details": "..." }]
  }
}

IMPORTANT: 
- Return ONLY valid JSON, no additional text or markdown formatting
- Ensure all arrays and objects are properly closed
- All numeric fields must contain actual numbers (not strings or error messages)
- Analyze the transactions you can identify even if some data is ambiguous`;

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

export interface AuditedAccountsAnalysisResult {
  years: {
    yearEnding: string;
    turnover: number;
    grossProfit: number;
    netProfit: number;
    totalAssets: number;
    totalLiabilities: number;
    netAssets: number;
    shareholderFunds: number;
    cashAndEquivalents: number;
    debtors: number;
    creditors: number;
    bankLoans: number;
  }[];
  ratios: {
    year: string;
    ratios: {
      grossProfitMargin: number;
      netProfitMargin: number;
      currentRatio: number;
      quickRatio: number;
      debtToEquity: number;
      interestCover: number;
      debtorDays: number;
      creditorDays: number;
      returnOnCapitalEmployed: number;
    };
  }[];
  trends: {
    turnoverGrowth: number[];
    profitGrowth: number[];
    netAssetGrowth: number[];
    trend: 'improving' | 'stable' | 'declining';
    summary: string;
  };
  dscr: {
    historical: number[];
    average: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  concerns: {
    category: 'going_concern' | 'contingent_liability' | 'related_party' | 'auditor_opinion' | 'subsequent_event' | 'other';
    description: string;
    severity: 'low' | 'medium' | 'high';
    yearEnding: string;
  }[];
  auditorOpinion: string;
  summary: string;
  riskAssessment: 'low' | 'medium' | 'high';
}

export async function analyzeAuditedAccounts(
  pdfTexts: { year: string; text: string }[],
  loanAmount: number,
  monthlyRepayment: number
): Promise<AuditedAccountsAnalysisResult> {
  const combinedText = pdfTexts.map(p => `\n=== ACCOUNTS FOR YEAR ENDING ${p.year} ===\n${p.text}`).join('\n\n');
  
  const prompt = `You are a financial analyst specializing in commercial lending. Analyze these audited accounts (up to 3 years) extracted from PDF documents and provide a comprehensive credit assessment.

CRITICAL INSTRUCTIONS:
- Extract key financial figures from each year's accounts
- Calculate financial ratios and identify trends
- Pay special attention to the Notes to the Accounts for any concerns
- Look for going concern warnings, contingent liabilities, related party transactions, and auditor qualifications
- Calculate historical DSCR based on operating profit and any debt service costs mentioned

AUDITED ACCOUNTS TEXT:
${combinedText}

LOAN DETAILS:
- Requested Amount: £${loanAmount.toLocaleString()}
- Monthly Repayment: £${monthlyRepayment.toLocaleString()}

Return your analysis as valid JSON with this exact structure:
{
  "years": [
    {
      "yearEnding": "YYYY-MM-DD",
      "turnover": number,
      "grossProfit": number,
      "netProfit": number,
      "totalAssets": number,
      "totalLiabilities": number,
      "netAssets": number,
      "shareholderFunds": number,
      "cashAndEquivalents": number,
      "debtors": number,
      "creditors": number,
      "bankLoans": number
    }
  ],
  "ratios": [
    {
      "year": "YYYY",
      "ratios": {
        "grossProfitMargin": number (percentage),
        "netProfitMargin": number (percentage),
        "currentRatio": number,
        "quickRatio": number,
        "debtToEquity": number,
        "interestCover": number,
        "debtorDays": number,
        "creditorDays": number,
        "returnOnCapitalEmployed": number (percentage)
      }
    }
  ],
  "trends": {
    "turnoverGrowth": [number] (year-on-year % growth),
    "profitGrowth": [number] (year-on-year % growth),
    "netAssetGrowth": [number] (year-on-year % growth),
    "trend": "improving" | "stable" | "declining",
    "summary": "Brief trend analysis summary"
  },
  "dscr": {
    "historical": [number] (DSCR for each year if calculable),
    "average": number,
    "trend": "improving" | "stable" | "declining"
  },
  "concerns": [
    {
      "category": "going_concern" | "contingent_liability" | "related_party" | "auditor_opinion" | "subsequent_event" | "other",
      "description": "Description of concern from notes to accounts",
      "severity": "low" | "medium" | "high",
      "yearEnding": "YYYY"
    }
  ],
  "auditorOpinion": "Summary of auditor's opinion across years (unqualified, qualified, adverse, disclaimer)",
  "summary": "Executive summary of financial health and creditworthiness based on 3-year analysis",
  "riskAssessment": "low" | "medium" | "high"
}

IMPORTANT:
- Return ONLY valid JSON, no additional text or markdown
- Use 0 for any figures not found in the accounts
- If ratios cannot be calculated, use 0
- Always identify any concerns from the notes to accounts
- Provide meaningful analysis even with partial data`;

  const maxRetries = 3;

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

      let jsonStr = repairJson(jsonMatch[0]);
      const result = JSON.parse(jsonStr) as AuditedAccountsAnalysisResult;
      
      // Ensure required fields exist with defaults
      result.years = result.years || [];
      result.ratios = result.ratios || [];
      result.trends = result.trends || { turnoverGrowth: [], profitGrowth: [], netAssetGrowth: [], trend: 'stable', summary: '' };
      result.dscr = result.dscr || { historical: [], average: 0, trend: 'stable' };
      result.concerns = result.concerns || [];
      result.auditorOpinion = result.auditorOpinion || 'Not specified';
      result.summary = result.summary || '';
      result.riskAssessment = result.riskAssessment || 'medium';

      return result;
    } catch (error) {
      console.error(`Audited accounts analysis attempt ${attempt}/${maxRetries} error:`, error);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  throw new Error("Failed to analyze audited accounts after multiple attempts");
}

export interface SwotAnalysisResult {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  summary: string;
}

export async function generateSwotAnalysis(
  companyName: string,
  sector: string,
  loanAmount: number,
  loanPurpose: string,
  financialSummary: string,
  companiesHouseData?: string,
  bankAnalysisSummary?: string,
  eligibilityNotes?: string
): Promise<SwotAnalysisResult> {
  const prompt = `You are a commercial lending analyst. Generate a comprehensive SWOT analysis for this loan application.

COMPANY DETAILS:
- Company Name: ${companyName}
- Sector: ${sector}
- Loan Amount Requested: £${loanAmount.toLocaleString()}
- Purpose of Finance: ${loanPurpose}

${financialSummary ? `FINANCIAL SUMMARY:\n${financialSummary}\n` : ''}
${companiesHouseData ? `COMPANIES HOUSE DATA:\n${companiesHouseData}\n` : ''}
${bankAnalysisSummary ? `BANK STATEMENT ANALYSIS:\n${bankAnalysisSummary}\n` : ''}
${eligibilityNotes ? `ELIGIBILITY NOTES:\n${eligibilityNotes}\n` : ''}

Generate a SWOT analysis for this loan application. Consider:
- Strengths: Internal positive attributes that support the loan (e.g., trading history, financial strength, management experience, industry expertise, cash flow stability)
- Weaknesses: Internal factors that may increase lending risk (e.g., limited trading history, thin margins, high gearing, key person dependency, seasonal cash flow)
- Opportunities: External factors that could benefit the business (e.g., market growth, expansion potential, contract wins, regulatory changes in favor)
- Threats: External factors that could harm repayment ability (e.g., competition, economic conditions, regulatory risks, supply chain issues, interest rate sensitivity)

Return your analysis as valid JSON with this structure:
{
  "strengths": ["Strength 1", "Strength 2", "Strength 3", "Strength 4"],
  "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
  "opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"],
  "threats": ["Threat 1", "Threat 2", "Threat 3"],
  "summary": "Brief overall assessment of the application considering the SWOT factors"
}

IMPORTANT:
- Return ONLY valid JSON, no additional text
- Provide 3-5 points for each category
- Be specific to this application, not generic
- Focus on factors relevant to commercial lending decisions`;

  const maxRetries = 3;

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

      let jsonStr = repairJson(jsonMatch[0]);
      const result = JSON.parse(jsonStr) as SwotAnalysisResult;
      
      // Ensure required fields exist with defaults
      result.strengths = result.strengths || [];
      result.weaknesses = result.weaknesses || [];
      result.opportunities = result.opportunities || [];
      result.threats = result.threats || [];
      result.summary = result.summary || '';

      return result;
    } catch (error) {
      console.error(`SWOT analysis attempt ${attempt}/${maxRetries} error:`, error);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  throw new Error("Failed to generate SWOT analysis after multiple attempts");
}
