import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { getObjectStorage } from "../utils/routerHelpers";
import type { UnderwritingAttachment } from "@shared/schema";
import { ipAllowlist } from "../utils/ipAllowlist";

const router = Router();
router.use(ipAllowlist());

// External partner (e.g. Sterling Capital Reserve) portal. Access is scoped to
// only the handoffs explicitly sent to this user, and only while unexpired.
function isExternalBroker(req: Request, res: Response, next: any) {
  const user = req.user as any;
  if (!user || user.role !== "external_broker") {
    return res.status(403).json({ error: "Access denied. External broker account required." });
  }
  next();
}

async function loadActiveHandoff(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  const userId = req.user!.id;
  const handoff = await storage.getBrokerHandoff(id);
  if (!handoff || handoff.externalUserId !== userId) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  if (new Date(handoff.expiresAt).getTime() < Date.now()) {
    res.status(410).json({ error: "This deal's access has expired" });
    return null;
  }
  return handoff;
}

router.get("/api/broker-portal/handoffs", isAuthenticated, isExternalBroker, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const handoffs = await storage.listBrokerHandoffsForUser(userId);
    const active = handoffs.filter((h) => new Date(h.expiresAt).getTime() >= Date.now());

    const enriched = await Promise.all(
      active.map(async (handoff) => {
        const [prospect, submission] = await Promise.all([
          storage.getProspectById(handoff.prospectId),
          storage.getUnderwritingSubmission(handoff.submissionId),
        ]);
        return {
          id: handoff.id,
          submissionId: handoff.submissionId,
          companyName: prospect?.company?.companyName || "Unknown",
          companyNumber: prospect?.company?.companyNumber,
          status: submission?.status,
          sentAt: handoff.createdAt,
          expiresAt: handoff.expiresAt,
        };
      })
    );

    res.json(enriched);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/broker-portal/handoffs/:id/report.pdf", isAuthenticated, isExternalBroker, async (req: Request, res: Response) => {
  try {
    const handoff = await loadActiveHandoff(req, res);
    if (!handoff) return;

    const prospect = await storage.getProspectById(handoff.prospectId);
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });

    const [contacts, activities, dueDiligence] = await Promise.all([
      storage.listContacts(handoff.prospectId, prospect.userId),
      storage.listActivities(handoff.prospectId, prospect.userId),
      storage.getDueDiligence(handoff.prospectId, prospect.userId).catch(() => null),
    ]);

    const { createProspectReportDocument, renderProspectReport } = await import("../utils/pdfGenerator");
    const doc = createProspectReportDocument({
      prospect,
      contacts,
      activities,
      dueDiligence: dueDiligence || undefined,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Credit_Assessment_${prospect.company.companyName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf"`
    );
    doc.pipe(res);
    renderProspectReport(doc, {
      prospect,
      contacts,
      activities,
      dueDiligence: dueDiligence || undefined,
    });
    doc.end();
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/broker-portal/handoffs/:id/attachments", isAuthenticated, isExternalBroker, async (req: Request, res: Response) => {
  try {
    const handoff = await loadActiveHandoff(req, res);
    if (!handoff) return;

    const activities = await storage.listUnderwritingActivities(handoff.submissionId);
    const attachments: UnderwritingAttachment[] = activities.flatMap((a: any) => a.attachments || []);
    res.json(attachments.map((a, index) => ({ index, fileName: a.fileName, fileType: a.fileType, fileSize: a.fileSize })));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.get("/api/broker-portal/handoffs/:id/attachments/:index", isAuthenticated, isExternalBroker, async (req: Request, res: Response) => {
  try {
    const handoff = await loadActiveHandoff(req, res);
    if (!handoff) return;

    const fileIndex = parseInt(req.params.index);
    const activities = await storage.listUnderwritingActivities(handoff.submissionId);
    const attachments: UnderwritingAttachment[] = activities.flatMap((a: any) => a.attachments || []);

    if (fileIndex < 0 || fileIndex >= attachments.length) {
      return res.status(404).json({ error: "File not found" });
    }
    const attachment = attachments[fileIndex];

    const { data } = await getObjectStorage().downloadAsBytes(attachment.storagePath);
    const { encodeContentDisposition } = await import("../utils/security");
    res.setHeader("Content-Type", attachment.fileType);
    res.setHeader("Content-Disposition", encodeContentDisposition(attachment.fileName));
    res.send(Buffer.from(data));
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

export default router;
