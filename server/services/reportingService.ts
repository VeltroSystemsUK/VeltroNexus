import cron from "node-cron";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { storage } from "../storage";
import { sendEmail } from "./email";
import { houseAskWithEngine } from "./caseyScout";
import { generateWorksheetPdf, generateProgressReportPdf } from "../utils/reportPdf";
import { listAgentMail } from "./agentMailLog";
import { isInboundLead } from "./inboundPipeline";
import {
  buildProgressSummaryPrompt,
  fallbackProgressSummary,
  PROGRESS_SUMMARY_SYSTEM,
  summarizeWeeklySalesActivity,
  type WeeklySalesActivity,
} from "@shared/progressReport";
import type { ReportTask, ReportSettings } from "@shared/schema";

const REPORTS_DIR = path.resolve(process.cwd(), "uploads", "reports");

function savePdfFile(pdf: Buffer): string {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.pdf`;
  fs.writeFileSync(path.join(REPORTS_DIR, filename), pdf);
  return filename;
}

const TIMEZONE = "Europe/London";
const DAY_MS = 86400000;

function startOfWeekMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
}

// Project week number, anchored to a user-defined week in Report Settings
// (e.g. "w/c 31/08/26 is Week 5") instead of the calendar's ISO week.
// Falls back to the ISO week if no anchor is set.
function projectWeekNumber(weekStartMonday: Date, settings: ReportSettings): number {
  if (!settings.weekAnchorDate) return isoWeekNumber(weekStartMonday);
  const anchorMonday = startOfWeekMonday(new Date(settings.weekAnchorDate));
  const weeksDiff = Math.round((weekStartMonday.getTime() - anchorMonday.getTime()) / (7 * DAY_MS));
  return settings.weekAnchorNumber + weeksDiff;
}

function withDefaults(settings: Partial<ReportSettings> | undefined, userId: string): ReportSettings {
  return {
    id: settings?.id,
    userId,
    recipientName: settings?.recipientName || "David Griffiths",
    recipientEmail: settings?.recipientEmail || "",
    preparedByName: settings?.preparedByName || "Shaun Tuhey",
    projectCode: settings?.projectCode || "STRATA-NEXUS-INT-001",
    executiveSummary: settings?.executiveSummary || "",
    weekAnchorDate: settings?.weekAnchorDate || "",
    weekAnchorNumber: settings?.weekAnchorNumber ?? 1,
    monthlyFee: settings?.monthlyFee || "£2,500.00",
    weeklyPayment: settings?.weeklyPayment || "£625.00",
    weeklyHours: settings?.weeklyHours || "30 hours (6 hours/day, 5 days/week)",
    autoSendWorksheet: settings?.autoSendWorksheet ?? true,
    autoSendProgress: settings?.autoSendProgress ?? true,
    skipNextWorksheet: settings?.skipNextWorksheet ?? false,
    skipNextProgress: settings?.skipNextProgress ?? false,
    createdAt: settings?.createdAt as any,
    updatedAt: settings?.updatedAt as any,
  };
}

export async function buildWorksheetForUser(userId: string, refDate: Date = new Date()) {
  const settings = withDefaults(await storage.getReportSettings(userId), userId);
  const allTasks = await storage.listReportTasks(userId);
  const weekStart = startOfWeekMonday(refDate);
  const weekEnd = new Date(weekStart.getTime() + 4 * DAY_MS);
  weekEnd.setHours(23, 59, 59, 999);

  const weekTasks = allTasks.filter((t) => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate as any);
    return d >= weekStart && d <= weekEnd;
  });

  const weekNumber = projectWeekNumber(weekStart, settings);
  const pdf = await generateWorksheetPdf({
    weekNumber,
    weekStart,
    weekEnd,
    settings,
    tasks: weekTasks,
  });

  return { pdf, settings, weekTasks, weekStart, weekEnd, weekNumber };
}

export async function buildProgressReportForUser(userId: string, refDate: Date = new Date()) {
  const settings = withDefaults(await storage.getReportSettings(userId), userId);
  const allTasks = await storage.listReportTasks(userId);
  const weekStart = startOfWeekMonday(refDate);
  const weekEnd = new Date(weekStart.getTime() + 4 * DAY_MS);
  weekEnd.setHours(23, 59, 59, 999);
  const nextWeekStart = new Date(weekStart.getTime() + 7 * DAY_MS);
  const nextWeekEnd = new Date(nextWeekStart.getTime() + 4 * DAY_MS);

  const doneThisWeek = allTasks.filter((t) => {
    if (t.status !== "done" || !t.completedAt) return false;
    const d = new Date(t.completedAt as any);
    return d >= weekStart && d <= weekEnd;
  });
  const completedPlanned = doneThisWeek.filter((t) => t.dueDate);
  const completedExtra = doneThisWeek.filter((t) => !t.dueDate);

  const upcoming = allTasks.filter((t) => {
    if (t.status === "done" || !t.dueDate) return false;
    const d = new Date(t.dueDate as any);
    return d >= nextWeekStart && d <= nextWeekEnd;
  });

  const weekNumber = projectWeekNumber(weekStart, settings);
  const inboundLeads = (await storage.listInternalLeads()).filter(isInboundLead);
  const salesActivity = summarizeWeeklySalesActivity({
    mail: listAgentMail(2000),
    inboundLeads,
    weekStart,
    weekEnd,
  });
  const summaryText = await composeProgressSummary({
    weekNumber,
    completedPlanned: completedPlanned.map((t) => t.title),
    completedExtra: completedExtra.map((t) => t.title),
    sales: salesActivity,
  });
  const pdf = await generateProgressReportPdf({
    weekNumber,
    weekStart,
    weekEnd,
    settings,
    completedPlanned,
    completedExtra,
    upcoming,
    salesActivity,
    summaryText,
  });

  return { pdf, settings, completedPlanned, completedExtra, upcoming, weekStart, weekEnd, weekNumber, salesActivity, summaryText };
}

export async function composeProgressSummary(
  input: {
    weekNumber: number;
    completedPlanned: string[];
    completedExtra: string[];
    sales: WeeklySalesActivity;
  },
  ask: typeof houseAskWithEngine = houseAskWithEngine,
): Promise<string> {
  try {
    const { text } = await ask(buildProgressSummaryPrompt(input), undefined, PROGRESS_SUMMARY_SYSTEM);
    const cleaned = (text || "").trim();
    if (cleaned) return cleaned;
  } catch (err) {
    console.error("[Reporting] Progress summary AI failed:", err);
  }
  return fallbackProgressSummary(input);
}

// To-do agent: reads the current state-of-play and open tasks, proposes follow-up
// tasks grounded in that text (never invents unrelated work), and logs them to the board.
const TODO_AGENT_SYSTEM = "You are a delivery-focused project assistant for a small software/finance operation. You only ever suggest follow-up tasks that are directly grounded in the notes you're given — never invent unrelated work or specifics not implied by the text.";

export async function runTodoAgent(userId: string): Promise<ReportTask[]> {
  const settings = withDefaults(await storage.getReportSettings(userId), userId);
  const allTasks = await storage.listReportTasks(userId);
  const openTitles = allTasks.filter((t) => t.status !== "done").map((t) => t.title);

  const prompt = [
    "Current state of play for this project:",
    settings.executiveSummary?.trim() || "(no state-of-play notes recorded)",
    "",
    "Tasks already open on the board — do not repeat these:",
    openTitles.length ? openTitles.map((t) => `- ${t}`).join("\n") : "(none)",
    "",
    'Based only on the state of play above, identify up to 4 concrete follow-up tasks that still need doing and are not already listed. Do not invent details not implied by the text. Return ONLY a JSON array of objects with "title" (short, actionable, under 80 characters) and "notes" (one short sentence, optional). If nothing new is warranted, return [].',
  ].join("\n");

  const { text } = await houseAskWithEngine(prompt, undefined, TODO_AGENT_SYSTEM);

  let suggestions: Array<{ title?: string; notes?: string }> = [];
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    suggestions = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    return [];
  }

  // Give each task a due date inside the current Mon-Fri worksheet week (never in the
  // past) — the worksheet only pulls tasks that have a dueDate, so an undated task
  // would be added to the board but never show up in "Week Objectives" / "Daily Breakdown".
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = startOfWeekMonday(today);
  const weekEnd = new Date(weekStart.getTime() + 4 * DAY_MS);
  const scheduleStart = today > weekStart ? today : weekStart;

  const existingLower = new Set(allTasks.map((t) => t.title.trim().toLowerCase()));
  const created: ReportTask[] = [];
  let slot = 0;
  for (const s of suggestions) {
    const title = (s.title || "").trim();
    if (!title || existingLower.has(title.toLowerCase())) continue;
    const dueDate = new Date(Math.min(scheduleStart.getTime() + slot * DAY_MS, weekEnd.getTime()));
    const task = await storage.createReportTask(
      { title, notes: s.notes?.trim() || null, timeSlot: null, dueDate, status: "todo" },
      userId,
    );
    created.push(task);
    existingLower.add(title.toLowerCase());
    slot++;
  }
  return created;
}

async function dispatchWorksheet(userId: string) {
  const settings = withDefaults(await storage.getReportSettings(userId), userId);
  if (!settings.autoSendWorksheet || !settings.recipientEmail) return;
  if (settings.skipNextWorksheet) {
    await storage.upsertReportSettings(userId, { skipNextWorksheet: false });
    await storage.createReportLog({
      userId, type: "worksheet", weekLabel: `Week ${projectWeekNumber(startOfWeekMonday(new Date()), settings)}`,
      recipient: settings.recipientEmail, taskCount: 0, status: "skipped", sentAt: new Date(),
    });
    return;
  }

  const { pdf, weekNumber, weekTasks } = await buildWorksheetForUser(userId);
  await sendReport(userId, settings, "worksheet", weekNumber, pdf, weekTasks.length,
    `Operational Worksheet — Week ${weekNumber}`,
    `Please find attached the operational worksheet for Week ${weekNumber}.`);
}

async function dispatchProgress(userId: string) {
  const settings = withDefaults(await storage.getReportSettings(userId), userId);
  if (!settings.autoSendProgress || !settings.recipientEmail) return;
  if (settings.skipNextProgress) {
    await storage.upsertReportSettings(userId, { skipNextProgress: false });
    await storage.createReportLog({
      userId, type: "progress", weekLabel: `Week ${projectWeekNumber(startOfWeekMonday(new Date()), settings)}`,
      recipient: settings.recipientEmail, taskCount: 0, status: "skipped", sentAt: new Date(),
    });
    return;
  }

  const { pdf, weekNumber, completedPlanned, completedExtra } = await buildProgressReportForUser(userId);
  await sendReport(userId, settings, "progress", weekNumber, pdf, completedPlanned.length + completedExtra.length,
    `Week ${weekNumber} Progress Report`,
    `Please find attached the Week ${weekNumber} progress report.`);
}

async function sendReport(
  userId: string,
  settings: ReportSettings,
  type: "worksheet" | "progress",
  weekNumber: number,
  pdf: Buffer,
  taskCount: number,
  subject: string,
  body: string,
) {
  const filename = type === "worksheet"
    ? `Operational_Worksheet_Week${weekNumber}.pdf`
    : `Week${weekNumber}_Progress_Report.pdf`;

  let status: "sent" | "failed" = "sent";
  try {
    await sendEmail({}, settings.recipientEmail, subject, body, {}, [
      { filename, content: pdf, contentType: "application/pdf" },
    ]);
  } catch (err) {
    console.error(`[Reporting] Failed to send ${type} report:`, err);
    status = "failed";
  }

  const pdfFile = savePdfFile(pdf);

  await storage.createReportLog({
    userId,
    type,
    weekLabel: `Week ${weekNumber}`,
    recipient: settings.recipientEmail,
    taskCount,
    status,
    sentAt: new Date(),
    pdfFile,
  });
}

async function forEachConfiguredUser(fn: (userId: string) => Promise<void>) {
  const users = await storage.getAllUsers();
  for (const user of users) {
    const settings = await storage.getReportSettings(user.id);
    if (!settings?.recipientEmail) continue;
    try {
      await fn(user.id);
    } catch (err) {
      console.error(`[Reporting] Failed processing user ${user.id}:`, err);
    }
  }
}

class ReportingService {
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;

    // Mon 09:45 — comfortably before the 10am deadline
    cron.schedule("45 9 * * 1", () => {
      forEachConfiguredUser(dispatchWorksheet);
    }, { timezone: TIMEZONE });

    // Fri 15:00
    cron.schedule("0 15 * * 5", () => {
      forEachConfiguredUser(dispatchProgress);
    }, { timezone: TIMEZONE });

    console.log("[Reporting] Weekly worksheet (Mon 09:45) and progress report (Fri 15:00) scheduled.");
  }
}

export const reportingService = new ReportingService();
export { dispatchWorksheet, dispatchProgress, sendReport };
