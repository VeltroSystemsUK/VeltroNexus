import { describe, expect, it } from "vitest";
import { answerLearnQuestion, shouldHandoffQuestion } from "@shared/learnLibrarian";

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
