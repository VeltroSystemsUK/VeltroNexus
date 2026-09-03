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
});
