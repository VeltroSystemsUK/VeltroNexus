import { visualForTrack } from "./craftDirector";
import type { CreativeAmmoBrief } from "./craftScout";

export const YAFFLE_DEFAULT_URL = "http://127.0.0.1:47831";

export type YaffleAspect = "16:9" | "1:1" | "9:16";

export function aspectForPreset(presetId?: string): YaffleAspect {
  if (presetId === "square") return "1:1";
  if (presetId === "story") return "9:16";
  return "16:9";
}

export function ammoForPost(
  briefs: CreativeAmmoBrief[],
  post: { title?: string; track?: string; visual?: { stockId?: string } },
): CreativeAmmoBrief | undefined {
  return (
    briefs.find((brief) => brief.headline === post.title) ||
    briefs.find((brief) => brief.track === post.track && brief.stockId === post.visual?.stockId) ||
    briefs.find((brief) => brief.track === post.track)
  );
}

const SLOP =
  /\b(masterpiece|8k|4k|octane|unreal engine|trending on artstation|best quality|ultra detailed|cinematic lighting|award winning)\b/gi;

export function stripSlop(prompt: string): string {
  return prompt
    .replace(SLOP, "")
    .replace(/\bnot stock-smile\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/[. ,]+$/g, "")
    .trim();
}

export function lightingForStock(_stockId?: string): string {
  return "studio";
}

export function lensForStock(_stockId?: string): string {
  return "50mm";
}

export function stylePresetForStock(_stockId?: string): string {
  return "photorealistic_hasselblad";
}

export function yaffleNegative(): string {
  return "sepia, vintage, aged paper, yellowed, ornate frame, picture frame, vignette, film grain, polaroid, luxury car, glass skyscraper, handshake, homelessness, stock smile, neon glow, fintech gradient, readable text, logo, watermark, rate, APR, generic AI art, oversaturated";
}

export function yafflePromptFromAmmo(
  brief: Pick<CreativeAmmoBrief, "imagePrompt" | "socialAngle" | "stockId" | "track">,
): string {
  const visual = visualForTrack(brief.track, brief.stockId);
  return stripSlop(brief.imagePrompt || visual.prompt || visual.query || brief.socialAngle);
}

export function yaffleImagePayload(prompt: string, presetId?: string, stockId?: string) {
  return {
    prompt: stripSlop(prompt),
    negative_prompt: yaffleNegative(),
    aspect_ratio: aspectForPreset(presetId),
    style_engine: "hyperreal_commercial",
    style_preset: stylePresetForStock(stockId),
    lighting_profile: lightingForStock(stockId),
    lens: lensForStock(stockId),
    slop_suppressor: true,
    anatomy_guardrails: true,
    render_suppression: true,
    defect_filtering: true,
    compositional_noise: true,
    artistic_medium: true,
    auto_snap_cfg: true,
    auto_snap_negative: true,
    quality: true,
    refine: true,
    qa_retry: true,
    film_grain: 0,
    bank_weights: {
      anatomy_strict: 1.1,
      render_suppression: 1.15,
      photographic_defects: 1,
      compositional_noise: 1.1,
      artistic_medium: 1.1,
      slop_suppressor: 1.15,
    },
  };
}

export const GROK_IMAGE_MODEL = "grok-imagine-image-2.0";

export function stillEngine(_hasGrokKey?: boolean): "grok" | "yaffle" {
  return "grok";
}

/** Console `xai-` key wins; otherwise the Grok CLI session; otherwise any XAI_API_KEY. */
export function xaiBearer(
  env: Record<string, string | undefined>,
  grokAuth?: unknown,
): string | undefined {
  const fromEnv = env.XAI_API_KEY?.trim();
  if (fromEnv?.startsWith("xai-")) return fromEnv;
  if (grokAuth && typeof grokAuth === "object") {
    for (const account of Object.values(grokAuth as Record<string, unknown>)) {
      if (!account || typeof account !== "object") continue;
      const key = (account as { key?: unknown }).key;
      if (typeof key === "string" && key.trim()) return key.trim();
    }
  }
  return fromEnv || undefined;
}

export function grokImageRequest(prompt: string, presetId?: string) {
  return {
    model: GROK_IMAGE_MODEL,
    prompt: stripSlop(prompt),
    n: 1,
    aspect_ratio: aspectForPreset(presetId),
    resolution: "1k",
    quality: "medium",
    response_format: "b64_json" as const,
  };
}

export function parseYaffleImageRequest(input: unknown): { postId: string; prompt?: string } {
  if (!input || typeof input !== "object") throw new Error("Invalid Yaffle request");
  const raw = input as Record<string, unknown>;
  const postId = typeof raw.postId === "string" ? raw.postId.trim() : "";
  if (!postId) throw new Error("Pick a post for Isla to generate.");
  const prompt = typeof raw.prompt === "string" && raw.prompt.trim() ? raw.prompt.trim() : undefined;
  return { postId, prompt };
}
