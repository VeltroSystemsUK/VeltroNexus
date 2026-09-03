import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { storage } from "../storage";
import {
  buildLearnHome,
  helpedCookieValue,
  isLearnHost,
  parseHelpedCookie,
  toLearnPublic,
  type LearnPieceLike,
} from "@shared/learn";

const router = Router();

function requireLearnHost(req: Request, res: Response, next: NextFunction) {
  const host = req.get("x-forwarded-host") || req.get("host");
  if (!isLearnHost(host)) return res.status(404).json({ error: "not found" });
  next();
}

function helpedIdsFromCookie(header: string | undefined): number[] {
  const raw = header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith("learn_helped="))
    ?.slice("learn_helped=".length);
  return parseHelpedCookie(raw);
}

router.use("/learn", requireLearnHost);

router.get("/learn/home", async (_req, res) => {
  const live = await storage.listLiveLearnPieces();
  res.json(buildLearnHome(live as LearnPieceLike[]));
});

router.get("/learn/library", async (_req, res) => {
  const { library } = buildLearnHome((await storage.listLiveLearnPieces()) as LearnPieceLike[]);
  res.json({ library });
});

router.get("/learn/piece/:kind/:slug", async (req, res) => {
  const kind = req.params.kind === "article" ? "article" : req.params.kind === "video" ? "video" : null;
  if (!kind) return res.status(404).json({ error: "not found" });
  const row = await storage.getLiveLearnPieceBySlug(kind, req.params.slug);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(toLearnPublic(row as LearnPieceLike));
});

router.post("/learn/piece/:id/helped", async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const already = helpedIdsFromCookie(req.get("cookie"));
  const row = await storage.getLearnPiece(id);
  if (!row || !row.live) return res.status(404).json({ error: "not found" });
  let thisHelped = row.thisHelped || 0;
  let ids = already;
  if (!already.includes(id)) {
    const next = await storage.incrementLearnHelped(id);
    thisHelped = next?.thisHelped ?? thisHelped + 1;
    ids = [...already, id];
  }
  res.setHeader("Set-Cookie", `learn_helped=${helpedCookieValue(ids)}; Path=/; SameSite=Lax; Max-Age=31536000`);
  res.json({ thisHelped });
});

export default router;
