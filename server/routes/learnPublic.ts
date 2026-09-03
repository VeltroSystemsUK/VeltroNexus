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
import {
  answerLearnQuestion,
  retrieveLearnPieces,
  shouldHandoffQuestion,
} from "@shared/learnLibrarian";
import { houseAskWithEngine } from "../services/caseyScout";

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

router.post("/learn/ask", async (req, res) => {
  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  if (question.length < 1 || question.length > 500) {
    return res.status(400).json({ error: "invalid question" });
  }
  const slug = typeof req.body?.slug === "string" && req.body.slug.trim() ? req.body.slug.trim() : undefined;
  const live = (await storage.listLiveLearnPieces()) as LearnPieceLike[];
  const result = await answerLearnQuestion({
    question,
    slug,
    live,
    ask: async (system, user) => {
      const { text } = await houseAskWithEngine(user, undefined, system);
      return text;
    },
  });
  const retrieved = shouldHandoffQuestion(question) ? [] : retrieveLearnPieces(live, question, slug);
  await storage.insertLearnBotLog({
    slug: slug ?? null,
    question,
    handoff: result.kind === "handoff",
    retrievedIds: retrieved
      .map((piece) => piece.id)
      .filter((id): id is number => typeof id === "number"),
  });
  res.json({ kind: result.kind, text: result.text, citations: result.citations });
});

export default router;
