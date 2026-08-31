import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";
import { createEditorialPieceSchema } from "@shared/schema";
import {
  EDITORIAL_WRITER_PROMPT,
  approveEditorial,
  canExportPiece,
  editorialExportPayload,
  editorialGenerateInputError,
  editorialUserPrompt,
  markEditorialExported,
  rejectEditorial,
  reviewEditorialCopy,
  signOffEditorialCompliance,
} from "@shared/editorial";
import { houseAskWithEngine, researchTopic } from "../services/caseyScout";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();
const patchSchema = z.object({
  title: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  body: z.string().optional(),
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
      const next = signOffEditorialCompliance(existing);
      const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, { compliance: next.compliance });
      return res.json(piece);
    } catch (err: any) {
      return res.status(400).json({ error: err.message, findings: reviewEditorialCopy(existing).findings });
    }
  } catch (err: any) {
    handleApiError(res, err, "compliance-editorial");
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
