import crypto from "crypto";
import fs from "fs";
import path from "path";
import { withJsonFileLock } from "../server/utils/jsonFileLock";
import { parseCollectionsStore } from "../server/utils/collectionsStore";

const ROOT = path.resolve(process.cwd());
const STORE = path.join(ROOT, "uploads", "local_collections_store.json");
const REPORTS = path.join(ROOT, "uploads", "reports");
const USER_ID = "Auond2MCDRlSuiOXZQDo";
const now = new Date().toISOString();

function copyPdf(src: string): string {
  const name = `${crypto.randomUUID()}.pdf`;
  fs.copyFileSync(src, path.join(REPORTS, name));
  return name;
}

function task(
  id: number,
  title: string,
  notes: string,
  dueDate: string,
  status: "todo" | "done",
  completedAt: string | null,
): Record<string, unknown> {
  return {
    id,
    userId: USER_ID,
    title,
    notes,
    timeSlot: null,
    dueDate: `${dueDate}T09:00:00.000Z`,
    status,
    completedAt,
    createdAt: "2026-09-01T09:27:04.000Z",
    updatedAt: now,
  };
}

function main() {
  const worksheetPdf = copyPdf("F:\\Shaun\\Desktop\\Week 5 Worksheet.pdf");
  const progressPdf = copyPdf("F:\\Shaun\\Desktop\\Week 5 Progress.pdf");

  withJsonFileLock(STORE, () => {
    const data = parseCollectionsStore(fs.readFileSync(STORE, "utf8")) as Record<string, any[]>;
    const logs = [...(data.report_log || [])];
    const nextLogId = logs.reduce((m, row) => Math.max(m, Number(row.id) || 0), 0) + 1;

    if (!logs.some((row) => row.weekLabel === "Week 5" && row.type === "worksheet")) {
      logs.push({
        id: nextLogId,
        userId: USER_ID,
        type: "worksheet",
        weekLabel: "Week 5",
        recipient: "David Griffiths",
        taskCount: 13,
        status: "sent",
        sentAt: "2026-09-01T09:27:04.000Z",
        pdfFile: worksheetPdf,
        createdAt: "2026-09-01T09:27:04.000Z",
        updatedAt: now,
      });
    }
    if (!logs.some((row) => row.weekLabel === "Week 5" && row.type === "progress")) {
      logs.push({
        id: nextLogId + 1,
        userId: USER_ID,
        type: "progress",
        weekLabel: "Week 5",
        recipient: "David Griffiths",
        taskCount: 19,
        status: "sent",
        sentAt: "2026-09-04T14:59:40.000Z",
        pdfFile: progressPdf,
        createdAt: "2026-09-04T14:59:40.000Z",
        updatedAt: now,
      });
    }

    const existingTitles = new Set((data.report_tasks || []).map((row: any) => String(row.title)));
    const week5 = [
      task(1, "Finalize hopper-based ranking and sendable-contact gate", "Complete the scoring and gating logic for the agentic outreach queue.", "2026-09-01", "done", "2026-09-01T16:00:00.000Z"),
      task(2, "Complete Social Media Board", "Automated social media outreach campaigns", "2026-09-01", "done", "2026-09-01T16:00:00.000Z"),
      task(3, "Ensure that all website links work", "Final weblink tests", "2026-09-01", "done", "2026-09-01T16:00:00.000Z"),
      task(4, "Complete non-bank Companies House charge classification", "Finish classifying live charges to refine outreach targeting.", "2026-09-02", "done", "2026-09-02T16:00:00.000Z"),
      task(5, "Complete Editorial Platform", "Blogs & Press Release Management System", "2026-09-02", "done", "2026-09-02T16:00:00.000Z"),
      task(6, "First Marketing Campaign", "Outreach to 100 potential new customers", "2026-09-02", "done", "2026-09-02T16:00:00.000Z"),
      task(7, "Finalize Credit Memo and report output formatting", "Close out the carried-forward formatting work for Credit Memo and risk scorecard outputs.", "2026-09-03", "todo", null),
      task(8, "Campaign Temperature", "Check success rate of first marketing campaign", "2026-09-03", "done", "2026-09-03T16:00:00.000Z"),
      task(9, "Complete remaining CDFI lender documentation set-up", "Finish outstanding documentation beyond CWRT, BCRS and FFE packs.", "2026-09-04", "todo", null),
      task(10, "Finalize 12-month trading gate (SIG-01)", "Implement the trading-history filter to keep outreach targeted at qualifying SMEs.", "2026-09-04", "done", "2026-09-04T16:00:00.000Z"),
      task(11, "Complete reactivation outreach scripts", "Finish the in-progress scripts for re-engaging lapsed leads.", "2026-09-04", "done", "2026-09-04T16:00:00.000Z"),
      task(12, "Complete first-touch outreach scripts", "Finish the in-progress scripts for initial SME contact.", "2026-09-04", "done", "2026-09-04T16:00:00.000Z"),
      task(13, "Finalize new agentic outreach templates", "Complete the templates being developed for the agentic outreach queue.", "2026-09-04", "done", "2026-09-04T16:00:00.000Z"),
      task(14, "Validate Creditsafe API integration in underwriting workflow", "Confirm the newly added Creditsafe API is functioning correctly within the underwriting process.", "2026-09-04", "done", "2026-09-04T16:00:00.000Z"),
      task(15, "Series of 5 Promo Videos", "Promotional Videos for Strata Finance Launch - to be released sequentially over first two weeks.", "2026-09-02", "done", "2026-09-02T16:00:00.000Z"),
      task(16, "Lead Uploads", "Now have 7408 data cleansed and enriched leads on database", "2026-09-03", "done", "2026-09-03T16:00:00.000Z"),
      task(17, "Learn Hub Build", "Build a Learning Hub for customers to access real-time blogs and information to foster trust and engagement", "2026-09-03", "done", "2026-09-03T16:00:00.000Z"),
    ].filter((row) => !existingTitles.has(String(row.title)));

    const tasks = [...(data.report_tasks || []), ...week5];
    data.report_log = logs;
    data.report_tasks = tasks;

    const tmp = `${STORE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, STORE);
    console.log(`week5 worksheet ${worksheetPdf}`);
    console.log(`week5 progress ${progressPdf}`);
    console.log(`logs ${logs.length} tasks ${tasks.length} added ${week5.length}`);
  });
}

main();
