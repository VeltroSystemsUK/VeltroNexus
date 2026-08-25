import { describe, expect, it } from "vitest";
import PDFDocument from "pdfkit";
import { createProspectReportDocument, renderProspectReport } from "../../utils/pdfGenerator";
import type { Contact, DueDiligence, ProspectWithCompany } from "@shared/schema";

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

const manyContacts: Contact[] = Array.from({ length: 12 }, (_, i) => ({
  prospectId: 1,
  name: `Contact ${i}`,
  email: `contact${i}@example.com`,
  phone: "0121 000 0000",
  role: "Director",
  isPrimary: i === 0 ? 1 : 0,
}));

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
            means: "Sufficient net assets to support the facility.",
            purpose: "Working capital to refinance a daily MCA.",
            amount: "£150,000 requested.",
            repayment: "Serviced from trading cashflow.",
            insurance: "Directors' guarantee in place.",
          },
        },
        financialAnalysis: {
          dscr: 1.35,
          redFlags: ["Declining turnover in Q3", { label: "Late VAT filing", isActive: true }],
        },
        accountsAnalysis: {
          riskAssessment: "medium",
          auditorOpinion: "Unqualified",
          concerns: ["Rising creditor days"],
          summary: "Accounts show steady but slowing growth.",
        },
        adverseMedia: {
          riskLevel: "LOW",
          summary: "No adverse findings.",
          flags: [],
        },
        ...overrides,
      },
    } as any,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  } as DueDiligence;
}

async function renderToBuffer(data: Parameters<typeof renderProspectReport>[1]): Promise<Buffer> {
  const doc = createProspectReportDocument(data as any);
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  renderProspectReport(doc, data as any);
  doc.end();
  await new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", reject);
  });
  return Buffer.concat(chunks);
}

describe("renderProspectReport", () => {
  it("renders a full report without throwing and produces PDF bytes", async () => {
    const buffer = await renderToBuffer({
      prospect: prospect(),
      contacts: manyContacts,
      activities: [],
      dueDiligence: dueDiligence(),
      companiesHouseData: null,
    });
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders with no due diligence / companies house data without throwing", async () => {
    const buffer = await renderToBuffer({
      prospect: prospect({ adviserRecommendation: null, adviserRecommendationSignedBy: null }),
      contacts: [],
      activities: [],
      dueDiligence: undefined,
      companiesHouseData: undefined,
    });
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("shows the real adviser recommendation instead of the old hardcoded placeholder", async () => {
    // The signature block used to always print "No recommendation provided." even when
    // prospect.adviserRecommendation / underwriting.adviserSummary.recommendation was set.
    // Use an uncompressed doc so the recommendation text is greppable in the raw bytes.
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true, compress: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const data = {
      prospect: prospect(),
      contacts: [],
      activities: [],
      dueDiligence: dueDiligence(),
      companiesHouseData: null,
    };
    renderProspectReport(doc as any, data as any);
    doc.end();
    await new Promise<void>((resolve, reject) => {
      doc.on("end", () => resolve());
      doc.on("error", reject);
    });
    const raw = Buffer.concat(chunks).toString("latin1");
    // PDFKit emits text as hex-encoded glyph runs (<hex> ... TJ), not literal ASCII —
    // reassemble them in stream order to search for the rendered sentence.
    const decoded = Array.from(raw.matchAll(/<([0-9a-fA-F]+)>/g))
      .map((m) => {
        const hex = m[1];
        let out = "";
        for (let i = 0; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
        return out;
      })
      .join("");

    expect(decoded).toContain("Supportable subject to statements.");
    expect(decoded).not.toContain("No recommendation provided.");
  });
});
