import { describe, expect, it } from "vitest";
import { scanWeek } from "@shared/craftScout";
import {
  ammoForPost,
  aspectForPreset,
  grokImageRequest,
  stillEngine,
  xaiBearer,
  yaffleImagePayload,
  yafflePromptFromAmmo,
} from "@shared/craftYaffle";

describe("Yaffle Creative sidecar prompts", () => {
  it("sends Casey's scene, not a pile of no-X slop in the positive prompt", () => {
    const brief = scanWeek()[0]!;
    expect(brief.imagePrompt.length).toBeGreaterThan(20);
    const prompt = yafflePromptFromAmmo(brief);
    expect(prompt).toBe(brief.imagePrompt);
    expect(prompt.toLowerCase()).not.toMatch(/\bno (luxury|logos|watermarks|rates)\b/);
    expect(prompt.toLowerCase()).not.toMatch(/\b(8k|masterpiece|octane|unreal engine)\b/);
    expect(prompt.toLowerCase()).not.toMatch(/\b(apr|payday|guaranteed funding)\b/);
  });

  it("packages a sidecar image job the way Yaffle's own UI does", () => {
    const brief = scanWeek()[0]!;
    const payload = yaffleImagePayload(yafflePromptFromAmmo(brief), "og", brief.stockId);
    expect(payload.prompt).toBe(brief.imagePrompt);
    expect(payload.aspect_ratio).toBe("16:9");
    expect(payload.style_engine).toBe("hyperreal_commercial");
    expect(payload.style_preset).toBe("photorealistic_hasselblad");
    expect(payload.lighting_profile).toBe("studio");
    expect(payload.lens).toBe("50mm");
    expect(payload.color_grade).toBeUndefined();
    expect(payload.film_grain).toBe(0);
    expect(payload.quality).toBe(true);
    expect(payload.refine).toBe(true);
    expect(payload.slop_suppressor).toBe(true);
    expect(payload.negative_prompt).toMatch(/watermark/i);
    expect(payload.negative_prompt).toMatch(/sepia|vintage|ornate frame/i);
    expect(payload.negative_prompt).toMatch(/luxury car/i);
    expect(payload.prompt).not.toMatch(/no logos/i);
    expect(aspectForPreset("square")).toBe("1:1");
    expect(aspectForPreset("story")).toBe("9:16");
  });

  it("prefers Grok Imagine when an xAI key is present", () => {
    expect(stillEngine(true)).toBe("grok");
    expect(stillEngine(false)).toBe("grok");
    const body = grokImageRequest("Late-afternoon UK office desk, empty chair", "og");
    expect(body.model).toBe("grok-imagine-image-2.0");
    expect(body.aspect_ratio).toBe("16:9");
    expect(body.resolution).toBe("1k");
    expect(body.quality).toBe("medium");
    expect(body.response_format).toBe("b64_json");
    expect(body.prompt.toLowerCase()).not.toMatch(/\b(sepia|8k|masterpiece)\b/);
  });

  it("uses XAI_API_KEY when set, otherwise the Grok CLI session token", () => {
    const grokAuth = {
      "https://auth.x.ai::team": { key: "  grok-session-token  ", auth_mode: "oidc" },
    };
    expect(xaiBearer({ XAI_API_KEY: "xai-from-env" }, grokAuth)).toBe("xai-from-env");
    expect(xaiBearer({ XAI_API_KEY: "eyJhbGciOi.jwt" }, grokAuth)).toBe("grok-session-token");
    expect(xaiBearer({ XAI_API_KEY: "  " }, grokAuth)).toBe("grok-session-token");
    expect(xaiBearer({}, grokAuth)).toBe("grok-session-token");
    expect(xaiBearer({ XAI_API_KEY: "eyJhbGciOi.jwt" }, undefined)).toBe("eyJhbGciOi.jwt");
    expect(xaiBearer({ XAI_API_KEY: "" }, undefined)).toBeUndefined();
  });

  it("skips an expired Grok JWT instead of sending it to Imagine", () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ exp: 1 })).toString("base64url");
    const expired = `${header}.${payload}.sig`;
    const grokAuth = {
      "https://auth.x.ai::team": { key: expired, auth_mode: "oidc" },
    };
    expect(xaiBearer({ XAI_API_KEY: expired }, grokAuth)).toBeUndefined();
    expect(xaiBearer({ XAI_API_KEY: expired }, undefined)).toBeUndefined();
    expect(
      xaiBearer({ XAI_API_KEY: expired }, {
        "https://auth.x.ai::team": { key: "live-session", auth_mode: "oidc" },
      }),
    ).toBe("live-session");
  });

  it("pairs a queued post to its Content Aid brief", () => {
    const briefs = scanWeek();
    const post = { title: briefs[2]!.headline, track: briefs[2]!.track, visual: { stockId: briefs[2]!.stockId } };
    expect(ammoForPost(briefs, post)?.id).toBe(briefs[2]!.id);
  });
});
