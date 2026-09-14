import { Router } from "express";
import {
  briefingHtmlForToken,
  recordBriefingDwellAndPromote,
  recordBriefingSlide,
  recordVeltroInterest,
} from "../services/briefings";
import { sendTrackingPixel } from "../utils/trackingPixel";

const router = Router();

function staffSession(req: { isAuthenticated?: () => boolean }): boolean {
  return typeof req.isAuthenticated === "function" && req.isAuthenticated();
}

function trackingOpts(req: { isAuthenticated?: () => boolean; get: (name: string) => string | undefined }) {
  return {
    staffSession: staffSession(req),
    referer: req.get("referer") || req.get("referrer"),
  };
}

function noindex(res: { setHeader: (name: string, value: string) => void }): void {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

router.get("/briefing/:token", (req, res) => {
  noindex(res);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(briefingHtmlForToken(String(req.params.token || "")));
});

router.get("/api/briefing/:token/dwell.gif", async (req, res) => {
  try {
    await recordBriefingDwellAndPromote(String(req.params.token || ""), trackingOpts(req));
  } catch (error) {
    console.error("[Briefing] Dwell tracking error:", error);
  }
  sendTrackingPixel(res);
});

router.post("/api/briefing/:token/slide", (req, res) => {
  const result = recordBriefingSlide(String(req.params.token || ""), req.body?.index, trackingOpts(req));
  res.json(result);
});

router.post("/api/veltro/interest", (req, res) => {
  const token = String(req.body?.token || "");
  res.json(recordVeltroInterest(token));
});

export default router;
