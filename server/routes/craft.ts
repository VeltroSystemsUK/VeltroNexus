import { Router } from "express";
import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { handleApiError } from "../utils/errorHandler";
import {
  applyAmmoToWeek,
  applyChannelHandles,
  applyCopyPatch,
  defaultChannels,
  generateWeek,
  mergeGeneratedWeek,
  normalizePost,
  parseChannelPatch,
  parseCopyPatch,
  parseWeekGenerate,
  type CraftChannel,
  type CraftPost,
} from "@shared/craftQueue";
import { normalizeAmmo, type CreativeAmmoBrief } from "@shared/craftScout";
import { ammoForPost, parseYaffleImageRequest, yafflePromptFromAmmo } from "@shared/craftYaffle";
import { canPublishLearn, slugifyLearnTitle, snapshotLearnPiece, NEWS_CATEGORIES } from "@shared/learn";
import type { LearnPiece } from "@shared/schema";
import { researchWeek } from "../services/caseyScout";
import { grokFile, grokGenerateStill, grokJob } from "../services/grokImages";
import { stillStatus, yaffleFileBuffer, yaffleJob } from "../services/yaffleSidecar";

interface AuthenticatedRequest extends Request {
  user?: any;
}

type Desk = {
  week: CraftPost[];
  channels: CraftChannel[];
  weekStart: string | null;
  briefs: CreativeAmmoBrief[];
};

const DESK_FILE = path.resolve(process.cwd(), "uploads", "craft_desk.json");

const router = Router();

function readAll(): Record<string, Desk> {
  try {
    if (!fs.existsSync(DESK_FILE)) return {};
    return JSON.parse(fs.readFileSync(DESK_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, Desk>) {
  const dir = path.dirname(DESK_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DESK_FILE, JSON.stringify(data, null, 2));
}

function deskFor(userId: string): Desk {
  const all = readAll();
  const desk = all[userId] ?? { week: [], channels: defaultChannels(), weekStart: null, briefs: [] };
  return {
    ...desk,
    week: (desk.week ?? []).map(normalizePost),
    channels: desk.channels ?? defaultChannels(),
    briefs: normalizeAmmo(desk.briefs),
  };
}

function saveDesk(userId: string, desk: Desk) {
  const all = readAll();
  all[userId] = desk;
  writeAll(all);
}

router.get("/craft/desk", isAuthenticated, (req: AuthenticatedRequest, res: Response) => {
  try {
    const desk = deskFor(req.user!.id);
    res.json({ ...desk, channels: desk.channels.length ? desk.channels : defaultChannels() });
  } catch (err) {
    handleApiError(res, err, "craft-desk");
  }
});

router.post("/craft/week", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const desk = deskFor(req.user!.id);
    const { from, mode, selectedId, stamp } = parseWeekGenerate(req.body);
    const channels = desk.channels.length ? desk.channels : defaultChannels();
    const briefs =
      mode === "selected" && desk.briefs.length === 7
        ? desk.briefs
        : await researchWeek(desk.briefs);
    const generated = generateWeek(
      from,
      briefs,
      mode === "replace" ? stamp || Date.now().toString(36) : undefined,
    ).map((post) => applyChannelHandles(post, channels));
    const week = mergeGeneratedWeek(desk.week, generated, mode, selectedId);
    const next: Desk = { week, channels, weekStart: week[0]?.date ?? from, briefs };
    saveDesk(req.user!.id, next);
    res.json(next);
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (/pick a post|post not found/i.test(msg)) {
      return res.status(400).json({ error: msg });
    }
    handleApiError(res, err, "craft-week");
  }
});

router.post("/craft/scan", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const desk = deskFor(req.user!.id);
    const briefs = await researchWeek(desk.briefs);
    const channels = desk.channels.length ? desk.channels : defaultChannels();
    const week = desk.week.length
      ? applyAmmoToWeek(desk.week, briefs)
      : generateWeek(desk.weekStart || new Date().toISOString().slice(0, 10), briefs).map((post) =>
          applyChannelHandles(post, channels),
        );
    const next: Desk = { ...desk, channels, week, weekStart: week[0]?.date ?? desk.weekStart, briefs };
    saveDesk(req.user!.id, next);
    res.json(next);
  } catch (err) {
    handleApiError(res, err, "craft-scan");
  }
});

router.patch("/craft/week/:id", isAuthenticated, (req: AuthenticatedRequest, res: Response) => {
  try {
    const patch = parseCopyPatch(req.body);
    const desk = deskFor(req.user!.id);
    let found = false;
    const week = desk.week.map((post) => {
      if (post.id !== req.params.id) return post;
      found = true;
      return applyCopyPatch(post, patch);
    });
    if (!found) {
      return res.status(404).json({ error: "Post not found" });
    }
    const next = { ...desk, week };
    saveDesk(req.user!.id, next);
    res.json(next);
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (/invalid status|invalid compliance|house policy|invalid patch|marketing must approve|packager|do not lend|compliance must sign off|http\(s\)|valid http|characters or fewer|at most/i.test(msg)) {
      return res.status(400).json({ error: msg });
    }
    handleApiError(res, err, "craft-week-patch");
  }
});

const publishLearnSchema = z.object({
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  category: z.enum(NEWS_CATEGORIES).nullable().optional(),
  overrideCompliance: z.boolean().optional(),
  publishedAt: z.string().optional(),
});

function craftPostToLearnBody(post: CraftPost): string {
  const heroLine = [post.hook, post.hook2].filter(Boolean).join(" ");
  return [heroLine, post.body, post.cta].filter((part) => part && part.trim().length > 0).join("\n\n");
}

router.post("/craft/week/:id/publish-learn", isAuthenticated, (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = publishLearnSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
    const desk = deskFor(req.user!.id);
    const post = desk.week.find((row) => row.id === req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });
    const slug = slugifyLearnTitle(parsed.data.slug || post.title);
    if (!slug) return res.status(400).json({ error: "Slug is required." });
    const excerpt = parsed.data.excerpt ?? "";
    const body = craftPostToLearnBody(post);
    const gate = canPublishLearn({
      status: post.status,
      compliance: post.compliance,
      autoPublish: post.autoPublish !== false,
      kind: "news",
      type: "news",
      title: post.title,
      excerpt,
      body,
      overrideCompliance: parsed.data.overrideCompliance === true,
      category: parsed.data.category,
    });
    if (!gate.ok) return res.status(400).json({ error: gate.error });
    const snapshot = snapshotLearnPiece({
      kind: "news",
      slug,
      title: post.title,
      excerpt,
      body,
      pathPosition: null,
      category: parsed.data.category,
      publishedAt: parsed.data.publishedAt,
      source: { desk: "craft", id: post.id },
      userId: req.user!.id,
    });
    storage
      .upsertLiveLearnPiece(snapshot as LearnPiece)
      .then((live) => res.json(live))
      .catch((err: any) => {
        if (err?.message === "slug taken") return res.status(400).json({ error: err.message });
        handleApiError(res, err, "craft-publish-learn");
      });
  } catch (err: any) {
    handleApiError(res, err, "craft-publish-learn");
  }
});

router.put("/craft/channels/:id", isAuthenticated, (req: AuthenticatedRequest, res: Response) => {
  try {
    const patch = parseChannelPatch(req.body);
    const desk = deskFor(req.user!.id);
    const channels = (desk.channels.length ? desk.channels : defaultChannels()).map((ch) =>
      ch.id === req.params.id ? { ...ch, ...patch } : ch
    );
    if (!channels.some((ch) => ch.id === req.params.id)) {
      return res.status(404).json({ error: "Unknown channel" });
    }
    const next = { ...desk, channels };
    saveDesk(req.user!.id, next);
    res.json(next);
  } catch (err: any) {
    if (String(err?.message || "").toLowerCase().includes("password")) {
      return res.status(400).json({ error: err.message });
    }
    handleApiError(res, err, "craft-channels");
  }
});

router.get("/craft/yaffle/status", isAuthenticated, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(await stillStatus());
  } catch (err) {
    handleApiError(res, err, "craft-yaffle-status");
  }
});

router.post("/craft/yaffle/image", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { postId, prompt } = parseYaffleImageRequest(req.body);
    const desk = deskFor(req.user!.id);
    const post = desk.week.find((item) => item.id === postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    const brief = ammoForPost(desk.briefs, post);
    const line = prompt || (brief ? yafflePromptFromAmmo(brief) : post.visual?.prompt || post.hook);
    if (!line?.trim()) return res.status(400).json({ error: "Casey has no image prompt for this post. Scan first." });
    const job = await grokGenerateStill(line, post.presetId);
    res.json({ ...job, postId });
  } catch (err: any) {
    const msg = String(err?.message || "Images failed");
    const status = /timed out/i.test(msg) ? 504 : /expired|credential|XAI_API_KEY|sign in/i.test(msg) ? 401 : 400;
    return res.status(status).json({ error: msg.slice(0, 400) });
  }
});

router.get("/craft/yaffle/jobs/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const grok = grokJob(req.params.id);
    if (grok) return res.json(grok);
    res.json(await yaffleJob(req.params.id));
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (/unknown yaffle job/i.test(msg)) return res.status(404).json({ error: msg });
    if (/not reachable/i.test(msg)) return res.status(400).json({ error: msg });
    handleApiError(res, err, "craft-yaffle-job");
  }
});

router.get("/craft/yaffle/jobs/:id/image", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const grok = grokFile(req.params.id);
    const file = grok ?? (await yaffleFileBuffer(req.params.id));
    res.setHeader("Content-Type", file.mime);
    res.setHeader("Content-Length", String(file.buffer.length));
    res.end(file.buffer);
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (/no file|empty image/i.test(msg)) return res.status(404).json({ error: msg });
    if (/not reachable/i.test(msg)) return res.status(400).json({ error: msg });
    handleApiError(res, err, "craft-yaffle-file");
  }
});

export default router;
