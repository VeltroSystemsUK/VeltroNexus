import { describe, expect, it } from "vitest";
import {
  buildLearnHome,
  canPublishLearn,
  helpedCookieValue,
  isAllowedVideoSource,
  isLearnHost,
  parseHelpedCookie,
  pathPositionTaken,
  reviewLearnCopy,
  slugifyLearnTitle,
  snapshotLearnPiece,
  toLearnPublic,
  type LearnPieceLike,
} from "@shared/learn";

function live(over: Partial<LearnPieceLike> = {}): LearnPieceLike {
  return {
    id: 1,
    slug: "payday-lenders",
    kind: "video",
    title: "What a commercial payday lender actually is",
    excerpt: "Stacked short-term facilities are a trap.",
    heroImageUrl: null,
    body: "",
    videoUrl: "/uploads/learn/videos/StrataFinance_PaydayLenders.mp4",
    transcript: "Strata packages files. We do not lend.",
    pathPosition: 1,
    durationLabel: "1 min",
    thisHelped: 0,
    source: { desk: "learn-video", id: 9 },
    live: true,
    publishedAt: "2026-09-03T00:00:00.000Z",
    unpublishedAt: null,
    userId: "u1",
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    ...over,
  };
}

describe("isLearnHost", () => {
  it("accepts the public host and learn.localhost", () => {
    expect(isLearnHost("learn.stratanexus.co.uk")).toBe(true);
    expect(isLearnHost("learn.stratanexus.co.uk:443")).toBe(true);
    expect(isLearnHost("learn.localhost")).toBe(true);
    expect(isLearnHost("leads.stratanexus.co.uk")).toBe(false);
    expect(isLearnHost("localhost:5000")).toBe(false);
  });
});

describe("slug and video source", () => {
  it("slugifies titles", () => {
    expect(slugifyLearnTitle("HMRC Time to Pay")).toBe("hmrc-time-to-pay");
  });
  it("allows stored mp4 and YouTube/Vimeo, rejects Grok CDN", () => {
    expect(isAllowedVideoSource("/uploads/learn/videos/StrataFinance_PaydayLenders.mp4")).toBe(true);
    expect(isAllowedVideoSource("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(isAllowedVideoSource("https://youtu.be/abc")).toBe(true);
    expect(isAllowedVideoSource("https://vimeo.com/123")).toBe(true);
    expect(isAllowedVideoSource("https://assets.grok.com/users/x/generated/y/StrataFinance_Promo.mp4")).toBe(false);
    expect(isAllowedVideoSource("/uploads/learn/videos/../media/secret.mp4")).toBe(false);
  });
});

describe("path positions", () => {
  it("treats a live slot as taken unless it is the same id", () => {
    const rows = [live({ id: 1, pathPosition: 1 }), live({ id: 2, pathPosition: 2, live: false })];
    expect(pathPositionTaken(rows, 1)).toBe(true);
    expect(pathPositionTaken(rows, 1, 1)).toBe(false);
    expect(pathPositionTaken(rows, 2)).toBe(false);
    expect(pathPositionTaken(rows, null)).toBe(false);
  });
});

describe("reviewLearnCopy", () => {
  it("passes a payday warning that says packager not lender", () => {
    const text =
      "Commercial payday-style facilities are a trap. Strata packages distress-refinance files. We do not lend.";
    expect(reviewLearnCopy(text).ok).toBe(true);
  });
  it("blocks we lend and rate claims and missing packager line", () => {
    expect(reviewLearnCopy("We lend to UK SMEs at 9% APR.").ok).toBe(false);
    expect(reviewLearnCopy("Stacked debt is a trap.").ok).toBe(false);
  });
});

describe("canPublishLearn", () => {
  it("refuses drafts, press releases, grok CDN, and autoPublish", () => {
    const base = {
      status: "approved" as const,
      compliance: "cleared" as const,
      autoPublish: false as const,
      kind: "video" as const,
      title: "Payday",
      excerpt: "Trap",
      videoUrl: "/uploads/learn/videos/StrataFinance_PaydayLenders.mp4",
      description: "Strata packages files. We do not lend.",
    };
    expect(canPublishLearn(base).ok).toBe(true);
    expect(canPublishLearn({ ...base, status: "draft" }).ok).toBe(false);
    expect(canPublishLearn({ ...base, autoPublish: true }).ok).toBe(false);
    expect(
      canPublishLearn({
        ...base,
        kind: "article",
        type: "press_release",
        videoUrl: "",
        body: "Strata packages. We do not lend.",
      }).ok,
    ).toBe(false);
    expect(
      canPublishLearn({
        ...base,
        videoUrl: "https://assets.grok.com/users/x/generated/y/a.mp4",
      }).ok,
    ).toBe(false);
  });
});

describe("home split and public DTO", () => {
  it("orders path, skips holes, newest library, strips source", () => {
    const rows = [
      live({ id: 1, pathPosition: 1, slug: "payday" }),
      live({ id: 2, pathPosition: 3, slug: "ttp", publishedAt: "2026-09-02T00:00:00.000Z" }),
      live({
        id: 3,
        pathPosition: null,
        slug: "promo",
        kind: "video",
        publishedAt: "2026-09-04T00:00:00.000Z",
      }),
    ];
    const home = buildLearnHome(rows);
    expect(home.path.map((p) => p.slug)).toEqual(["payday", "ttp"]);
    expect(home.library.map((p) => p.slug)).toEqual(["promo"]);
    expect(home.path[0]).not.toHaveProperty("source");
    expect(home.path[0]).not.toHaveProperty("userId");
  });
});

describe("this helped cookie", () => {
  it("parses and appends ids once", () => {
    expect(parseHelpedCookie("1,2,2")).toEqual([1, 2]);
    expect(helpedCookieValue([1, 3])).toBe("1,3");
  });
});

describe("snapshotLearnPiece", () => {
  it("copies article markdown and video url into a live row", () => {
    const snap = snapshotLearnPiece({
      kind: "article",
      slug: "time-to-pay",
      title: "Time to Pay is not a write-off",
      excerpt: "HMRC instalments, not a loan.",
      body: "Strata packages. We do not lend.",
      source: { desk: "editorial", id: 4 },
      pathPosition: 3,
      userId: "u1",
    });
    expect(snap.live).toBe(true);
    expect(snap.kind).toBe("article");
    expect(snap.videoUrl).toBe("");
    expect(snap.body).toMatch(/do not lend/);
  });
});
