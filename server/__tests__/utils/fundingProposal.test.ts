import { describe, expect, it } from "vitest";
import type { Contact, DueDiligence, ProspectWithCompany } from "@shared/schema";
import {
  buildFundingProposal,
  findChromium,
  renderFundingProposalHtmlFromData,
  renderFundingProposalPdf,
} from "../../utils/fundingProposal";

function prospect(overrides: Partial<ProspectWithCompany> = {}): ProspectWithCompany {
  return {
    id: 1,
    userId: "user-1",
    companyId: 1,
    stage: "due-diligence",
    loanAmount: 15_000_000,
    term: 60,
    interestRate: "10.5",
    directorsGuarantee: 1,
    adviserRecommendation: "Supportable subject to statements.",
    adviserRecommendationSignedBy: "Shaun",
    adviserRecommendationSignedAt: "2026-01-01",
    loanRequirementNotes: "Working capital to refinance a daily MCA.",
    background: "Family bakery supplying regional multiples.",
    loanRequirementData: {
      product_type: "BUSINESS_LOAN",
      product_details: { loan_amount: 150000, term_months: 60 },
      notes: "Working capital to refinance a daily MCA.",
      security_offered: { directors_guarantee: true, debenture: true },
      use_of_funds: {
        total_request_amount: 150000,
        breakdown: [
          { description: "Refinance MCA", amount: 90000 },
          { description: "Stock", amount: 60000 },
        ],
      },
    },
    loanAllocation: [
      { description: "Refinance MCA", amount: 90000 },
      { description: "Stock", amount: 60000 },
    ],
    researchData: {
      campari_module: {
        character: { management_experience_years: 6, credit_history_summary: "Clean conduct." },
        purpose: { validation_comment: "Refinance reduces daily MCA drag." },
      },
    },
    company: {
      companyName: "PDF REPORT TEST LTD",
      companyNumber: "TP000002",
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
    prospectId: 1,
    name: "Test Director",
    email: "director@example.com",
    phone: "0121 000 0000",
    role: "Director",
    isPrimary: 1,
  },
];

function dueDiligence(overrides: Record<string, any> = {}): DueDiligence {
  return {
    id: 1,
    prospectId: 1,
    data: {
      checklist: [],
      underwriting: {
        riskGrade: "B",
        adviserSummary: {
          recommendation: "Proceed subject to final bank checks.",
          sections: {
            character: "Directors have a clean credit history.",
            ability: "Management has run the business for 6 years.",
            purpose: "Working capital to refinance a daily MCA.",
          },
        },
        financialAnalysis: {
          dscr: 1.35,
          averageMonthlyRevenue: 42000,
          averageMonthlyExpenses: 36000,
          netDisposableIncome: 6000,
          summary: "Credits covering outgoings with a thin surplus.",
          monthlyBreakdown: [
            { month: "Jan 25", income: 40000, expenses: 35000, net: 5000, closingBalance: 12000 },
            { month: "Feb 25", income: 44000, expenses: 37000, net: 7000, closingBalance: 19000 },
          ],
          redFlags: ["Declining turnover in Q3", { label: "Returned item — HMRC", isActive: true }],
          preliminaryFindings: {
            loans: [{ date: "2025-02-03", description: "YouLend daily", amount: 180, details: "Suspected MCA" }],
            transfers: [{ date: "2025-02-10", description: "To personal", amount: 500, details: "Director transfer" }],
            bouncedPayments: [{ date: "2025-02-14", description: "DD failed — British Gas", amount: 212, details: "Unpaid" }],
            gambling: [{ date: "2025-02-08", description: "Betfair", amount: 40, details: "Betting" }],
            personalUse: [{ date: "2025-02-12", description: "Tesco", amount: 86, details: "Personal retailer" }],
            directDebits: [{ date: "2025-02-01", description: "Sage payroll", amount: 1200, details: "Monthly DD" }],
            anomalies: [{ date: "2025-02-20", description: "Round-sum cash", amount: 2000, details: "Unexplained" }],
          },
        },
        accountsAnalysis: {
          summary: "Accounts show steady but slowing growth.",
          concerns: ["Rising creditor days"],
          years: [
            { year: "FY24", turnover: 1_200_000, grossProfit: 400_000, ebitda: 140_000, netProfit: 90_000 },
            { year: "FY25", turnover: 980_000, grossProfit: 310_000, ebitda: 95_000, netProfit: 40_000 },
          ],
        },
        swotAnalysis: {
          strengths: ["Repeat trade"],
          weaknesses: ["MCA"],
          opportunities: ["New site"],
          threats: ["Food inflation"],
          summary: "Family bakery with MCA pressure.",
        },
        ...overrides,
      },
    } as any,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  } as DueDiligence;
}

describe("Passan-format funding proposal", () => {
  it("renders the seven authored sections, not the old credit-pack title", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence(),
    });
    expect(html).toContain("FUNDING PROPOSAL");
    expect(html).toContain("Company Profile");
    expect(html).toContain("Legal name");
    expect(html).toContain("Company number");
    expect(html).toContain("Background");
    expect(html).toContain("1.&nbsp;&nbsp;Loan amount and purpose");
    expect(html).toContain("2.&nbsp;&nbsp;The business");
    expect(html).toContain("3.&nbsp;&nbsp;Risk assessment");
    expect(html).toContain("4.&nbsp;&nbsp;Current financial situation");
    expect(html).toContain("5.&nbsp;&nbsp;Historic financial information");
    expect(html).toContain("6.&nbsp;&nbsp;Deal summary");
    expect(html).toContain("7.&nbsp;&nbsp;Financial forecasts");
    expect(html).toContain("8.&nbsp;&nbsp;Recommendation");
    expect(html).toContain("9.&nbsp;&nbsp;Attachments checklist");
    expect(html).not.toContain("Credit Assessment Report");
    expect(html).not.toContain("Veltro");
    expect(html).not.toContain("Note —");
    expect(html).toContain("alt=\"Sterling Commercial Finance\"");
    expect(html).toContain("Ref SCF-TP000002-");
    expect(html).toContain("class=\"running-name\"");
    expect(html).toContain("justify-content: space-between");
    expect(html).not.toContain("class=\"footer-page\"");
    expect(html).not.toContain("1 / 9");
    expect(html).not.toContain("9 / 9");
    expect(html).toContain("text-align: right");
  });

  it("expands Companies House register, charges, risk indicators and background notes", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect({ notes: "Director meeting 12 Aug." }),
      contacts,
      activities: [],
      dueDiligence: dueDiligence(),
      companiesHouseData: {
        profile: {
          date_of_creation: "2018-03-01",
          accounts: {
            last_accounts: { made_up_to: "2025-03-31", type: "full" },
            next_accounts: { due_on: "2026-12-31", overdue: true },
          },
          confirmation_statement: { last_made_up_to: "2025-03-01" },
          has_charges: true,
          has_insolvency_history: false,
          has_been_liquidated: false,
        },
        charges: {
          total_count: 1,
          satisfied_count: 0,
          items: [
            {
              charge_number: 1,
              status: "outstanding",
              classification: { description: "Debenture" },
              created_on: "2024-01-15",
              persons_entitled: [{ name: "NatWest Bank Plc" }],
              particulars: {
                contains_fixed_charge: true,
                contains_floating_charge: true,
                contains_negative_pledge: true,
              },
            },
          ],
        },
      },
    });
    expect(html).toContain("Incorporation date");
    expect(html).toContain("1 March 2018");
    expect(html).toContain("Latest filed accounts");
    expect(html).toContain("31 March 2025");
    expect(html).toContain("Full");
    expect(html).toContain("Next accounts due");
    expect(html).toContain("Overdue");
    expect(html).toContain("Risk indicators");
    expect(html).toContain("Insolvency history");
    expect(html).toContain("Debenture");
    expect(html).toContain("class=\"fin charges\"");
    expect(html).toContain("table.fin.charges th:nth-child(2)");
    expect(html).toContain("table.fin.charges th:nth-child(3)");
    expect(html).toContain("NatWest Bank Plc");
    expect(html).toContain("Negative pledge");
    expect(html).not.toContain("Background &amp; Notes");
    expect(html).toContain("Family bakery supplying regional multiples.");
    expect(html).not.toContain("Director meeting 12 Aug.");
  });

  it("prints loan amounts as pounds and the real company facts", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence(),
    });
    expect(html).toContain("£150,000");
    expect(html).not.toContain("£15,000,000");
    expect(html).toContain(
      "CONFIDENTIAL - Written by David Griffiths from Sterling Commercial Finance Limited"
    );
    expect(html).not.toContain("Confidential — prepared for");
    expect(html).toContain("TP000002");
    expect(html).toContain("1 Test Street, Birmingham");
    expect(html).toContain("Manufacture of bread");
    expect(html).toContain("Family bakery supplying regional multiples.");
    expect(html).toContain("Refinance MCA");
    expect(html).toContain("Purpose of loan");
    expect(html).toContain("Security offered");
    expect(html).toContain("Director's Guarantee");
    expect(html).toContain("Offered");
    expect(html).toContain("Use of funds");
    expect(html).not.toContain(">Allocations<");
    expect(html).not.toContain("Research Hub — CAMPARI");
    expect(html).toContain("Loan calculation");
    expect(html).toContain("Monthly repayment");
  });

  it("presents bank activity, red flags, DDs, bounces, loans, gambling and personal spend", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence(),
    });
    expect(html).toContain("4.&nbsp;&nbsp;Current financial situation");
    expect(html).toContain("Bank statement activity");
    expect(html).toContain("Jan 25");
    expect(html).toContain("Regular direct debits");
    expect(html).toContain("Sage payroll");
    expect(html).toContain("Suspected loan / MCA repayments");
    expect(html).toContain("YouLend daily");
    expect(html).toContain("Bounced / returned payments");
    expect(html).toContain("British Gas");
    expect(html).toContain("Gambling / betting");
    expect(html).toContain("Betfair");
    expect(html).toContain("Personal use of business account");
    expect(html).toContain("Tesco");
    expect(html).toContain("Anomalies");
    expect(html).toContain("Round-sum cash");
    expect(html).toContain("Declining turnover in Q3");
  });

  it("copies the Credit Studio SWOT onto the risk assessment page", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence(),
    });
    expect(html).not.toContain("Risk grade: B");
    expect(html).toMatch(/Grade now/);
    expect(html).toMatch(/Grade after/);
    expect(html).toContain("SWOT analysis");
    expect(html).toContain("Strengths");
    expect(html).toContain("Weaknesses");
    expect(html).toContain("Opportunities");
    expect(html).toContain("Threats");
    expect(html).toContain("Repeat trade");
    expect(html).toContain("MCA");
    expect(html).toContain("New site");
    expect(html).toContain("Food inflation");
  });

  it("copies CAMPARI onto the risk assessment page", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence(),
    });
    expect(html).toContain("3.&nbsp;&nbsp;Risk assessment");
    expect(html).toContain("CAMPARI");
    expect(html).toContain("C – Character");
    expect(html).toContain("Directors have a clean credit history.");
    expect(html).toContain("A – Ability");
    expect(html).toContain("Management has run the business for 6 years.");
    expect(html).toContain("P – Purpose");
    expect(html).toContain('ul class="campari-points"');
    expect(html).toContain("<li>Directors have a clean credit history.</li>");
  });

  it("turns stored CAMPARI paragraphs into bullets and drops chrome headings", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence({
        adviserSummary: {
          sections: {
            character:
              "# CAMPARI Analysis: Character\n\n**Company and directors**\nThe applicant is GEORGES TRADITION GROUP LIMITED. Three directors are recorded on file. No CCJs are held on this file.",
          },
        },
      }),
    });
    const campari = html.split("CAMPARI")[1]?.split("SWOT")[0] || html;
    expect(campari).toContain('ul class="campari-points"');
    expect(campari).toContain("<li>The applicant is GEORGES TRADITION GROUP LIMITED.</li>");
    expect(campari).toContain("<li>Three directors are recorded on file.</li>");
    expect(campari).toContain("<li>No CCJs are held on this file.</li>");
    expect(campari).toContain("Company and directors");
    expect(campari).not.toContain("CAMPARI Analysis");
    expect(campari).not.toContain('<p class="body-text">The applicant is GEORGES TRADITION GROUP LIMITED.');
  });

  it("prints CAMPARI only on the risk assessment, not other sections", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence({
        adviserSummary: {
          sections: {
            overview:
              "# Overview\n\nA fish and chip group in Derbyshire.\n\n## Key Facts a Credit Officer Needs Before CAMPARI\n\nShould not appear in The business.",
            character: "Directors have a clean credit history.",
            means: "Working capital is tight after the MCA.",
            repayment: "# Repayment\n\n**Facility terms:** £150,000 over 60 months. This must not appear in forecasts.",
          },
        },
      }),
    });
    const business = html.split("2.&nbsp;&nbsp;The business")[1]?.split("3.&nbsp;&nbsp;Risk assessment")[0] || "";
    const risk = html.split("3.&nbsp;&nbsp;Risk assessment")[1]?.split("4.&nbsp;&nbsp;Current financial situation")[0] || "";
    const historic = html.split("5.&nbsp;&nbsp;Historic financial information")[1]?.split("6.&nbsp;&nbsp;Deal summary")[0] || "";
    const deal = html.split("6.&nbsp;&nbsp;Deal summary")[1]?.split("7.&nbsp;&nbsp;Financial forecasts")[0] || "";
    const forecasts = html.split("7.&nbsp;&nbsp;Financial forecasts")[1]?.split("8.&nbsp;&nbsp;Recommendation")[0] || "";

    expect(business).toContain("A fish and chip group in Derbyshire.");
    expect(business).not.toContain("Should not appear in The business.");
    expect(business).not.toContain("Key Facts a Credit Officer Needs Before CAMPARI");
    expect(risk).toContain("C – Character");
    expect(risk).toContain("Directors have a clean credit history.");
    expect(risk).toContain("Working capital is tight after the MCA.");
    expect(risk.match(/Directors have a clean credit history/g)?.length).toBe(1);
    expect(historic).not.toContain("CAMPARI Analysis");
    expect(historic).not.toContain("Working capital is tight after the MCA.");
    expect(deal).not.toContain("Research Hub — CAMPARI");
    expect(forecasts).not.toContain("Facility terms:");
    expect(forecasts).not.toContain("This must not appear in forecasts.");
  });

  it("uses analysed accounts for historic P&amp;L in £000", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence(),
    });
    expect(html).toContain("Historic Profit &amp; Loss (£000)");
    expect(html).toContain("FY24");
    expect(html).toContain("1,200");
    expect(html).not.toContain("Accounts show steady but slowing growth.");
    expect(html).toContain("class=\"accounts-chart\"");
    expect(html).toContain("Accounts trend (£000)");
    expect(html).toContain("<polyline");
    expect(html).toContain("Trend (Turnover)");
  });

  it("copies the Credit Studio recommendation onto section 7", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence({
        adviserSummary: {
          recommendation: "approve_conditions",
          sections: {
            recommendation: "Proceed subject to updated bank statements and a site visit.",
          },
        },
      }),
    });
    expect(html).toContain("8.&nbsp;&nbsp;Recommendation");
    expect(html).toContain("Recommend");
    expect(html).toContain("Approve with Conditions");
    expect(html).toContain("Proceed subject to updated bank statements and a site visit.");
    expect(html).toContain("class=\"remarks-page\"");
    expect(html).toContain("For and on behalf of Sterling Commercial Finance");
    expect(html).toContain("Shaun");
  });

  it("keeps company profile values left-aligned next to labels", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence(),
    });
    expect(html).toContain('table class="kv"');
    expect(html).toMatch(/<th>Legal name<\/th><td>PDF REPORT TEST LTD<\/td>/);
    expect(html).not.toMatch(/table class="fin"><tbody><tr><td><strong>Legal name/);
  });

  it("renders Auto Write markdown as proposal copy and does not dump Character into The business", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence({
        adviserSummary: {
          sections: {
            overview: `# Overview\n\n**Georges Tradition** is an active limited company.\n\n## Key Facts a Credit Officer Needs Before CAMPARI\n\nShould not appear in The business.`,
            character: "Directors: Nicky Dean Hogan. This character dump must not fill The business.",
          },
        },
      }),
    });
    expect(html).toContain("Georges Tradition");
    expect(html).not.toContain("# Overview");
    expect(html).not.toContain("**Georges Tradition**");
    expect(html).not.toContain("Should not appear in The business.");
    const business = html.split("2.&nbsp;&nbsp;The business")[1]?.split("3.&nbsp;&nbsp;Risk assessment")[0] || "";
    expect(business).not.toContain("This character dump must not fill The business.");
    expect(html).toContain("This character dump must not fill The business.");
  });

  it("does not print [object Object] when riskGrade is an empty object", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect({
        company: {
          ...prospect().company,
          creditsafeScore: "C",
          creditsafeRatingDescription: "Moderate Risk",
        },
      }),
      contacts,
      activities: [],
      dueDiligence: dueDiligence({ riskGrade: {} }),
    });
    expect(html).not.toContain("[object Object]");
    expect(html).toContain("Moderate Risk");
    expect(html).not.toContain("Risk grade: Moderate Risk");
    expect(html).toMatch(/Creditsafe/);
  });

  it("turns **headings** and numbered Auto Write lines into proposal HTML", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect({
        loanRequirementNotes: "Refinance of existing short term debts",
        loanRequirementData: {
          ...(prospect().loanRequirementData as object),
          notes: "Refinance of existing short term debts",
        },
      }),
      contacts,
      activities: [],
      dueDiligence: dueDiligence({
        adviserSummary: {
          purpose: "",
          sections: {
            purpose: "**Purpose**\n\n**Exact use of funds**\n\n1. Itemised schedule of debts.\n- Directors on file: Ian Moore.",
            overview: "A fish and chip group.",
          },
        },
      }),
    });
    expect(html).toContain("Refinance of existing short term debts");
    expect(html).not.toContain("**Purpose**");
    const purpose = html.split("1.&nbsp;&nbsp;Loan amount and purpose")[1]?.split("2.&nbsp;&nbsp;The business")[0] || "";
    expect(purpose).not.toContain("Exact use of funds");
    const campari = html.split("CAMPARI")[1]?.split("SWOT")[0] || html;
    expect(campari).toContain("Itemised schedule of debts.");
    expect(campari).toContain("Directors on file: Ian Moore.");
  });

  it("never prints leftover markdown hashes or asterisks", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect({
        loanRequirementNotes: "Refinance of existing short term debts",
        loanRequirementData: {
          ...(prospect().loanRequirementData as object),
          notes: "Refinance of existing short term debts",
        },
      }),
      contacts,
      activities: [],
      dueDiligence: dueDiligence({
        adviserSummary: {
          purpose:
            "## Purpose\n\n**Exact use of funds**\n\nThe stated purpose of the facility is the refinance of existing short-term debts.",
          sections: {
            overview:
              "# Overview\n\nA fish and chip group in Derbyshire.\n\n**Key facts a credit officer needs before CAMPARI:**\n\n- **Company identity/status:** Confirmed active.\n\n# CAMPARI Analysis: Character\n\n## Owners/Directors\n\n- **Ian Moore** (Director)",
            character:
              "# CAMPARI Analysis: Character\n\n## Owners/Directors\n\n- **Ian Moore** (Director)\n\nThe company is shown as **active** at Companies House.",
          },
        },
      }),
    });
    expect(html).not.toContain("**");
    expect(html).not.toContain("## Purpose");
    expect(html).not.toContain("## Owners");
    expect(html).not.toContain("# Overview");
    expect(html).not.toContain("# CAMPARI");
    const purpose = html.split("1.&nbsp;&nbsp;Loan amount and purpose")[1]?.split("2.&nbsp;&nbsp;The business")[0] || "";
    const business = html.split("2.&nbsp;&nbsp;The business")[1]?.split("3.&nbsp;&nbsp;Risk assessment")[0] || "";
    expect(purpose).toContain("Refinance of existing short term debts");
    expect(purpose).not.toContain("Exact use of funds");
    expect(business).toContain("A fish and chip group in Derbyshire.");
    expect(business).not.toContain("CAMPARI Analysis");
    expect(business).not.toContain("Ian Moore");
    expect(html).toContain("Ian Moore");
    expect(html).toContain("active");
  });

  it("leaves recommendation and forecasts empty rather than inventing them", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect({ adviserRecommendation: null, adviserRecommendationSignedBy: null }),
      contacts: [],
      activities: [],
      dueDiligence: undefined,
    });
    expect(html).toContain("Awaiting recommendation");
    expect(html).toContain("Forecasts not yet modelled");
    expect(html).not.toContain("Supportable subject to statements.");
  });

  it("prints the attachments checklist from uploaded documents", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence(),
      documents: [
        { id: 1, fileName: "accounts-fy24.pdf", category: "accounts" } as any,
        { id: 2, fileName: "statements-mar-aug.pdf", category: "bank-statements" } as any,
      ],
    });
    expect(html).toContain("Last 3 years filed accounts");
    expect(html).toContain("Last 6 months business bank statements");
    expect(html).toContain("Photo ID for all directors");
    expect(html).toMatch(/Attached/i);
    expect(html).toMatch(/☑[\s\S]*Last 3 years filed accounts/);
    expect(html).toMatch(/☐[\s\S]*Photo ID for all directors/);
  });

  it("escapes HTML in company-supplied text", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect({ background: `<img src=x onerror=alert(1)>` }),
      contacts: [],
      activities: [],
    });
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
  });

  it("builds a cover fact table with a 5-year term from 60 months", () => {
    const model = buildFundingProposal({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence(),
    });
    expect(model.facts.find((f) => f.label.startsWith("Term"))?.value).toBe("5 years");
    expect(model.facts.find((f) => f.label.startsWith("Loan amount"))?.value).toBe("£150,000");
    expect(model.facts.some((f) => f.label.startsWith("Risk grade"))).toBe(false);
    expect(model.reference).toMatch(/^SCF-TP000002-\d{8}-\d{4}$/);
    expect(model.generatedStamp).toMatch(/, \d{2}:\d{2}$/);
  });

  it("prints to a compact PDF without a stack of empty pages", async () => {
    const chrome = findChromium();
    if (!chrome) return;
    const pdf = await renderFundingProposalPdf({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence(),
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
    const raw = pdf.toString("latin1");
    const pageCount = (raw.match(/\/Type\s*\/Page(?!s)/g) || []).length;
    expect(pageCount).toBeGreaterThanOrEqual(3);
    expect(pageCount).toBeLessThanOrEqual(12);
  }, 60000);

  it("prints one amount, D then A, and no working-notes", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect({
        loanAmount: 12_000_000,
        term: 60,
        interestRate: "18",
        loanRequirementData: {
          product_type: "BUSINESS_LOAN",
          product_details: { loan_amount: 120000, term_months: 60 },
          use_of_funds: { total_request_amount: 120000, breakdown: [{ description: "Iwoca", amount: 21823 }] },
          notes: "Refinance of expensive short-term debt",
        },
        loanAllocation: [{ description: "Iwoca", amount: 21823 }],
        background: "Omnichannel craft retailer in Yate and online.",
        notes: "Note on scope: the document provided is a schedule.",
      }),
      contacts,
      activities: [],
      dueDiligence: dueDiligence({
        riskGrade: "A",
        financialAnalysis: {
          summary: "Note on scope: the document provided is a single-page schedule. Proposed £110,000. £8,500,000 inconsistency.",
          dscr: 0,
          riskScore: "E",
          averageMonthlyRevenue: 0,
          netDisposableIncome: 0,
        },
        accountsAnalysis: {
          summary: "The loan request is for £8,500,000 with a £0 stated monthly repayment.",
          years: [{ year: "FY26", turnover: 0, grossProfit: 0, ebitda: 0, netProfit: 0 }],
        },
        adviserSummary: {
          sections: {
            amount: "The £85,000 refinance is intended to consolidate.",
            character: "Sole director on file: Kirsty Bevan.",
          },
        },
        affordabilitySweep: {
          totals: { avgIn: 20200.98, avgOut: 20952.73, avgNet: -751.75, months: 6 },
          financeMonthly: 5702.7,
          cashForDebt: 4950.95,
          proposedMonthly: 3050,
          dscrCurrent: 0.87,
          dscrRefinance: 1.62,
          monthlySaving: 2652.7,
          lenders: [{ name: "YouLend", kind: "mca", moneyOut: 250, count: 166, monthly: 2179.72 }],
          months: [{ label: "March 2026", moneyIn: 21489.34, moneyOut: 26289.12, net: -4799.78, closing: -8833.09 }],
        },
      }),
      documents: [{ id: 1, fileName: "statements-mar-aug.pdf", category: "bank-statements" } as any],
    });
    expect(html.match(/£120,000/g)?.length).toBeGreaterThan(0);
    expect(html).not.toContain("£85,000");
    expect(html).not.toContain("£110,000");
    expect(html).not.toContain("£8,500,000");
    expect(html).not.toMatch(/note on scope/i);
    expect(html).not.toContain("the document provided");
    expect(html).not.toContain(">Allocations<");
    expect(html).not.toContain("Application of Funds");
    expect(html).not.toContain("1 / 9");
    expect(html).not.toContain("overflow-wrap: anywhere");
    expect(html).toMatch(/Grade now/);
    expect(html).toMatch(/Grade after/);
    expect(html).toContain(">D<");
    expect(html).toContain(">A<");
    expect((html.split("Background").length - 1)).toBeLessThanOrEqual(2);
    expect(html).toContain("Last 6 months business bank statements");
    expect(html).toMatch(/Attached/i);
  });

  it("prints CAMPARI from slots and drops mixed-heading pound essays", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence({
        adviserSummary: {
          sections: {
            amount:
              "# CAMPARI Analysis\n\n## Amount\nThe £85,000 refinance is intended to consolidate.",
            character: "Sole director on file: Kirsty Bevan.",
          },
        },
      }),
    });
    expect(html).not.toContain("£85,000");
    const campari = html.split("CAMPARI")[1]?.split("SWOT")[0] || "";
    expect(campari).toContain('ul class="campari-points"');
    expect(campari).toContain("<li>Sole director on file: Kirsty Bevan.</li>");
    expect(campari).not.toContain("The £85,000 refinance is intended to consolidate.");
  });

  it("prints purpose as a ul, not a body paragraph", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence(),
    });
    const purpose = html.split("1.&nbsp;&nbsp;Loan amount and purpose")[1]?.split("2.&nbsp;&nbsp;The business")[0] || "";
    expect(purpose).toMatch(/<ul[^>]*>[\s\S]*<li>/);
    expect(purpose).not.toContain('p class="body-text"');
    expect(purpose).toContain("Working capital to refinance a daily MCA");
  });

  it("does not backfill cashflow kv from financialAnalysis when sweep is missing", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect(),
      contacts,
      activities: [],
      dueDiligence: dueDiligence(),
    });
    const cash = html.split("4.&nbsp;&nbsp;Current financial situation")[1]?.split("5.&nbsp;&nbsp;Historic financial information")[0] || "";
    expect(cash).not.toContain("Average monthly credits");
    expect(cash).not.toContain("Net disposable income");
    expect(cash).not.toContain("£42,000");
    expect(cash).not.toContain("£6,000");
  });

  it("does not use Creditsafe as the cover grade", () => {
    const html = renderFundingProposalHtmlFromData({
      prospect: prospect({ company: { ...prospect().company, creditsafeScore: "A", creditsafeRatingDescription: "Very Low Risk" } }),
      contacts,
      activities: [],
      dueDiligence: dueDiligence({ riskGrade: undefined, affordabilitySweep: { ...dueDiligence().data.underwriting.affordabilitySweep, financeMonthly: 5702.7, cashForDebt: 4950.95 } }),
    });
    expect(html).not.toMatch(/Risk grade:\s*Very Low Risk/);
    expect(html).toMatch(/Creditsafe/);
  });
});
