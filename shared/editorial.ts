import {
  BANNED,
  PACKAGER_IDENTITY,
  RATE_CLAIM,
  type ComplianceFinding,
  type ComplianceReview,
} from "./craftQueue";
import { formatCaseyNotes, type CaseyNote } from "./craftScout";
import { stripSlop } from "./craftYaffle";

export type EditorialType = "blog" | "press_release" | "news";
export type EditorialStatus = "draft" | "approved" | "rejected" | "exported";
export type EditorialCompliance = "pending" | "cleared" | "blocked";
export type EditorialEngine = { provider: "anthropic" | "xai"; model: string };

export type EditorialLinkedInPack = {
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  keywords: string[];
};

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
  heroImageUrl?: string | null;
  linkedinPack?: EditorialLinkedInPack | null;
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
    heroImageUrl: typeof piece.heroImageUrl === "string" && piece.heroImageUrl ? piece.heroImageUrl : null,
    linkedinPack: piece.linkedinPack && typeof piece.linkedinPack === "object" ? piece.linkedinPack : null,
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

export type EditorialReadiness = {
  percent: number;
  label: string;
  tone: "idle" | "live" | "ready" | "blocked";
};

export function editorialReadiness(piece: EditorialPieceLike): EditorialReadiness {
  const scanned = (piece.notes || []).length > 0;
  const drafted = Boolean((piece.body || "").trim());
  const policy = reviewEditorialCopy(piece).ok;
  const approved = piece.status === "approved" || piece.status === "exported";
  const cleared = piece.compliance === "cleared";
  const blocked = piece.status === "rejected" || piece.compliance === "blocked";

  let percent = 0;
  if (scanned) percent += 20;
  if (drafted) percent += 20;
  if (drafted && policy) percent += 20;
  if (approved && policy) percent += 20;
  if (cleared && approved && policy) percent += 20;
  if (piece.status === "exported" || (drafted && policy && approved && cleared)) percent = 100;

  let label = "Scan first";
  if (!scanned) label = "Scan first";
  else if (!drafted) label = "Write the piece";
  else if (!policy) label = "House policy";
  else if (!approved) label = "Approve copy";
  else if (!cleared) label = piece.compliance === "blocked" ? "Blocked" : "Compliance";
  else label = piece.status === "exported" ? "Exported" : "Ready to export";
  if (piece.status === "rejected") label = "Rejected";

  const tone: EditorialReadiness["tone"] = blocked ? "blocked" : percent >= 100 ? "ready" : percent === 0 ? "idle" : "live";
  return { percent, label, tone };
}

export function signOffEditorialCompliance(
  piece: EditorialPieceLike,
  overrideCompliance = false,
): EditorialPieceLike {
  if (piece.status !== "approved") {
    throw new Error("Marketing must approve the copy before compliance can sign off.");
  }
  if (!overrideCompliance) {
    const review = reviewEditorialCopy(piece);
    if (!review.ok) {
      const msg = review.findings
        .filter((item) => item.level === "block")
        .map((item) => item.message)
        .join(" ");
      throw new Error(msg || "Copy failed compliance review.");
    }
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

function stillSeedText(value: string): string {
  return value.replace(/#\w+/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function editorialStillPrompt(
  piece: Pick<EditorialPieceLike, "title" | "topic">,
  custom?: string,
): string {
  if (custom?.trim()) return stripSlop(custom);
  const title = stillSeedText(piece.title);
  const topic = stillSeedText(piece.topic);
  return stripSlop(
    `${title}. ${topic}. UK documentary still for a thought-leadership article, natural light, real workplace, no people facing camera, no readable text, no logo, no watermark.`,
  );
}

export function parseEditorialImageRequest(input: unknown): { prompt?: string } {
  if (!input || typeof input !== "object") throw new Error("Invalid image request");
  const raw = input as Record<string, unknown>;
  const prompt = typeof raw.prompt === "string" && raw.prompt.trim() ? raw.prompt.trim() : undefined;
  return prompt ? { prompt } : {};
}

export function isEditorialMediaUrl(url: string): boolean {
  if (url.startsWith("/uploads/media/") && !url.includes("..") && !url.includes("\\")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function insertEditorialImage(body: string, url: string, alt: string): string {
  if (!isEditorialMediaUrl(url)) throw new Error("Image URL must be a media upload or https.");
  const safeAlt = alt.replace(/[\[\]]/g, "").trim() || "Article still";
  const md = `![${safeAlt}](${url})`;
  const text = body.trim();
  return text ? `${md}\n\n${text}` : md;
}

export const EDITORIAL_LINKEDIN_PROMPT = `You are Isla Quinn, Marketing Director / Creative Director (MKT-2) at Strata Finance. You write LinkedIn posts that get read. You do not post. You do not invent research or numbers.

Return JSON only: {"hook","body","cta","hashtags","keywords"}.

Virality rules for LinkedIn:
- The first line is the hook. Specific, tense, concrete. No "I'm excited to share", no "Thrilled", no "Delve".
- Short lines and white space. Not a blog paste.
- 3-5 hashtags, mix of niche UK SME finance and one broader. Never a hashtag dump.
- keywords are 4-8 search phrases without #, for discoverability, not stuffed into the post.
- House policy: packager not lender. No rates, APR, guarantees, payday, consumer-credit, or "we lend". Always include a plain packager-identity sentence in body. We do not lend.`;

export function editorialLinkedInUserPrompt(piece: EditorialPieceLike): string {
  return `Write a LinkedIn post that would make this ${piece.type === "press_release" ? "press release" : "article"} travel.

Title: ${piece.title}
Topic: ${piece.topic}

Article:
${piece.body.slice(0, 4000)}

Return JSON only with hook, body, cta, hashtags (3-5), keywords (4-8 search phrases).
The hook is the first line of the feed post. Hashtags at the end of the post, not the start.
House policy: packager not lender. No rates. Include a packager-identity sentence.`;
}

function extractJsonObject(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && !Array.isArray(input)) return input as Record<string, unknown>;
  if (typeof input !== "string") throw new Error("Invalid LinkedIn pack");
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Invalid LinkedIn pack");
  return JSON.parse(input.slice(start, end + 1)) as Record<string, unknown>;
}

function parseTagList(value: unknown, max: number, hash: boolean): string[] {
  const parts = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\s,]+/) : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (typeof part !== "string") continue;
    let tag = part.trim();
    if (!tag) continue;
    if (hash) tag = tag.startsWith("#") ? tag : `#${tag}`;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

export function parseEditorialLinkedInPack(input: unknown): EditorialLinkedInPack {
  const raw = extractJsonObject(input);
  const hook = typeof raw.hook === "string" ? raw.hook.trim() : "";
  let body = typeof raw.body === "string" ? raw.body.trim() : "";
  const cta = typeof raw.cta === "string" ? raw.cta.trim() : "";
  if (!hook || !body || !cta) throw new Error("LinkedIn pack needs hook, body, and CTA.");
  const hashtags = parseTagList(raw.hashtags, 5, true);
  const keywords = parseTagList(raw.keywords, 8, false);
  if (hashtags.length < 3) throw new Error("Use 3 to 5 hashtags.");
  if (!keywords.length) throw new Error("LinkedIn pack needs keywords.");
  if (!PACKAGER_IDENTITY.test(body)) {
    body = `${body}\n\nStrata packages the file. We do not lend.`;
  }
  const pack = { hook, body, cta, hashtags, keywords };
  const text = `${hook} ${body} ${cta} ${hashtags.join(" ")} ${keywords.join(" ")}`;
  if (BANNED.test(text) || RATE_CLAIM.test(text)) {
    throw new Error("Copy fails house policy — no rates, guarantees, consumer-credit claims, or lending.");
  }
  return pack;
}

export function formatEditorialLinkedInPost(pack: EditorialLinkedInPack): string {
  return `${pack.hook}\n\n${pack.body}\n\n${pack.cta}\n\n${pack.hashtags.join(" ")}`;
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
    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line.trim());
    if (image) {
      flushPara(para);
      const src = image[2]!;
      if (isEditorialMediaUrl(src)) {
        out.push(`<img src="${escapeHtml(src)}" alt="${escapeHtml(image[1] || "")}">`);
      }
      continue;
    }
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
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>img{max-width:100%;height:auto}</style></head><body>${out.join("")}</body></html>`;
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
