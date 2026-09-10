import { Router } from "express";
import { handleApiError } from "../utils/errorHandler";
import { getPublicApply, submitPublicApply } from "../services/applyOnline";

const router = Router();

router.use("/api/apply", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

router.get("/api/apply/:token", async (req, res) => {
  try {
    const state = await getPublicApply(String(req.params.token || ""));
    if (!state) return res.status(404).json({ error: "This application link is not valid." });
    res.json(state);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/apply/:token", async (req, res) => {
  try {
    const state = await submitPublicApply(
      String(req.params.token || ""),
      {
        answers: req.body?.answers && typeof req.body.answers === "object" ? req.body.answers : {},
        directors: Array.isArray(req.body?.directors) ? req.body.directors : [],
        sign:
          req.body?.sign && typeof req.body.sign === "object"
            ? { name: String(req.body.sign.name || ""), title: String(req.body.sign.title || "") }
            : undefined,
      },
      req.ip,
    );
    res.json(state);
  } catch (error: any) {
    const status = Number(error?.status) || 0;
    if (status === 400 || status === 404 || status === 409) {
      return res.status(status).json({ error: error.message });
    }
    handleApiError(res, error, "api-error");
  }
});

export default router;
