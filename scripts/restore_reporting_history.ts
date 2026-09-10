import fs from "fs";
import path from "path";
import { withJsonFileLock } from "../server/utils/jsonFileLock";
import { mergeCollections, parseCollectionsStore } from "../server/utils/collectionsStore";

const ROOT = path.resolve(process.cwd());
const STORE = path.join(ROOT, "uploads", "local_collections_store.json");
const USER_ID = "Auond2MCDRlSuiOXZQDo";
const now = new Date().toISOString();

const LOGS = [
  { pdfFile: "a7c3c605-eeee-4cdc-bf00-b78d8f4b32d3.pdf", type: "progress" as const, weekLabel: "Week 1", sentAt: "2026-08-14T13:35:28.000Z", taskCount: 10 },
  { pdfFile: "50d6edc7-6d0d-4070-9725-958f8038356f.pdf", type: "worksheet" as const, weekLabel: "Week 2", sentAt: "2026-08-14T13:39:10.000Z", taskCount: 0 },
  { pdfFile: "96f79b6e-14f9-488d-b7e9-b7ab8c81b96c.pdf", type: "worksheet" as const, weekLabel: "Week 2", sentAt: "2026-08-12T08:31:05.000Z", taskCount: 0 },
  { pdfFile: "51c7e77f-bfd4-4b3c-837f-ee846471f9f9.pdf", type: "progress" as const, weekLabel: "Week 2", sentAt: "2026-08-14T13:53:38.000Z", taskCount: 6 },
  { pdfFile: "f6d85397-b2cc-42fe-83a1-e7529d0d3efa.pdf", type: "worksheet" as const, weekLabel: "Week 3", sentAt: "2026-08-20T10:46:24.000Z", taskCount: 0 },
  { pdfFile: "be044bc9-23f3-43de-9b6c-04319c5f0642.pdf", type: "progress" as const, weekLabel: "Week 3", sentAt: "2026-08-21T13:42:01.000Z", taskCount: 10 },
  { pdfFile: "795056dd-9dd9-463f-98c8-223e749a9fcd.pdf", type: "worksheet" as const, weekLabel: "Week 4", sentAt: "2026-09-01T07:34:40.000Z", taskCount: 0 },
  { pdfFile: "807642a9-54d2-4dfa-bfb0-810185f2147c.pdf", type: "progress" as const, weekLabel: "Week 4", sentAt: "2026-09-01T07:34:27.000Z", taskCount: 9 },
];

function main() {
  withJsonFileLock(STORE, () => {
    const data = parseCollectionsStore(fs.readFileSync(STORE, "utf8")) as Record<string, any[]>;
    const backup = path.join(ROOT, "scripts", "backups", `collections_before_reporting_restore_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.writeFileSync(backup, JSON.stringify(data));

    const logs = LOGS.map((row, i) => ({
      id: i + 1,
      userId: USER_ID,
      type: row.type,
      weekLabel: row.weekLabel,
      recipient: "David Griffiths",
      taskCount: row.taskCount,
      status: "sent",
      sentAt: row.sentAt,
      pdfFile: row.pdfFile,
      createdAt: row.sentAt,
      updatedAt: now,
    }));

    const settings = [
      {
        id: 1,
        userId: USER_ID,
        recipientName: "David Griffiths",
        recipientEmail: "david@sterlingcapitalreserve.co.uk",
        preparedByName: "Shaun Tuhey",
        projectCode: "STRATA-NEXUS-INT-001",
        executiveSummary: "",
        weekAnchorDate: "2026-08-03",
        weekAnchorNumber: 1,
        monthlyFee: "£2,500.00",
        weeklyPayment: "£625.00",
        weeklyHours: "30 hours (6 hours/day, 5 days/week)",
        autoSendWorksheet: true,
        autoSendProgress: true,
        skipNextWorksheet: false,
        skipNextProgress: false,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const merged = mergeCollections(data, {
      report_log: logs,
      report_settings: settings,
      report_tasks: data.report_tasks || [],
    }) as Record<string, any[]>;

    const tmp = `${STORE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(merged, null, 2));
    fs.renameSync(tmp, STORE);
    console.log(`restored ${logs.length} report logs, settings, backup ${backup}`);
  });
}

main();
