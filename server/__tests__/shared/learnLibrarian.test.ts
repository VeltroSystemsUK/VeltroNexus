import { describe, expect, it } from "vitest";
import {
  answerLearnQuestion,
  LEARN_DESK_PROMPTS,
  retrieveLearnPieces,
  shouldHandoffQuestion,
} from "@shared/learnLibrarian";

const payday = {
  id: 1,
  slug: "payday-lenders",
  kind: "video" as const,
  title: "Commercial payday lenders",
  excerpt: "Stacked short-term facilities are a trap.",
  body: "",
  transcript: "A commercial payday lender is short-term high-cost credit. Strata packages. We do not lend.",
  live: true,
  pathPosition: 1,
};

describe("handoff", () => {
  it("does not call the model for eligibility", async () => {
    let called = false;
    const res = await answerLearnQuestion({
      question: "Can you do my deal at 9%?",
      live: [payday],
      ask: async () => {
        called = true;
        return "yes";
      },
    });
    expect(shouldHandoffQuestion("Can you do my deal at 9%?")).toBe(true);
    expect(called).toBe(false);
    expect(res.kind).toBe("handoff");
  });
});

describe("grounded answer", () => {
  it("cites the payday lesson and refuses ungrounded rates", async () => {
    const res = await answerLearnQuestion({
      question: "What is a commercial payday lender?",
      live: [payday],
      ask: async (_s, user) => {
        expect(user).toMatch(/payday/i);
        return "A commercial payday lender is short-term high-cost credit. Source: Commercial payday lenders.";
      },
    });
    expect(res.kind).toBe("answer");
    expect(res.citations?.some((c) => c.slug === "payday-lenders")).toBe(true);
  });

  it("turns a model eligibility claim into a handoff", async () => {
    const res = await answerLearnQuestion({
      question: "What is stacked debt?",
      live: [payday],
      ask: async () => "You would be eligible for CDFI at 6% APR.",
    });
    expect(res.kind).toBe("handoff");
  });

  it("unavailable when ask throws", async () => {
    const res = await answerLearnQuestion({
      question: "What is stacked debt?",
      live: [payday],
      ask: async () => {
        throw new Error("down");
      },
    });
    expect(res.kind).toBe("unavailable");
  });
});

describe("desk prompts", () => {
  it("offers valid questions that never trip the file handoff", () => {
    expect(LEARN_DESK_PROMPTS.length).toBeGreaterThanOrEqual(6);
    for (const prompt of LEARN_DESK_PROMPTS) {
      expect(shouldHandoffQuestion(prompt.question)).toBe(false);
      expect(prompt.question.length).toBeGreaterThan(8);
      expect(prompt.question.length).toBeLessThanOrEqual(500);
    }
  });
});

describe("retrieveLearnPieces", () => {
  it("does not rank a piece on quiz-block wording", () => {
    const piece = {
      ...payday,
      id: 9,
      slug: "hidden-commissions",
      kind: "article" as const,
      title: "Hidden commissions",
      excerpt: "",
      transcript: "",
      body: [
        "Wood is the commercial broker case. Strata packages. We do not lend.",
        "",
        ":::quiz",
        "Q: Is a secret commission always a bribe after Hopcraft?",
        "A: Yes.",
        "B: No. *",
        "Explain: Hopcraft pulled the law back.",
        ":::",
      ].join("\n"),
    };
    expect(retrieveLearnPieces([piece], "bribe after Hopcraft").map((row) => row.slug)).toEqual([]);
    expect(retrieveLearnPieces([piece], "Wood commercial broker").some((row) => row.slug === "hidden-commissions")).toBe(
      true,
    );
  });

  it("prefers a handbook article over a promo with the same keyword", () => {
    const promo = {
      ...payday,
      id: 2,
      slug: "promo",
      title: "Strata promo",
      excerpt: "commission",
      body: "",
      transcript: "commission",
      pathPosition: null,
    };
    const handbook = {
      ...payday,
      id: 3,
      slug: "hidden-commissions",
      kind: "article" as const,
      title: "Hidden commissions",
      excerpt: "commission",
      body: "The lender paid a commission. Strata packages. We do not lend.",
      transcript: "",
      pathPosition: null,
    };
    expect(retrieveLearnPieces([promo, handbook], "commission")[0]?.slug).toBe("hidden-commissions");
  });
});

