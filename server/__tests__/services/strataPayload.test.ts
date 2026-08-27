import { describe, expect, it } from "vitest";
import { buildStrataPayload, omitEmpty } from "../../services/strataPayload";
import type { Contact, ProspectWithCompany } from "@shared/schema";

function prospect(overrides: Partial<ProspectWithCompany> = {}): ProspectWithCompany {
  return {
    id: 27,
    userId: "user-1",
    companyId: 1,
    stage: "packaging",
    loanAmount: 15_000_000,
    term: 60,
    interestRate: "10.5",
    directorsGuarantee: 1,
    commercialProperty: 0,
    homeEquity: 0,
    propertyOther: 0,
    debenture: 1,
    parentCompanyGuarantee: 0,
    collateral: 0,
    crossCompanyGuarantee: 0,
    loanRequirementNotes: "Working capital to refinance a daily MCA.",
    loanAllocation: [],
    notes: "File notes from the pipeline.",
    background: "UK bakery trading since 2018.",
    adviserRecommendation: "Supportable subject to statements.",
    adviserRecommendationSignedBy: "Shaun",
    loanRequirementData: {
      product_type: "BUSINESS_LOAN",
      product_details: { loan_amount: 150000, term_months: 60 },
      security_offered: { directors_guarantee: true, debenture: true },
      use_of_funds: {
        total_request_amount: 150000,
        breakdown: [
          { description: "Refinance MCA", amount: 90000 },
          { description: "Stock", amount: 60000 },
        ],
      },
      notes: "Use of funds agreed with director.",
    },
    company: {
      companyName: "STRATA PACK TEST LTD",
      companyNumber: "TP000001",
      registeredAddress: "1 Test Street, Birmingham",
      postcode: "B1 1AA",
      incorporationDate: "2018-03-01",
      companyStatus: "active",
      companyType: "ltd",
      sicCode: "10710",
      sicDescription: "Manufacture of bread",
    },
    ...overrides,
  } as ProspectWithCompany;
}

const contacts: Contact[] = [
  {
    prospectId: 27,
    name: "Test Director",
    email: "test.director@example.com",
    phone: "0121 000 0000",
    role: "Director",
    isPrimary: 1,
  },
];

describe("buildStrataPayload", () => {
  it("copies company, people, loan pence and use of funds onto Strata fields", () => {
    const payload = buildStrataPayload({ prospect: prospect(), contacts }) as any;
    expect(payload.borrower.legal_name).toBe("STRATA PACK TEST LTD");
    expect(payload.borrower.company_number).toBe("TP000001");
    expect(payload.borrower.trading_postcode).toBe("B1 1AA");
    expect(payload.borrower.what_business_does).toBe("Manufacture of bread");
    expect(payload.contacts.main_name).toBe("Test Director");
    expect(payload.contacts.main_email).toBe("test.director@example.com");
    expect(payload.people[0]).toMatchObject({ forename: "Test", surname: "Director", position: "Director" });
    expect(payload.loan.amount).toBe("150000");
    expect(payload.loan.term_months).toBe("60");
    expect(payload.loan.purpose).toBe("Refinance");
    expect(payload.loan.is_refinance).toBe("yes");
    expect(payload.loan.purpose_breakdown).toContain("Refinance MCA: £90000");
    expect(payload.loan.purpose_breakdown).toContain("Stock: £60000");
    expect(payload.narrative.the_business).toContain("UK bakery trading since 2018");
    expect(payload.narrative.cover_note).toContain("Supportable subject to statements");
    expect(payload.nexus.prospect_id).toBe(27);
  });

  it("maps BBB answers and does not invent missing financial figures", () => {
    const payload = buildStrataPayload({
      prospect: prospect(),
      contacts,
      diligence: {
        checklist: [],
        hmrcTimeToPay: "active",
        underwriting: {
          eligibility: {
            isEligible: true,
            answers: {
              uk_trading: true,
              not_in_difficulty: true,
              subsidy_room: true,
            },
          },
        },
      },
    }) as any;
    expect(payload.eligibility.business_insolvency).toBe("no");
    expect(payload.eligibility.state_aid).toBe("no");
    expect(payload.eligibility.firstent_uk_registered).toBe("yes");
    expect(payload.financials.ttp[0]).toMatchObject({ lender: "HMRC", status: "active" });
    expect(payload.financials.historic_pl).toBeUndefined();
    expect(payload.loan.amount).toBe("150000");
  });

  it("maps underwriting financials, SWOT, documents and open banking when present", () => {
    const payload = buildStrataPayload({
      prospect: prospect(),
      contacts,
      documents: [
        { prospectId: 27, userId: "u", fileName: "June-statement.pdf", fileType: "application/pdf", fileSize: 1, storagePath: "x", category: "bank_statements" } as any,
        { prospectId: 27, userId: "u", fileName: "accounts-2024.pdf", fileType: "application/pdf", fileSize: 1, storagePath: "y", category: "audited_accounts" } as any,
      ],
      diligence: {
        checklist: [],
        underwriting: {
          riskGrade: "B",
          analyzedAt: "2026-08-18T10:00:00.000Z",
          openBanking: { status: "connected", customerEmail: "md@example.com" },
          financialAnalysis: { dscr: 1.4, summary: "Statements support the instalment.", profitAndLoss: { turnover: 800000, periodMonths: 6 } },
          accountsAnalysis: {
            summary: "Filed accounts show a profit.",
            concerns: ["Thin cash"],
            years: [{ year: "2024", turnover: 820000, netProfit: 41000 }],
          },
          swotAnalysis: { strengths: ["Repeat trade"], weaknesses: ["MCA"], threats: ["Food inflation"] },
          adviserSummary: { purpose: "Working capital", recommendation: "Proceed", sections: { background: "Family bakery." } },
        },
      },
    }) as any;
    expect(payload.documents.bank_statements).toBe("yes");
    expect(payload.documents.statutory_accounts).toBe("yes");
    expect(payload.banking.open_banking.status).toBe("connected");
    expect(payload.banking.analysis.summary).toContain("Statements support the instalment");
    expect(payload.banking.analysis.summary).toContain("DSCR 1.4");
    expect(payload.financials.historic_pl.lines[0].values).toEqual(["820000"]);
    expect(payload.assessment.rating).toBe("B");
    expect(payload.assessment.strengths).toEqual(["Repeat trade"]);
    expect(payload.assessment.risks).toEqual(expect.arrayContaining(["MCA", "Food inflation", "Thin cash"]));
    expect(payload.impact.last_quarter_turnover).toBe("800000");
    expect(payload.narrative.the_business).toContain("Family bakery");
  });

  it("falls back to prospect loanAmount pence when no requirement card exists", () => {
    const payload = buildStrataPayload({
      prospect: prospect({ loanRequirementData: undefined, loanRequirementNotes: "Working capital" }),
      contacts: [],
    }) as any;
    expect(payload.loan.amount).toBe("150000");
    expect(payload.loan.purpose).toBe("Working Capital");
    expect(payload.people).toBeUndefined();
  });
});

describe("omitEmpty", () => {
  it("drops blank strings and empty objects so Strata merge will not wipe filled fields", () => {
    expect(omitEmpty({ a: "", b: "kept", c: { d: "" }, e: [] })).toEqual({ b: "kept" });
  });
});
