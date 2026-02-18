import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { fromZodError } from "zod-validation-error";
import { insertActivitySchema, insertTimeEntrySchema } from "@shared/schema";

const router = Router();

// ── Activities ──────────────────────────────────────────────────────────────

router.get("/activities", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const activities = await storage.listAllUserActivities(userId);
        res.json(activities);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.post("/activities", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        // SECURITY: Strip userId from request body to prevent injection attacks
        const { userId: _, ...safeBody } = req.body;
        const result = insertActivitySchema.safeParse(safeBody);
        if (!result.success) {
            return res.status(400).json({ error: fromZodError(result.error).toString() });
        }
        const activity = await storage.createActivity(result.data, userId);
        if (!activity) {
            return res
                .status(403)
                .json({ error: "Access denied - prospect not found or not owned by user" });
        }
        res.json(activity);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.get("/prospects/:prospectId/activities", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user!.id;
        const activities = await storage.listActivities(prospectId, userId);
        res.json(activities);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.post("/prospects/:prospectId/activities", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);
        // SECURITY: Strip userId from request body to prevent injection attacks
        const { userId: _, ...safeBody } = req.body;
        const result = insertActivitySchema.safeParse({ ...safeBody, prospectId });
        if (!result.success) {
            return res.status(400).json({ error: fromZodError(result.error).toString() });
        }
        const activity = await storage.createActivity(result.data, userId);
        if (!activity) {
            return res
                .status(403)
                .json({ error: "Access denied - prospect not found or not owned by user" });
        }
        res.json(activity);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.patch("/activities/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const userId = req.user!.id;
        const activity = await storage.updateActivity(id, userId, req.body);
        if (!activity) {
            return res.status(404).json({ error: "Activity not found or access denied" });
        }
        res.json(activity);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.delete("/activities/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const userId = req.user!.id;
        await storage.deleteActivity(id, userId);
        res.json({ success: true });
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

// ── Time Entries ─────────────────────────────────────────────────────────────

router.get("/prospects/:prospectId/time-entries", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user!.id;
        const entries = await storage.listTimeEntries(prospectId, userId);
        res.json(entries);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.get("/prospects/:prospectId/time-total", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user!.id;
        const totalMinutes = await storage.getProspectTotalTime(prospectId, userId);
        res.json({ totalMinutes });
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.post("/prospects/:prospectId/time-entries", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user!.id;
        const parsed = insertTimeEntrySchema.safeParse({ ...req.body, prospectId });
        if (!parsed.success) {
            return res.status(400).json({ error: fromZodError(parsed.error).message });
        }
        const entry = await storage.createTimeEntry(parsed.data, userId);
        res.status(201).json(entry);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.patch("/time-entries/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const userId = req.user!.id;
        const entry = await storage.updateTimeEntry(id, req.body, userId);
        if (!entry) {
            return res.status(404).json({ error: "Time entry not found or access denied" });
        }
        res.json(entry);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.delete("/time-entries/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const userId = req.user!.id;
        await storage.deleteTimeEntry(id, userId);
        res.json({ success: true });
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

export default router;
