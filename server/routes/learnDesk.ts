import fs from "fs";
import path from "path";
import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { createLearnVideoSchema, type LearnPiece } from "@shared/schema";
import {
  approveEditorial,
  EDITORIAL_WRITER_PROMPT,
  editorialUserPrompt,
  rejectEditorial,
  type EditorialPieceLike,
} from "@shared/editorial";
import {
  canPublishLearn,
  isAllowedVideoSource,
  learnVideoCopy,
  learnVideoGenerateInputError,
  reviewLearnCopy,
  signOffLearnVideoCompliance,
  slugifyLearnTitle,
  snapshotLearnPiece,
  type LearnVideoLike,
} from "@shared/learn";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { houseAskWithEngine, researchTopic } from "../services/caseyScout";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();
const VIDEO_DIR = path.join(process.cwd(), "uploads", "learn", "videos");
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  description: z.string().optional(),
  transcript: z.string().optional(),
  videoUrl: z.string().optional(),
  excerpt: z.string().optional(),
  durationLabel: z.string().optional(),
  pathPosition: z.number().int().min(1).max(6).nullable().optional(),
  heroImageUrl: z.string().nullable().optional(),
});

const publishSchema = z.object({
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  pathPosition: z.number().int().min(1).max(6).nullable().optional(),
  overrideCompliance: z.boolean().optional(),
});

const pathSchema = z.object({
  pathPosition: z.number().int().min(1).max(6).nullable(),
});

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(VIDEO_DIR, { recursive: true });
      cb(null, VIDEO_DIR);
    },
    filename: (req, _file, cb) => {
      const id = parseInt(String(req.params.id), 10);
      const safe = Number.isInteger(id) && id > 0 ? id : 0;
      cb(null, `learn-${safe}-${Date.now()}.mp4`);
    },
  }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "video/mp4") {
      cb(new Error("mp4 only"));
      return;
    }
    cb(null, true);
  },
});

function asEditorial(video: LearnVideoLike): EditorialPieceLike {
  return {
    id: video.id,
    userId: video.userId,
    type: "blog",
    title: video.title,
    topic: video.topic,
    body: video.description || "",
    notes: video.notes || [],
    engine: video.engine ?? null,
    status: video.status,
    compliance: video.compliance,
    autoPublish: false,
    heroImageUrl: video.heroImageUrl ?? null,
  };
}

async function loadVideo(req: AuthenticatedRequest, res: Response) {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "Learn video not found" });
    return null;
  }
  const video = await storage.getLearnVideo(id, req.user.id);
  if (!video) {
    res.status(404).json({ error: "Learn video not found" });
    return null;
  }
  return video as LearnVideoLike;
}

async function loadPiece(req: AuthenticatedRequest, res: Response) {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "Learn piece not found" });
    return null;
  }
  const piece = await storage.getLearnPiece(id);
  if (!piece || piece.userId !== req.user.id) {
    res.status(404).json({ error: "Learn piece not found" });
    return null;
  }
  return piece;
}

function publishError(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err || "");
  if (message === "slug taken" || message === "path position taken") return message;
  return null;
}

function handleUpload(req: Request, res: Response, next: () => void) {
  videoUpload.single("file")(req, res, (err: unknown) => {
    if (!err) return next();
    const multerErr = err as { code?: string; message?: string };
    if (multerErr?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large (max 80MB)" });
    }
    return res.status(400).json({ error: multerErr?.message || "Upload failed" });
  });
}

router.get("/learn-desk/videos", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(await storage.listLearnVideos(req.user.id));
  } catch (err: any) {
    handleApiError(res, err, "list-learn-videos");
  }
});

router.post("/learn-desk/videos", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createLearnVideoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: fromZodError(parsed.error).message });
    const video = await storage.createLearnVideo(parsed.data, req.user.id);
    res.status(201).json(video);
  } catch (err: any) {
    handleApiError(res, err, "create-learn-video");
  }
});

router.get("/learn-desk/videos/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const video = await loadVideo(req, res);
    if (!video) return;
    res.json(video);
  } catch (err: any) {
    handleApiError(res, err, "get-learn-video");
  }
});

router.patch("/learn-desk/videos/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: fromZodError(parsed.error).message });
    const existing = await loadVideo(req, res);
    if (!existing) return;
    if (parsed.data.videoUrl && !isAllowedVideoSource(parsed.data.videoUrl)) {
      return res.status(400).json({ error: "Video source must be a stored Learn mp4 or YouTube/Vimeo URL." });
    }
    const video = await storage.updateLearnVideo(existing.id!, req.user.id, parsed.data);
    res.json(video);
  } catch (err: any) {
    handleApiError(res, err, "patch-learn-video");
  }
});

router.delete("/learn-desk/videos/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadVideo(req, res);
    if (!existing) return;
    await storage.deleteLearnVideo(existing.id!, req.user.id);
    res.json({ ok: true });
  } catch (err: any) {
    handleApiError(res, err, "delete-learn-video");
  }
});

router.post("/learn-desk/videos/:id/scan", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadVideo(req, res);
    if (!existing) return;
    const result = await researchTopic(existing.topic);
    const video = await storage.updateLearnVideo(existing.id!, req.user.id, { notes: result.notes });
    res.json({ ...video, warning: result.warning });
  } catch (err: any) {
    console.error("[LearnDesk] scan", err);
    res.status(502).json({ error: err.message || "Topic scan failed" });
  }
});

router.post("/learn-desk/videos/:id/generate", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadVideo(req, res);
    if (!existing) return;
    const blocked = learnVideoGenerateInputError(existing);
    if (blocked) return res.status(400).json({ error: blocked });
    const today = new Date().toISOString().slice(0, 10);
    const { text, engine } = await houseAskWithEngine(
      editorialUserPrompt(asEditorial(existing), today),
      undefined,
      EDITORIAL_WRITER_PROMPT,
    );
    const video = await storage.updateLearnVideo(existing.id!, req.user.id, {
      description: text,
      engine,
      status: "draft",
      compliance: "pending",
    });
    res.json(video);
  } catch (err: any) {
    console.error("[LearnDesk] generate", err);
    res.status(500).json({ error: err.message || "Failed to generate video description" });
  }
});

router.post("/learn-desk/videos/:id/approve", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadVideo(req, res);
    if (!existing) return;
    const next = approveEditorial(asEditorial(existing));
    const video = await storage.updateLearnVideo(existing.id!, req.user.id, {
      status: next.status,
      compliance: next.compliance,
    });
    res.json(video);
  } catch (err: any) {
    handleApiError(res, err, "approve-learn-video");
  }
});

router.post("/learn-desk/videos/:id/reject", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadVideo(req, res);
    if (!existing) return;
    const next = rejectEditorial(asEditorial(existing));
    const video = await storage.updateLearnVideo(existing.id!, req.user.id, { status: next.status });
    res.json(video);
  } catch (err: any) {
    handleApiError(res, err, "reject-learn-video");
  }
});

router.post("/learn-desk/videos/:id/compliance", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadVideo(req, res);
    if (!existing) return;
    const action = req.body?.action;
    if (action === "blocked") {
      const video = await storage.updateLearnVideo(existing.id!, req.user.id, { compliance: "blocked" });
      return res.json(video);
    }
    if (action !== "cleared") return res.status(400).json({ error: "action must be cleared or blocked" });
    try {
      const next = signOffLearnVideoCompliance(existing, req.body?.overrideCompliance === true);
      const video = await storage.updateLearnVideo(existing.id!, req.user.id, { compliance: next.compliance });
      return res.json(video);
    } catch (err: any) {
      return res.status(400).json({ error: err.message, findings: reviewLearnCopy(learnVideoCopy(existing)).findings });
    }
  } catch (err: any) {
    handleApiError(res, err, "compliance-learn-video");
  }
});

router.post(
  "/learn-desk/videos/:id/upload",
  isAuthenticated,
  handleUpload,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await loadVideo(req, res);
      if (!existing) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        return;
      }
      if (!req.file) return res.status(400).json({ error: "mp4 file required" });
      const videoUrl = `/uploads/learn/videos/${req.file.filename}`;
      const video = await storage.updateLearnVideo(existing.id!, req.user.id, { videoUrl });
      res.json(video);
    } catch (err: any) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      handleApiError(res, err, "upload-learn-video");
    }
  },
);

router.post("/learn-desk/videos/:id/publish", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadVideo(req, res);
    if (!existing) return;
    const parsed = publishSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: fromZodError(parsed.error).message });
    const slug = slugifyLearnTitle(parsed.data.slug || existing.title);
    if (!slug) return res.status(400).json({ error: "Slug is required." });
    const excerpt = parsed.data.excerpt ?? existing.excerpt ?? "";
    const pathPosition =
      parsed.data.pathPosition === undefined ? (existing.pathPosition ?? null) : parsed.data.pathPosition;
    const gate = canPublishLearn({
      status: existing.status,
      compliance: existing.compliance,
      autoPublish: existing.autoPublish !== false,
      kind: "video",
      title: existing.title,
      excerpt,
      videoUrl: existing.videoUrl,
      description: existing.description,
      transcript: existing.transcript,
      overrideCompliance: parsed.data.overrideCompliance === true,
    });
    if (!gate.ok) return res.status(400).json({ error: gate.error });
    const snapshot = snapshotLearnPiece({
      kind: "video",
      slug,
      title: existing.title,
      excerpt,
      videoUrl: existing.videoUrl,
      transcript: existing.transcript,
      heroImageUrl: existing.heroImageUrl,
      durationLabel: existing.durationLabel,
      pathPosition,
      source: { desk: "learn-video", id: existing.id! },
      userId: req.user.id,
    });
    try {
      const live = await storage.upsertLiveLearnPiece(snapshot as LearnPiece);
      res.json(live);
    } catch (err: any) {
      const known = publishError(err);
      if (known) return res.status(400).json({ error: known });
      throw err;
    }
  } catch (err: any) {
    handleApiError(res, err, "publish-learn-video");
  }
});

router.get("/learn-desk/pieces", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(await storage.listLearnPieces(req.user.id));
  } catch (err: any) {
    handleApiError(res, err, "list-learn-pieces");
  }
});

router.post("/learn-desk/pieces/:id/unpublish", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const piece = await storage.unpublishLearnPiece(existing.id!);
    if (!piece) return res.status(404).json({ error: "Learn piece not found" });
    res.json(piece);
  } catch (err: any) {
    handleApiError(res, err, "unpublish-learn-piece");
  }
});

router.patch("/learn-desk/pieces/:id/path", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = pathSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: fromZodError(parsed.error).message });
    const existing = await loadPiece(req, res);
    if (!existing) return;
    try {
      const piece = await storage.upsertLiveLearnPiece({
        ...existing,
        pathPosition: parsed.data.pathPosition,
      });
      res.json(piece);
    } catch (err: any) {
      const known = publishError(err);
      if (known) return res.status(400).json({ error: known });
      throw err;
    }
  } catch (err: any) {
    handleApiError(res, err, "path-learn-piece");
  }
});

router.get("/learn-desk/bot-logs", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(await storage.listLearnBotLogs());
  } catch (err: any) {
    handleApiError(res, err, "list-learn-bot-logs");
  }
});

router.get("/learn-desk/news-comments", isAuthenticated, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await storage.listNewsComments();
    res.json(
      rows.map((row) => ({
        id: row.id,
        pieceId: row.pieceId,
        name: row.name,
        body: row.body,
        marketingOptIn: row.marketingOptIn,
        live: row.live,
        createdAt: row.createdAt,
      })),
    );
  } catch (err: any) {
    handleApiError(res, err, "list-news-comments");
  }
});

router.post("/learn-desk/news-comments/:id/hide", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const row = await storage.hideNewsComment(id);
    if (!row) return res.status(404).json({ error: "Comment not found" });
    res.json({ id: row.id, live: row.live });
  } catch (err: any) {
    handleApiError(res, err, "hide-news-comment");
  }
});

export default router;
