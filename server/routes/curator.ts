import { Router } from "express";
import type { Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import {
  createCollection,
  getAsset,
  ingestFromUrl,
  listAssets,
  listCollections,
  runDeskScan,
  searchAssets,
  useAsset,
} from "../services/mediaCurator";
import type { CuratorAspect, CuratorChannel } from "@shared/mediaCurator";

const router = Router();

router.post("/curator/ingest", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const result = await ingestFromUrl(req.user!.id, req.body);
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (/url or file|fetch that image|raster images/i.test(msg)) {
      return res.status(400).json({ error: msg });
    }
    handleApiError(res, err, "curator-ingest");
  }
});

router.post("/curator/search", isAuthenticated, (req: Request, res: Response) => {
  try {
    const raw = req.body && typeof req.body === "object" ? req.body : {};
    const aspect = raw.aspectRatio as CuratorAspect | undefined;
    const assets = searchAssets({
      q: typeof raw.q === "string" ? raw.q : undefined,
      tags: Array.isArray(raw.tags) ? raw.tags.filter((t: unknown) => typeof t === "string") : undefined,
      aspectRatio: aspect,
      color: typeof raw.color === "string" ? raw.color : undefined,
    });
    res.json({ assets });
  } catch (err) {
    handleApiError(res, err, "curator-search");
  }
});

router.get("/curator/assets", isAuthenticated, (_req: Request, res: Response) => {
  try {
    res.json({ assets: listAssets() });
  } catch (err) {
    handleApiError(res, err, "curator-list");
  }
});

router.get("/curator/assets/:id", isAuthenticated, (req: Request, res: Response) => {
  try {
    const asset = getAsset(req.params.id);
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    res.json(asset);
  } catch (err) {
    handleApiError(res, err, "curator-get");
  }
});

router.post("/curator/assets/:id/use", isAuthenticated, (req: Request, res: Response) => {
  try {
    const channel = req.body?.channel as CuratorChannel;
    const campaignId = typeof req.body?.campaignId === "string" ? req.body.campaignId : "";
    if (!campaignId || !channel) return res.status(400).json({ error: "campaignId and channel are required" });
    res.json(useAsset(req.params.id, { campaignId, channel }));
  } catch (err: any) {
    if (String(err?.message || "").includes("not found")) return res.status(404).json({ error: err.message });
    handleApiError(res, err, "curator-use");
  }
});

router.get("/curator/collections", isAuthenticated, (_req: Request, res: Response) => {
  try {
    res.json({ collections: listCollections() });
  } catch (err) {
    handleApiError(res, err, "curator-collections");
  }
});

router.post("/curator/collections", isAuthenticated, (req: Request, res: Response) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name : "";
    res.status(201).json(createCollection(name));
  } catch (err) {
    handleApiError(res, err, "curator-collections-create");
  }
});

router.post("/curator/run", isAuthenticated, async (req: Request, res: Response) => {
  req.setTimeout(180000);
  res.setTimeout(180000);
  try {
    const query = typeof req.body?.query === "string" && req.body.query.trim() ? req.body.query.trim() : undefined;
    const result = await runDeskScan(req.user!.id, query);
    res.json(result);
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (/unavailable/i.test(msg)) return res.status(502).json({ error: msg });
    handleApiError(res, err, "curator-run");
  }
});

export default router;
