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
    transfers: {
      date: string;
      description: string;
      amount: number;
      type: string;
      details: string;
    }[];
    anomalies: {
      date: string;
      description: string;
      amount: number;
      type: string;
      details: string;
    }[];
  };
}

const DSCR_THRESHOLD = 1.25;

// Red flag keywords for transaction detection
const RED_FLAG_KEYWORDS = [
  { pattern: /gambl|bet365|paddy\s*power|william\s*hill|ladbrokes|coral|betfair|skybet|888|casino/i, label: "Gambling activity detected" },
  { pattern: /payday|wonga|quickquid|sunny|amigo/i, label: "Payday loan detected" },
  { pattern: /bounced|returned|unpaid|dishon/i, label: "Returned/bounced payment" },
  { pattern: /hmrc|vat|paye|tax/i, label: "Tax authority payment" },
  { pattern: /loan|credit|finance.*repay/i, label: "Existing loan repayment" },
];

interface ParsedTransaction {
  date: Date;
  month: string; // "Jan 24" format
  description: string;
  income: number;
  expense: number;
  balance: number | null;
}

interface MonthlyAggregate {
  month: string;
  income: number;
  expenses: number;
  net: number;
  transactionCount: number;
  closingBalance: number;
}

interface CsvPreProcessResult {
  monthlyBreakdown: MonthlyAggregate[];
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
  averageMonthlyIncome: number;
  averageMonthlyExpenses: number;
  netDisposableIncome: number;
  redFlagsFound: { label: string; count: number; totalAmount: number }[];
  notableTransactions: { date: string; description: string; amount: number; type: string }[];
  periodMonths: number;
}

function parseAmount(value: string, preserveSign = false): number {
  if (!value || value.trim() === '') return 0;
  // Remove currency symbols, quotes, and handle commas
  const cleaned = value.replace(/[£$€"']/g, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return preserveSign ? num : Math.abs(num);
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  const cleaned = dateStr.trim();
  
  // Try DD/MM/YYYY format
  const ukMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    const fullYear = year.length === 2 ? (parseInt(year) > 50 ? 1900 + parseInt(year) : 2000 + parseInt(year)) : parseInt(year);
    return new Date(fullYear, parseInt(month) - 1, parseInt(day));
  }
  
  // Try YYYY-MM-DD format
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(cleaned);
  }
  
  // Try other common formats
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function getMonthKey(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
}

export function preprocessCsvData(csvData: string): CsvPreProcessResult {
  const lines = csvData.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    return {
      monthlyBreakdown: [],
      totalIncome: 0,
      totalExpenses: 0,
      transactionCount: 0,
      averageMonthlyIncome: 0,
      averageMonthlyExpenses: 0,
      netDisposableIncome: 0,
      redFlagsFound: [],
      notableTransactions: [],
      periodMonths: 0,
    };
  }

  // Parse header to identify columns - normalize by removing currency symbols and extra chars
  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(',').map(h => h.trim().replace(/["'£$€()]/g, '').trim());
  
  // Find column indices with flexible matching for common UK bank formats
  const dateIdx = headers.findIndex(h => h.includes('date') || h === 'posted');
  const descIdx = headers.findIndex(h => 
    h.includes('desc') || h.includes('details') || h.includes('narrative') || 
    h.includes('reference') || h.includes('transaction') || h.includes('particulars')
  );
  // Match: "in", "paid in", "credit", "money in", "credits", "deposit", etc.
  const inIdx = headers.findIndex(h => 
    h === 'in' || h.includes('paid in') || h.includes('money in') || 
    h.includes('credit') || h.includes('deposit') || h.includes('receipts')
  );
  // Match: "out", "paid out", "debit", "money out", "debits", "withdrawal", etc.  
  const outIdx = headers.findIndex(h => 
    h === 'out' || h.includes('paid out') || h.includes('money out') || 
    h.includes('debit') || h.includes('withdrawal') || h.includes('payments')
  );
  const balanceIdx = headers.findIndex(h => h.includes('balance'));
  // Match "amount" but not if it's part of in/out column names already found
  const amountIdx = headers.findIndex((h, i) => 
    (h === 'amount' || h.includes('value')) && i !== inIdx && i !== outIdx
  );
  
  console.log(`[CSV Parser] Headers: ${headers.join(', ')}`);
  console.log(`[CSV Parser] Found columns - date:${dateIdx}, desc:${descIdx}, in:${inIdx}, out:${outIdx}, balance:${balanceIdx}, amount:${amountIdx}`);

  const transactions: ParsedTransaction[] = [];
  const monthlyData: Map<string, MonthlyAggregate> = new Map();
  const redFlagCounts: Map<string, { count: number; totalAmount: number }> = new Map();
  const notableTransactions: { date: string; description: string; amount: number; type: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse CSV line handling quoted values
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const dateVal = dateIdx >= 0 ? values[dateIdx] : '';
    const date = parseDate(dateVal);
    if (!date) continue;

    const description = descIdx >= 0 ? values[descIdx]?.replace(/"/g, '') || '' : '';
    
    let income = 0;
    let expense = 0;
    
    if (inIdx >= 0 && outIdx >= 0) {
      // Separate IN/OUT columns
      income = parseAmount(values[inIdx]);
      expense = parseAmount(values[outIdx]);
    } else if (amountIdx >= 0) {
      // Single amount column - positive is income, negative is expense
      const amt = parseFloat(values[amountIdx]?.replace(/[£$€"',]/g, '') || '0');
      if (amt > 0) income = amt;
      else expense = Math.abs(amt);
    }

    // Preserve sign for balance (can be negative for overdrafts)
    const balance = balanceIdx >= 0 ? parseAmount(values[balanceIdx], true) : null;
    const monthKey = getMonthKey(date);

    transactions.push({ date, month: monthKey, description, income, expense, balance });

    // Aggregate by month
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { month: monthKey, income: 0, expenses: 0, net: 0, transactionCount: 0, closingBalance: 0 });
    }
    const monthAgg = monthlyData.get(monthKey)!;
    monthAgg.income += income;
    monthAgg.expenses += expense;
    monthAgg.net = monthAgg.income - monthAgg.expenses;
    monthAgg.transactionCount++;
    if (balance !== null) monthAgg.closingBalance = balance;

    // Check red flags on FULL description before any truncation
    for (const rf of RED_FLAG_KEYWORDS) {
      if (rf.pattern.test(description)) {
        const existing = redFlagCounts.get(rf.label) || { count: 0, totalAmount: 0 };
        existing.count++;
        existing.totalAmount += income + expense;
        redFlagCounts.set(rf.label, existing);
      }
    }

    // Track notable large transactions (>£5000) - check keywords on FULL description
    const txAmount = income || expense;
    const isLoanRelated = /loan|credit|finance/i.test(description);
    const isTransfer = /transfer/i.test(description);
    
    if (txAmount > 5000 || isLoanRelated || isTransfer) {
      let txType = income > 0 ? 'LARGE_CREDIT' : 'LARGE_DEBIT';
      if (isLoanRelated) txType = 'LOAN_RELATED';
      if (isTransfer) txType = 'TRANSFER';
      
      notableTransactions.push({
        date: date.toISOString().split('T')[0],
        description: description.substring(0, 80), // Longer truncation for display
        amount: txAmount,
        type: txType,
      });
    }
  }

  // Sort monthly breakdown chronologically
  const monthlyBreakdown = Array.from(monthlyData.values()).sort((a, b) => {
    const parseMonthKey = (key: string) => {
      const [mon, yr] = key.split(' ');
      const monthNum = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(mon);
      return parseInt('20' + yr) * 12 + monthNum;
    };
    return parseMonthKey(a.month) - parseMonthKey(b.month);
  });

  const totalIncome = monthlyBreakdown.reduce((sum, m) => sum + m.income, 0);
  const totalExpenses = monthlyBreakdown.reduce((sum, m) => sum + m.expenses, 0);
  const periodMonths = monthlyBreakdown.length || 1;

  return {
    monthlyBreakdown,
    totalIncome,
    totalExpenses,
    transactionCount: transactions.length,
    averageMonthlyIncome: totalIncome / periodMonths,
    averageMonthlyExpenses: totalExpenses / periodMonths,
    netDisposableIncome: (totalIncome - totalExpenses) / periodMonths,
    redFlagsFound: Array.from(redFlagCounts.entries()).map(([label, data]) => ({ label, ...data })),
    notableTransactions: notableTransactions.slice(0, 20), // Top 20 notable transactions
    periodMonths,
  };
}

export async function analyzeFinancials(
  csvData: string,
  loanAmount: number,
  monthlyRepayment: number
): Promise<FinancialAnalysisResult> {
  // Pre-process CSV locally for fast metrics
  console.log("[Gemini CSV] Pre-processing CSV data locally...");
  const preProcessed = preprocessCsvData(csvData);
  console.log(`[Gemini CSV] Parsed ${preProcessed.transactionCount} transactions across ${preProcessed.periodMonths} months`);

  // If we have valid pre-processed data, send condensed summary to AI for narrative
  const condensedSummary = `
MONTHLY CASH FLOW SUMMARY (${preProcessed.periodMonths} months):
${preProcessed.monthlyBreakdown.map(m => `${m.month}: Income £${m.income.toFixed(2)}, Expenses £${m.expenses.toFixed(2)}, Net £${m.net.toFixed(2)}, Transactions: ${m.transactionCount}`).join('\n')}

TOTALS:
- Total Income: £${preProcessed.totalIncome.toFixed(2)}
- Total Expenses: £${preProcessed.totalExpenses.toFixed(2)}
- Average Monthly Income: £${preProcessed.averageMonthlyIncome.toFixed(2)}
- Average Monthly Expenses: £${preProcessed.averageMonthlyExpenses.toFixed(2)}
- Net Disposable Income (Monthly): £${preProcessed.netDisposableIncome.toFixed(2)}
- Transaction Count: ${preProcessed.transactionCount}

${preProcessed.redFlagsFound.length > 0 ? `RED FLAGS DETECTED:\n${preProcessed.redFlagsFound.map(rf => `- ${rf.label}: ${rf.count} occurrences, total £${rf.totalAmount.toFixed(2)}`).join('\n')}` : 'NO RED FLAGS DETECTED'}

${preProcessed.notableTransactions.length > 0 ? `NOTABLE LARGE TRANSACTIONS:\n${preProcessed.notableTransactions.map(t => `- ${t.date}: ${t.description} - £${t.amount.toFixed(2)} (${t.type})`).join('\n')}` : ''}
`;

  // Calculate DSCR from pre-processed data
  const calculatedDscr = monthlyRepayment > 0 ? preProcessed.netDisposableIncome / monthlyRepayment : 0;
  
  // Determine risk score based on DSCR
  let riskScore: string;
  if (calculatedDscr > 2.0) riskScore = 'A';
  else if (calculatedDscr > 1.5) riskScore = 'B';
  else if (calculatedDscr > 1.25) riskScore = 'C';
  else if (calculatedDscr > 1.0) riskScore = 'D';
  else riskScore = 'E';

  // Build red flags from pre-processed data
  const redFlags = preProcessed.redFlagsFound.map(rf => ({
    label: `${rf.label} (${rf.count} occurrences, £${rf.totalAmount.toFixed(2)})`,
    isActive: true,
  }));

  // Build preliminary findings from notable transactions using pre-categorized types
  const preliminaryFindings = {
    loans: preProcessed.notableTransactions
      .filter(t => t.type === 'LOAN_RELATED')
      .map(t => ({ date: t.date, description: t.description, amount: t.amount, type: 'LOAN_REPAYMENT', details: '' })),
    transfers: preProcessed.notableTransactions
      .filter(t => t.type === 'TRANSFER')
      .map(t => ({ date: t.date, description: t.description, amount: t.amount, type: 'TRANSFER', details: '' })),
    anomalies: preProcessed.notableTransactions
      .filter(t => t.amount > 10000 && t.type !== 'LOAN_RELATED' && t.type !== 'TRANSFER')
      .map(t => ({ date: t.date, description: t.description, amount: t.amount, type: 'LARGE_TRANSACTION', details: '' })),
  };

  // Now get AI to provide just the narrative summary (much faster with condensed data)
  const prompt = `You are a financial analyst. Based on this pre-processed bank statement summary, provide a brief executive summary.

${condensedSummary}

LOAN DETAILS:
- Requested Amount: £${loanAmount.toLocaleString()}
- Monthly Repayment: £${monthlyRepayment.toLocaleString()}
- DSCR: ${calculatedDscr.toFixed(2)}
- Risk Score: ${riskScore}

Write a 2-3 sentence executive summary of the financial health and lending risk. Focus on cash flow stability, any concerns, and overall recommendation.
Return ONLY the summary text, no JSON or formatting.`;

  const maxRetries = 2;
  let summary = `Based on ${preProcessed.periodMonths} months of bank statements with ${preProcessed.transactionCount} transactions, the average monthly income is £${preProcessed.averageMonthlyIncome.toFixed(2)} with expenses of £${preProcessed.averageMonthlyExpenses.toFixed(2)}, resulting in a DSCR of ${calculatedDscr.toFixed(2)}.`;
  const timeoutMs = 30000; // 30 second timeout for summary only

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Gemini CSV] Getting AI summary (attempt ${attempt}/${maxRetries})...`);
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Gemini API timeout after ${timeoutMs/1000}s`)), timeoutMs)
      );
      
      const response = await Promise.race([
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        }),
        timeoutPromise
      ]);

      const text = response.text?.trim() || "";
      if (text.length > 20) {
        summary = text;
        console.log(`[Gemini CSV] Got AI summary (${summary.length} chars)`);
      }
      break;
    } catch (error) {
      console.error(`[Gemini CSV] Summary attempt ${attempt}/${maxRetries} error:`, error);
      // Continue with default summary if AI fails
    }
  }

  // Build result using pre-processed data (instant) + AI summary
  const result: FinancialAnalysisResult = {
    averageMonthlyRevenue: preProcessed.averageMonthlyIncome,
    averageMonthlyExpenses: preProcessed.averageMonthlyExpenses,
    netDisposableIncome: preProcessed.netDisposableIncome,
    dscr: calculatedDscr,
    riskScore,
    summary,
    monthlyBreakdown: preProcessed.monthlyBreakdown.map(m => ({
      month: m.month,
      income: m.income,
      expenses: m.expenses,
      net: m.net,
      closingBalance: m.closingBalance,
    })),
    transactionCount: preProcessed.transactionCount,
    profitAndLoss: {
      turnover: preProcessed.totalIncome,
      costOfSales: 0,
      grossProfit: preProcessed.totalIncome,
      expenses: {},
      totalExpenses: preProcessed.totalExpenses,
      netProfit: preProcessed.totalIncome - preProcessed.totalExpenses,
      periodMonths: preProcessed.periodMonths,
    },
    excludedTransferValue: 0,
    excludedTransferCount: 0,
    redFlags,
    preliminaryFindings,
  };

  console.log(`[Gemini CSV] Analysis complete - DSCR: ${calculatedDscr.toFixed(2)}, Risk: ${riskScore}`);
  return result;
}

export async function analyzeFinancialsFromPdf(
  pdfTexts: { fileName: string; text: string; pages?: number }[],
  loanAmount: number,
  monthlyRepayment: number
): Promise<FinancialAnalysisResult> {
  const combinedText = pdfTexts
    .map((p, i) => `\n=== BANK STATEMENT FILE ${i + 1}: ${p.fileName} ===\n${p.text}`)
    .join("\n\n");

  const prompt = `You are a financial analyst specializing in commercial lending. Analyze these bank statements extracted from PDF documents (up to 6 months) and provide a comprehensive financial assessment.

CRITICAL INSTRUCTIONS:
- These are raw text extractions from PDF bank statements - they may contain headers, footers, page numbers, and formatting artifacts
- You MUST analyze the data provided and produce meaningful financial metrics
- Identify the bank format and adapt your parsing accordingly (different banks have different statement layouts)
- Look for transaction tables with dates, descriptions, debits/credits, and balances
- Ignore repeated headers, footers, page numbers, and promotional content
- Credits/deposits/payments IN are income; debits/withdrawals/payments OUT are expenses
- ALWAYS provide numeric values - never return error messages in place of numbers

BANK STATEMENT PDF TEXT:
${combinedText}

LOAN DETAILS:
- Requested Amount: £${loanAmount.toLocaleString()}
- Monthly Repayment: £${monthlyRepayment.toLocaleString()}
- DSCR Threshold: ${DSCR_THRESHOLD}

ANALYSIS REQUIREMENTS:
1. Parse all transactions from the PDF text - identify the transaction table structure
2. Separate credits (income) from debits (expenses) based on amount signs, column positions, or descriptions
3. Calculate monthly cash flow metrics based on actual transaction amounts
4. Identify any red flags (gambling, high-risk activity, irregular patterns, bounced payments, returned items)
5. Calculate DSCR = Net Disposable Income / Monthly Repayment (use absolute values)
6. Identify existing loan repayments, large transfers, and unusual transactions
7. Generate a P&L summary from the transaction categories
8. Assess overall credit risk: A=Excellent (DSCR>2.0), B=Good (DSCR>1.5), C=Acceptable (DSCR>1.25), D=Marginal (DSCR>1.0), E=Decline (DSCR<1.0)

Return your analysis as valid JSON with this exact structure:
{
  "averageMonthlyRevenue": number,
  "averageMonthlyExpenses": number,
  "netDisposableIncome": number,
  "dscr": number,
  "riskScore": "A" | "B" | "C" | "D" | "E",
  "summary": "Brief executive summary of financial health based on actual transactions analyzed from PDF statements",
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
- Analyze the transactions you can identify from the PDF text even if some data is unclear`;

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
      jsonStr = repairJson(jsonStr);

      const result = JSON.parse(jsonStr) as FinancialAnalysisResult;

      result.averageMonthlyRevenue = result.averageMonthlyRevenue || 0;
      result.averageMonthlyExpenses = result.averageMonthlyExpenses || 0;
      
      // Ensure netDisposableIncome is correctly calculated from revenue - expenses
      // The AI may return an inconsistent value, so we recalculate to ensure accuracy
      const calculatedNetDisposable = result.averageMonthlyRevenue - result.averageMonthlyExpenses;
      result.netDisposableIncome = calculatedNetDisposable;
      
      result.monthlyBreakdown = result.monthlyBreakdown || [];
      result.transactionCount = result.transactionCount || 0;
      result.redFlags = result.redFlags || [];
      result.preliminaryFindings = result.preliminaryFindings || {
        loans: [],
        transfers: [],
        anomalies: [],
      };
      result.profitAndLoss = result.profitAndLoss || {
        turnover: 0,
        costOfSales: 0,
        grossProfit: 0,
        expenses: {},
        totalExpenses: 0,
        netProfit: 0,
        periodMonths: 0,
      };

      // Calculate DSCR from the corrected netDisposableIncome
      if (monthlyRepayment > 0) {
        result.dscr = result.netDisposableIncome / monthlyRepayment;
        
        // Recalculate risk score based on corrected DSCR
        if (result.dscr > 2.0) result.riskScore = 'A';
        else if (result.dscr > 1.5) result.riskScore = 'B';
        else if (result.dscr > 1.25) result.riskScore = 'C';
        else if (result.dscr > 1.0) result.riskScore = 'D';
        else result.riskScore = 'E';
        
        console.log(`[Gemini PDF] DSCR calculated: ${result.netDisposableIncome.toFixed(2)} / ${monthlyRepayment.toFixed(2)} = ${result.dscr.toFixed(2)}, Risk: ${result.riskScore}`);
      }

      return result;
    } catch (error) {
      console.error(`Gemini PDF analysis attempt ${attempt}/${maxRetries} error:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error("All Gemini PDF analysis attempts failed");
  throw new Error("Failed to analyze bank statement PDFs after multiple attempts");
}

function repairJson(jsonStr: string): string {
  let result = jsonStr.trim();

  // Remove any markdown code fences
  result = result.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
  result = result.replace(/^```\s*/i, "").replace(/\s*```$/i, "");

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
    result = result.replace(/,\s*[^}\]]*$/, "");
    result = result.replace(/:\s*"[^"]*$/, ': ""');
    result = result.replace(/:\s*\[[^\]]*$/, ": []");
    result = result.replace(/:\s*\{[^}]*$/, ": {}");

    // Add missing closing brackets/braces
    const newOpenBraces = (result.match(/\{/g) || []).length;
    const newCloseBraces = (result.match(/\}/g) || []).length;
    const newOpenBrackets = (result.match(/\[/g) || []).length;
    const newCloseBrackets = (result.match(/\]/g) || []).length;

    result += "]".repeat(Math.max(0, newOpenBrackets - newCloseBrackets));
    result += "}".repeat(Math.max(0, newOpenBraces - newCloseBraces));
  }

  return result;
}

export function calculateRiskGrade(
  dscr: number,
  redFlagsCount: number,
  netDisposable: number,
  isScenarioActive: boolean,
  ddRisk: "LOW" | "MEDIUM" | "HIGH"
): string {
  if (dscr < 1.0 || ddRisk === "HIGH") return "E";
  if (dscr < DSCR_THRESHOLD && redFlagsCount > 3) return "D";
  if (dscr < DSCR_THRESHOLD || ddRisk === "MEDIUM") return "C";
  if (dscr >= 1.5 && redFlagsCount === 0 && ddRisk === "LOW") return "A";
  if (dscr >= DSCR_THRESHOLD && redFlagsCount <= 2) return "B";
  return "C";
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
    trend: "improving" | "stable" | "declining";
    summary: string;
  };
  dscr: {
    historical: number[];
    average: number;
    trend: "improving" | "stable" | "declining";
  };
  concerns: {
    category:
      | "going_concern"
      | "contingent_liability"
      | "related_party"
      | "auditor_opinion"
      | "subsequent_event"
      | "other";
    description: string;
    severity: "low" | "medium" | "high";
    yearEnding: string;
  }[];
  auditorOpinion: string;
  summary: string;
  riskAssessment: "low" | "medium" | "high";
}

export async function analyzeAuditedAccounts(
  pdfTexts: { year: string; text: string }[],
  loanAmount: number,
  monthlyRepayment: number
): Promise<AuditedAccountsAnalysisResult> {
  const combinedText = pdfTexts
    .map((p) => `\n=== ACCOUNTS FOR YEAR ENDING ${p.year} ===\n${p.text}`)
    .join("\n\n");

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
      result.trends = result.trends || {
        turnoverGrowth: [],
        profitGrowth: [],
        netAssetGrowth: [],
        trend: "stable",
        summary: "",
      };
      result.dscr = result.dscr || { historical: [], average: 0, trend: "stable" };
      result.concerns = result.concerns || [];
      result.auditorOpinion = result.auditorOpinion || "Not specified";
      result.summary = result.summary || "";
      result.riskAssessment = result.riskAssessment || "medium";

      return result;
    } catch (error) {
      console.error(`Audited accounts analysis attempt ${attempt}/${maxRetries} error:`, error);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
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

${financialSummary ? `FINANCIAL SUMMARY:\n${financialSummary}\n` : ""}
${companiesHouseData ? `COMPANIES HOUSE DATA:\n${companiesHouseData}\n` : ""}
${bankAnalysisSummary ? `BANK STATEMENT ANALYSIS:\n${bankAnalysisSummary}\n` : ""}
${eligibilityNotes ? `ELIGIBILITY NOTES:\n${eligibilityNotes}\n` : ""}

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
      result.summary = result.summary || "";

      return result;
    } catch (error) {
      console.error(`SWOT analysis attempt ${attempt}/${maxRetries} error:`, error);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw new Error("Failed to generate SWOT analysis after multiple attempts");
}

// CAMPARI section generation
const CAMPARI_PROMPTS: Record<string, string> = {
  character: `Assess the CHARACTER of the applicant/business. Consider:
- Who are the owners/directors and their track record?
- How long has the business traded?
- Any CCJs, defaults, late filings, or governance concerns?
- What does bank conduct show about reliability?
- Are credit reports (personal + business) clean?
- Have statutory obligations (VAT, PAYE, CT) been met?
- Is management transparent and responsive?`,
  ability: `Assess the ABILITY of the management team. Consider:
- Do directors have the skills and experience to run this business?
- What qualifications or industry experience do they have?
- Is team capability sufficient to deliver contracts?
- Evidence of recurring revenue or proven delivery history?
- Are contracts, pipelines, or orders in place?
- Any operational or staffing gaps that impact delivery?`,
  means: `Assess the MEANS (financial position) of the business. Consider:
- Current financial position (assets, liabilities, equity)?
- Do accounts show consistent profitability or deterioration?
- Balance sheet indicators (working capital, liquidity, gearing)?
- Are debtor, creditor, and stock levels reasonable?
- Related-party balances or intercompany exposures?
- Is the business over-leveraged or reliant on short-term debt?
- Does bank behaviour support the financial summaries?`,
  purpose: `Assess the PURPOSE of the loan. Consider:
- What exactly is the loan for?
- Is the purpose permitted under policy?
- What evidence supports the requirement (invoices, quotes)?
- For refinance: which lenders, what balances, what savings?
- Does the purpose improve viability?
- Is the purpose business-related only (no private benefit)?`,
  amount: `Assess the AMOUNT requested. Consider:
- How much funding is required and how was this calculated?
- Does the amount reconcile to evidence?
- Is contribution required and verified?
- Is loan size proportionate to turnover and balance-sheet strength?
- Could the same outcome be achieved with a smaller amount?`,
  repayment: `Assess the REPAYMENT ability. Consider:
- Historic cash inflows/outflows from bank statements?
- What will monthly repayment be under the loan?
- Is there sufficient free cashflow to service the loan?
- What is DSCR (base case and downside)?
- Are VAT/PAYE/CT obligations included in cashflow forecast?
- Are forecasts realistic and tied to evidence?`,
  insurance: `Assess INSURANCE and security considerations. Consider:
- What security is available (PGs, assets, debentures)?
- Is insurance adequate for business risks?
- Are there life/key person policies in place?
- What mitigants exist for identified risks?
- Is the security proportionate to the loan size?`,
};

export interface DocumentSummary {
  fileName: string;
  category: string;
  content: string;
}

export async function generateCampariSection(
  sectionKey: string,
  companyName: string,
  sector: string,
  loanAmount: number,
  loanPurpose: string,
  financialSummary: string,
  companiesHouseData?: string,
  bankAnalysisSummary?: string,
  accountsAnalysisSummary?: string,
  documentSummaries?: DocumentSummary[]
): Promise<string> {
  const sectionPrompt = CAMPARI_PROMPTS[sectionKey];
  if (!sectionPrompt) {
    throw new Error(`Unknown CAMPARI section: ${sectionKey}`);
  }

  // Build document content section
  let documentContent = "";
  if (documentSummaries && documentSummaries.length > 0) {
    documentContent = "UPLOADED DOCUMENTS:\n\n";
    for (const doc of documentSummaries) {
      const categoryLabel =
        doc.category === "business"
          ? "Business Plan"
          : doc.category === "financial"
            ? "Financial Document"
            : doc.category === "legal"
              ? "Legal Document"
              : doc.category === "identity"
                ? "CV / Identity Document"
                : doc.category === "correspondence"
                  ? "Correspondence / Loan Application"
                  : doc.category === "property"
                    ? "Property Document"
                    : doc.category === "other"
                      ? "Supporting Document"
                      : "Document";
      documentContent += `--- ${categoryLabel}: ${doc.fileName} ---\n${doc.content}\n\n`;
    }
  }

  const prompt = `You are an experienced commercial lending underwriter. Write a professional assessment for a loan application.

COMPANY DETAILS:
- Company Name: ${companyName}
- Sector: ${sector}
- Loan Amount Requested: £${loanAmount.toLocaleString()}
- Purpose of Finance: ${loanPurpose}

${financialSummary ? `FINANCIAL SUMMARY:\n${financialSummary}\n` : ""}
${companiesHouseData ? `COMPANIES HOUSE DATA:\n${companiesHouseData}\n` : ""}
${bankAnalysisSummary ? `BANK STATEMENT ANALYSIS:\n${bankAnalysisSummary}\n` : ""}
${accountsAnalysisSummary ? `ACCOUNTS ANALYSIS:\n${accountsAnalysisSummary}\n` : ""}
${documentContent}

TASK: Write a professional credit assessment for this CAMPARI section.

${sectionPrompt}

IMPORTANT: You MUST draw upon ALL the information provided above, especially any uploaded documents such as Business Plans, Company Profiles, CVs, and Loan Applications. Reference specific details and evidence from these documents in your assessment.

Write 2-4 concise paragraphs in professional underwriting language. Be specific to this application using the data provided.
Start directly with the assessment - do not include section headers or titles.
Focus on facts and evidence from the provided data. Where data is limited, note what additional information would be helpful.`;

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const text = response.text || "";

      // Clean up the response
      const cleanedText = text
        .replace(/^[\s\n]*/, "") // Remove leading whitespace
        .replace(/[\s\n]*$/, "") // Remove trailing whitespace
        .trim();

      if (cleanedText.length < 50) {
        throw new Error("Response too short");
      }

      return cleanedText;
    } catch (error) {
      console.error(`CAMPARI section generation attempt ${attempt}/${maxRetries} error:`, error);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw new Error("Failed to generate CAMPARI section after multiple attempts");
}

export interface ManagementAccountsAnalysis {
  summary: string;
  keyMetrics: {
    revenue?: number;
    grossProfit?: number;
    netProfit?: number;
    ebitda?: number;
    totalAssets?: number;
    totalLiabilities?: number;
    netAssets?: number;
    cashPosition?: number;
  };
  commentary: string;
  strengths: string[];
  concerns: string[];
  recommendations: string[];
  profitabilityAssessment: string;
  liquidityAssessment: string;
  overallRating: "strong" | "satisfactory" | "weak" | "critical";
}

export async function analyzeManagementAccounts(
  parsedText: string,
  companyName: string,
  periodMonths: number
): Promise<ManagementAccountsAnalysis> {
  const prompt = `You are an experienced commercial lending underwriter analyzing management accounts for a credit application.

COMPANY: ${companyName}
PERIOD COVERED: ${periodMonths} months

MANAGEMENT ACCOUNTS CONTENT:
${parsedText.substring(0, 25000)}

TASK: Analyze these management accounts and provide a comprehensive assessment for lending purposes.

Return your analysis as a valid JSON object with this exact structure:
{
  "summary": "A 2-3 sentence executive summary of the financial position",
  "keyMetrics": {
    "revenue": <number or null if not found>,
    "grossProfit": <number or null>,
    "netProfit": <number or null>,
    "ebitda": <number or null>,
    "totalAssets": <number or null>,
    "totalLiabilities": <number or null>,
    "netAssets": <number or null>,
    "cashPosition": <number or null>
  },
  "commentary": "A detailed 2-3 paragraph analysis of the financial performance, trends, and position. Reference specific figures from the accounts.",
  "strengths": ["strength1", "strength2", "strength3"],
  "concerns": ["concern1", "concern2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "profitabilityAssessment": "Assessment of profitability (1-2 sentences)",
  "liquidityAssessment": "Assessment of liquidity and cash position (1-2 sentences)",
  "overallRating": "strong" | "satisfactory" | "weak" | "critical"
}

IMPORTANT:
- Extract actual numbers from the management accounts where visible
- If exact figures cannot be determined, note this and provide estimates or ranges
- Be specific about trends (improving/declining)
- Consider seasonality if relevant
- Rating criteria:
  - "strong": Healthy profitability, good liquidity, positive trends
  - "satisfactory": Adequate performance with some minor concerns
  - "weak": Concerning metrics requiring attention
  - "critical": Significant financial distress indicators

Return ONLY the JSON object, no other text.`;

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const text = response.text || "";
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]) as ManagementAccountsAnalysis;
      
      // Validate required fields
      if (!parsed.summary || !parsed.commentary || !parsed.overallRating) {
        throw new Error("Missing required fields in response");
      }

      // Ensure arrays exist
      parsed.strengths = parsed.strengths || [];
      parsed.concerns = parsed.concerns || [];
      parsed.recommendations = parsed.recommendations || [];
      parsed.keyMetrics = parsed.keyMetrics || {};

      return parsed;
    } catch (error) {
      console.error(`Management accounts analysis attempt ${attempt}/${maxRetries} error:`, error);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw new Error("Failed to analyze management accounts after multiple attempts");
}
