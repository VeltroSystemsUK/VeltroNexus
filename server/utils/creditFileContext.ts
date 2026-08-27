import type { Contact, DueDiligenceData, ProspectWithCompany } from "@shared/schema";

type Underwriting = NonNullable<DueDiligenceData["underwriting"]>;

export function loanAmountPounds(
  prospect: Pick<ProspectWithCompany, "loanAmount">,
  underwriting?: Underwriting | null
): number {
  const fromDetails = underwriting?.loanDetails?.amount;
  const pence = prospect.loanAmount;
  if (typeof fromDetails === "number" && fromDetails > 0) {
    if (typeof pence === "number" && fromDetails === pence) return fromDetails / 100;
    return fromDetails;
  }
  if (typeof pence === "number" && pence > 0) return pence / 100;
  return 0;
}

export function isStubAiSection(text: string): boolean {
  const trimmed = (text || "").trim();
  if (trimmed.length < 80) return true;
  if (/unavailable/i.test(trimmed) && trimmed.length < 220) return true;
  return false;
}

function line(label: string, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === "Unknown" || text === "n/a") return null;
  return `${label}: ${text}`;
}

export function buildCreditFileContext(input: {
  prospect: ProspectWithCompany;
  dueDiligence?: DueDiligenceData | Record<string, any> | null;
  contacts?: Array<Pick<Contact, "name" | "role"> | { name?: string | null; role?: string | null }>;
  omitSwot?: boolean;
}): string {
  const prospect = input.prospect;
  const company = prospect.company || ({} as ProspectWithCompany["company"]);
  const dd = (input.dueDiligence || {}) as DueDiligenceData;
  const underwriting = (dd.underwriting || {}) as Underwriting;
  const adviser = underwriting.adviserSummary || {};
  const amount = loanAmountPounds(prospect, underwriting);
  const purpose =
    (typeof adviser.purpose === "string" && adviser.purpose.trim()) ||
    prospect.loanRequirementNotes ||
    "";
  const sector =
    (typeof adviser.sector === "string" &&
    adviser.sector.trim() &&
    adviser.sector !== "Professional Services"
      ? adviser.sector
      : "") ||
    company.sicDescription ||
    company.sicCode ||
    "";

  const companyLines = [
    line("Company name", company.companyName),
    line("Company number", company.companyNumber),
    line("Status", company.companyStatus),
    line("Type", company.companyType),
    line("Incorporated", company.incorporationDate),
    line("Registered address", company.registeredAddress),
    line("Postcode", company.postcode),
    line("SIC", [company.sicCode, company.sicDescription].filter(Boolean).join(" ")),
    line("Website", company.website),
  ].filter(Boolean);

  const dealLines = [
    line("Loan amount", amount ? `£${amount.toLocaleString("en-GB")}` : null),
    line("Term (months)", prospect.term || underwriting.loanDetails?.termMonths),
    line("Interest rate", prospect.interestRate || underwriting.loanDetails?.interestRate),
    line("Purpose", purpose),
    line("Sector", sector),
    line("Directors guarantee", prospect.directorsGuarantee ? "Yes" : null),
    line("Background on file", prospect.background),
  ].filter(Boolean);

  const directors = (input.contacts || [])
    .map((contact) => {
      const name = (contact.name || "").trim();
      if (!name) return null;
      return contact.role ? `${name} (${contact.role})` : name;
    })
    .filter(Boolean);

  const swot = underwriting.swotAnalysis;
  const swotLines = swot
    ? [
        line("SWOT summary", swot.summary),
        swot.strengths?.length ? `Strengths: ${swot.strengths.join("; ")}` : null,
        swot.weaknesses?.length ? `Weaknesses: ${swot.weaknesses.join("; ")}` : null,
        swot.opportunities?.length ? `Opportunities: ${swot.opportunities.join("; ")}` : null,
        swot.threats?.length ? `Threats: ${swot.threats.join("; ")}` : null,
      ].filter(Boolean)
    : [];

  const financial = underwriting.financialAnalysis;
  const financialLines = financial
    ? [
        line("Bank/financial summary", financial.summary),
        line("Risk score", financial.riskScore),
        line("DSCR", financial.dscr),
        line("Avg monthly revenue", financial.averageMonthlyRevenue),
        line("Net disposable income", financial.netDisposableIncome),
      ].filter(Boolean)
    : [];

  const accounts = underwriting.accountsAnalysis;
  const accountLines = accounts
    ? [line("Accounts summary", accounts.summary), line("Accounts risk", accounts.riskAssessment)].filter(
        Boolean
      )
    : [];

  const parts = [
    "FILE FACTS (use these; do not claim they were not supplied):",
    companyLines.length ? ["Company", ...companyLines].join("\n") : null,
    directors.length ? `Directors / contacts on file:\n- ${directors.join("\n- ")}` : null,
    dealLines.length ? ["Facility", ...dealLines].join("\n") : null,
    financialLines.length ? ["Bank analysis on file", ...financialLines].join("\n") : null,
    accountLines.length ? ["Accounts analysis on file", ...accountLines].join("\n") : null,
    !input.omitSwot && swotLines.length ? ["SWOT on file", ...swotLines].join("\n") : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}
