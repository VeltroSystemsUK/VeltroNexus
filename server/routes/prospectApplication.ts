import { Router } from "express";
import type { Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { getReadableProspect } from "../utils/prospectAccess";
import {
  loadProspectApplication,
  prospectApplicationDocx,
  saveProspectApplication,
  sendProspectApplication,
} from "../services/prospectApplication";
import { isApplicationSigned, parseApplicationData } from "@shared/applicationDataFields";

const router = Router();

router.get("/api/prospects/:id/application", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const prospect = await getReadableProspect(req, parseInt(req.params.id, 10));
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    const { data } = await loadProspectApplication(prospect.id!);
    res.json({ ...data, signed: isApplicationSigned(data) });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.put("/api/prospects/:id/application", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const prospect = await getReadableProspect(req, parseInt(req.params.id, 10));
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    const patch = parseApplicationData(req.body);
    const data = await saveProspectApplication(prospect.id!, {
      answers: patch.answers,
      directors: patch.directors,
    });
    res.json({ ...data, signed: isApplicationSigned(data) });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/prospects/:id/application/send", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const prospect = await getReadableProspect(req, parseInt(req.params.id, 10));
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    const sent = await sendProspectApplication(prospect.id!);
    res.json({ url: sent.url, ...sent.data, signed: isApplicationSigned(sent.data) });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/prospects/:id/application.docx", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const prospect = await getReadableProspect(req, parseInt(req.params.id, 10));
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    const lender = String(req.query.lender || "bcrs");
    const { buffer, filename } = await prospectApplicationDocx(prospect.id!, lender);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

export default router;
