import { describe, expect, it } from "vitest";
import {
  parseLearnLesson,
  scoreLearnQuiz,
  splitLearnQuizzes,
} from "@shared/learnQuiz";
import { DIRECTORS_HANDBOOK_SLUGS, handbookPieces, type LearnPiecePublic } from "@shared/learn";

describe("splitLearnQuizzes", () => {
  it("pulls a starred choice quiz out of the article and leaves the teaching copy", () => {
    const markdown = [
      "Brokers who will not name the lender are selling a product.",
      "",
      ":::quiz",
      "Q: A broker will not name the lender until after you sign. What is going on?",
      "A: They are matching you to a panel.",
      "B: They are packing you into a product they already have a kickback on. *",
      "C: Same-day funding is a high-street bank product.",
      "D: You should sign first to lock terms.",
      "Explain: If they will not name the lender, they are selling inventory, not packaging a file.",
      ":::",
      "",
      "Strata packages; it does not lend.",
    ].join("\n");

    const { body, quizzes } = splitLearnQuizzes(markdown);
    expect(body).toContain("Brokers who will not name the lender");
    expect(body).toContain("Strata packages; it does not lend.");
    expect(body).not.toContain(":::quiz");
    expect(body).not.toContain("Explain:");
    expect(quizzes).toHaveLength(1);
    expect(quizzes[0].question).toMatch(/will not name the lender/);
    expect(quizzes[0].choices).toHaveLength(4);
    expect(quizzes[0].choices.map((c) => c.correct)).toEqual([false, true, false, false]);
    expect(quizzes[0].choices[1].text).toMatch(/kickback/);
    expect(quizzes[0].explain).toMatch(/selling inventory/);
  });

  it("keeps teaching copy when there is no quiz block", () => {
    const { body, quizzes } = splitLearnQuizzes("Strata packages. We do not lend.");
    expect(body).toContain("We do not lend.");
    expect(quizzes).toEqual([]);
  });
});

const QUIZ = [
  ":::quiz",
  "Q: Probe?",
  "A: No.",
  "B: Yes. *",
  "Explain: Because.",
  ":::",
].join("\n");

describe("parseLearnLesson", () => {
  it("turns clustered end quizzes into copy-then-test beats, one per heading", () => {
    const markdown = [
      "Lede that belongs with the first heading. Strata packages. We do not lend.",
      "",
      "## Warehouse brokers",
      "They will not name the lender.",
      "",
      "## Hidden commissions",
      "Ask for the number in pounds.",
      "",
      QUIZ,
      "",
      QUIZ.replace("Probe?", "Pounds?"),
    ].join("\n");

    const steps = parseLearnLesson(markdown);
    expect(steps.map((step) => step.kind)).toEqual(["copy", "quiz", "copy", "quiz"]);
    expect(steps[0].kind === "copy" && steps[0].title).toBe("Warehouse brokers");
    expect(steps[0].kind === "copy" && steps[0].markdown).toMatch(/Lede that belongs/);
    expect(steps[0].kind === "copy" && steps[0].markdown).toMatch(/will not name the lender/);
    expect(steps[2].kind === "copy" && steps[2].title).toBe("Hidden commissions");
    expect(steps[1].kind === "quiz" && steps[1].quiz.question).toBe("Probe?");
    expect(steps[3].kind === "quiz" && steps[3].quiz.question).toBe("Pounds?");
  });

  it("keeps quizzes that already sit after their section", () => {
    const markdown = [
      "## File first",
      "The return comes first.",
      "",
      QUIZ,
      "",
      "## Broken plans",
      "Missing a payment restarts enforcement.",
      "",
      QUIZ.replace("Probe?", "Broken?"),
    ].join("\n");

    expect(parseLearnLesson(markdown).map((step) => step.kind)).toEqual([
      "copy",
      "quiz",
      "copy",
      "quiz",
    ]);
  });
});

describe("scoreLearnQuiz", () => {
  it("marks the starred choice correct and returns the explanation either way", () => {
    const quiz = splitLearnQuizzes(
      [
        ":::quiz",
        "Q: Is Time to Pay a loan?",
        "A: Yes, HMRC is lending you the tax.",
        "B: No. It is an instalment arrangement, not a right. *",
        "Explain: Time to Pay is HMRC agreeing a schedule. It is not credit.",
        ":::",
      ].join("\n"),
    ).quizzes[0];

    expect(scoreLearnQuiz(quiz, 1)).toEqual({
      correct: true,
      explain: "Time to Pay is HMRC agreeing a schedule. It is not credit.",
    });
    expect(scoreLearnQuiz(quiz, 0).correct).toBe(false);
    expect(scoreLearnQuiz(quiz, 0).explain).toMatch(/not credit/);
    expect(scoreLearnQuiz(quiz, 9).correct).toBe(false);
  });
});

describe("handbookPieces", () => {
  it("orders live handbook articles by the director path, ignoring other library rows", () => {
    expect(DIRECTORS_HANDBOOK_SLUGS[0]).toBe("if-the-business-is-in-trouble");
    const piece = (slug: string, publishedAt: string): LearnPiecePublic => ({
      slug,
      kind: "article",
      title: slug,
      excerpt: "",
      heroImageUrl: null,
      body: "",
      videoUrl: "",
      transcript: "",
      pathPosition: null,
      durationLabel: "12 min",
      thisHelped: 0,
      publishedAt,
    });
    const ordered = handbookPieces([
      piece("stacked-debt", "2026-09-03T00:00:00.000Z"),
      piece("promo", "2026-09-04T00:00:00.000Z"),
      piece("if-the-business-is-in-trouble", "2026-09-01T00:00:00.000Z"),
      piece("warehouse-brokers", "2026-09-02T00:00:00.000Z"),
    ]);
    expect(ordered.map((row) => row.slug)).toEqual([
      "if-the-business-is-in-trouble",
      "warehouse-brokers",
      "stacked-debt",
    ]);
  });
});
