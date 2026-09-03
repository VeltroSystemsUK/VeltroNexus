import { Router } from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { insertReportTaskSchema, updateReportSettingsSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { buildWorksheetForUser, buildProgressReportForUser, sendReport, runTodoAgent } from "../services/reportingService";

const REPORTS_DIR = path.resolve(process.cwd(), "uploads", "reports");

const router = Router();

// --- Task board ---

router.get("/reporting/tasks", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const tasks = await storage.listReportTasks(req.user!.id);
    res.json(tasks);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/reporting/tasks", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const result = insertReportTaskSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: fromZodError(result.error).toString() });
    }
    const task = await storage.createReportTask(result.data, req.user!.id);
    res.json(task);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.patch("/reporting/tasks/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid task ID" });
    const task = await storage.updateReportTask(id, req.user!.id, req.body);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.delete("/reporting/tasks/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid task ID" });
    await storage.deleteReportTask(id, req.user!.id);
    res.json({ success: true });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// --- To-do agent: identifies follow-up work from the state of play and logs it as tasks ---

router.post("/reporting/todo-agent/run", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const created = await runTodoAgent(req.user!.id);
    res.json({ created });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// --- Settings (recipient, boilerplate text, auto-send toggles) ---

router.get("/reporting/settings", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const settings = await storage.getReportSettings(req.user!.id);
    res.json(settings || null);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.patch("/reporting/settings", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const result = updateReportSettingsSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: fromZodError(result.error).toString() });
    }
    const settings = await storage.upsertReportSettings(req.user!.id, result.data);
    res.json(settings);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// --- History ---

router.get("/reporting/logs", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const logs = await storage.listReportLogs(req.user!.id);
    res.json(logs.sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime()));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// --- Live preview: always reflects the current task board, no side effects ---

router.get("/reporting/preview/:type", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const userId = req.user!.id;
    const built = type === "worksheet"
      ? await buildWorksheetForUser(userId)
      : type === "progress"
        ? await buildProgressReportForUser(userId)
        : null;
    if (!built) return res.status(400).json({ error: "Unknown report type" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="preview-${type}.pdf"`);
    res.send(built.pdf);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// --- Open the exact PDF that was sent for a given history entry ---

router.get("/reporting/logs/:id/pdf", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid log ID" });
    const log = await storage.getReportLog(id, req.user!.id);
    if (!log?.pdfFile) return res.status(404).json({ error: "No document on file for this report" });

    const filePath = path.join(REPORTS_DIR, path.basename(log.pdfFile));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Document file is missing" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${log.weekLabel.replace(/\s+/g, "_")}_${log.type}.pdf"`);
    res.sendFile(filePath);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

// --- Manual send: ignores auto-send/skip toggles, requires a recipient to be set ---

router.post("/reporting/send-now/:type", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const userId = req.user!.id;
    const settings = await storage.getReportSettings(userId);
    if (!settings?.recipientEmail) {
      return res.status(400).json({ error: "Set a recipient email in Reporting settings first." });
    }

    if (type === "worksheet") {
      const { pdf, weekNumber, weekTasks } = await buildWorksheetForUser(userId);
      await sendReport(userId, settings, "worksheet", weekNumber, pdf, weekTasks.length,
        `Operational Worksheet — Week ${weekNumber}`,
        `Please find attached the operational worksheet for Week ${weekNumber}.`);
    } else if (type === "progress") {
      const { pdf, weekNumber, completedPlanned, completedExtra } = await buildProgressReportForUser(userId);
      await sendReport(userId, settings, "progress", weekNumber, pdf, completedPlanned.length + completedExtra.length,
        `Week ${weekNumber} Progress Report`,
        `Please find attached the Week ${weekNumber} progress report.`);
    } else {
      return res.status(400).json({ error: "Unknown report type" });
    }

    res.json({ success: true });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

export default router;
