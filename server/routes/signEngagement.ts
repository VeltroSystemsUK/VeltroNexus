import { Router } from "express";
import { handleApiError } from "../utils/errorHandler";
import { getPublicSign, submitPublicSign } from "../services/signEngagement";

const router = Router();

router.use("/api/sign", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

router.get("/api/sign/:token", async (req, res) => {
  try {
    const pack = await getPublicSign(String(req.params.token || ""));
    if (!pack) return res.status(404).json({ error: "This signing link is not valid." });
    res.json(pack);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/sign/:token", async (req, res) => {
  try {
    const pack = await submitPublicSign(
      String(req.params.token || ""),
      {
        name: String(req.body?.name || ""),
        title: req.body?.title ? String(req.body.title) : undefined,
        privacyAccepted: req.body?.privacyAccepted === true,
        termsAccepted: req.body?.termsAccepted === true,
      },
      req.ip,
    );
    res.json(pack);
  } catch (error: any) {
    const status = Number(error?.status) || 0;
    if (status === 400 || status === 404 || status === 409) {
      return res.status(status).json({ error: error.message });
    }
    if (/not valid|Type your|Please confirm/i.test(String(error?.message || ""))) {
      return res.status(400).json({ error: error.message });
    }
    handleApiError(res, error, "api-error");
  }
});

export default router;
