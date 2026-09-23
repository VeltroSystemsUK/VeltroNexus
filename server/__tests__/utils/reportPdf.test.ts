import { describe, expect, it } from "vitest";
import type { ReportSettings, ReportTask } from "@shared/schema";
import { generateProgressReportPdf, generateWorksheetPdf } from "../../utils/reportPdf";

function settings(overrides: Partial<ReportSettings> = {}): ReportSettings {
  return {
    userId: "u1",
    recipientName: "David Griffiths",
    recipientEmail: "david@example.com",
    preparedByName: "Shaun Tuhey",
    projectCode: "STRATA-NEXUS-INT-001",
    executiveSummary: "",
    weekAnchorDate: "",
    weekAnchorNumber: 1,
    monthlyFee: "£2,500.00",
    weeklyPayment: "£625.00",
    weeklyHours: "30 hours",
    autoSendWorksheet: true,
    autoSendProgress: true,
    skipNextWorksheet: false,
    skipNextProgress: false,
    ...overrides,
  };
}

function task(overrides: Partial<ReportTask> = {}): ReportTask {
  return {
    userId: "u1",
    title: "Ship pack upload",
    notes: null,
    timeSlot: null,
    dueDate: new Date("2026-09-02"),
    status: "done",
    completedAt: new Date("2026-09-02T16:00:00.000Z"),
    createdAt: new Date("2026-09-01"),
    updatedAt: new Date("2026-09-02"),
    ...overrides,
  } as ReportTask;
}

function decodePdf(raw: string): string {
  return Array.from(raw.matchAll(/<([0-9a-fA-F]+)>/g))
    .map((m) => {
      const hex = m[1];
      let out = "";
      for (let i = 0; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
      return out;
    })
    .join("");
}

describe("generateProgressReportPdf", () => {
  it("puts a sales activity overview and inbound prospects in Additional Activity", async () => {
    const pdf = await generateProgressReportPdf({
      weekNumber: 5,
      weekStart: new Date("2026-08-31"),
      weekEnd: new Date("2026-09-04"),
      settings: settings(),
      completedPlanned: [task()],
      completedExtra: [task({ title: "Fix tracking pixel", dueDate: null })],
      upcoming: [],
      salesActivity: {
        emailsSent: 12,
        emailsOpened: 4,
        linksClicked: 2,
        repliesReceived: 1,
        inboundProspects: [{ companyName: "Acme Joinery Ltd", contactName: "Jane Smith" }],
      },
      summaryText: "We shipped pack upload so inbound files land without a chase.",
    });
    const text = decodePdf(pdf.toString("latin1"));
    expect(text).toContain("ADDITIONAL ACTIVITY");
    expect(text).toContain("Emails sent");
    expect(text).toContain("12");
    expect(text).toContain("Emails opened");
    expect(text).toContain("Acme Joinery Ltd");
    expect(text).toContain("Jane Smith");
    expect(text).toContain("stratafinance.co.uk");
    expect(text).toContain("We shipped pack upload so inbound files land without a chase.");
    const pages = Number(pdf.toString("latin1").match(/\/Count\s+(\d+)/)?.[1] || 0);
    expect(pages).toBeGreaterThan(0);
    expect(pages).toBeLessThanOrEqual(2);
  });

  it("uses a sign-off block instead of counter-approval", async () => {
    const pdf = await generateProgressReportPdf({
      weekNumber: 5,
      weekStart: new Date("2026-08-31"),
      weekEnd: new Date("2026-09-04"),
      settings: settings(),
      completedPlanned: [],
      completedExtra: [],
      upcoming: [],
      salesActivity: {
        emailsSent: 0,
        emailsOpened: 0,
        linksClicked: 0,
        repliesReceived: 0,
        inboundProspects: [],
      },
    });
    const text = decodePdf(pdf.toString("latin1"));
    expect(text).toContain("SIGN-OFF");
    expect(text).toContain("Shaun Tuhey");
    expect(text).not.toContain("APPROVAL");
    expect(text).not.toContain("Approved by");
    expect(text).not.toMatch(/parties confirm agreement/i);
    const pages = Number(pdf.toString("latin1").match(/\/Count\s+(\d+)/)?.[1] || 0);
    expect(pages).toBeGreaterThan(0);
    expect(pages).toBeLessThanOrEqual(2);
  });
});

function pdfPageCount(pdf: Buffer): number {
  return Number(pdf.toString("latin1").match(/\/Count\s+(\d+)/)?.[1] || 0);
}

describe("generateWorksheetPdf", () => {
  it("still requires two-party approval on the worksheet", async () => {
    const pdf = await generateWorksheetPdf({
      weekNumber: 5,
      weekStart: new Date("2026-08-31"),
      weekEnd: new Date("2026-09-04"),
      settings: settings(),
      tasks: [task({ status: "todo", completedAt: null })],
    });
    const text = decodePdf(pdf.toString("latin1"));
    expect(text).toContain("APPROVAL");
    expect(text).toContain("Approved by");
  });

  it("does not pad a full week with blank pages", async () => {
    const weekStart = new Date(2026, 7, 31); // Mon 31 Aug
    const rows: Array<[string, string, number]> = [
      ["Finalize hopper-based ranking and sendable-contact gate", "Complete the scoring and gating logic for the agentic outreach queue.", 0],
      ["Complete Social Media Board", "Automated social media outreach campaigns", 0],
      ["Ensure that all website links work", "Final weblink tests", 0],
      ["Complete non-bank Companies House charge classification", "Finish classifying live charges to refine outreach targeting.", 1],
      ["Complete Editorial Platform", "Blogs & Press Release Management System", 1],
      ["First Marketing Campaign", "Outreach to 100 potential new customers", 1],
      ["Finalize Credit Memo and report output formatting", "Close out the carried-forward formatting work for Credit Memo and risk scorecard outputs.", 2],
      ["Campaign Temperature", "Check success rate of first marketing campaign", 2],
      ["Complete remaining CDFI lender documentation set-up", "Finish outstanding documentation beyond CWRT, BCRS and FFE packs.", 3],
      ["Finalize 12-month trading gate (SIG-01)", "Implement the trading-history filter to keep outreach targeted at qualifying SMEs.", 3],
      ["Complete reactivation outreach scripts", "Finish the in-progress scripts for re-engaging lapsed leads.", 3],
      ["Complete first-touch outreach scripts", "Finish the in-progress scripts for initial SME contact.", 3],
      ["Finalize new agentic outreach templates", "Complete the templates being developed for the agentic outreach queue.", 3],
    ];
    const tasks = rows.map(([title, notes, day]) =>
      task({
        title,
        notes,
        dueDate: new Date(2026, 7, 31 + day, 12, 0, 0),
        status: "todo",
        completedAt: null,
      }),
    );
    const pdf = await generateWorksheetPdf({
      weekNumber: 5,
      weekStart,
      weekEnd: new Date(2026, 8, 4, 23, 59, 59, 999),
      settings: settings({
        executiveSummary: [
          "Weeks 1-4 delivered the core Nexus build: the four-stage verification pipeline (Companies House, Google Places, HMRC/TTP screening, CDFI routing), the front-end integration between www.stratafinance.co.uk and the Nexus backend, the automated Credit Memo and risk scorecard, and the initial SME prospect database (2,734 leads cleansed and loaded).",
          "Creditsafe API added to Underwriting process.",
          "Standard CDFI lender application packs were configured for CWRT, BCRS and FFE, and a separate Sterling App prototype was built for demo use. Current focus (Week 5) is scaling the outbound lead-generation engine: hopper-based ranking and a sendable contact gate for the agentic outreach queue, classification of live non-bank Companies House charges, and a 12-month trading gate (SIG-01) to keep outreach targeted at qualifying SMEs. Reactivation and first-touch outreach scripts are in progress alongside new agentic outreach templates.",
          "Open items carried forward: final Credit Memo/report output formatting, remaining CDFI documentation set-up, and the start of the social media campaign once outreach volumes are confirmed.",
        ].join("\n\n"),
        weeklyHours: "30 hours (6 hours/day, 5 days/week)",
      }),
      tasks,
    });
    const pages = pdfPageCount(pdf);
    expect(pages).toBeGreaterThan(0);
    expect(pages).toBeLessThanOrEqual(3);
    const text = decodePdf(pdf.toString("latin1"));
    expect(text).toContain("WEEK OBJECTIVES");
    expect(text).toContain("DAILY BREAKDOWN");
    expect(text).toContain("APPROVAL");
  });
});
