import { describe, expect, it } from "vitest";
import {
  buildProgressSummaryPrompt,
  fallbackProgressSummary,
  formatInboundProspectLine,
  summarizeWeeklySalesActivity,
} from "@shared/progressReport";

const weekStart = new Date("2026-08-31T00:00:00");
const weekEnd = new Date("2026-09-04T23:59:59.999");

describe("summarizeWeeklySalesActivity", () => {
  it("counts sent, opened, clicked, and replies inside the week and ignores the rest", () => {
    const summary = summarizeWeeklySalesActivity({
      weekStart,
      weekEnd,
      mail: [
        {
          direction: "outbound",
          status: "sent",
          createdAt: "2026-09-01T10:00:00.000Z",
          opens: ["2026-09-01T11:00:00.000Z"],
          clicks: [{ at: "2026-09-01T11:05:00.000Z", url: "https://stratafinance.co.uk/pack" }],
        },
        {
          direction: "outbound",
          status: "sent",
          createdAt: "2026-09-02T09:00:00.000Z",
        },
        {
          direction: "outbound",
          status: "sent",
          createdAt: "2026-08-20T09:00:00.000Z",
          opens: ["2026-09-01T10:00:00.000Z"],
        },
        { direction: "outbound", status: "mock", createdAt: "2026-09-01T12:00:00.000Z" },
        { direction: "outbound", status: "failed", createdAt: "2026-09-01T13:00:00.000Z" },
        { direction: "inbound", status: "received", createdAt: "2026-09-03T08:00:00.000Z" },
      ],
      inboundLeads: [
        { companyName: "Acme Joinery Ltd", contactName: "Jane Smith", createdAt: "2026-09-02T14:00:00.000Z" },
        { companyName: "Old Enquiry Ltd", contactName: "Past", createdAt: "2026-08-01T14:00:00.000Z" },
      ],
    });

    expect(summary.emailsSent).toBe(2);
    expect(summary.emailsOpened).toBe(1);
    expect(summary.linksClicked).toBe(1);
    expect(summary.repliesReceived).toBe(1);
    expect(summary.inboundProspects).toEqual([
      { companyName: "Acme Joinery Ltd", contactName: "Jane Smith" },
    ]);
  });

  it("treats unique opened emails, not pixel hits, as emails opened", () => {
    const summary = summarizeWeeklySalesActivity({
      weekStart,
      weekEnd,
      mail: [
        {
          direction: "outbound",
          status: "sent",
          createdAt: "2026-09-01T10:00:00.000Z",
          opens: ["2026-09-01T11:00:00.000Z", "2026-09-01T12:00:00.000Z"],
        },
      ],
      inboundLeads: [],
    });
    expect(summary.emailsOpened).toBe(1);
  });
});

describe("formatInboundProspectLine", () => {
  it("includes contact when present", () => {
    expect(formatInboundProspectLine({ companyName: "Acme Joinery Ltd", contactName: "Jane Smith" }))
      .toBe("Acme Joinery Ltd — Jane Smith");
    expect(formatInboundProspectLine({ companyName: "Beta Ltd" })).toBe("Beta Ltd");
  });
});

describe("progress summary copy", () => {
  it("grounds the AI prompt in completed work, sales activity, and inbound names", () => {
    const prompt = buildProgressSummaryPrompt({
      weekNumber: 5,
      completedPlanned: ["Ship pack upload"],
      completedExtra: ["Fix tracking pixel"],
      sales: {
        emailsSent: 12,
        emailsOpened: 4,
        linksClicked: 2,
        repliesReceived: 1,
        inboundProspects: [{ companyName: "Acme Joinery Ltd", contactName: "Jane Smith" }],
      },
    });
    expect(prompt).toMatch(/Week 5/);
    expect(prompt).toMatch(/Ship pack upload/);
    expect(prompt).toMatch(/Fix tracking pixel/);
    expect(prompt).toMatch(/Emails sent: 12/);
    expect(prompt).toMatch(/Emails opened: 4/);
    expect(prompt).toMatch(/Acme Joinery Ltd — Jane Smith/);
    expect(prompt).toMatch(/what was done/i);
    expect(prompt).toMatch(/why/i);
    expect(prompt).toMatch(/benefit/i);
  });

  it("writes a short factual fallback from the same inputs", () => {
    const text = fallbackProgressSummary({
      weekNumber: 5,
      completedPlanned: ["Ship pack upload"],
      completedExtra: [],
      sales: {
        emailsSent: 12,
        emailsOpened: 4,
        linksClicked: 2,
        repliesReceived: 1,
        inboundProspects: [{ companyName: "Acme Joinery Ltd", contactName: "Jane Smith" }],
      },
    });
    expect(text).toMatch(/Ship pack upload/);
    expect(text).toMatch(/12 emails/);
    expect(text).toMatch(/4 opened/);
    expect(text).toMatch(/Acme Joinery Ltd/);
    expect(text.length).toBeLessThan(600);
  });
});
