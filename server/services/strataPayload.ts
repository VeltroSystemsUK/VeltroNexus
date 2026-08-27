/**
 * Maps a completed Nexus file onto the standalone Strata case payload.
 * Only copies values that already exist on the Nexus record — never invents figures.
 */
import type { Contact, DueDiligenceData, ProspectDocument, ProspectWithCompany } from "@shared/schema";

export type StrataPayloadInput = {
  prospect: ProspectWithCompany;
  contacts: Contact[];
  diligence?: DueDiligenceData | null;
  documents?: ProspectDocument[];
  exceptions?: Array<{ message?: string; source?: string; status?: string }>;
  notes?: string;
  submissionId?: number;
};

const PRODUCT_PURPOSE: Record<string, string> = {
  BUSINESS_LOAN: "Working Capital",
  SECURED_LOAN: "Working Capital",
  ASSET_FINANCE: "Capital Items",
  EQUIPMENT_LEASING: "Capital Items",
  INVOICE_FINANCE: "Working Capital",
  BRIDGING_LOAN: "Property",
  COMMERCIAL_MORTGAGE: "Property",
  BUY_TO_LET: "Property",
};

const DOC_FLAGS: Array<{ test: RegExp; field: string }> = [
  { test: /bank.?statement|open.?banking|accountscore/i, field: "bank_statements" },
  { test: /statutory|audited|filed.?account|accounts?_3|accounts.?pdf/i, field: "statutory_accounts" },
  { test: /management.?account/i, field: "management_accounts" },
  { test: /business.?plan|proposal/i, field: "business_plan" },
  { test: /forecast|projection/i, field: "forecasts" },
  { test: /cash.?flow|cfads/i, field: "cash_flow" },
  { test: /passport|identity|id.?doc|driving.?licen/i, field: "id" },
  { test: /proof.?of.?address|utility|council.?tax/i, field: "proof_of_address" },
  { test: /credit.?report/i, field: "credit_reports" },
  { test: /decline/i, field: "decline_letter" },
  { test: /\bcv\b|curriculum/i, field: "cvs" },
];

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function text(...parts: unknown[]): string {
  return parts
    .flatMap((part) => {
      if (part == null) return [];
      if (typeof part === "string") return part.trim() ? [part.trim()] : [];
      if (typeof part === "number" && Number.isFinite(part)) return [String(part)];
      return [];
    })
    .join("\n\n");
}

function money(value: unknown): string {
  if (value == null || value === "") return "";
  const n = typeof value === "number" ? value : Number(String(value).replace(/[,£\s]/g, ""));
  if (!Number.isFinite(n) || n === 0) return n === 0 ? "0" : "";
  return String(Math.round(n * 100) / 100);
}

function yesNo(value: unknown): string {
  if (value === true || value === 1 || value === "1" || value === "yes" || value === "true") return "yes";
  if (value === false || value === 0 || value === "0" || value === "no" || value === "false") return "no";
  return "";
}

function splitName(name?: string | null): { forename: string; surname: string } {
  const bits = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!bits.length) return { forename: "", surname: "" };
  if (bits.length === 1) return { forename: bits[0], surname: "" };
  return { forename: bits.slice(0, -1).join(" "), surname: bits[bits.length - 1] };
}

function legalEntity(companyType?: string | null): string {
  const raw = String(companyType || "").toLowerCase();
  if (raw.includes("llp")) return "llp";
  if (raw.includes("sole") || raw.includes("trader")) return "sole_trader";
  if (raw.includes("partner") && !raw.includes("limited")) return "partnership";
  if (raw) return "limited_company";
  return "limited_company";
}

function looksRefinance(parts: string[]): boolean {
  return parts.some((part) => /\brefinanc/i.test(part));
}

function loanPounds(prospect: ProspectWithCompany, req: Record<string, any>, underwriting: Record<string, any>, diligence: Record<string, any>): string {
  const details = asRecord(req.product_details);
  const useOfFunds = asRecord(req.use_of_funds);
  const loanDetails = asRecord(underwriting.loanDetails);
  const calc = asRecord(diligence.loanCalculator);
  const candidates = [
    details.loan_amount,
    details.finance_amount,
    details.net_loan_amount,
    details.mortgage_amount,
    details.required_facility_limit,
    useOfFunds.total_request_amount,
    loanDetails.amount,
    calc.loanAmount,
    prospect.loanAmount != null ? Number(prospect.loanAmount) / 100 : null,
  ];
  for (const value of candidates) {
    const out = money(value);
    if (out && out !== "0") return out;
  }
  return money(candidates.find((value) => value != null && value !== "") ?? "");
}

function termMonths(prospect: ProspectWithCompany, req: Record<string, any>, underwriting: Record<string, any>, diligence: Record<string, any>): string {
  const details = asRecord(req.product_details);
  const loanDetails = asRecord(underwriting.loanDetails);
  const calc = asRecord(diligence.loanCalculator);
  if (details.term_months) return String(details.term_months);
  if (details.term_years) return String(Number(details.term_years) * 12);
  if (loanDetails.termMonths) return String(loanDetails.termMonths);
  if (calc.term) return String(calc.term);
  if (prospect.term) return String(prospect.term);
  return "";
}

function purposeOfLoan(req: Record<string, any>, adviser: Record<string, any>, notes: string[]): string {
  const stated = String(adviser.purpose || "").trim();
  if (/refinanc/i.test(stated)) return "Refinance";
  if (/working.?capital|cashflow|cash flow/i.test(stated)) return "Working Capital";
  if (/equipment|capex|capital item|plant/i.test(stated)) return "Capital Items";
  if (/expand|growth|acquisition/i.test(stated)) return "Business expansion";
  if (/property|mortgage|bridging/i.test(stated)) return "Property";
  if (stated) return "Other";
  if (looksRefinance(notes)) return "Refinance";
  if (notes.some((part) => /working.?capital|cashflow|cash flow/i.test(part))) return "Working Capital";
  if (notes.some((part) => /equipment|capex|capital item|plant/i.test(part))) return "Capital Items";
  if (notes.some((part) => /expand|growth|acquisition/i.test(part))) return "Business expansion";
  if (notes.some((part) => /property|mortgage|bridging/i.test(part))) return "Property";
  return PRODUCT_PURPOSE[String(req.product_type || "")] || "";
}

function useOfFundsBreakdown(req: Record<string, any>, notes: string): string {
  const rows = Array.isArray(req.use_of_funds?.breakdown) ? req.use_of_funds.breakdown : [];
  const lines = rows
    .map((row: any) => {
      const label = String(row?.description || "").trim();
      const amount = money(row?.amount);
      if (!label && !amount) return "";
      return amount ? `${label || "Use of funds"}: £${amount}` : label;
    })
    .filter(Boolean);
  return text(...lines, notes);
}

function peopleFromContacts(contacts: Contact[]): Record<string, string>[] {
  return contacts
    .filter((row) => String(row.name || "").trim())
    .map((row) => {
      const { forename, surname } = splitName(row.name);
      return {
        forename,
        surname,
        position: row.role || "",
        email: row.email || "",
        mobile: row.phone || "",
      };
    });
}

function documentFlags(documents: ProspectDocument[], underwriting: Record<string, any>): Record<string, string> {
  const flags: Record<string, string> = {};
  const haystacks = documents.map((doc) => `${doc.category || ""} ${doc.fileName || ""}`);
  if (Array.isArray(underwriting.accountsPdfs) && underwriting.accountsPdfs.length) haystacks.push("statutory accounts");
  if (Array.isArray(underwriting.bankPdfFiles) && underwriting.bankPdfFiles.length) haystacks.push("bank statements");
  if (asRecord(underwriting.openBanking).status === "connected") haystacks.push("open banking accountscore");
  for (const item of haystacks) {
    for (const { test, field } of DOC_FLAGS) {
      if (test.test(item)) flags[field] = "yes";
    }
  }
  return flags;
}

function historicFromAccounts(accounts: Record<string, any>): Record<string, any> | null {
  const years = Array.isArray(accounts.years) ? accounts.years : [];
  if (!years.length) return null;
  const columns = years.map((year: any, index: number) =>
    String(year.year || year.period || year.label || `Year ${index + 1}`)
  );
  const pick = (key: string) => years.map((year: any) => money(year[key] ?? year[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)]));
  const lines = [
    { label: "Turnover", values: pick("turnover") },
    { label: "Gross profit", values: pick("grossProfit") },
    { label: "Net profit", values: pick("netProfit") },
    { label: "EBITDA", values: pick("ebitda") },
  ].filter((line) => line.values.some((value) => value && value !== "0"));
  if (!lines.length) return null;
  return { basis: "Nexus audited-accounts analysis", title: "Historic P&L (from Nexus)", columns, lines };
}

function compactSource(input: StrataPayloadInput) {
  const { prospect, diligence, documents, exceptions } = input;
  const company = prospect.company || ({} as ProspectWithCompany["company"]);
  return {
    prospect_id: prospect.id,
    company_number: company.companyNumber || "",
    stage: prospect.stage,
    documents: (documents || []).map((doc) => ({
      fileName: doc.fileName,
      category: doc.category,
      status: doc.status,
    })),
    exceptions: (exceptions || [])
      .filter((row) => row.status !== "resolved")
      .map((row) => [row.source, row.message].filter(Boolean).join(": ")),
    diligence_keys: Object.keys(asRecord(diligence)),
    underwriting_keys: Object.keys(asRecord(asRecord(diligence).underwriting)),
  };
}

export function omitEmpty<T>(value: T): T {
  if (Array.isArray(value)) {
    const next = value
      .map((item) => omitEmpty(item))
      .filter((item) => {
        if (item == null) return false;
        if (typeof item === "string") return item.trim().length > 0;
        if (Array.isArray(item)) return item.length > 0;
        if (typeof item === "object") return Object.keys(item as object).length > 0;
        return true;
      });
    return next as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child == null) continue;
      if (typeof child === "string" && !child.trim()) continue;
      const cleaned = omitEmpty(child);
      if (cleaned == null) continue;
      if (typeof cleaned === "string" && !cleaned.trim()) continue;
      if (Array.isArray(cleaned) && cleaned.length === 0) continue;
      if (typeof cleaned === "object" && !Array.isArray(cleaned) && Object.keys(cleaned).length === 0) continue;
      out[key] = cleaned;
    }
    return out as T;
  }
  return value;
}

export function buildStrataPayload(input: StrataPayloadInput): Record<string, unknown> {
  const { prospect, contacts, notes, submissionId } = input;
  const diligence = asRecord(input.diligence);
  const company = prospect.company || ({} as ProspectWithCompany["company"]);
  const req = asRecord(prospect.loanRequirementData);
  const research = asRecord(prospect.researchData);
  const campari = asRecord(research.campari_module);
  const underwriting = asRecord(diligence.underwriting);
  const adviser = asRecord(underwriting.adviserSummary);
  const eligibility = asRecord(underwriting.eligibility);
  const answers = asRecord(eligibility.answers);
  const financial = asRecord(underwriting.financialAnalysis);
  const accounts = asRecord(underwriting.accountsAnalysis);
  const swot = asRecord(underwriting.swotAnalysis);
  const adverseMedia = asRecord(underwriting.adverseMedia);
  const openBanking = asRecord(underwriting.openBanking);
  const character = asRecord(diligence.character);
  const affordability = asRecord(diligence.affordability);
  const ratios = asRecord(diligence.financialRatios);
  const hirePurchase = asRecord(diligence.hirePurchase);
  const primary = contacts.find((row) => row.isPrimary) || contacts[0];
  const secondary = contacts.find((row) => row !== primary);
  const postcode = company.postcode || "";
  const registered = [company.registeredAddress, postcode].filter(Boolean).join(", ");
  const sections = asRecord(adviser.sections);
  const purposeNotes = [
    prospect.loanRequirementNotes,
    req.notes,
    adviser.purpose,
    notes,
  ].filter(Boolean).map(String);
  const amount = loanPounds(prospect, req, underwriting, diligence);
  const term = termMonths(prospect, req, underwriting, diligence);
  const purpose = purposeOfLoan(req, adviser, purposeNotes);
  const refinance = purpose === "Refinance" ? "yes" : looksRefinance(purposeNotes) ? "yes" : "";
  const people = peopleFromContacts(contacts);
  const historic = historicFromAccounts(accounts);
  const docs = documentFlags(input.documents || [], underwriting);
  const related = text(
    prospect.notes,
    prospect.background,
    notes,
    ...(input.exceptions || [])
      .filter((row) => row.status !== "resolved" && row.message)
      .map((row) => `Exception (${row.source || "nexus"}): ${row.message}`),
    Array.isArray(prospect.savedAssociations) && prospect.savedAssociations.length
      ? `Associated companies: ${prospect.savedAssociations
          .map((row: any) => row.companyName || row.name || row.company_name)
          .filter(Boolean)
          .join("; ")}`
      : ""
  );

  const securityBits = [
    prospect.directorsGuarantee || req.security_offered?.directors_guarantee ? "Directors' guarantee" : "",
    prospect.debenture || req.security_offered?.debenture ? "Debenture" : "",
    prospect.commercialProperty || req.security_offered?.commercial_property ? "Commercial property" : "",
    prospect.homeEquity || req.security_offered?.home_equity ? "Home equity" : "",
    prospect.parentCompanyGuarantee || req.security_offered?.parent_company_guarantee ? "Parent company guarantee" : "",
    prospect.crossCompanyGuarantee || req.security_offered?.cross_company_guarantee ? "Cross-company guarantee" : "",
    prospect.collateral || req.security_offered?.collateral ? "Other collateral" : "",
  ].filter(Boolean);

  const cover = text(
    prospect.adviserRecommendation,
    prospect.adviserRecommendationSignedBy
      ? `Signed by ${prospect.adviserRecommendationSignedBy}${
          prospect.adviserRecommendationSignedAt ? ` on ${prospect.adviserRecommendationSignedAt}` : ""
        }`
      : "",
    adviser.recommendation ? `Nexus recommendation: ${adviser.recommendation}` : "",
    securityBits.length ? `Security offered: ${securityBits.join(", ")}` : ""
  );

  const payload = {
    nexus: {
      prospect_id: prospect.id,
      submission_id: submissionId ?? null,
      copied_at: new Date().toISOString(),
      source: compactSource(input),
    },
    borrower: {
      legal_name: company.companyName || "",
      trading_name: company.companyName || "",
      company_number: company.companyNumber || "",
      company_status: company.companyStatus || "",
      legal_entity: legalEntity(company.companyType),
      stage: company.incorporationDate ? "existing" : "",
      trading_start_date: company.incorporationDate || "",
      what_business_does: company.sicDescription || company.sicCode || adviser.sector || "",
      trading_activity: company.sicDescription || "",
      business_category: [company.sicCode, company.sicDescription, adviser.sector].filter(Boolean).join(" — "),
      trading_address: company.registeredAddress || "",
      trading_postcode: postcode,
      registered_address: registered,
      website: company.website || "",
      phone: primary?.phone || "",
      finance_email: primary?.email || "",
      related_entities_note: related,
    },
    contacts: {
      main_name: primary?.name || "",
      main_position: primary?.role || "",
      main_phone: primary?.phone || "",
      main_mobile: primary?.phone || "",
      main_email: primary?.email || "",
      key_name: secondary?.name || "",
      key_position: secondary?.role || "",
    },
    people,
    loan: {
      amount,
      term_months: term,
      purpose,
      is_refinance: refinance,
      purpose_breakdown: useOfFundsBreakdown(req, text(prospect.loanRequirementNotes, req.notes, adviser.purpose)),
      own_funds: money(asRecord(req.product_details).deposit_amount ?? hirePurchase.deposit),
      project_cost: money(asRecord(req.product_details).purchase_price ?? hirePurchase.assetPrice),
      repayment_type:
        asRecord(req.product_details).repayment_type === "INTEREST_ONLY"
          ? "Interest only"
          : amount
            ? "Capital & interest"
            : "",
    },
    eligibility: {
      business_insolvency: answers.not_in_difficulty === true ? "no" : answers.not_in_difficulty === false ? "yes" : "",
      business_insolvency_details:
        answers.not_in_difficulty === false
          ? text("Nexus GGS: business flagged as in difficulty / insolvency.", ...(eligibility.ineligibilityReasons || []))
          : "",
      state_aid: answers.subsidy_room === true ? "no" : answers.subsidy_room === false ? "yes" : "",
      firstent_uk_registered: answers.uk_trading === true ? "yes" : answers.uk_trading === false ? "no" : "",
    },
    narrative: {
      cover_note: cover,
      loan_purpose: text(adviser.purpose, prospect.loanRequirementNotes, req.notes),
      the_business: text(
        prospect.background,
        sections.background,
        sections.overview,
        company.sicDescription
      ),
      historic_commentary: text(accounts.summary, character.notes),
      deal_summary: text(adviser.recommendation, prospect.adviserRecommendation),
      forecast_commentary: text(financial.summary, accounts.summary),
      future_strategy: text(asRecord(campari.repayment).primary_source),
      source: "nexus",
    },
    financials: {
      source: historic || financial.summary || accounts.summary ? "nexus" : "",
      historic_pl: historic || undefined,
      ttp:
        diligence.hmrcTimeToPay && diligence.hmrcTimeToPay !== "none"
          ? [{ lender: "HMRC", status: diligence.hmrcTimeToPay, notes: "Self-reported in Nexus due diligence" }]
          : [],
      existing_lenders:
        affordability.existingMonthlyDebt
          ? {
              columns: ["Item", "Monthly"],
              rows: [["Existing monthly debt (Nexus affordability)", money(affordability.existingMonthlyDebt)]],
            }
          : undefined,
    },
    banking: {
      open_banking: {
        provider: openBanking.linkId ? "Nexus open-banking invite" : "",
        status: openBanking.status || "",
        sent_to: openBanking.customerEmail || "",
        sent_at: openBanking.invitedAt || openBanking.connectedAt || "",
      },
      analysis: {
        status: financial.summary || financial.dscr ? "complete" : "",
        summary: text(
          financial.summary,
          financial.dscr != null && financial.dscr !== "" ? `DSCR ${financial.dscr}` : "",
          accounts.dscr != null && accounts.dscr !== "" ? `Accounts DSCR ${accounts.dscr}` : "",
          affordability.annualEbitda != null ? `EBITDA £${money(affordability.annualEbitda)}` : "",
          ratios.revenue != null ? `Ratio revenue £${money(ratios.revenue)}` : ""
        ),
        months_covered: financial.profitAndLoss?.periodMonths
          ? String(financial.profitAndLoss.periodMonths)
          : Array.isArray(financial.monthlyBreakdown)
            ? String(financial.monthlyBreakdown.length)
            : "",
        findings: [
          ...(Array.isArray(financial.redFlags)
            ? financial.redFlags
                .map((flag: any) => (typeof flag === "string" ? flag : flag?.isActive ? flag.label : ""))
                .filter(Boolean)
            : []),
          ...(Array.isArray(accounts.concerns) ? accounts.concerns : []),
        ],
        analysed_at: underwriting.analyzedAt || underwriting.accountsAnalyzedAt || "",
        source_files: [
          underwriting.csvFileName,
          ...(Array.isArray(underwriting.accountsPdfs) ? underwriting.accountsPdfs.map((row: any) => row.fileName) : []),
          ...(Array.isArray(underwriting.bankPdfFiles) ? underwriting.bankPdfFiles.map((row: any) => row.fileName || row.name) : []),
        ].filter(Boolean),
      },
    },
    assessment: {
      score: underwriting.riskGrade || (character.managementExperience != null ? String(character.managementExperience) : ""),
      rating: underwriting.riskGrade || "",
      summary: text(
        financial.summary,
        accounts.summary,
        swot.summary,
        adviser.recommendation,
        adverseMedia.riskLevel && adverseMedia.riskLevel !== "LOW"
          ? `Adverse media screening: ${adverseMedia.riskLevel} risk. ${adverseMedia.summary || ""}`.trim()
          : ""
      ),
      strengths: Array.isArray(swot.strengths) ? swot.strengths : [],
      risks: [
        ...(Array.isArray(swot.weaknesses) ? swot.weaknesses : []),
        ...(Array.isArray(swot.threats) ? swot.threats : []),
        ...(Array.isArray(accounts.concerns) ? accounts.concerns : []),
        ...(Array.isArray(financial.redFlags)
          ? financial.redFlags
              .map((flag: any) => (typeof flag === "string" ? flag : flag?.isActive ? flag.label : ""))
              .filter(Boolean)
          : []),
        ...(Array.isArray(adverseMedia.flags) ? adverseMedia.flags : []),
      ],
      scored_at: underwriting.analyzedAt || underwriting.completedAt || "",
    },
    documents: docs,
    impact: {
      last_quarter_turnover: money(
        financial.profitAndLoss?.turnover ?? affordability.annualRevenue ?? ratios.revenue ?? accounts.years?.[0]?.turnover
      ),
    },
  };

  return omitEmpty(payload);
}
