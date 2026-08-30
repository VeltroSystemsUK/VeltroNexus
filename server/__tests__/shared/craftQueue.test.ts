import { describe, expect, it } from "vitest";
import {
  COPY_LIMITS,
  applyChannelHandles,
  applyCopyPatch,
  approvePost,
  defaultChannels,
  exportablePosts,
  generateWeek,
  mergeGeneratedWeek,
  parseChannelPatch,
  weekDesignWipeIds,
  parseHashtags,
  parseLinks,
  rejectPost,
  reviewMarketingCopy,
  signOffCompliance,
  weekCopyIsClean,
} from "@shared/craftQueue";

describe("generateWeek", () => {
  it("fills Monday–Sunday with LinkedIn-first packs for both tracks", () => {
    const week = generateWeek("2026-08-31");
    expect(week).toHaveLength(7);
    expect(week.map((p) => p.weekday)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(week.some((p) => p.track === "borrower")).toBe(true);
    expect(week.some((p) => p.track === "introducer")).toBe(true);
    for (const post of week) {
      expect(post.status).toBe("draft");
      expect(post.compliance).toBe("pending");
      expect(post.autoPublish).toBe(false);
      expect(post.primaryChannel).toBe("linkedin");
      expect(post.channels).toEqual(["linkedin", "instagram", "facebook", "tiktok"]);
      expect(post.presetId).toBeTruthy();
      expect(post.hook.length).toBeGreaterThan(3);
      expect(post.hook.length).toBeLessThanOrEqual(COPY_LIMITS.hook);
      expect(post.hook2.length).toBeLessThanOrEqual(COPY_LIMITS.hook2);
      expect(post.body.length).toBeGreaterThan(20);
      expect(post.body.length).toBeLessThanOrEqual(COPY_LIMITS.body);
      expect(post.cta.length).toBeLessThanOrEqual(COPY_LIMITS.cta);
      expect(post.hashtags.length).toBeLessThanOrEqual(COPY_LIMITS.hashtags);
    }
  });

  it("rejects copy that will not fit the board", () => {
    const post = generateWeek("2026-08-31")[0]!;
    expect(() =>
      applyCopyPatch(post, {
        hook: "This hook is deliberately far too long to sit on a social graphic without eating the CTA, the hashtags, and the link.",
      })
    ).toThrow(/hook/i);
  });

  it("does not invent rates, guarantees, or consumer-credit claims", () => {
    const week = generateWeek("2026-08-31");
    for (const post of week) {
      expect(weekCopyIsClean(post)).toBe(true);
    }
  });

  it("stamps replace ids so cached designs cannot reattach", () => {
    const a = generateWeek("2026-08-31", undefined, "aaa");
    const b = generateWeek("2026-08-31", undefined, "bbb");
    expect(a.map((p) => p.id)).not.toEqual(b.map((p) => p.id));
    expect(a[0]!.id).toContain("aaa");
  });
});

describe("mergeGeneratedWeek", () => {
  it("replace swaps the whole queue", () => {
    const existing = generateWeek("2026-08-31", undefined, "old");
    const next = generateWeek("2026-08-31", undefined, "new");
    const merged = mergeGeneratedWeek(existing, next, "replace");
    expect(merged.map((p) => p.id)).toEqual(next.map((p) => p.id));
  });

  it("keep_approved leaves signed-off posts and fills the rest", () => {
    const existing = generateWeek("2026-08-31", undefined, "old");
    const kept = { ...existing[0]!, status: "approved" as const, compliance: "cleared" as const };
    existing[0] = kept;
    existing[2] = { ...existing[2]!, hook: "Hand-edited hook that must survive." };
    const next = generateWeek("2026-08-31", undefined, "new");
    const merged = mergeGeneratedWeek(existing, next, "keep_approved");
    expect(merged[0]!.id).toBe(kept.id);
    expect(merged[0]!.compliance).toBe("cleared");
    expect(merged[2]!.hook).toBe(next[2]!.hook);
    expect(merged[2]!.hook).not.toBe("Hand-edited hook that must survive.");
  });

  it("selected replaces one post and keeps the others", () => {
    const existing = generateWeek("2026-08-31", undefined, "old");
    const next = generateWeek("2026-08-31", undefined, "new");
    const target = existing[3]!;
    const merged = mergeGeneratedWeek(existing, next, "selected", target.id);
    expect(merged[3]!.hook).toBe(next[3]!.hook);
    expect(merged[3]!.id).toBe(target.id);
    expect(merged[1]!.id).toBe(existing[1]!.id);
    expect(merged.filter((p) => p.id === existing[1]!.id)).toHaveLength(1);
  });

  it("names the designs that must be wiped for each mode", () => {
    const existing = generateWeek("2026-08-31", undefined, "old");
    existing[0] = { ...existing[0]!, status: "approved", compliance: "cleared" };
    expect(weekDesignWipeIds(existing, "replace")).toEqual(existing.map((p) => p.id));
    expect(weekDesignWipeIds(existing, "keep_approved")).toEqual(existing.slice(1).map((p) => p.id));
    expect(weekDesignWipeIds(existing, "selected", existing[3]!.id)).toEqual([existing[3]!.id]);
  });
});

describe("approve and export", () => {
  it("does not export until marketing is approved and compliance has signed off", () => {
    const week = generateWeek("2026-08-31");
    const approved = approvePost(week, week[0].id);
    expect(exportablePosts(approved)).toHaveLength(0);
    expect(approved[0]!.compliance).toBe("pending");
    expect(reviewMarketingCopy(approved[0]!).ok).toBe(true);

    expect(() => signOffCompliance(week[0]!)).toThrow(/marketing must approve/i);

    const cleared = signOffCompliance(approved[0]!);
    expect(cleared.compliance).toBe("cleared");
    const pack = exportablePosts(approved.map((p) => (p.id === cleared.id ? cleared : p)));
    expect(pack).toHaveLength(1);
    expect(pack[0]!.id).toBe(week[0]!.id);
  });

  it("blocks compliance sign-off when the post does not say Strata packages and does not lend", () => {
    const post = approvePost(generateWeek("2026-08-31"), generateWeek("2026-08-31")[0]!.id)[0]!;
    const dirty = applyCopyPatch(post, {
      status: "approved",
      body: "UK limited companies can often refinance a stack of short-term facilities into a cleaner structure.",
    });
    expect(dirty.status).toBe("approved");
    expect(reviewMarketingCopy(dirty).ok).toBe(false);
    expect(() => signOffCompliance(dirty)).toThrow(/packager|not lend/i);
    expect(exportablePosts([dirty])).toHaveLength(0);
  });

  it("returns copy to draft and pending compliance when the words change", () => {
    const approved = approvePost(generateWeek("2026-08-31"), generateWeek("2026-08-31")[0]!.id)[0]!;
    const cleared = signOffCompliance(approved);
    const next = applyCopyPatch(cleared, { hook: "Rewritten hook this week." });
    expect(next.status).toBe("draft");
    expect(next.compliance).toBe("pending");
  });
});

describe("edit draft copy", () => {
  it("writes title, hook, body, cta and hashtags onto a draft", () => {
    const post = generateWeek("2026-08-31")[0]!;
    const next = applyCopyPatch(post, {
      title: "  New title  ",
      hook: "A sharper hook.",
      body: "Full LinkedIn body that still packages, not lends.",
      cta: "Talk to Strata.",
      links: "stratafinance.co.uk/start\nhttps://linkedin.com/company/strata",
      hashtags: "#SMEFinance extra",
    });
    expect(next.title).toBe("New title");
    expect(next.hook).toBe("A sharper hook.");
    expect(next.body).toBe("Full LinkedIn body that still packages, not lends.");
    expect(next.cta).toBe("Talk to Strata.");
    expect(next.links).toEqual([
      "https://stratafinance.co.uk/start",
      "https://linkedin.com/company/strata",
    ]);
    expect(next.hashtags).toEqual(["#SMEFinance", "#extra"]);
    expect(next.status).toBe("draft");
    expect(next.autoPublish).toBe(false);
    expect(weekCopyIsClean(next)).toBe(true);
  });

  it("returns an approved post to draft when copy changes", () => {
    const post = approvePost(generateWeek("2026-08-31"), generateWeek("2026-08-31")[0]!.id)[0]!;
    expect(post.status).toBe("approved");
    const next = applyCopyPatch(post, { hook: "Rewritten hook for the week." });
    expect(next.status).toBe("draft");
    expect(next.hook).toBe("Rewritten hook for the week.");
  });

  it("does not wipe status when only status is patched", () => {
    const post = generateWeek("2026-08-31")[0]!;
    const next = applyCopyPatch(post, { status: "approved" });
    expect(next.status).toBe("approved");
    expect(next.hook).toBe(post.hook);
  });

  it("rejects guaranteed-funding claims", () => {
    const post = generateWeek("2026-08-31")[0]!;
    expect(() => applyCopyPatch(post, { body: "Guaranteed funding for every applicant." })).toThrow(
      /house policy/i
    );
  });

  it("parses hashtag strings into #tags", () => {
    expect(parseHashtags("#SMEFinance, UKBusiness extra")).toEqual([
      "#SMEFinance",
      "#UKBusiness",
      "#extra",
    ]);
    expect(parseHashtags(["#SME", "directors"])).toEqual(["#SME", "#directors"]);
  });

  it("parses http(s) links and rejects other schemes", () => {
    expect(parseLinks("stratafinance.co.uk  https://example.com/pack")).toEqual([
      "https://stratafinance.co.uk/",
      "https://example.com/pack",
    ]);
    expect(() => parseLinks("javascript:alert(1)")).toThrow(/http/i);
  });
});

describe("channels", () => {
  it("starts disconnected with public URL and handle slots only", () => {
    const channels = defaultChannels();
    expect(channels.map((c) => c.id)).toEqual([
      "linkedin",
      "instagram",
      "facebook",
      "tiktok",
      "linkedin_ads",
      "meta_ads",
    ]);
    for (const channel of channels) {
      expect(channel.status).toBe("not_connected");
      expect(channel).not.toHaveProperty("password");
      expect(channel).not.toHaveProperty("secret");
    }
  });

  it("rejects password fields and stamps handles onto copy", () => {
    expect(() => parseChannelPatch({ password: "hunter2" })).toThrow(/password/i);
    const stamped = applyChannelHandles(
      generateWeek("2026-08-31")[0],
      defaultChannels().map((c) =>
        c.id === "linkedin" ? { ...c, handle: "stratafinance", url: "https://linkedin.com/company/strata" } : c
      )
    );
    expect(stamped.body).toContain("linkedin.com/company/strata");
  });
});
