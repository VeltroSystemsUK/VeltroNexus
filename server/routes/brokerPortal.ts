import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import type { UnderwritingAttachment } from "@shared/schema";
import {
  STERLING_LENDERS,
  STERLING_SETTINGS_KEY,
  isSterlingLenderId,
  isSterlingOversightRole,
  isSterlingPortalRole,
  parseSterlingSettings,
} from "@shared/sterlingPortal";
import { loadSterlingFileContext, buildSterlingPackZip, sterlingReportHtml, readStoredFile } from "../services/sterlingPack";
import { handoverPackHtml } from "@shared/handoverPack";
import { buildProspectReportData } from "../utils/prospectReport";

const router = Router();

function canUseSterlingPortal(req: Request, res: Response, next: any) {
  const user = req.user as any;
  if (!user || !isSterlingPortalRole(user.role)) {
    return res.status(403).json({ error: "Access denied." });
  }
  next();
}

function isOversight(req: Request) {
  return isSterlingOversightRole((req.user as any)?.role);
}

async function loadHandoff(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  const userId = req.user!.id;
  const handoff = await storage.getBrokerHandoff(id);
  if (!handoff) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  if (!isOversight(req) && handoff.externalUserId !== userId) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  return handoff;
}

router.get("/api/broker-portal/handoffs", isAuthenticated, canUseSterlingPortal, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const handoffs = isOversight(req)
      ? await storage.listAllBrokerHandoffs()
      : await storage.listBrokerHandoffsForUser(userId);
    const enriched = await Promise.all(
      handoffs.map(async (handoff) => {
        const ctx = await loadSterlingFileContext(handoff).catch(() => null);
        return {
          id: handoff.id,
          submissionId: handoff.submissionId,
          companyName: ctx?.prospect.company?.companyName || "Unknown",
          companyNumber: ctx?.prospect.company?.companyNumber,
          status: handoff.status || "awaiting_recommendation",
          flagCount: ctx?.missing.length || 0,
          sentAt: handoff.createdAt,
          updatedAt: handoff.updatedAt,
          loanAmount: ctx?.loanAmount,
          term: ctx?.term,
        };
      })
    );
    res.json(enriched);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/broker-portal/handoffs/:id", isAuthenticated, canUseSterlingPortal, async (req: Request, res: Response) => {
  try {
    const handoff = await loadHandoff(req, res);
    if (!handoff) return;
    const ctx = await loadSterlingFileContext(handoff);
    const settings = parseSterlingSettings(await storage.getSystemSetting(STERLING_SETTINGS_KEY));
    res.json({
      id: handoff.id,
      status: handoff.status || "awaiting_recommendation",
      recommendation: handoff.recommendation || "",
      returnNote: handoff.returnNote || "",
      approvedLenderId: handoff.approvedLenderId || null,
      companyName: ctx.prospect.company.companyName,
      companyNumber: ctx.prospect.company.companyNumber,
      loanAmount: ctx.loanAmount,
      term: ctx.term,
      attachments: ctx.attachments,
      missing: ctx.missing,
      packLines: ctx.packLines,
      documents: ctx.documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        fileType: d.fileType,
        fileSize: d.fileSize,
        category: d.category,
      })),
      otherDocuments: ctx.otherDocuments.map((d) => ({
        id: d.id,
        fileName: d.fileName,
      })),
      handover: {
        answered: ctx.handover.answered,
        total: ctx.handover.total,
      },
      lenders: STERLING_LENDERS.map((l) => ({
        ...l,
        destination: settings[l.id],
      })),
    });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/broker-portal/handoffs/:id/handover.html", isAuthenticated, canUseSterlingPortal, async (req: Request, res: Response) => {
  try {
    const handoff = await loadHandoff(req, res);
    if (!handoff) return;
    const ctx = await loadSterlingFileContext(handoff);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(handoverPackHtml(ctx.handover, { companyName: ctx.prospect.company.companyName || "File" }));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/broker-portal/handoffs/:id/report.html", isAuthenticated, canUseSterlingPortal, async (req: Request, res: Response) => {
  try {
    const handoff = await loadHandoff(req, res);
    if (!handoff) return;
    const prospect = await storage.getProspectById(handoff.prospectId);
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    const reportData = await buildProspectReportData(prospect, { layoutUserId: prospect.userId });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(sterlingReportHtml(reportData));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/broker-portal/handoffs/:id/report.pdf", isAuthenticated, canUseSterlingPortal, async (req: Request, res: Response) => {
  try {
    const handoff = await loadHandoff(req, res);
    if (!handoff) return;
    const prospect = await storage.getProspectById(handoff.prospectId);
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    const { buildProspectReportData, reportFilename, streamProspectReport } = await import("../utils/prospectReport");
    const reportData = await buildProspectReportData(prospect, { layoutUserId: prospect.userId });
    await streamProspectReport(res, { ...reportData, hideAdviserRecommendation: true } as any, reportFilename(prospect.company.companyName));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.put("/api/broker-portal/handoffs/:id/recommendation", isAuthenticated, canUseSterlingPortal, async (req: Request, res: Response) => {
  try {
    const handoff = await loadHandoff(req, res);
    if (!handoff) return;
    const recommendation = String(req.body?.recommendation || "");
    const updated = await storage.updateBrokerHandoff(handoff.id, {
      recommendation,
      recommendedAt: new Date().toISOString(),
      recommendedByUserId: req.user!.id,
    });
    res.json({ ok: true, recommendation: updated?.recommendation || recommendation });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/broker-portal/handoffs/:id/return", isAuthenticated, canUseSterlingPortal, async (req: Request, res: Response) => {
  try {
    const handoff = await loadHandoff(req, res);
    if (!handoff) return;
    const note = String(req.body?.note || "").trim();
    if (!note) return res.status(400).json({ error: "A return note is required" });
    const { markSterlingReturned } = await import("../services/sterlingHandoff");
    const updated = await markSterlingReturned({
      handoff,
      note,
      userId: req.user!.id,
    });
    res.json({ ok: true, handoff: updated });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/broker-portal/handoffs/:id/pack", isAuthenticated, canUseSterlingPortal, async (req: Request, res: Response) => {
  try {
    const handoff = await loadHandoff(req, res);
    if (!handoff) return;
    const lenderId = String(req.body?.lenderId || "");
    if (!isSterlingLenderId(lenderId)) return res.status(400).json({ error: "Unknown lender" });
    const user = req.user as any;
    const signedBy = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "David Griffiths";
    const pack = await buildSterlingPackZip({ handoff, lenderId, signedBy });
    await storage.updateBrokerHandoff(handoff.id, {
      status: "sent",
      approvedLenderId: lenderId,
      packGeneratedAt: new Date().toISOString(),
    });
    if (handoff.submissionId) {
      await storage.createUnderwritingActivity(
        {
          submissionId: handoff.submissionId,
          activityType: "sterling_pack_downloaded",
          content: `Sterling downloaded pack for ${lenderId}`,
        },
        req.user!.id
      );
    }
    const { encodeContentDisposition } = await import("../utils/security");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", encodeContentDisposition(pack.filename));
    res.send(pack.buffer);
  } catch (error: any) {
    if (error?.status === 400) return res.status(400).json({ error: error.message });
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/broker-portal/handoffs/:id/documents/:docId", isAuthenticated, canUseSterlingPortal, async (req: Request, res: Response) => {
  try {
    const handoff = await loadHandoff(req, res);
    if (!handoff) return;
    const docId = parseInt(req.params.docId);
    const docs = await storage.listProspectDocuments(handoff.prospectId);
    const doc = docs.find((d) => d.id === docId);
    if (!doc) return res.status(404).json({ error: "File not found" });
    const buf = await readStoredFile(doc.storagePath);
    if (!buf) return res.status(404).json({ error: "File not found" });
    const { encodeContentDisposition } = await import("../utils/security");
    res.setHeader("Content-Type", doc.fileType || "application/octet-stream");
    res.setHeader("Content-Disposition", encodeContentDisposition(doc.fileName));
    res.send(buf);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/broker-portal/handoffs/:id/attachments", isAuthenticated, canUseSterlingPortal, async (req: Request, res: Response) => {
  try {
    const handoff = await loadHandoff(req, res);
    if (!handoff) return;
    const activities = await storage.listUnderwritingActivities(handoff.submissionId);
    const attachments: UnderwritingAttachment[] = activities.flatMap((a: any) => a.attachments || []);
    res.json(attachments.map((a, index) => ({ index, fileName: a.fileName, fileType: a.fileType, fileSize: a.fileSize })));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/broker-portal/settings", isAuthenticated, canUseSterlingPortal, async (_req: Request, res: Response) => {
  try {
    const settings = parseSterlingSettings(await storage.getSystemSetting(STERLING_SETTINGS_KEY));
    res.json({
      lenders: STERLING_LENDERS.map((l) => ({ ...l, destination: settings[l.id] })),
    });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.put("/api/broker-portal/settings", isAuthenticated, canUseSterlingPortal, async (req: Request, res: Response) => {
  try {
    const current = parseSterlingSettings(await storage.getSystemSetting(STERLING_SETTINGS_KEY));
    const incoming = req.body?.destinations || req.body || {};
    const next = parseSterlingSettings({ ...current, ...incoming });
    await storage.updateSystemSetting(STERLING_SETTINGS_KEY, next, req.user!.id);
    res.json({ ok: true, destinations: next });
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

export default router;
