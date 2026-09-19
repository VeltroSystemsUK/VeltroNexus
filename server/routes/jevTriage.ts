import { Router } from "express";
import type { Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { isJevConfigured } from "../utils/jevClient";
import { wrapAiRequest } from "../utils/aiGovernance";
import { getReadableProspect } from "../utils/prospectAccess";
import { triageProspect } from "../services/leadTriage";

const router = Router();

router.post("/prospects/:id/triage", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!isJevConfigured()) {
      return res.status(503).json({ error: "TYPESAFE_API_KEY is not configured" });
    }

    const prospectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(prospectId)) {
      return res.status(400).json({ error: "Invalid prospect ID" });
    }

    const prospect = await getReadableProspect(req, prospectId);
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });

    const consentToAiProcessing = req.body?.consentToAiProcessing !== false;
    const wrapped = await wrapAiRequest(
      {
        userId: req.user!.id,
        prospectId,
        operation: "jev.triage_lead",
        dataType: "json",
        consentToAiProcessing,
      },
      JSON.stringify({
        notes: prospect.notes || "",
        background: prospect.background || "",
        company: prospect.company?.companyName,
      }),
      async () => triageProspect(prospectId, prospect.userId)
    );

    if ("error" in wrapped) {
      return res.status(wrapped.code).json({ error: wrapped.error });
    }

    res.json(wrapped.result);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

export default router;
