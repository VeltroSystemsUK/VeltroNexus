export type LearnQuizChoice = {
  label: string;
  text: string;
  correct: boolean;
};

export type LearnQuizQuestion = {
  question: string;
  choices: LearnQuizChoice[];
  explain: string;
};

export type LearnLessonStep =
  | { kind: "copy"; title: string; markdown: string }
  | { kind: "quiz"; quiz: LearnQuizQuestion };

const QUIZ_BLOCK = /:::quiz\s*\n([\s\S]*?)\n:::/g;
const CHOICE_LINE = /^([A-F])\s*:\s*(.*?)\s*(\*)?\s*$/;

function parseQuizBlock(inner: string): LearnQuizQuestion | null {
  const lines = inner.replace(/\r\n/g, "\n").split("\n");
  let question = "";
  let explain = "";
  const choices: LearnQuizChoice[] = [];
  let mode: "none" | "q" | "explain" = "none";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const choice = CHOICE_LINE.exec(line);
    if (choice) {
      mode = "none";
      choices.push({
        label: choice[1]!,
        text: choice[2]!.replace(/\s+\*$/, "").trim(),
        correct: Boolean(choice[3]) || /\s+\*$/.test(choice[2] || ""),
      });
      continue;
    }
    if (/^Q:\s*/i.test(line)) {
      mode = "q";
      question = line.replace(/^Q:\s*/i, "").trim();
      continue;
    }
    if (/^Explain:\s*/i.test(line)) {
      mode = "explain";
      explain = line.replace(/^Explain:\s*/i, "").trim();
      continue;
    }
    if (mode === "q") question = `${question} ${line}`.trim();
    else if (mode === "explain") explain = `${explain} ${line}`.trim();
  }

  const marked = choices.filter((item) => item.correct);
  if (!question || choices.length < 2 || marked.length !== 1 || !explain) return null;
  return { question, choices, explain };
}

type LessonToken =
  | { kind: "copy"; text: string }
  | { kind: "quiz"; quiz: LearnQuizQuestion };

function tokenizeLesson(markdown: string): LessonToken[] {
  const src = String(markdown || "").replace(/\r\n/g, "\n");
  const tokens: LessonToken[] = [];
  const re = new RegExp(QUIZ_BLOCK.source, "g");
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(src))) {
    const before = src.slice(last, match.index).trim();
    if (before) tokens.push({ kind: "copy", text: before });
    const quiz = parseQuizBlock(match[1] || "");
    if (quiz) tokens.push({ kind: "quiz", quiz });
    last = re.lastIndex;
  }
  const after = src.slice(last).trim();
  if (after) tokens.push({ kind: "copy", text: after });
  return tokens;
}

function copyTitle(markdown: string): string {
  const heading = /^##\s+(.+)$/m.exec(markdown);
  return heading?.[1]?.trim() || "Read";
}

function splitCopySections(body: string): string[] {
  const parts = body
    .split(/(?=^## )/m)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2 && !parts[0]!.startsWith("##")) {
    parts[1] = `${parts[0]}\n\n${parts[1]}`;
    parts.shift();
  }
  return parts;
}

function quizzesClusteredAtEnd(tokens: LessonToken[]): boolean {
  const firstQuiz = tokens.findIndex((token) => token.kind === "quiz");
  if (firstQuiz < 0) return false;
  return tokens.slice(firstQuiz).every((token) => token.kind === "quiz");
}

export function splitLearnQuizzes(markdown: string): { body: string; quizzes: LearnQuizQuestion[] } {
  const tokens = tokenizeLesson(markdown);
  return {
    body: tokens
      .filter((token): token is Extract<LessonToken, { kind: "copy" }> => token.kind === "copy")
      .map((token) => token.text)
      .join("\n\n")
      .trim(),
    quizzes: tokens
      .filter((token): token is Extract<LessonToken, { kind: "quiz" }> => token.kind === "quiz")
      .map((token) => token.quiz),
  };
}

export function parseLearnLesson(markdown: string): LearnLessonStep[] {
  const tokens = tokenizeLesson(markdown);
  if (!tokens.length) return [];

  const copyTokens = tokens.filter((token): token is Extract<LessonToken, { kind: "copy" }> => token.kind === "copy");
  const quizTokens = tokens.filter((token): token is Extract<LessonToken, { kind: "quiz" }> => token.kind === "quiz");

  if (!quizTokens.length) {
    return copyTokens.map((token) => ({ kind: "copy", title: copyTitle(token.text), markdown: token.text }));
  }

  if (quizzesClusteredAtEnd(tokens)) {
    const sections = splitCopySections(copyTokens.map((token) => token.text).join("\n\n"));
    const copyBeats = sections.length ? sections : copyTokens.map((token) => token.text);
    const count = Math.max(copyBeats.length, quizTokens.length);
    const steps: LearnLessonStep[] = [];
    for (let i = 0; i < count; i += 1) {
      const copy = copyBeats[i];
      if (copy) steps.push({ kind: "copy", title: copyTitle(copy), markdown: copy });
      const quiz = quizTokens[i];
      if (quiz) steps.push({ kind: "quiz", quiz: quiz.quiz });
    }
    return steps;
  }

  return tokens.map((token) =>
    token.kind === "copy"
      ? { kind: "copy", title: copyTitle(token.text), markdown: token.text }
      : { kind: "quiz", quiz: token.quiz },
  );
}

export function scoreLearnQuiz(
  quiz: LearnQuizQuestion,
  choiceIndex: number,
): { correct: boolean; explain: string } {
  const picked = quiz.choices[choiceIndex];
  return { correct: Boolean(picked?.correct), explain: quiz.explain };
}
