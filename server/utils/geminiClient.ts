import Anthropic from "@anthropic-ai/sdk";
import { joinAiBullets, toAiBullets } from "@shared/aiBullets";
import { searchGazetteNotices } from "./gazetteClient";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;
export const DEFAULT_GEMINI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const DEFAULT_MAX_TOKENS = Number(process.env.ANTHROPIC_MAX_TOKENS || 4096);

export type GroundedSearchResult = {
  bulletPoints: string[];
  sources: Array<{ url: string; title?: string }>;
};

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
    anomalies?: { date: string; description: string; amount: number; type: string; details: string }[];
    directDebits?: { date: string; description: string; amount: number; type: string; details: string }[];
    bouncedPayments?: { date: string; description: string; amount: number; type: string; details: string }[];
    gambling?: { date: string; description: string; amount: number; type: string; details: string }[];
    personalUse?: { date: string; description: string; amount: number; type: string; details: string }[];
  };
}

function extractJson(text: string): any {
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Anthropic did not return JSON");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function resolveAnthropicModel(requestedModel?: string): string {
  // Several older callers pass Gemini/Ollama model names. Do not send those
  // invalid names to Anthropic; use the configured Anthropic model instead.
  return requestedModel?.startsWith("claude-") ? requestedModel : DEFAULT_GEMINI_MODEL;
}

type AnthropicUserContent = string | Array<Record<string, unknown>>;

async function anthropicChat(
  messages: Array<{ role: string; content: AnthropicUserContent }>,
  options: { model?: string; system?: string; maxTokens?: number } = {}
): Promise<string> {
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the server");
  }
  const response = await anthropic.messages.create({
    model: resolveAnthropicModel(options.model),
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(options.system ? { system: options.system } : {}),
    messages: messages.map((message) => ({
      role: message.role === "assistant" ? "assistant" as const : "user" as const,
      content: message.content as any,
    })),
  });
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Anthropic returned an empty response");
  return text;
}

export async function generateText(
  prompt: string,
  model = DEFAULT_GEMINI_MODEL,
  systemInstruction?: string
): Promise<string> {
  return anthropicChat([{ role: "user", content: prompt }], { model, system: systemInstruction });
}

async function generateJson<T>(prompt: string, systemInstruction?: string, maxTokens?: number): Promise<T> {
  const text = await anthropicChat([{ role: "user", content: prompt }], {
    system: systemInstruction,
    maxTokens,
  });
  return extractJson(text) as T;
}

async function generateJsonWithPdfs<T>(
  prompt: string,
  pdfs: { fileName: string; data: Buffer }[],
  maxTokens?: number
): Promise<T> {
  const content: Array<Record<string, unknown>> = pdfs.slice(0, 3).map((pdf) => ({
    type: "document",
    source: {
      type: "base64",
      media_type: "application/pdf",
      data: Buffer.from(pdf.data).toString("base64"),
    },
  }));
  content.push({ type: "text", text: prompt });
  const text = await anthropicChat([{ role: "user", content }], { maxTokens });
  return extractJson(text) as T;
}

export async function groundedSearch(query: string, _maxResults = 5): Promise<GroundedSearchResult> {
  try {
    const parsed = await generateJson<Partial<GroundedSearchResult>>(
      `Answer from existing knowledge only. Do not claim you browsed the web or verified a live source. Never invent URLs.
Return JSON only:
{"bulletPoints":["..."],"sources":[]}

Question: ${query}`
    );
    return {
      bulletPoints: Array.isArray(parsed.bulletPoints) ? parsed.bulletPoints.filter((item) => typeof item === "string") : [],
      sources: Array.isArray(parsed.sources)
        ? parsed.sources.filter((source): source is { url: string; title?: string } => !!source && typeof source.url === "string")
        : [],
    };
  } catch (error) {
    console.warn("[Anthropic] groundedSearch failed:", error);
    return { bulletPoints: [], sources: [] };
  }
}

export async function calculateRiskGrade(...args: any[]): Promise<string> {
  try {
    return await generateText(`Analyze this company / risk data and provide a risk grade (A-F): ${JSON.stringify(args.length === 1 ? args[0] : args)}`);
  } catch {
    return "D";
  }
}

export async function researchCompany(
  companyName: string,
  website?: string
): Promise<{ businessProfile: string; sourceCommentary: string; sources: Array<{ url: string; title: string }> }> {
  const fallback = {
    businessProfile: `Research unavailable for ${companyName}`,
    sourceCommentary: "Local model only — no live web search was performed.",
    sources: [] as Array<{ url: string; title: string }>,
  };
  try {
    const parsed = await generateJson<typeof fallback>(
      `From existing knowledge only, research the UK company "${companyName}"${website ? ` (website: ${website})` : ""}.
Do not invent URLs. If uncertain, say so in sourceCommentary.
businessProfile must be 4 to 6 short bullet points, one fact per line, no paragraphs.
Return JSON only:
{"businessProfile":"","sourceCommentary":"","sources":[]}`
    );
    return {
      businessProfile: joinAiBullets(toAiBullets(parsed.businessProfile || fallback.businessProfile, 6)),
      sourceCommentary: parsed.sourceCommentary || fallback.sourceCommentary,
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    };
  } catch (error) {
    console.warn("[Anthropic] researchCompany failed:", error);
    return fallback;
  }
}

export async function searchCompanyInfo(
  companyName: string,
  website?: string
): Promise<{
  businessOverview: string;
  emails: string[];
  phones: string[];
  linkedinUrls: string[];
  profileImages: string[];
  contacts: Array<{ name: string; role: string; email?: string }>;
  sources: Array<{ url: string; title: string }>;
}> {
  const empty = {
    businessOverview: "",
    emails: [] as string[],
    phones: [] as string[],
    linkedinUrls: [] as string[],
    profileImages: [] as string[],
    contacts: [] as Array<{ name: string; role: string; email?: string }>,
    sources: [] as Array<{ url: string; title: string }>,
  };
  try {
    const parsed = await generateJson<typeof empty>(
      `From existing knowledge only, research "${companyName}"${website ? ` (${website})` : ""}.
Never invent emails, phones, or URLs. Use empty arrays when unknown.
Return JSON only:
{"businessOverview":"","emails":[],"phones":[],"linkedinUrls":[],"profileImages":[],"contacts":[{"name":"","role":"","email":""}],"sources":[]}`
    );
    return {
      businessOverview: parsed.businessOverview || "",
      emails: Array.isArray(parsed.emails) ? parsed.emails : [],
      phones: Array.isArray(parsed.phones) ? parsed.phones : [],
      linkedinUrls: Array.isArray(parsed.linkedinUrls) ? parsed.linkedinUrls : [],
      profileImages: Array.isArray(parsed.profileImages) ? parsed.profileImages : [],
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    };
  } catch (error) {
    console.warn("[Anthropic] searchCompanyInfo failed:", error);
    return empty;
  }
}

export async function searchAdverseMedia(
  companyName: string,
  registrationNumber?: string
): Promise<{ riskLevel: "LOW" | "MEDIUM" | "HIGH"; flags: string[]; summary: string }> {
  const fallback = {
    riskLevel: "LOW" as const,
    flags: [] as string[],
    summary: "Local model check only — no live adverse-media search was performed.",
  };
  try {
    // The local model cannot browse. Check The Gazette separately so the
    // result is still useful when the model is available but has no live web
    // access, and never describe model-only output as verified news.
    const gazette = await searchGazetteNotices({
      service: "insolvency",
      text: registrationNumber || companyName,
      pageSize: 10,
    }).catch((error) => {
      console.warn("[Gazette] adverse-media search failed:", error);
      return { entries: [], total: 0 };
    });
    const parsed = await generateJson<{ riskLevel?: string; flags?: string[]; summary?: string }>(
      `From existing knowledge only, note possible adverse-media considerations for "${companyName}"${registrationNumber ? ` (${registrationNumber})` : ""}.
Do not claim web access. If you have no specific knowledge, return LOW with an empty flags array.
Return JSON only:
{"riskLevel":"LOW","flags":[],"summary":""}`
    );
    const gazetteFlags = gazette.entries
      .map((entry) => entry.title || entry.content || "Gazette insolvency notice")
      .filter(Boolean)
      .slice(0, 10);
    const rawRisk = gazetteFlags.length > 0 ? "HIGH" : String(parsed.riskLevel || "LOW").toUpperCase();
    const riskLevel = rawRisk === "HIGH" || rawRisk === "MEDIUM" ? (rawRisk as "HIGH" | "MEDIUM") : "LOW";
    return {
      riskLevel,
      flags: [...gazetteFlags, ...(Array.isArray(parsed.flags) ? parsed.flags : [])],
      summary: gazetteFlags.length > 0
        ? `${gazetteFlags.length} matching insolvency notice(s) found in The Gazette. ${parsed.summary || "Review the linked notices before making a decision."}`
        : parsed.summary || fallback.summary,
    };
  } catch (error) {
    console.warn("[Anthropic] searchAdverseMedia failed:", error);
    return fallback;
  }
}

export function repairJson(jsonString: string): string {
  try {
    JSON.parse(jsonString);
    return jsonString;
  } catch {
    const cleaned = jsonString.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const slice = cleaned.slice(start, end + 1);
      try {
        JSON.parse(slice);
        return slice;
      } catch {
        return slice;
      }
    }
    return jsonString;
  }
}

function emptyFinancialAnalysis(summary = "Financial analysis unavailable"): FinancialAnalysisResult {
  return {
    averageMonthlyRevenue: 0,
    averageMonthlyExpenses: 0,
    netDisposableIncome: 0,
    dscr: 0,
    riskScore: "E",
    summary,
    monthlyBreakdown: [],
    transactionCount: 0,
    profitAndLoss: {
      turnover: 0,
      costOfSales: 0,
      grossProfit: 0,
      expenses: {},
      totalExpenses: 0,
      netProfit: 0,
      periodMonths: 0,
    },
    excludedTransferValue: 0,
    excludedTransferCount: 0,
    redFlags: [],
    preliminaryFindings: {
      loans: [],
      transfers: [],
      anomalies: [],
      directDebits: [],
      bouncedPayments: [],
      gambling: [],
      personalUse: [],
    },
  };
}

function coerceFinancialAnalysis(parsed: any, monthlyRepayment?: number): FinancialAnalysisResult {
  const base = emptyFinancialAnalysis();
  const dscr = Number(parsed?.dscr);
  const netDisposableIncome = Number(parsed?.netDisposableIncome);
  const repayment = Number(monthlyRepayment);
  const resolvedDscr = Number.isFinite(dscr)
    ? dscr
    : Number.isFinite(netDisposableIncome) && repayment > 0
      ? netDisposableIncome / repayment
      : 0;

  return {
    ...base,
    ...parsed,
    averageMonthlyRevenue: Number(parsed?.averageMonthlyRevenue) || 0,
    averageMonthlyExpenses: Number(parsed?.averageMonthlyExpenses) || 0,
    netDisposableIncome: Number.isFinite(netDisposableIncome) ? netDisposableIncome : 0,
    dscr: Number.isFinite(resolvedDscr) ? resolvedDscr : 0,
    riskScore: typeof parsed?.riskScore === "string" ? parsed.riskScore : base.riskScore,
    summary: joinAiBullets(toAiBullets(typeof parsed?.summary === "string" ? parsed.summary : base.summary, 8)),
    monthlyBreakdown: Array.isArray(parsed?.monthlyBreakdown) ? parsed.monthlyBreakdown : [],
    transactionCount: Number(parsed?.transactionCount) || 0,
    profitAndLoss: { ...base.profitAndLoss, ...(parsed?.profitAndLoss || {}) },
    excludedTransferValue: Number(parsed?.excludedTransferValue) || 0,
    excludedTransferCount: Number(parsed?.excludedTransferCount) || 0,
    redFlags: Array.isArray(parsed?.redFlags) ? parsed.redFlags : [],
    preliminaryFindings: {
      loans: Array.isArray(parsed?.preliminaryFindings?.loans) ? parsed.preliminaryFindings.loans : [],
      transfers: Array.isArray(parsed?.preliminaryFindings?.transfers) ? parsed.preliminaryFindings.transfers : [],
      anomalies: Array.isArray(parsed?.preliminaryFindings?.anomalies) ? parsed.preliminaryFindings.anomalies : [],
      directDebits: Array.isArray(parsed?.preliminaryFindings?.directDebits) ? parsed.preliminaryFindings.directDebits : [],
      bouncedPayments: Array.isArray(parsed?.preliminaryFindings?.bouncedPayments) ? parsed.preliminaryFindings.bouncedPayments : [],
      gambling: Array.isArray(parsed?.preliminaryFindings?.gambling) ? parsed.preliminaryFindings.gambling : [],
      personalUse: Array.isArray(parsed?.preliminaryFindings?.personalUse) ? parsed.preliminaryFindings.personalUse : [],
    },
  };
}

const FINANCIAL_JSON_SHAPE = `{
  "averageMonthlyRevenue": 0,
  "averageMonthlyExpenses": 0,
  "netDisposableIncome": 0,
  "dscr": 0,
  "riskScore": "A-E",
  "summary": "",
  "monthlyBreakdown": [{"month":"","income":0,"expenses":0,"net":0,"closingBalance":0}],
  "transactionCount": 0,
  "profitAndLoss": {"turnover":0,"costOfSales":0,"grossProfit":0,"expenses":{},"totalExpenses":0,"netProfit":0,"periodMonths":0},
  "excludedTransferValue": 0,
  "excludedTransferCount": 0,
  "redFlags": [{"label":"","isActive":false}],
  "preliminaryFindings": {
    "loans":[{"date":"","description":"","amount":0,"details":""}],
    "transfers":[{"date":"","description":"","amount":0,"details":""}],
    "anomalies":[{"date":"","description":"","amount":0,"details":""}],
    "directDebits":[{"date":"","description":"","amount":0,"details":""}],
    "bouncedPayments":[{"date":"","description":"","amount":0,"details":""}],
    "gambling":[{"date":"","description":"","amount":0,"details":""}],
    "personalUse":[{"date":"","description":"","amount":0,"details":""}]
  }
}`;

export async function analyzeFinancials(
  data: any,
  loanAmount?: number,
  monthlyRepayment?: number
): Promise<FinancialAnalysisResult> {
  try {
    const parsed = await generateJson<any>(
      `Analyze these financial statements for a commercial loan.
Requested amount: £${Number(loanAmount || 0).toLocaleString()}
Monthly repayment: £${Number(monthlyRepayment || 0).toLocaleString()}
Always return numeric dscr (net disposable monthly income / monthly repayment). If unknown, use 0.
Identify only from the data — do not invent: regular direct debits, bounced/returned items, suspected loan or MCA repayments, gambling/betting spend, and personal use of the business account.
summary must be 4 to 8 short bullet points, one fact per line, no paragraphs.

DATA:
${typeof data === "string" ? data.slice(0, 20000) : JSON.stringify(data).slice(0, 20000)}

Return JSON only:
${FINANCIAL_JSON_SHAPE}`,
      undefined,
      8192
    );
    return coerceFinancialAnalysis(parsed, monthlyRepayment);
  } catch (error) {
    console.warn("[Anthropic] analyzeFinancials failed:", error);
    return emptyFinancialAnalysis();
  }
}

export async function analyzeFinancialsFromPdf(
  pdfTexts: { fileName: string; text: string; pages?: number }[] | any,
  loanAmount?: number,
  monthlyRepayment?: number,
  accountsAnalysis?: any
): Promise<FinancialAnalysisResult> {
  const combinedText = Array.isArray(pdfTexts)
    ? pdfTexts.map((item, index) => `\n=== BANK STATEMENT FILE ${index + 1}: ${item.fileName} ===\n${item.text || ""}`).join("\n\n")
    : typeof pdfTexts === "string"
      ? pdfTexts
      : JSON.stringify(pdfTexts);

  let accountsContext = "";
  if (accountsAnalysis?.dscr?.average || accountsAnalysis?.years?.length > 0) {
    const avgDscr = accountsAnalysis.dscr?.average || 0;
    const latestYear = accountsAnalysis.years?.[0];
    accountsContext = `
AUDITED ACCOUNTS REFERENCE:
- Official DSCR: ${Number(avgDscr).toFixed(2)}x
${latestYear ? `- Latest year turnover: £${Number(latestYear.turnover || 0).toLocaleString()}
- Latest year net profit: £${Number(latestYear.netProfit || 0).toLocaleString()}` : ""}
Compare bank-statement findings against these figures in the summary.
`;
  }

  try {
    const parsed = await generateJson<any>(
      `You are a commercial-lending analyst. Extract cash-flow metrics from these bank-statement texts.
Always return numeric dscr (monthly net disposable income / monthly repayment). If unknown, use 0.
Identify only from the statements — do not invent: regular direct debits, bounced/returned items, suspected loan or MCA repayments, gambling/betting spend, and personal use of the business account.
summary must be 4 to 8 short bullet points, one fact per line, no paragraphs.
${accountsContext}
LOAN DETAILS:
- Requested amount: £${Number(loanAmount || 0).toLocaleString()}
- Monthly repayment: £${Number(monthlyRepayment || 0).toLocaleString()}

BANK STATEMENT TEXT:
${String(combinedText).slice(0, 24000)}

Return JSON only:
${FINANCIAL_JSON_SHAPE}`,
      undefined,
      8192
    );
    return coerceFinancialAnalysis(parsed, monthlyRepayment);
  } catch (error) {
    console.warn("[Anthropic] analyzeFinancialsFromPdf failed:", error);
    return emptyFinancialAnalysis();
  }
}

const AUDITED_ACCOUNTS_JSON_SHAPE = `{
  "years":[{"yearEnding":"YYYY-MM-DD","turnover":0,"grossProfit":0,"netProfit":0,"totalAssets":0,"totalLiabilities":0,"netAssets":0,"shareholderFunds":0,"cashAndEquivalents":0,"debtors":0,"creditors":0,"bankLoans":0}],
  "ratios":[{"year":"YYYY","ratios":{"grossProfitMargin":0,"netProfitMargin":0,"currentRatio":0,"quickRatio":0,"debtToEquity":0,"interestCover":0,"debtorDays":0,"creditorDays":0,"returnOnCapitalEmployed":0}}],
  "trends":{"turnoverGrowth":[],"profitGrowth":[],"netAssetGrowth":[],"trend":"stable","summary":""},
  "dscr":{"historical":[],"average":0,"trend":"stable"},
  "concerns":[{"category":"other","description":"","severity":"low","yearEnding":""}],
  "notesToAccounts":[{"note":"","accountsEvidence":"","assessment":"clarification_required","severity":"medium","action":""}],
  "auditorOpinion":"",
  "summary":"",
  "riskAssessment":"medium"
}`;

export async function analyzeAuditedAccounts(
  pdfTexts: { year: string; text: string; data?: Buffer }[],
  loanAmount?: number,
  monthlyRepayment?: number,
  caseNotes?: string,
  extras?: { creditsafeJson?: string; spreadsheetText?: string }
): Promise<any> {
  const combinedText = (Array.isArray(pdfTexts) ? pdfTexts : [])
    .map((item) => `\n=== ACCOUNTS FOR YEAR ENDING ${item.year} ===\n${item.text || ""}`)
    .join("\n\n");
  const pdfsWithData = (Array.isArray(pdfTexts) ? pdfTexts : []).filter((item) => item.data && item.data.length > 100);
  const prompt = `You are a financial analyst specialising in UK commercial lending. Analyse these audited / statutory accounts (up to 3 years) and return a credit assessment.

CRITICAL:
- Do not invent turnover or profit. If no P&L is in the uploaded PDFs, sheets, or Creditsafe, leave those fields null.
- Prefer the structured Creditsafe figures below for the balance sheet.
- Use uploaded Profit & Loss PDFs (and xlsx/csv) for turnover, gross profit, and operating profit when Creditsafe has no P&L line. Quote only numbers present in those files.
- Use statutory-accounts PDFs for Notes to the accounts, accounting policies, average employees, related-party / director loan notes, going-concern wording, and auditor opinion.
- Extract every note that should be raised with the adviser.
- For notesToAccounts, use assessment values: "confirmed", "inconsistent", "not_found", or "clarification_required". Do not treat a note as a fact merely because it is written in the notes.

STRUCTURED BALANCE SHEET (Creditsafe — use these numbers):
${String(extras?.creditsafeJson || "None").slice(0, 8000)}

SPREADSHEETS ON THE CASE FILE:
${String(extras?.spreadsheetText || "None").slice(0, 24000)}

AUDITED ACCOUNTS TEXT:
${combinedText.slice(0, 24000)}

LOAN DETAILS:
- Requested amount: £${Number(loanAmount || 0).toLocaleString("en-GB")}
- Monthly repayment: £${Number(monthlyRepayment || 0).toLocaleString("en-GB")}

CASE NOTES / UNDERWRITER FINDINGS:
${String(caseNotes || "No case notes recorded.").slice(0, 12000)}

Return JSON only:
${AUDITED_ACCOUNTS_JSON_SHAPE}`;

  try {
    const parsed = pdfsWithData.length
      ? await generateJsonWithPdfs<any>(prompt, pdfsWithData, 8192)
      : await generateJson<any>(prompt, undefined, 8192);

    return {
      years: Array.isArray(parsed?.years) ? parsed.years : [],
      ratios: Array.isArray(parsed?.ratios) ? parsed.ratios : [],
      trends: parsed?.trends || {
        turnoverGrowth: [],
        profitGrowth: [],
        netAssetGrowth: [],
        trend: "stable",
        summary: "",
      },
      dscr: parsed?.dscr && typeof parsed.dscr === "object"
        ? parsed.dscr
        : { historical: [], average: Number(parsed?.dscr) || 0, trend: "stable" },
      concerns: Array.isArray(parsed?.concerns) ? parsed.concerns : [],
      notesToAccounts: Array.isArray(parsed?.notesToAccounts) ? parsed.notesToAccounts : [],
      auditorOpinion: parsed?.auditorOpinion || "",
      summary: joinAiBullets(toAiBullets(parsed?.summary || "", 8)),
      riskAssessment: parsed?.riskAssessment === "low" || parsed?.riskAssessment === "high"
        ? parsed.riskAssessment
        : "medium",
    };
  } catch (error) {
    console.warn("[Anthropic] analyzeAuditedAccounts failed:", error);
    return {
      years: [],
      ratios: [],
      trends: { turnoverGrowth: [], profitGrowth: [], netAssetGrowth: [], trend: "stable", summary: "" },
      dscr: { historical: [], average: 0, trend: "stable" },
      concerns: [],
      auditorOpinion: "",
      summary: "Accounts analysis unavailable",
      riskAssessment: "medium",
    };
  }
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
  const fallback: ManagementAccountsAnalysis = {
    summary: "Management accounts analysis unavailable",
    keyMetrics: {},
    commentary: "",
    strengths: [],
    concerns: [],
    recommendations: [],
    profitabilityAssessment: "",
    liquidityAssessment: "",
    overallRating: "weak",
  };
  try {
    const parsed = await generateJson<ManagementAccountsAnalysis>(
      `Analyze these management accounts for lending.
COMPANY: ${companyName}
PERIOD: ${periodMonths} months
CONTENT:
${String(parsedText).slice(0, 20000)}

summary, commentary, profitabilityAssessment and liquidityAssessment must be short bullet points, one fact per line, no paragraphs.
Return JSON only:
{"summary":"","keyMetrics":{},"commentary":"","strengths":[],"concerns":[],"recommendations":[],"profitabilityAssessment":"","liquidityAssessment":"","overallRating":"satisfactory"}`,
      undefined,
      8192
    );
    return {
      ...fallback,
      ...parsed,
      keyMetrics: parsed.keyMetrics || {},
      strengths: parsed.strengths || [],
      concerns: parsed.concerns || [],
      recommendations: parsed.recommendations || [],
      summary: joinAiBullets(toAiBullets(parsed.summary || "", 6)),
      commentary: joinAiBullets(toAiBullets(parsed.commentary || "", 6)),
      profitabilityAssessment: joinAiBullets(toAiBullets(parsed.profitabilityAssessment || "", 4)),
      liquidityAssessment: joinAiBullets(toAiBullets(parsed.liquidityAssessment || "", 4)),
      overallRating: ["strong", "satisfactory", "weak", "critical"].includes(parsed.overallRating)
        ? parsed.overallRating
        : "weak",
    };
  } catch (error) {
    console.warn("[Anthropic] analyzeManagementAccounts failed:", error);
    return fallback;
  }
}

export async function generateSwotAnalysis(
  companyName: string,
  sector?: string,
  loanAmount?: number,
  loanPurpose?: string,
  financialSummary?: string,
  companiesHouseData?: string,
  bankAnalysisSummary?: string,
  eligibilityNotes?: string,
  fileFacts?: string
): Promise<{
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  summary: string;
}> {
  try {
    const parsed = await generateJson<{
      strengths?: string[];
      weaknesses?: string[];
      opportunities?: string[];
      threats?: string[];
      summary?: string;
    }>(`Generate a SWOT analysis for commercial lending.
Use FILE FACTS. Do not claim company, directors, address, loan amount or purpose were not supplied if they appear there. Do not invent figures.
The loan amount in FILE FACTS is already in pounds sterling. Never multiply it by 100. Do not mention a different facility amount than the one in FILE FACTS.
Do not write pound amounts, DSCR ratios, risk grades, or facility term in months or years. Those are injected from the file ledger. Do not write "note on scope", "the document provided", "cannot currently be assessed", or any commentary about missing documents. Maximum 5 bullets, 20 words each for SWOT.
${fileFacts || ""}
Company: ${companyName}
Sector: ${sector || "unknown"}
Purpose: ${loanPurpose || "unspecified"}
Financial summary: ${financialSummary || "n/a"}
Companies House: ${companiesHouseData || "n/a"}
Bank analysis: ${bankAnalysisSummary || "n/a"}
Eligibility notes: ${eligibilityNotes || "n/a"}

Each SWOT item is one short bullet (max 20 words). No paragraphs. summary is 3 short bullets joined by newlines, not a paragraph.
Return JSON only:
{"strengths":[],"weaknesses":[],"opportunities":[],"threats":[],"summary":""}`);
    const result = {
      strengths: toAiBullets((Array.isArray(parsed.strengths) ? parsed.strengths : []).join("\n"), 5),
      weaknesses: toAiBullets((Array.isArray(parsed.weaknesses) ? parsed.weaknesses : []).join("\n"), 5),
      opportunities: toAiBullets((Array.isArray(parsed.opportunities) ? parsed.opportunities : []).join("\n"), 5),
      threats: toAiBullets((Array.isArray(parsed.threats) ? parsed.threats : []).join("\n"), 5),
      summary: joinAiBullets(toAiBullets(typeof parsed.summary === "string" ? parsed.summary : "", 3)),
    };
    if (
      !result.strengths.length &&
      !result.weaknesses.length &&
      !result.opportunities.length &&
      !result.threats.length
    ) {
      throw new Error("SWOT analysis returned no content");
    }
    return result;
  } catch (error) {
    console.warn("[Anthropic] generateSwotAnalysis failed:", error);
    throw error instanceof Error ? error : new Error("SWOT analysis failed");
  }
}

export async function extractCashflowForecastJson(flatText: string): Promise<unknown> {
  return generateJson(
    `Extract monthly-average figures from this cashflow forecast dump.
Return JSON only:
{"creditsAvg":null,"opexAvg":null,"debtServiceAvg":null,"netAvg":null,"months":[]}
Use JSON numbers. Use null when a figure is not clearly present. Never use 0 as a stand-in for unknown. No prose, no pound signs inside strings, no loan-amount commentary.

DUMP:
${String(flatText || "").slice(0, 20000)}`,
  );
}

export async function critiqueCashflowForecastJson(input: {
  without: { creditsAvg: number | null; opexAvg: number | null; debtServiceAvg: number | null; netAvg: number | null; dscr: number | null };
  with: { creditsAvg: number | null; opexAvg: number | null; debtServiceAvg: number | null; netAvg: number | null; dscr: number | null };
  findings: string[];
  flattenedText: string;
}): Promise<string[]> {
  const facts = JSON.stringify({ without: input.without, with: input.with, findings: input.findings });
  const parsed = await generateJson<{ bullets?: string[] }>(
    `You are a sceptical commercial-finance underwriter. The customer's cashflow forecast is a claim. The bank-statement run-rate is evidence.
Write up to 8 short bullets that critique the forecast. Call out excessive optimism. Temper the sheet with statement reality.
Use only numbers in FILE FACTS. Do not invent figures, grades, or a loan amount.
Each bullet max 30 words. No paragraphs. No "note on scope". No "the document provided".
Return JSON only: {"bullets":["..."]}

FILE FACTS:
${facts}

FORECAST DUMP (excerpt):
${String(input.flattenedText || "").slice(0, 8000)}`,
  );
  return Array.isArray(parsed?.bullets) ? parsed.bullets.map((line) => String(line)) : [];
}

const SECTION_GUIDANCE: Record<string, string> = {
  overview:
    "Credit memo Overview: short bullets on what the business does and the lending proposition. Qualitative facts a credit officer needs before CAMPARI. No amounts, grades, or facility terms.",
  background:
    "Background: up to 10 short bullets on history, ownership, trading sites, and recent events (refinance, distress, expansion) that explain this application. No amounts or grades.",
  bank:
    "Bank Statement Summary: short bullets on inflows, outgoings, missed payments, returned items, MCA sweeps, HMRC time-to-pay. No pound figures or ratios.",
  recommendation:
    "Adviser Recommendation: short bullets on whether the file should proceed, conditions, and residual risk the credit officer must accept. No amounts, grades, or terms.",
  character:
    "CAMPARI Character: short bullets on owners/directors, track record, CCJs/defaults/late filings, bank conduct, credit reports, statutory obligations.",
  ability:
    "CAMPARI Ability: short bullets on management skills, industry experience, delivery history, contracts/pipeline, operational gaps.",
  means:
    "CAMPARI Means: short bullets on financial position, profitability trend, working capital, gearing, related-party balances, over-leverage. No pound amounts or ratios.",
  purpose:
    "CAMPARI Purpose: short bullets on exact use of funds, policy fit, evidence (invoices/quotes/statements), refinance detail, private-benefit check. No pound amounts.",
  amount:
    "CAMPARI Amount: short bullets on how the ask was evidenced, contribution, and proportionality to turnover. Do not state the facility figure, term, or rate.",
  repayment:
    "CAMPARI Repayment: short bullets on historic cashflow quality, free cash after obligations, tax conduct, and downside resilience. Do not state ratios or monthly figures.",
  insurance:
    "CAMPARI Insurance: short bullets on policies in force, security (debenture/PG/charge), licences and regulatory requirements.",
};

export async function generateCampariSection(
  sectionKey: string,
  companyName?: string,
  sector?: string,
  loanAmount?: number,
  loanPurpose?: string,
  financialSummary?: string,
  companiesHouseData?: string,
  bankAnalysisSummary?: string,
  accountsAnalysisSummary?: string,
  documentSummaries?: Array<{ fileName: string; category?: string; content: string }>,
  fileFacts?: string
): Promise<string> {
  const docs = (documentSummaries || [])
    .map((doc) => `--- ${doc.category || "Document"}: ${doc.fileName} ---\n${doc.content}`)
    .join("\n\n");
  const brief = SECTION_GUIDANCE[sectionKey] || `Write the credit-assessment section "${sectionKey}".`;
  const campariKeys = new Set([
    "character",
    "ability",
    "means",
    "purpose",
    "amount",
    "repayment",
    "insurance",
  ]);
  const isBackground = sectionKey === "background";
  const slotConstraint =
    `Do not write pound amounts, DSCR ratios, risk grades, or facility term in months or years. Those are injected from the file ledger. Do not write "note on scope", "the document provided", "cannot currently be assessed", or any commentary about missing documents. Maximum 6 bullets, 20 words each for CAMPARI; 10 bullets, 25 words for Background; 5 bullets, 20 words for SWOT.`;
  const shape = campariKeys.has(sectionKey)
    ? `Write only this CAMPARI pillar as up to 6 short bullet points, 20 words each. One fact per bullet. Do not write the other CAMPARI pillars. No lengthy paragraphs, no essay, no numbered report. A short bold heading is allowed only to group related bullets. Do not repeat the pillar title or company name as a heading. ${slotConstraint}`
    : `Write this section for a UK commercial-lending file as short bullet points only (maximum ${isBackground ? 10 : 6} bullets, ${isBackground ? 25 : 20} words each).
Write the section itself. Do not wrap it in a full credit-memo template unless the section is overview. ${slotConstraint}`;
  const text = await generateText(`${brief}
${shape}
Use FILE FACTS as the source of truth. If a company number, address, director, loan amount or purpose appears there, you must use it — do not say it was not supplied.
If SWOT or other narrative on file contradicts FILE FACTS on loan amount or purpose, use FILE FACTS. Do not mention the contradiction or write a file-inconsistency note.
Do not invent figures. If a fact is not in FILE FACTS or documents, omit that bullet — do not write working notes about missing documents.
Do not reply with a one-line "unavailable" stub.

${fileFacts || ""}

Additional notes from the request:
Company: ${companyName || "unknown"}
Sector: ${sector || "unknown"}
Purpose: ${loanPurpose || "unspecified"}
Financial summary: ${financialSummary || "n/a"}
Companies House: ${companiesHouseData || "n/a"}
Bank analysis: ${bankAnalysisSummary || "n/a"}
Accounts analysis: ${accountsAnalysisSummary || "n/a"}
Documents:
${docs.slice(0, 12000)}`);
  return joinAiBullets(toAiBullets(text, sectionKey === "background" ? 10 : 6));
}

export const ai = {
  models: {
    generateContent: async (params: any) => ({
      text: await generateText(params.contents?.[0]?.parts?.[0]?.text || "", params.model),
    }),
  },
};
