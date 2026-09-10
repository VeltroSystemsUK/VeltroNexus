import type { LearnQuizQuestion } from "./learnQuiz";

export const STACKED_DEBT_SCENARIO_VIDEO = "/uploads/learn/videos/strata-scene-ALL.mp4";
export const STACKED_DEBT_SCENARIO_POSTER = "/uploads/learn/videos/strata-scene-ALL.jpg";
export const STACKED_DEBT_SCENARIO_HREF = "/tools/stacked-debt-scenario";
export const THURSDAY_PACK_HREF = "/thursday-pack/";
export const THURSDAY_PACK_POSTER = "/thursday-pack/assets/desk.jpg";

export type ScenarioBeat = {
  id: string;
  start: number;
  pauseAt: number;
  title: string;
  quiz: LearnQuizQuestion | null;
};

function quiz(
  question: string,
  choices: Array<[string, string, boolean]>,
  explain: string,
): LearnQuizQuestion {
  return {
    question,
    choices: choices.map(([label, text, correct]) => ({ label, text, correct })),
    explain,
  };
}

export const STACKED_DEBT_BEATS: ScenarioBeat[] = [
  {
    id: "oxygen",
    start: 0,
    pauseAt: 28,
    title: "Your business is drowning",
    quiz: quiz(
      "Still trading, cash is drowning, a broker can get a facility in 24 hours. What do you do?",
      [
        ["A", "Take it. Oxygen first, structure later.", false],
        ["B", "Stop. Map every facility, HMRC, and the personal guarantee before anyone new is paid.", true],
        ["C", "Sign whatever they email today so Friday wages clear.", false],
      ],
      "Same-day money is how the stack starts. Strata packages files; it does not lend. Read the books before another name hits the current account.",
    ),
  },
  {
    id: "more",
    start: 28,
    pauseAt: 58,
    title: "Thirty to sixty days later",
    quiz: quiz(
      "The same broker rings. The first facility is already eating the account. They can get you more. What do you do?",
      [
        ["A", "Take the second facility so you can keep the first one current.", false],
        ["B", "Ask who the lender is and what it costs in pounds — then do not stack.", true],
        ["C", "Roll the first one into a larger version of the same product.", false],
      ],
      "Loan two does not pay off loan one. It sits on top of it. Strata packages; it does not lend.",
    ),
  },
  {
    id: "trap",
    start: 58,
    pauseAt: 100,
    title: "Loan two sits on top",
    quiz: quiz(
      "You are now borrowing to service the last loan. Friday wages almost do not happen. What is this?",
      [
        ["A", "A growth facility that needs time to bed in.", false],
        ["B", "A refinance that will settle once turnover recovers.", false],
        ["C", "A trap. Stacked short-term credit servicing itself.", true],
      ],
      "Borrowing to service the last loan is the definition of a trap. Strata packages files. We do not lend.",
    ),
  },
  {
    id: "way-out",
    start: 100,
    pauseAt: 148,
    title: "The house is on a personal guarantee",
    quiz: quiz(
      "3 a.m. The spreadsheet. The house is on a personal guarantee. What is the way out?",
      [
        ["A", "Another facility, larger, from a better-sounding broker.", false],
        ["B", "A hard look at the books, then a packager who will not stack you further.", true],
        ["C", "Hide from HMRC until someone says yes.", false],
      ],
      "The way out is not another facility. Do not stack your way out of a hole. Strata packages; it does not lend.",
    ),
  },
  {
    id: "close",
    start: 148,
    pauseAt: 171.6,
    title: "Don't stack your way out of a hole",
    quiz: null,
  },
];

export function pauseFor(time: number, answered: readonly string[]): ScenarioBeat | null {
  for (const beat of STACKED_DEBT_BEATS) {
    if (!beat.quiz || answered.includes(beat.id)) continue;
    if (time + 1e-6 >= beat.pauseAt) return beat;
  }
  return null;
}

export function clampPlayhead(time: number, answered: readonly string[]): number {
  const beat = pauseFor(time, answered);
  if (!beat) return time;
  return Math.min(time, beat.pauseAt);
}

export function resumeFrom(beat: ScenarioBeat): number {
  return beat.pauseAt;
}

export function scenarioCopy(): string {
  return STACKED_DEBT_BEATS.map((beat) => {
    const quizText = beat.quiz
      ? [beat.quiz.question, ...beat.quiz.choices.map((choice) => choice.text), beat.quiz.explain].join(" ")
      : "";
    return `${beat.title} ${quizText}`;
  }).join(" ");
}
