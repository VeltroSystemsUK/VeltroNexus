import { RATE_CLAIM } from "./craftQueue";
import { isHandbookSlug, type LearnPieceLike } from "./learn";
import { splitLearnQuizzes } from "./learnQuiz";

export type LibrarianPiece = Pick<
  LearnPieceLike,
  "slug" | "kind" | "title" | "excerpt" | "body" | "transcript"
> & {
  id?: number;
  live?: boolean;
};

export type LibrarianCitation = { title: string; slug: string; kind: string };

export type LibrarianAsk = (system: string, user: string) => Promise<string>;

export type LibrarianResult = {
  kind: "answer" | "handoff" | "unavailable";
  text?: string;
  citations?: LibrarianCitation[];
};

const QUESTION_HANDOFF =
  /\b(my (company|deal|turnover|figures?|rate)|am i eligible|can you (lend|do my|fund)|what would i pay|book a (call|review)|speak to (shaun|someone)|call me)\b/i;

const WE_LEND = /\bwe lend\b/i;
const ELIGIBLE_CLAIM = /\byou (are|would be) eligible\b/i;

export const LEARN_LIBRARIAN_SYSTEM = `You are Isla Quinn, Marketing Director / Creative Director (MKT-2) at Strata Finance. You sit at the desk of Strata Learn. You are not James.

Answer only from the retrieved published lessons in the user message. Prefer the Director's handbook when it is in the retrieved set. Cite lesson titles. Short answers. Strata is a packager, not a lender — Strata does not lend. If the answer is not in the retrieved text, say so. Never invent rates, APR, terms, eligibility, or outcomes. Never write “I’ve helped directors like you”. Do not take files, remember visitors, browse the web, run Explore, or book a call.`;

export const LEARN_DESK_PROMPTS = [
  { question: "Is Time to Pay a loan?", slug: "hmrc-time-to-pay" },
  { question: "How does a warehouse broker actually get paid?", slug: "warehouse-brokers" },
  { question: "What did the Supreme Court decide in Hopcraft?", slug: "hidden-commissions" },
  { question: "What is an all-monies clause?", slug: "terms-that-should-stop-the-pen" },
  { question: "When does a director's duty to creditors switch on?", slug: "directors-in-the-danger-zone" },
  { question: "Who can I call for free help with business debt?", slug: "help-that-is-actually-there" },
  { question: "What is stacked debt?", slug: "stacked-debt" },
] as const;

export function shouldHandoffQuestion(question: string): boolean {
  return QUESTION_HANDOFF.test(question) || RATE_CLAIM.test(question);
}

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((token) => token.length >= 3);
}

function lessonCorpus(piece: LibrarianPiece): string {
  const teaching = splitLearnQuizzes(piece.body || "").body;
  return `${piece.title} ${piece.excerpt} ${teaching} ${piece.transcript}`;
}

function overlapScore(piece: LibrarianPiece, terms: string[]): number {
  const hay = lessonCorpus(piece).toLowerCase();
  const seen = new Set<string>();
  let score = 0;
  for (const term of terms) {
    if (seen.has(term)) continue;
    seen.add(term);
    if (hay.includes(term)) score += 1;
  }
  if (score > 0 && isHandbookSlug(piece.slug)) score += 2;
  return score;
}

export function retrieveLearnPieces(
  live: LibrarianPiece[],
  question: string,
  slug?: string,
): LibrarianPiece[] {
  const rows = live.filter((piece) => piece.live !== false && piece.kind !== "news");
  const selected: LibrarianPiece[] = [];
  const used = new Set<string>();

  if (slug) {
    const current = rows.find((piece) => piece.slug === slug);
    if (current) {
      selected.push(current);
      used.add(current.slug);
    }
  }

  const terms = tokens(question);
  const ranked = rows
    .filter((piece) => !used.has(piece.slug))
    .map((piece) => ({ piece, score: overlapScore(piece, terms) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const row of ranked) {
    if (selected.length >= 4) break;
    selected.push(row.piece);
  }

  return selected.slice(0, 4);
}

function citationsFor(retrieved: LibrarianPiece[]): LibrarianCitation[] {
  return retrieved.map((piece) => ({
    title: piece.title,
    slug: piece.slug,
    kind: piece.kind,
  }));
}

export function sanitizeLibrarianAnswer(
  text: string,
  retrieved: LibrarianPiece[] = [],
): { kind: "answer"; text: string; citations: LibrarianCitation[] } | { kind: "handoff" } {
  if (WE_LEND.test(text) || RATE_CLAIM.test(text) || ELIGIBLE_CLAIM.test(text)) {
    return { kind: "handoff" };
  }
  return { kind: "answer", text, citations: citationsFor(retrieved) };
}

function librarianUserPrompt(question: string, retrieved: LibrarianPiece[]): string {
  const lessons = retrieved.length
    ? retrieved
        .map((piece) => {
          const body = [piece.excerpt, splitLearnQuizzes(piece.body || "").body, piece.transcript]
            .filter(Boolean)
            .join("\n");
          return `Lesson: ${piece.title} [${piece.slug}] (${piece.kind})\n${body}`;
        })
        .join("\n\n")
    : "No matching lessons.";
  return `Question: ${question}\n\nRetrieved lessons:\n${lessons}`;
}

export async function answerLearnQuestion(args: {
  question: string;
  slug?: string;
  live: LibrarianPiece[];
  ask: LibrarianAsk;
}): Promise<LibrarianResult> {
  const question = args.question.trim();
  if (shouldHandoffQuestion(question)) {
    return { kind: "handoff" };
  }

  const retrieved = retrieveLearnPieces(args.live, question, args.slug);
  try {
    const text = await args.ask(LEARN_LIBRARIAN_SYSTEM, librarianUserPrompt(question, retrieved));
    return sanitizeLibrarianAnswer(text, retrieved);
  } catch {
    return { kind: "unavailable" };
  }
}
