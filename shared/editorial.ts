import {
  BANNED,
  PACKAGER_IDENTITY,
  RATE_CLAIM,
  type ComplianceFinding,
  type ComplianceReview,
} from "./craftQueue";
import { formatCaseyNotes, type CaseyNote } from "./craftScout";

export type EditorialType = "blog" | "press_release";
export type EditorialStatus = "draft" | "approved" | "rejected" | "exported";
export type EditorialCompliance = "pending" | "cleared" | "blocked";
export type EditorialEngine = { provider: "anthropic" | "xai"; model: string };

export type EditorialPieceLike = {
  id?: number;
  userId: string;
  type: EditorialType;
  title: string;
  topic: string;
  body: string;
  notes: CaseyNote[];
  engine: EditorialEngine | null;
  status: EditorialStatus;
  compliance: EditorialCompliance;
  autoPublish: false;
  exportedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export function normalizeEditorialPiece(piece: EditorialPieceLike): EditorialPieceLike {
  return {
    ...piece,
    body: typeof piece.body === "string" ? piece.body : "",
    notes: Array.isArray(piece.notes) ? piece.notes : [],
    engine: piece.engine && typeof piece.engine === "object" ? piece.engine : null,
    autoPublish: false,
    status: piece.status || "draft",
    compliance: piece.compliance || "pending",
  };
}

export function reviewEditorialCopy(piece: EditorialPieceLike): ComplianceReview {
  const text = `${piece.title} ${piece.topic} ${piece.body}`;
  const findings: ComplianceFinding[] = [];
  if (BANNED.test(text) || RATE_CLAIM.test(text)) {
    findings.push({
      level: "block",
      code: "house_policy",
      message: "Copy fails house policy — no rates, guarantees, consumer-credit claims, or lending.",
    });
  }
  if (!PACKAGER_IDENTITY.test(text)) {
    findings.push({
      level: "block",
      code: "identity",
      message: "Say plainly that Strata packages and does not lend.",
    });
  }
  if (piece.autoPublish !== false) {
    findings.push({
      level: "block",
      code: "autopost",
      message: "Auto-publish is not allowed.",
    });
  }
  return { ok: findings.every((item) => item.level !== "block"), findings };
}

export function canExportPiece(piece: EditorialPieceLike): boolean {
  return (
    piece.status === "approved" &&
    piece.compliance === "cleared" &&
    reviewEditorialCopy(piece).ok &&
    piece.autoPublish === false
  );
}

export function signOffEditorialCompliance(piece: EditorialPieceLike): EditorialPieceLike {
  if (piece.status !== "approved") {
    throw new Error("Marketing must approve the copy before compliance can sign off.");
  }
  const review = reviewEditorialCopy(piece);
  if (!review.ok) {
    const msg = review.findings
      .filter((item) => item.level === "block")
      .map((item) => item.message)
      .join(" ");
    throw new Error(msg || "Copy failed compliance review.");
  }
  return { ...piece, autoPublish: false, compliance: "cleared" };
}

export function approveEditorial(piece: EditorialPieceLike): EditorialPieceLike {
  return {
    ...piece,
    autoPublish: false,
    status: "approved",
    compliance: piece.compliance === "blocked" ? "blocked" : "pending",
  };
}

export function rejectEditorial(piece: EditorialPieceLike): EditorialPieceLike {
  return { ...piece, autoPublish: false, status: "rejected" };
}

export function applyEditorialPatch(
  piece: EditorialPieceLike,
  updates: Partial<Pick<EditorialPieceLike, "title" | "topic" | "body">>,
): EditorialPieceLike {
  const title = updates.title ?? piece.title;
  const topic = updates.topic ?? piece.topic;
  const body = updates.body ?? piece.body;
  const changed = title !== piece.title || topic !== piece.topic || body !== piece.body;
  const needsReset =
    changed &&
    (piece.status === "approved" || piece.status === "exported" || piece.compliance === "cleared");
  return normalizeEditorialPiece({
    ...piece,
    title,
    topic,
    body,
    autoPublish: false,
    status: needsReset ? "draft" : piece.status,
    compliance: needsReset ? "pending" : piece.compliance,
  });
}

export function markEditorialExported(piece: EditorialPieceLike, at: Date = new Date()): EditorialPieceLike {
  if (!canExportPiece(piece)) {
    throw new Error("Export is blocked until marketing approve and compliance sign-off.");
  }
  return { ...piece, autoPublish: false, status: "exported", exportedAt: at.toISOString() };
}

export function editorialGenerateInputError(piece: EditorialPieceLike): string | null {
  if (!piece.notes.length) return "Scan Casey before generating";
  return null;
}

export const EDITORIAL_WRITER_PROMPT = `You are Isla Quinn, Marketing Director / Creative Director (MKT-2) at Strata Finance. You write long-form blogs and press releases. You do not post. You do not invent research or numbers — never invent. If a data bite is missing, write missing.

Strata packages UK SME distress-refinance, CDFI / British Business Bank, and HMRC Time to Pay files. Strata does not lend. We do not lend. Never claim rates, APR, guarantees, payday, consumer-credit, or "we lend". Always include a plain packager-identity sentence. Markdown only. House engines only (Anthropic or xAI).`;

export function editorialUserPrompt(piece: EditorialPieceLike, today: string): string {
  const crawled = formatCaseyNotes(piece.notes);
  const ground = crawled
    ? `Use ONLY these Casey notes for facts and source URLs. If a number is not in the notes, write missing — never invent Bank Rate, APR, insolvency counts, or live URLs.\nNOTES:\n${crawled}`
    : "No Casey notes. Do not invent a live URL. Mark missing numbers as missing.";
  const policy =
    "House policy: packager not lender. No rates, APR, guarantees, payday, consumer-credit, or \"we lend\". Always include a plain packager-identity sentence. Markdown only.";
  if (piece.type === "press_release") {
    return `Write a UK press release in Markdown about: ${piece.topic}
Working title: ${piece.title}
Today (UK): ${today}

Shape:
FOR IMMEDIATE RELEASE
Headline
London, ${today}
Lead paragraph
Two to four short body paragraphs
## About Strata Finance
Boilerplate: Strata Finance packages UK SME distress-refinance, CDFI / British Business Bank, and HMRC Time to Pay files. Strata does not lend.
Media contact: [Media contact]

${ground}

${policy}`;
  }
  return `Write a UK thought-leadership blog in Markdown about: ${piece.topic}
Working title: ${piece.title}
Today (UK): ${today}

Shape:
# Title
Short standfirst
400-800 words with ## H2 sections
Close with how Strata packages distress-refinance / CDFI / HMRC Time to Pay for UK SMEs and does not lend.

${ground}

${policy}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, (_m, text, href) => `<a href="${href.replace(/"/g, "&quot;")}">${text}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function editorialMarkdownToHtml(markdown: string, title: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (!list.length) return;
    out.push(`<ul>${list.join("")}</ul>`);
    list = [];
  };
  const flushPara = (buf: string[]) => {
    const text = buf.join(" ").trim();
    if (text) out.push(`<p>${inlineMarkdown(text)}</p>`);
    buf.length = 0;
  };
  const para: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      flushPara(para);
      continue;
    }
    if (/^[-*] /.test(line.trim())) {
      flushPara(para);
      list.push(`<li>${inlineMarkdown(line.trim().slice(2))}</li>`);
      continue;
    }
    flushList();
    const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (heading) {
      flushPara(para);
      const level = heading[1]!.length;
      out.push(`<h${level}>${inlineMarkdown(heading[2]!)}</h${level}>`);
      continue;
    }
    para.push(line.trim());
  }
  flushList();
  flushPara(para);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${out.join("")}</body></html>`;
}

export function editorialExportPayload(piece: EditorialPieceLike): {
  markdown: string;
  html: string;
  filename: string;
} {
  const id = piece.id ?? 0;
  return {
    markdown: piece.body,
    html: editorialMarkdownToHtml(piece.body, piece.title),
    filename: `strata-${piece.type}-${id}`,
  };
}
