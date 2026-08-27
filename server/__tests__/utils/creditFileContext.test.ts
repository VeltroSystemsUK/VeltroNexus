import { describe, expect, it } from "vitest";
import {
  buildCreditFileContext,
  isStubAiSection,
  loanAmountPounds,
} from "../../utils/creditFileContext";
import type { ProspectWithCompany } from "@shared/schema";

const prospect = {
  id: 73,
  loanAmount: 25_000_000,
  term: 60,
  interestRate: "17",
  loanRequirementNotes: "Refinance of existing short term debts",
  background: "Fish and chip group trading from Derbyshire sites.",
  directorsGuarantee: 1,
  company: {
    companyName: "GEORGES TRADITION GROUP LIMITED",
    companyNumber: "13774324",
    companyStatus: "active",
    companyType: "ltd",
    incorporationDate: "2021-11-30",
    registeredAddress: "Unit 1 Erewash Court, Ilkeston, DE7 8EF",
  },
} as unknown as ProspectWithCompany;

describe("loanAmountPounds", () => {
  it("converts prospect pence when loan details are missing", () => {
    expect(loanAmountPounds(prospect)).toBe(250000);
  });

  it("prefers loan-details pounds", () => {
    expect(loanAmountPounds(prospect, { loanDetails: { amount: 150000 } })).toBe(150000);
  });
});

describe("buildCreditFileContext", () => {
  it("includes company number, address, directors, purpose and SWOT", () => {
    const text = buildCreditFileContext({
      prospect,
      dueDiligence: {
        underwriting: {
          swotAnalysis: {
            summary: "Supportable subject to statements.",
            strengths: ["Sites retained after administration"],
          },
          adviserSummary: { sector: "Professional Services", purpose: "" },
        },
      },
      contacts: [
        { name: "Nicky Dean Hogan", role: "Director" },
        { name: "Ian Moore", role: "Director" },
      ],
    });

    expect(text).toContain("13774324");
    expect(text).toContain("Ilkeston");
    expect(text).toContain("Nicky Dean Hogan (Director)");
    expect(text).toContain("Refinance of existing short term debts");
    expect(text).toContain("£250,000");
    expect(text).not.toContain("Professional Services");
    expect(text).toContain("Sites retained after administration");
    expect(text).toContain("FILE FACTS");
  });

  it("can omit a prior SWOT so regeneration is not poisoned by a stale amount", () => {
    const text = buildCreditFileContext({
      prospect,
      dueDiligence: {
        underwriting: {
          swotAnalysis: { summary: "Refers throughout to a £25,000,000 expansion facility." },
        },
      },
      omitSwot: true,
    });
    expect(text).toContain("£250,000");
    expect(text).not.toContain("25,000,000");
    expect(text).not.toContain("SWOT on file");
  });

  it("treats loan-details that still store pence as pounds", () => {
    expect(loanAmountPounds(prospect, { loanDetails: { amount: 25_000_000 } })).toBe(250000);
  });
});

describe("isStubAiSection", () => {
  it("flags short unavailable stubs", () => {
    expect(isStubAiSection("Comparative analysis unavailable")).toBe(true);
    expect(isStubAiSection("Section unavailable")).toBe(true);
    expect(isStubAiSection("")).toBe(true);
  });

  it("keeps a real memo", () => {
    expect(
      isStubAiSection(
        "Georges Tradition Group Limited (13774324) is an active private limited company incorporated on 30 November 2021. Directors on file include Nicky Dean Hogan."
      )
    ).toBe(false);
  });
});
