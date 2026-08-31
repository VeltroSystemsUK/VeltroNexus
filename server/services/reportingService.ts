import cron from "node-cron";
import { storage } from "../storage";
import { sendEmail } from "./email";
import { generateWorksheetPdf, generateProgressReportPdf } from "../utils/reportPdf";
import type { ReportTask, ReportSettings } from "@shared/schema";

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

function withDefaults(settings: Partial<ReportSettings> | undefined, userId: string): ReportSettings {
  return {
    id: settings?.id,
    userId,
    recipientName: settings?.recipientName || "David Griffiths",
    recipientEmail: settings?.recipientEmail || "",
    preparedByName: settings?.preparedByName || "Shaun Tuhey",
    projectCode: settings?.projectCode || "STRATA-NEXUS-INT-001",
    executiveSummary: settings?.executiveSummary || "",
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

  const pdf = await generateWorksheetPdf({
    weekNumber: isoWeekNumber(weekStart),
    weekStart,
    weekEnd,
    settings,
    tasks: weekTasks,
  });

  return { pdf, settings, weekTasks, weekStart, weekEnd, weekNumber: isoWeekNumber(weekStart) };
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

  const pdf = await generateProgressReportPdf({
    weekNumber: isoWeekNumber(weekStart),
    weekStart,
    weekEnd,
    settings,
    completedPlanned,
    completedExtra,
    upcoming,
  });

  return { pdf, settings, completedPlanned, completedExtra, upcoming, weekStart, weekEnd, weekNumber: isoWeekNumber(weekStart) };
}

async function dispatchWorksheet(userId: string) {
  const settings = withDefaults(await storage.getReportSettings(userId), userId);
  if (!settings.autoSendWorksheet || !settings.recipientEmail) return;
  if (settings.skipNextWorksheet) {
    await storage.upsertReportSettings(userId, { skipNextWorksheet: false });
    await storage.createReportLog({
      userId, type: "worksheet", weekLabel: `Week ${isoWeekNumber(new Date())}`,
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
      userId, type: "progress", weekLabel: `Week ${isoWeekNumber(new Date())}`,
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

  await storage.createReportLog({
    userId,
    type,
    weekLabel: `Week ${weekNumber}`,
    recipient: settings.recipientEmail,
    taskCount,
    status,
    sentAt: new Date(),
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
