import { Router } from "express";
import type { Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { getReadableProspect } from "../utils/prospectAccess";
import {
  downloadStrataPack,
  generateStrataPack,
  getStrataCase,
  isStrataConfigured,
  patchStrataCase,
  refreshStrataPackaging,
  startStrataPackaging,
} from "../services/strataPackaging";
import { storage } from "../storage";

const router = Router();

router.get("/api/prospects/:prospectId/strata-packaging", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const prospectId = parseInt(req.params.prospectId);
    const prospect = await getReadableProspect(req, prospectId);
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    const refreshed = await refreshStrataPackaging(prospectId, prospect.userId).catch(() => null);
    const diligence = await storage.getDueDiligence(prospectId, prospect.userId);
    const record = refreshed || (diligence?.data as { strataPackaging?: unknown } | undefined)?.strataPackaging || null;
    res.json({
      configured: isStrataConfigured(),
      packaging: record,
    });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/prospects/:prospectId/strata-packaging", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const prospectId = parseInt(req.params.prospectId);
    const prospect = await getReadableProspect(req, prospectId);
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    const record = await startStrataPackaging({
      prospectId,
      userId: req.user!.id,
      notes: typeof req.body?.notes === "string" ? req.body.notes : undefined,
      triggeredBy: "studio",
    });
    res.json({ configured: isStrataConfigured(), packaging: record });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/prospects/:prospectId/strata-packaging/pack", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const prospectId = parseInt(req.params.prospectId);
    const prospect = await getReadableProspect(req, prospectId);
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    const diligence = await storage.getDueDiligence(prospectId, prospect.userId);
    const caseId = (diligence?.data as { strataPackaging?: { caseId?: string } } | undefined)?.strataPackaging?.caseId;
    if (!caseId) return res.status(400).json({ error: "Start the Strata packaging process first" });
    const pack = await generateStrataPack(caseId);
    res.json({
      ...pack,
      download: `/api/prospects/${prospectId}/strata-packaging/pack/download?file=${encodeURIComponent(pack.filename)}`,
    });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/prospects/:prospectId/strata-packaging/case", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const prospectId = parseInt(req.params.prospectId);
    const prospect = await getReadableProspect(req, prospectId);
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    const diligence = await storage.getDueDiligence(prospectId, prospect.userId);
    const caseId = (diligence?.data as { strataPackaging?: { caseId?: string } } | undefined)?.strataPackaging?.caseId;
    if (!caseId) return res.status(404).json({ error: "Start packaging first" });
    res.json(await getStrataCase(caseId));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.patch("/api/prospects/:prospectId/strata-packaging/case", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const prospectId = parseInt(req.params.prospectId);
    const prospect = await getReadableProspect(req, prospectId);
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    const diligence = await storage.getDueDiligence(prospectId, prospect.userId);
    const caseId = (diligence?.data as { strataPackaging?: { caseId?: string } } | undefined)?.strataPackaging?.caseId;
    if (!caseId) return res.status(400).json({ error: "Start packaging first" });
    const title = typeof req.body?.title === "string" ? req.body.title : undefined;
    const payload = req.body?.payload && typeof req.body.payload === "object" ? req.body.payload : req.body;
    res.json(await patchStrataCase(caseId, payload, title));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/prospects/:prospectId/strata-packaging/pack/download", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const prospectId = parseInt(req.params.prospectId);
    const prospect = await getReadableProspect(req, prospectId);
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    const file = String(req.query.file || "");
    if (!file.endsWith(".zip")) return res.status(400).json({ error: "Invalid file" });
    const diligence = await storage.getDueDiligence(prospectId, prospect.userId);
    const caseId = (diligence?.data as { strataPackaging?: { caseId?: string } } | undefined)?.strataPackaging?.caseId;
    if (!caseId) return res.status(400).json({ error: "Start packaging first" });
    const pack = await downloadStrataPack(caseId, file);
    res.setHeader("Content-Type", pack.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${pack.filename}"`);
    res.send(pack.buffer);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

export default router;
