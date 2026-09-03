import fs from "fs";
import path from "path";
import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";
import { createEditorialPieceSchema, type LearnPiece } from "@shared/schema";
import {
  EDITORIAL_LINKEDIN_PROMPT,
  EDITORIAL_WRITER_PROMPT,
  approveEditorial,
  canExportPiece,
  editorialExportPayload,
  editorialGenerateInputError,
  editorialLinkedInUserPrompt,
  editorialStillPrompt,
  editorialUserPrompt,
  formatEditorialLinkedInPost,
  insertEditorialImage,
  markEditorialExported,
  parseEditorialImageRequest,
  parseEditorialLinkedInPack,
  rejectEditorial,
  reviewEditorialCopy,
  signOffEditorialCompliance,
} from "@shared/editorial";
import { canPublishLearn, slugifyLearnTitle, snapshotLearnPiece, NEWS_CATEGORIES } from "@shared/learn";
import { houseAskWithEngine, researchTopic } from "../services/caseyScout";
import { grokFile, grokGenerateStill } from "../services/grokImages";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();
const patchSchema = z.object({
  title: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  body: z.string().optional(),
});
const publishLearnSchema = z.object({
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  pathPosition: z.number().int().min(1).max(6).nullable().optional(),
  overrideCompliance: z.boolean().optional(),
  category: z.enum(NEWS_CATEGORIES).nullable().optional(),
});

async function loadPiece(req: AuthenticatedRequest, res: Response) {
  const id = parseInt(String(req.params.id), 10);
  const piece = await storage.getEditorialPiece(id, req.user.id);
  if (!piece) {
    res.status(404).json({ error: "Editorial piece not found" });
    return null;
  }
  return piece;
}

router.get("/editorial", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(await storage.listEditorialPieces(req.user.id));
  } catch (err: any) {
    handleApiError(res, err, "list-editorial");
  }
});

router.post("/editorial", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createEditorialPieceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: fromZodError(parsed.error).message });
    const piece = await storage.createEditorialPiece(parsed.data, req.user.id);
    res.status(201).json(piece);
  } catch (err: any) {
    handleApiError(res, err, "create-editorial");
  }
});

router.get("/editorial/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const piece = await loadPiece(req, res);
    if (!piece) return;
    res.json(piece);
  } catch (err: any) {
    handleApiError(res, err, "get-editorial");
  }
});

router.patch("/editorial/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: fromZodError(parsed.error).message });
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, parsed.data);
    res.json(piece);
  } catch (err: any) {
    handleApiError(res, err, "patch-editorial");
  }
});

router.delete("/editorial/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    await storage.deleteEditorialPiece(existing.id!, req.user.id);
    res.json({ ok: true });
  } catch (err: any) {
    handleApiError(res, err, "delete-editorial");
  }
});

router.post("/editorial/:id/scan", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const result = await researchTopic(existing.topic);
    const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, { notes: result.notes });
    res.json({ ...piece, warning: result.warning });
  } catch (err: any) {
    console.error("[Editorial] scan", err);
    res.status(502).json({ error: err.message || "Topic scan failed" });
  }
});

router.post("/editorial/:id/generate", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const blocked = editorialGenerateInputError(existing);
    if (blocked) return res.status(400).json({ error: blocked });
    const today = new Date().toISOString().slice(0, 10);
    const { text, engine } = await houseAskWithEngine(
      editorialUserPrompt(existing, today),
      undefined,
      EDITORIAL_WRITER_PROMPT,
    );
    const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, {
      body: text,
      engine,
      status: "draft",
      compliance: "pending",
    });
    res.json(piece);
  } catch (err: any) {
    console.error("[Editorial] generate", err);
    res.status(500).json({ error: err.message || "Failed to generate editorial copy" });
  }
});

router.post("/editorial/:id/approve", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const next = approveEditorial(existing);
    const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, {
      status: next.status,
      compliance: next.compliance,
    });
    res.json(piece);
  } catch (err: any) {
    handleApiError(res, err, "approve-editorial");
  }
});

router.post("/editorial/:id/reject", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const next = rejectEditorial(existing);
    const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, { status: next.status });
    res.json(piece);
  } catch (err: any) {
    handleApiError(res, err, "reject-editorial");
  }
});

router.post("/editorial/:id/compliance", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const action = req.body?.action;
    if (action === "blocked") {
      const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, { compliance: "blocked" });
      return res.json(piece);
    }
    if (action !== "cleared") return res.status(400).json({ error: "action must be cleared or blocked" });
    try {
      const next = signOffEditorialCompliance(existing, req.body?.overrideCompliance === true);
      const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, { compliance: next.compliance });
      return res.json(piece);
    } catch (err: any) {
      return res.status(400).json({ error: err.message, findings: reviewEditorialCopy(existing).findings });
    }
  } catch (err: any) {
    handleApiError(res, err, "compliance-editorial");
  }
});

router.post("/editorial/:id/image", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const parsed = parseEditorialImageRequest(req.body);
    const prompt = editorialStillPrompt(existing, parsed.prompt);
    const job = await grokGenerateStill(prompt, "og");
    const file = grokFile(job.id);
    if (!file?.buffer?.length) {
      return res.status(422).json({ error: "Grok could not generate an image. Try a different prompt." });
    }
    const mime = file.mime || "image/jpeg";
    const extension = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const filename = `editorial-${existing.id}-${Date.now()}.${extension}`;
    const storagePath = `media/${req.user.id}/${filename}`;
    const localFilePath = path.resolve(process.cwd(), "uploads", storagePath);
    fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
    fs.writeFileSync(localFilePath, file.buffer);
    const url = `/uploads/${storagePath}`;
    const insert = req.body?.insert === true;
    const body = insert ? insertEditorialImage(existing.body || "", url, existing.title) : undefined;
    const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, {
      heroImageUrl: url,
      ...(body !== undefined ? { body } : {}),
    });
    res.json({ url, prompt, piece: piece || existing });
  } catch (err: any) {
    const msg = String(err?.message || "Images failed");
    const status = /timed out/i.test(msg) ? 504 : /expired|credential|XAI_API_KEY|sign in/i.test(msg) ? 401 : 400;
    return res.status(status).json({ error: msg.slice(0, 400) });
  }
});

router.post("/editorial/:id/linkedin", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const { text } = await houseAskWithEngine(
      editorialLinkedInUserPrompt({ ...existing, title: existing.title, body: existing.body || "" }),
      undefined,
      EDITORIAL_LINKEDIN_PROMPT,
    );
    const pack = parseEditorialLinkedInPack(text);
    const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, { linkedinPack: pack });
    res.json({ pack, formatted: formatEditorialLinkedInPost(pack), piece: piece || { ...existing, linkedinPack: pack } });
  } catch (err: any) {
    const msg = String(err?.message || "Failed to generate LinkedIn pack");
    if (/house policy|hashtag|keyword|hook, body|Invalid LinkedIn/i.test(msg)) {
      return res.status(400).json({ error: msg.slice(0, 400) });
    }
    console.error("[Editorial] linkedin", err);
    res.status(500).json({ error: msg.slice(0, 400) });
  }
});

router.post("/editorial/:id/publish-learn", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const parsed = publishLearnSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: fromZodError(parsed.error).message });
    if (existing.type !== "blog" && existing.type !== "news") {
      return res.status(400).json({ error: "Only blog articles and news posts publish to Learn." });
    }
    const kind = existing.type === "news" ? "news" : "article";
    const slug = slugifyLearnTitle(parsed.data.slug || existing.title);
    if (!slug) return res.status(400).json({ error: "Slug is required." });
    const excerpt = parsed.data.excerpt ?? "";
    const pathPosition = kind === "news" ? null : parsed.data.pathPosition === undefined ? null : parsed.data.pathPosition;
    const gate = canPublishLearn({
      status: existing.status,
      compliance: existing.compliance,
      autoPublish: existing.autoPublish !== false,
      kind,
      type: existing.type,
      title: existing.title,
      excerpt,
      body: existing.body,
      overrideCompliance: parsed.data.overrideCompliance === true,
      category: parsed.data.category,
    });
    if (!gate.ok) return res.status(400).json({ error: gate.error });
    const snapshot = snapshotLearnPiece({
      kind,
      slug,
      title: existing.title,
      excerpt,
      body: existing.body,
      heroImageUrl: existing.heroImageUrl,
      pathPosition,
      category: parsed.data.category,
      source: { desk: "editorial", id: existing.id! },
      userId: req.user.id,
    });
    try {
      const live = await storage.upsertLiveLearnPiece(snapshot as LearnPiece);
      res.json(live);
    } catch (err: any) {
      if (err?.message === "slug taken" || err?.message === "path position taken") {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }
  } catch (err: any) {
    handleApiError(res, err, "publish-learn-editorial");
  }
});

router.post("/editorial/:id/export", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    if (!canExportPiece(existing)) {
      return res.status(400).json({
        error: "Export is blocked until marketing approve and compliance sign-off.",
        findings: reviewEditorialCopy(existing).findings,
      });
    }
    const next = markEditorialExported(existing);
    const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, {
      status: next.status,
      exportedAt: next.exportedAt,
    });
    const payload = editorialExportPayload(piece || next);
    res.json({ ...payload, piece: piece || next });
  } catch (err: any) {
    handleApiError(res, err, "export-editorial");
  }
});

export default router;
