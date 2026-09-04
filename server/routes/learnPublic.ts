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
  canPostLearnNewsComment,
  likedCookieValue,
  parseLikedCookie,
  toLearnNewsCommentPublic,
  validateLearnNewsComment,
} from "@shared/learnNews";
import { hashLearnCommentEmail } from "../services/learnNewsHash";
import {
  answerLearnQuestion,
  retrieveLearnPieces,
  shouldHandoffQuestion,
} from "@shared/learnLibrarian";
import { houseAskWithEngine } from "../services/caseyScout";
import { sendEmail } from "../services/email";
import {
  calculateDebtStress,
  calculateTtp,
  debtStressEmailHtml,
  emptyOutgoings,
  ttpEmailHtml,
  validateToolEmailRequest,
  type DebtRow,
} from "@shared/learnTools";

const router = Router();

function requireLearnHost(req: Request, res: Response, next: NextFunction) {
  const host = req.get("x-forwarded-host") || req.get("host");
  if (!isLearnHost(host)) return res.status(404).json({ error: "not found" });
  next();
}

function cookieList(header: string | undefined, name: string): number[] {
  const raw = header
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith(`${name}=`))
    ?.slice(`${name}=`.length);
  return name === "learn_news_liked" || name === "learn_news_disliked"
    ? parseLikedCookie(raw)
    : parseHelpedCookie(raw);
}

function commentPepper(): string {
  return process.env.LEARN_COMMENT_PEPPER || "strata-learn-news";
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

router.get("/learn/news", async (_req, res) => {
  const { news } = buildLearnHome((await storage.listLiveLearnPieces()) as LearnPieceLike[]);
  res.json({ news });
});

router.get("/learn/piece/:kind/:slug", async (req, res) => {
  const kind =
    req.params.kind === "article"
      ? "article"
      : req.params.kind === "video"
        ? "video"
        : req.params.kind === "news"
          ? "news"
          : null;
  if (!kind) return res.status(404).json({ error: "not found" });
  const row = await storage.getLiveLearnPieceBySlug(kind, req.params.slug);
  if (!row) return res.status(404).json({ error: "not found" });
  const publicPiece = toLearnPublic(row as LearnPieceLike);
  if (kind !== "news" || typeof row.id !== "number") return res.json(publicPiece);
  const comments = (await storage.listLiveNewsComments(row.id)).map(toLearnNewsCommentPublic);
  res.json({ ...publicPiece, comments });
});

router.post("/learn/news/:id/like", async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const already = cookieList(req.get("cookie"), "learn_news_liked");
  const row = await storage.getLearnPiece(id);
  if (!row || !row.live || row.kind !== "news") return res.status(404).json({ error: "not found" });
  let thisHelped = row.thisHelped || 0;
  let ids = already;
  if (!already.includes(id)) {
    const next = await storage.incrementLearnHelped(id);
    thisHelped = next?.thisHelped ?? thisHelped + 1;
    ids = [...already, id];
  }
  res.setHeader("Set-Cookie", `learn_news_liked=${likedCookieValue(ids)}; Path=/; SameSite=Lax; Max-Age=31536000`);
  res.json({ likes: thisHelped });
});

router.post("/learn/news/:id/dislike", async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const already = cookieList(req.get("cookie"), "learn_news_disliked");
  const row = await storage.getLearnPiece(id);
  if (!row || !row.live || row.kind !== "news") return res.status(404).json({ error: "not found" });
  let thisNotHelped = row.thisNotHelped || 0;
  let ids = already;
  if (!already.includes(id)) {
    const next = await storage.incrementLearnNotHelped(id);
    thisNotHelped = next?.thisNotHelped ?? thisNotHelped + 1;
    ids = [...already, id];
  }
  res.setHeader("Set-Cookie", `learn_news_disliked=${likedCookieValue(ids)}; Path=/; SameSite=Lax; Max-Age=31536000`);
  res.json({ dislikes: thisNotHelped });
});

router.post("/learn/news/:id/comments", async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const row = await storage.getLearnPiece(id);
  if (!row || !row.live || row.kind !== "news") return res.status(404).json({ error: "not found" });
  const parsed = validateLearnNewsComment(req.body ?? {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const emailHash = hashLearnCommentEmail(parsed.email, commentPepper());
  const recent = await storage.listNewsComments();
  const gate = canPostLearnNewsComment(
    recent.map((item) => ({ emailHash: item.emailHash, createdAt: String(item.createdAt) })),
    emailHash,
    Date.now(),
  );
  if (!gate.ok) return res.status(429).json({ error: gate.error });
  const saved = await storage.insertNewsComment({
    pieceId: id,
    name: parsed.name,
    emailHash,
    body: parsed.body,
    marketingOptIn: parsed.marketingOptIn,
  });
  if (parsed.marketingOptIn && row.userId) {
    try {
      const existing = await storage.getMarketingContactByEmail(parsed.email, row.userId);
      if (!existing?.unsubscribed) {
        const tags = Array.from(new Set([...(existing?.tags || []), "learn_news"]));
        const nameParts = parsed.name.split(/\s+/);
        await storage.createOrUpdateMarketingContact(
          {
            email: parsed.email,
            firstName: nameParts[0] || parsed.name,
            lastName: nameParts.slice(1).join(" ") || existing?.lastName,
            tags,
            unsubscribed: false,
          },
          row.userId,
        );
      }
    } catch {
      // Comment still stands if the magnet write fails.
    }
  }
  res.status(201).json(toLearnNewsCommentPublic(saved));
});

router.post("/learn/piece/:id/helped", async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const already = cookieList(req.get("cookie"), "learn_helped");
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

async function resolveToolsOwnerUserId(): Promise<string | null> {
  const users = await storage.getAllUsers();
  const shaun = users.find((user) => (user.email || "").toLowerCase() === "shaun@veltro.co.uk");
  if (shaun) return shaun.id;
  const admin = users.find((user) => user.role === "super_admin");
  if (admin) return admin.id;
  return users[0]?.id ?? null;
}

router.post("/learn/tools/email-me", async (req, res) => {
  const parsed = validateToolEmailRequest(req.body ?? {});
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  let subject: string;
  let html: string;
  if (parsed.tool === "ttp-calculator") {
    const input = {
      arrears: Number(req.body?.arrears) || 0,
      periodMonths: Number(req.body?.periodMonths) || 12,
      includeInterest: req.body?.includeInterest === true,
      annualRatePercent: Number(req.body?.annualRatePercent) || 0,
    };
    const result = calculateTtp(input);
    subject = "Your Time to Pay estimate — Strata Learn";
    html = ttpEmailHtml(parsed.name, input, result);
  } else {
    const rawOutgoings = req.body?.outgoings ?? {};
    const outgoings = {
      ...emptyOutgoings(),
      payroll: Number(rawOutgoings.payroll) || 0,
      rent: Number(rawOutgoings.rent) || 0,
      hmrcVat: Number(rawOutgoings.hmrcVat) || 0,
      suppliers: Number(rawOutgoings.suppliers) || 0,
      other: Number(rawOutgoings.other) || 0,
    };
    const debts: DebtRow[] = Array.isArray(req.body?.debts)
      ? req.body.debts.slice(0, 20).map((row: any, i: number) => ({
          id: String(row?.id || i),
          label: String(row?.label || "Facility"),
          balance: Number(row?.balance) || 0,
          repaymentAmount: Number(row?.repaymentAmount) || 0,
          frequency: row?.frequency === "daily" || row?.frequency === "weekly" ? row.frequency : "monthly",
        }))
      : [];
    const result = calculateDebtStress({
      monthlyIncome: Number(req.body?.monthlyIncome) || 0,
      outgoings,
      debts,
      cashOnHand: Number(req.body?.cashOnHand) || 0,
    });
    subject = "Your Debt Stress Check — Strata Learn";
    html = debtStressEmailHtml(parsed.name, result);
  }

  try {
    await sendEmail({}, parsed.email, subject, html);
  } catch (err) {
    console.error("[Learn Tools] email-me failed:", err);
    return res.status(502).json({ error: "Could not send that email. Try again shortly." });
  }

  if (parsed.marketingOptIn) {
    try {
      const userId = await resolveToolsOwnerUserId();
      if (userId) {
        const existing = await storage.getMarketingContactByEmail(parsed.email, userId);
        if (!existing?.unsubscribed) {
          const tags = Array.from(new Set([...(existing?.tags || []), `learn_tools_${parsed.tool}`]));
          const nameParts = parsed.name.split(/\s+/);
          await storage.createOrUpdateMarketingContact(
            {
              email: parsed.email,
              firstName: nameParts[0] || parsed.name,
              lastName: nameParts.slice(1).join(" ") || existing?.lastName,
              tags,
              unsubscribed: false,
            },
            userId,
          );
        }
      }
    } catch {
      // The email already went out; the magnet write failing shouldn't fail the request.
    }
  }

  res.json({ ok: true });
});

export default router;
