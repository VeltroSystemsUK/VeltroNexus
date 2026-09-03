import { describe, expect, it } from "vitest";
import { canPublishLearn, buildLearnHome, type LearnPieceLike } from "@shared/learn";
import { retrieveLearnPieces } from "@shared/learnLibrarian";
import {
  canPostLearnNewsComment,
  hideLearnNewsComment,
  parseLikedCookie,
  toLearnNewsCommentPublic,
  validateLearnNewsComment,
} from "@shared/learnNews";
import { hashLearnCommentEmail } from "../../services/learnNewsHash";

const PEPPER = "test-pepper";

describe("validateLearnNewsComment", () => {
  const good = {
    name: "Jordan Hale",
    email: "jordan@joinery.co.uk",
    body: "This is the first useful explanation of Time to Pay I have read as a director.",
    marketingOptIn: false,
  };

  it("accepts a clean named comment", () => {
    const parsed = validateLearnNewsComment(good);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.name).toBe("Jordan Hale");
      expect(parsed.email).toBe("jordan@joinery.co.uk");
      expect(parsed.marketingOptIn).toBe(false);
    }
  });

  it("rejects a name that is an email, a URL in the body, and a short body", () => {
    expect(validateLearnNewsComment({ ...good, name: "jordan@joinery.co.uk" }).ok).toBe(false);
    expect(validateLearnNewsComment({ ...good, body: "See https://claims.example for help with your facility." }).ok).toBe(
      false,
    );
    expect(validateLearnNewsComment({ ...good, body: "Too short." }).ok).toBe(false);
  });

  it("defaults the magnet tick to off", () => {
    const parsed = validateLearnNewsComment({ name: good.name, email: good.email, body: good.body });
    expect(parsed.ok && parsed.marketingOptIn).toBe(false);
  });
});

describe("comment identity and rate limit", () => {
  it("hashes emails case-insensitively", () => {
    expect(hashLearnCommentEmail("Jordan@Joinery.co.uk", PEPPER)).toBe(
      hashLearnCommentEmail("jordan@joinery.co.uk", PEPPER),
    );
    expect(hashLearnCommentEmail("jordan@joinery.co.uk", PEPPER)).not.toBe(
      hashLearnCommentEmail("jordan@joinery.co.uk", "other"),
    );
  });

  it("allows three comments an hour then blocks the fourth", () => {
    const now = Date.parse("2026-09-03T12:00:00.000Z");
    const hash = hashLearnCommentEmail("jordan@joinery.co.uk", PEPPER);
    const rows = [1, 2, 3].map((n) => ({
      emailHash: hash,
      createdAt: new Date(now - n * 60_000).toISOString(),
    }));
    expect(canPostLearnNewsComment(rows, hash, now).ok).toBe(false);
    expect(canPostLearnNewsComment(rows.slice(1), hash, now).ok).toBe(true);
  });
});

describe("public comment and hide", () => {
  it("strips email and hash from the public row and hide takes it off Learn", () => {
    const publicRow = toLearnNewsCommentPublic({
      id: 4,
      pieceId: 11,
      name: "Jordan Hale",
      emailHash: "abc",
      body: "Useful.",
      marketingOptIn: true,
      live: true,
      createdAt: "2026-09-03T12:00:00.000Z",
    });
    expect(publicRow).toEqual({
      id: 4,
      name: "Jordan Hale",
      body: "Useful.",
      createdAt: "2026-09-03T12:00:00.000Z",
    });
    expect(hideLearnNewsComment({ live: true }).live).toBe(false);
  });
});

describe("likes cookie", () => {
  it("parses ids once", () => {
    expect(parseLikedCookie("1,2,2")).toEqual([1, 2]);
  });
});

describe("news lane vs lessons", () => {
  function live(over: Partial<LearnPieceLike> = {}): LearnPieceLike {
    return {
      id: 1,
      slug: "channel-one",
      kind: "news",
      title: "HMRC is writing again",
      excerpt: "A note from the desk.",
      heroImageUrl: null,
      body: "Strata packages files. We do not lend.",
      videoUrl: "",
      transcript: "",
      pathPosition: null,
      durationLabel: "",
      thisHelped: 0,
      source: { desk: "editorial", id: 8 },
      live: true,
      publishedAt: "2026-09-03T12:00:00.000Z",
      unpublishedAt: null,
      userId: "u1",
      createdAt: "2026-09-03T12:00:00.000Z",
      updatedAt: "2026-09-03T12:00:00.000Z",
      ...over,
    };
  }

  it("lets a cleared news post publish and keeps news out of the lesson library", () => {
    expect(
      canPublishLearn({
        status: "approved",
        compliance: "cleared",
        autoPublish: false,
        kind: "news",
        type: "news",
        category: "uk_commercial_finance",
        title: "HMRC is writing again",
        excerpt: "A note from the desk.",
        body: "Strata packages. We do not lend.",
      }).ok,
    ).toBe(true);
    expect(
      canPublishLearn({
        status: "approved",
        compliance: "cleared",
        autoPublish: false,
        kind: "news",
        type: "news",
        title: "HMRC is writing again",
        excerpt: "A note from the desk.",
        body: "Strata packages. We do not lend.",
      }).ok,
    ).toBe(false);
    expect(
      canPublishLearn({
        status: "approved",
        compliance: "cleared",
        autoPublish: false,
        kind: "news",
        type: "blog",
        title: "HMRC is writing again",
        excerpt: "A note.",
        body: "Strata packages. We do not lend.",
      }).ok,
    ).toBe(false);
    const home = buildLearnHome([live(), live({ id: 2, kind: "article", slug: "warehouse-brokers", pathPosition: null })]);
    expect(home.library.map((row) => row.slug)).toEqual(["warehouse-brokers"]);
    expect(home.news.map((row) => row.slug)).toEqual(["channel-one"]);
  });

  it("does not feed news posts to the desk", () => {
    const news = live();
    expect(retrieveLearnPieces([news], "HMRC writing").map((row) => row.slug)).toEqual([]);
  });
});
