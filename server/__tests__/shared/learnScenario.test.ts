import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PACKAGER_IDENTITY, RATE_CLAIM } from "@shared/craftQueue";
import { scoreLearnQuiz } from "@shared/learnQuiz";
import {
  STACKED_DEBT_BEATS,
  STACKED_DEBT_SCENARIO_VIDEO,
  THURSDAY_PACK_HREF,
  clampPlayhead,
  pauseFor,
  resumeFrom,
  scenarioCopy,
} from "@shared/learnScenario";

describe("Thursday Pack drop-in", () => {
  it("hosts the packed game as a static Learn lesson, not a video player", () => {
    expect(THURSDAY_PACK_HREF).toBe("/thursday-pack/");
  });

  it("keeps the stacked-debt film and Thursday Pack as sibling lessons, not one replacing the other", () => {
    const home = readFileSync(path.resolve(process.cwd(), "client/src/pages/learn/LearnHome.tsx"), "utf8");
    const library = readFileSync(path.resolve(process.cwd(), "client/src/pages/learn/LearnLibrary.tsx"), "utf8");
    const app = readFileSync(path.resolve(process.cwd(), "client/src/pages/learn/LearnApp.tsx"), "utf8");
    const pathScript = readFileSync(path.resolve(process.cwd(), "scripts/publish_learn_path.ts"), "utf8");
    expect(home).toContain("STACKED_DEBT_SCENARIO_VIDEO");
    expect(home).toContain("ScenarioCard");
    expect(home).toContain("FilmCard");
    expect(library).toContain("FilmCard");
    expect(library).toContain("ScenarioCard");
    expect(app).toContain("/tools/stacked-debt-scenario");
    expect(app).toContain("/thursday-pack/");
    expect(pathScript).not.toMatch(/unpublishPromo|Unpublished promo/);
  });

  it("keeps choice buttons on screen instead of below a 720px frame", () => {
    const html = readFileSync(
      path.resolve(process.cwd(), "client/public/thursday-pack/index.html"),
      "utf8",
    );
    expect(html).toMatch(/#stage\{[^}]*100dvh/);
    expect(html).toMatch(/html,body\{[^}]*overflow:hidden/);
    expect(html).toMatch(/\.acts\{[^}]*flex:\s*0\s+0\s+auto/);
    expect(html).toMatch(/#sheet \.copy\{[^}]*overflow:auto/);
    expect(html).toMatch(/#hud\{[^}]*z-index:\s*20/);
    expect(html).toMatch(/#modal\{[^}]*--hud-h/);
    expect(html).not.toMatch(/#meters\{display:none\}/);
    expect(html).toContain('href="/tools/debt-stress-check"');
    expect(html).toContain('href="/tools/time-to-pay-calculator"');
  });

  it("uses plain English: offer, call-centre broker, professional broker, HMRC", () => {
    const html = readFileSync(
      path.resolve(process.cwd(), "client/public/thursday-pack/index.html"),
      "utf8",
    );
    const home = readFileSync(path.resolve(process.cwd(), "client/src/pages/learn/LearnHome.tsx"), "utf8");
    const tools = readFileSync(path.resolve(process.cwd(), "client/src/pages/learn/LearnTools.tsx"), "utf8");
    expect(html).not.toMatch(/Callum/);
    expect(html).not.toMatch(/The Crown/);
    expect(html).not.toMatch(/Warehouse pack|warehouse pack|signed pack|The pack/);
    expect(html).toContain("Call-centre broker");
    expect(html).toContain("Professional broker");
    expect(html).toContain("Guild of Business Finance Professionals");
    expect(html).toContain("The offer");
    expect(html).toContain("personal guarantee on the house");
    expect(html).toContain("They start taking money from the till");
    expect(home).not.toMatch(/Callum has a pack/);
    expect(home).toMatch(/call-centre broker/i);
    expect(tools).toMatch(/call-centre broker/i);
  });
});

describe("stacked-debt scenario beats", () => {
  it("plays a stored Learn mp4 in order, with a quiz at each pause and a closer with none", () => {
    expect(STACKED_DEBT_SCENARIO_VIDEO).toMatch(/^\/uploads\/learn\/videos\/.+\.mp4$/);
    expect(STACKED_DEBT_BEATS.length).toBeGreaterThanOrEqual(4);
    const quizzes = STACKED_DEBT_BEATS.filter((beat) => beat.quiz);
    const closers = STACKED_DEBT_BEATS.filter((beat) => !beat.quiz);
    expect(quizzes.length).toBe(4);
    expect(closers.length).toBe(1);
    expect(closers[0]?.id).toBe(STACKED_DEBT_BEATS.at(-1)?.id);
    for (let i = 1; i < STACKED_DEBT_BEATS.length; i++) {
      expect(STACKED_DEBT_BEATS[i]!.start).toBe(STACKED_DEBT_BEATS[i - 1]!.pauseAt);
      expect(STACKED_DEBT_BEATS[i]!.pauseAt).toBeGreaterThan(STACKED_DEBT_BEATS[i]!.start);
    }
  });

  it("pauses at the first unanswered beat and will not skip ahead", () => {
    const first = STACKED_DEBT_BEATS[0]!;
    const second = STACKED_DEBT_BEATS[1]!;
    expect(pauseFor(0, [])).toBeNull();
    expect(pauseFor(first.pauseAt - 0.05, [])).toBeNull();
    expect(pauseFor(first.pauseAt, [])?.id).toBe(first.id);
    expect(pauseFor(second.pauseAt, [])?.id).toBe(first.id);
    expect(clampPlayhead(second.pauseAt, [])).toBe(first.pauseAt);
    expect(pauseFor(first.pauseAt, [first.id])).toBeNull();
    expect(pauseFor(second.pauseAt, [first.id])?.id).toBe(second.id);
    expect(resumeFrom(first)).toBe(first.pauseAt);
  });

  it("marks exactly one correct choice per quiz and says Strata does not lend", () => {
    const copy = scenarioCopy();
    expect(PACKAGER_IDENTITY.test(copy)).toBe(true);
    expect(RATE_CLAIM.test(copy)).toBe(false);
    for (const beat of STACKED_DEBT_BEATS) {
      if (!beat.quiz) continue;
      const marked = beat.quiz.choices.filter((choice) => choice.correct);
      expect(marked).toHaveLength(1);
      const hit = beat.quiz.choices.findIndex((choice) => choice.correct);
      expect(scoreLearnQuiz(beat.quiz, hit).correct).toBe(true);
      expect(scoreLearnQuiz(beat.quiz, hit === 0 ? 1 : 0).correct).toBe(false);
    }
  });
});
