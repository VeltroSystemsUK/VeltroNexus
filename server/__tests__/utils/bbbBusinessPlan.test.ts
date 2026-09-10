import { afterEach, describe, expect, it, vi } from "vitest";
import { BBB_BUSINESS_PLAN_SECTIONS } from "@shared/bbbBusinessPlan";
import {
  buildBusinessPlanPrompt,
  generateBusinessPlanPdf,
  generateBbbBusinessPlan,
  parseBusinessPlanSections,
} from "../../utils/bbbBusinessPlan";

describe("parseBusinessPlanSections", () => {
  it("fills every required heading, using unknown where Grok omitted a section", () => {
    const sections = parseBusinessPlanSections({
      sections: [{ id: "executive-summary", body: "Kitchen fitter seeking refinance." }],
    });
    expect(sections).toHaveLength(BBB_BUSINESS_PLAN_SECTIONS.length);
    expect(sections[0].body).toMatch(/Kitchen fitter/);
    expect(sections.find((section) => section.id === "use-of-funds")?.body).toMatch(/unknown/i);
  });
});

describe("generateBusinessPlanPdf", () => {
  it("writes a PDF containing the company name and BBB disclaimer", async () => {
    const sections = parseBusinessPlanSections({
      sections: BBB_BUSINESS_PLAN_SECTIONS.map((section) => ({
        id: section.id,
        body: `${section.heading} body`,
      })),
    });
    const pdf = await generateBusinessPlanPdf({
      companyName: "THE HOME CRAFTERS LTD.",
      companyNumber: "10034885",
      sections,
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});

describe("generateBbbBusinessPlan", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks Grok and returns a PDF plus the BBB section set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(String(url)).toBe("https://api.x.ai/v1/chat/completions");
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    sections: [
                      { id: "executive-summary", body: "Refinance of stacked short-term facilities." },
                      { id: "use-of-funds", body: "Consolidate existing business debt." },
                    ],
                  }),
                },
              },
            ],
          }),
        } as Response;
      })
    );

    const result = await generateBbbBusinessPlan(
      {
        companyName: "THE HOME CRAFTERS LTD.",
        companyNumber: "10034885",
        registeredAddress: "Bristol",
        contacts: ["Kirsty Bevan, Director"],
        background: "Inbound refinance enquiry.",
        fundingReason: "Stacked short-term loans.",
        documents: ["2026_March_Statement.pdf"],
        loanAmount: 85000,
      },
      { XAI_API_KEY: "xai-test-key" }
    );

    expect(result.fileName).toMatch(/business-plan/i);
    expect(result.pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(result.sections.find((section) => section.id === "executive-summary")?.body).toMatch(/Refinance/);
    expect(buildBusinessPlanPrompt({ companyName: "THE HOME CRAFTERS LTD.", documents: [] })).toMatch(
      /do not invent/i
    );
  });
});
