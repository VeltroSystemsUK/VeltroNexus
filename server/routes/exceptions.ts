import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { verifyBusinessAddress } from "../utils/googlePlacesVerify";

const router = Router();

// Verification exceptions filed by Companies House monitoring, Google Places
// address checks, and due-diligence flags (e.g. HMRC Time To Pay).

router.get(
  "/api/prospects/:prospectId/exceptions",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const prospectId = parseInt(req.params.prospectId);
      const userId = req.user!.id;
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      const exceptions = await storage.listExceptionsForProspect(prospectId);
      res.json(exceptions);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  }
);

router.get("/api/exceptions/open", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const exceptions = await storage.listOpenExceptions();
    res.json(exceptions);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post(
  "/api/exceptions/:id/resolve",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const resolved = await storage.resolveException(id);
      if (!resolved) {
        return res.status(404).json({ error: "Exception not found" });
      }
      res.json(resolved);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  }
);

router.post(
  "/api/prospects/:id/verify-address",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const prospectId = parseInt(req.params.id);
      const userId = req.user!.id;
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }
      const { companyName, registeredAddress } = prospect.company;
      if (!registeredAddress) {
        return res.status(400).json({ error: "No registered address on file to verify" });
      }

      const result = await verifyBusinessAddress(companyName, registeredAddress);

      if (result.confidence !== "high") {
        await storage.createException({
          prospectId,
          source: "google_places",
          severity: result.confidence === "none" ? "high" : "medium",
          message:
            result.confidence === "none"
              ? `No operational Google Places listing found near "${registeredAddress}"`
              : `Nearest Google Places match ("${result.placeName}", ${result.placeAddress}) does not confirm the registered postcode`,
        });
      }

      res.json(result);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  }
);

export default router;
