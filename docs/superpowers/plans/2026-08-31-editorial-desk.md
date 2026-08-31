# Editorial Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Marketing Editorial draft desk for blogs and press releases: Casey topic scan, Anthropic-then-Grok generate, approve/compliance gates, Markdown/HTML export, never auto-publish.

**Architecture:** Campaigns-style records in `editorial_pieces` (SQLite JSON collection). Pure copy/gates/prompts in `shared/editorial.ts`. Casey topic scan in `caseyScout.ts` with injectable crawl. Thin Express router. One React page at `/editorial`. Isla owns the desk; Casey researches; Shaun exports and publishes off-platform.

**Tech Stack:** TypeScript, Zod, Vitest, Express, React, TanStack Query, existing `houseAsk` (Anthropic then xAI), Firecrawl, lucide-react. No new npm packages. No TipTap, Unlayer, or Craft canvas.

**Spec:** `docs/superpowers/specs/2026-08-31-editorial-desk-design.md`

## Global Constraints

- Draft desk only — no CMS, no site blog, no newswire, no social post, no publish button
- Types are `blog` and `press_release` only
- Casey does a **topic scan** for the piece — not Craft’s seven-brief week, not the seed library
- Copy: `houseAsk` Anthropic first, Grok if Anthropic is down; never Gemini
- `autoPublish` hard-pinned `false` on every write
- Packager not lender; no invented rates; missing numbers stay `missing`
- Generate 400 without notes; hand-written body with no scan is allowed
- Export blocked until `status === "approved"` and `compliance === "cleared"` and `reviewEditorialCopy` ok
- Edit of title/topic/body after approve/export/cleared returns `draft` + `pending`
- Do not call live Anthropic, xAI, or Firecrawl in CI
- Do not change Craft week, email campaign send, or Media Gallery behaviour
- Windows PowerShell: `git commit -m "message"` (no bash heredocs)

## File map

- Create: `shared/editorial.ts` — review, gates, markdown, patch, prompts, export payload
- Create: `server/__tests__/shared/editorial.test.ts`
- Create: `server/routes/editorial.ts`
- Create: `server/__tests__/services/caseyTopic.test.ts`
- Create: `client/src/pages/Editorial.tsx`
- Modify: `shared/craftQueue.ts` — export `BANNED`, `RATE_CLAIM`, `PACKAGER_IDENTITY`
- Modify: `shared/craftScout.ts` — export `caseyHostAllowed`
- Modify: `shared/schema.ts` — editorial piece zod
- Modify: `server/storage.ts` — IStorage methods
- Modify: `server/sqliteStorage.ts` — collection `editorial_pieces`
- Modify: `server/services/caseyScout.ts` — `researchTopic`, `houseAskWithEngine`, `caseyFirecrawlTopicScan`
- Modify: `server/routes.ts` — mount router
- Modify: `shared/factoryGraph.ts` — editorial lane
- Modify: `server/__tests__/shared/factoryGraph.test.ts`
- Modify: `client/src/App.tsx` — lazy route
- Modify: `client/src/components/Sidebar.tsx` — Editorial item
- Modify: `docs/agentic-org/agents/MKT-2.md`, `MKT-3.md`, `corporate_structure.md`, `CLAUDE.md`, `delegation_matrix.csv`, `agents.mmd`
- Modify: `docs/CRAFT.md` — pointer that Editorial is a separate desk

---

### Task 1: Editorial copy kernel

**Files:**
- Create: `shared/editorial.ts`
- Create: `server/__tests__/shared/editorial.test.ts`
- Modify: `shared/craftQueue.ts` (export the three house-policy regexes currently at lines 60–65)

**Interfaces:**
- Consumes: `BANNED`, `RATE_CLAIM`, `PACKAGER_IDENTITY` from `@shared/craftQueue`; `ComplianceReview` / `ComplianceFinding` from `@shared/craftQueue`; `formatCaseyNotes`, `CaseyNote` from `@shared/craftScout`
- Produces:
  - `EditorialPieceLike` — the fields review/export need (defined locally until schema exists; Task 2 replaces it with `EditorialPiece`)
  - `normalizeEditorialPiece(piece: EditorialPieceLike): EditorialPieceLike`
  - `reviewEditorialCopy(piece: EditorialPieceLike): ComplianceReview`
  - `canExportPiece(piece: EditorialPieceLike): boolean`
  - `signOffEditorialCompliance(piece: EditorialPieceLike): EditorialPieceLike`
  - `approveEditorial(piece: EditorialPieceLike): EditorialPieceLike`
  - `rejectEditorial(piece: EditorialPieceLike): EditorialPieceLike`
  - `applyEditorialPatch(piece: EditorialPieceLike, updates: Partial<Pick<EditorialPieceLike, "title" | "topic" | "body">>): EditorialPieceLike`
  - `markEditorialExported(piece: EditorialPieceLike, at?: Date): EditorialPieceLike`
  - `editorialMarkdownToHtml(markdown: string, title: string): string`
  - `editorialExportPayload(piece: EditorialPieceLike): { markdown: string; html: string; filename: string }`
  - `editorialGenerateInputError(piece: EditorialPieceLike): string | null`
  - `EDITORIAL_WRITER_PROMPT: string`
  - `editorialUserPrompt(piece: EditorialPieceLike, today: string): string`

For this task only, define `EditorialPieceLike` in `shared/editorial.ts` as the piece shape. Task 2 will type-alias it to `EditorialPiece` from schema.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/shared/editorial.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  EDITORIAL_WRITER_PROMPT,
  applyEditorialPatch,
  approveEditorial,
  canExportPiece,
  editorialExportPayload,
  editorialGenerateInputError,
  editorialMarkdownToHtml,
  editorialUserPrompt,
  markEditorialExported,
  normalizeEditorialPiece,
  rejectEditorial,
  reviewEditorialCopy,
  signOffEditorialCompliance,
  type EditorialPieceLike,
} from "@shared/editorial";

function piece(over: Partial<EditorialPieceLike> = {}): EditorialPieceLike {
  return normalizeEditorialPiece({
    id: 1,
    userId: "u1",
    type: "blog",
    title: "Stacked debt, then the pack",
    topic: "UK SME stacked short-term loans refinance",
    body: "Strata packages distress-refinance files. We do not lend.",
    notes: [],
    engine: null,
    status: "draft",
    compliance: "pending",
    autoPublish: false,
    exportedAt: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    ...over,
  });
}

describe("reviewEditorialCopy", () => {
  it("passes a clean packager blog", () => {
    const review = reviewEditorialCopy(piece());
    expect(review.ok).toBe(true);
    expect(review.findings.filter((f) => f.level === "block")).toEqual([]);
  });

  it("blocks banned terms and rate claims", () => {
    expect(reviewEditorialCopy(piece({ body: "Guaranteed funding from 4.9% APR. We do not lend." })).ok).toBe(false);
    expect(reviewEditorialCopy(piece({ body: "We lend to UK SMEs." })).ok).toBe(false);
  });

  it("blocks a missing packager line", () => {
    const review = reviewEditorialCopy(piece({ body: "A long article about cashflow with no identity sentence." }));
    expect(review.ok).toBe(false);
    expect(review.findings.some((f) => f.code === "identity")).toBe(true);
  });

  it("blocks autoPublish true", () => {
    const dirty = { ...piece(), autoPublish: true as false };
    expect(reviewEditorialCopy(dirty).findings.some((f) => f.code === "autopost")).toBe(true);
  });
});

describe("export gates", () => {
  it("canExportPiece is false until approved + cleared + review ok", () => {
    expect(canExportPiece(piece())).toBe(false);
    expect(canExportPiece(piece({ status: "approved" }))).toBe(false);
    const ready = piece({ status: "approved", compliance: "cleared" });
    expect(canExportPiece(ready)).toBe(true);
  });

  it("signOffEditorialCompliance throws if not approved", () => {
    expect(() => signOffEditorialCompliance(piece())).toThrow(/approve/i);
  });

  it("signOffEditorialCompliance throws if review fails", () => {
    expect(() =>
      signOffEditorialCompliance(piece({ status: "approved", body: "Payday loans for directors." })),
    ).toThrow();
  });

  it("signOffEditorialCompliance clears an approved clean piece", () => {
    const next = signOffEditorialCompliance(piece({ status: "approved" }));
    expect(next.compliance).toBe("cleared");
    expect(next.autoPublish).toBe(false);
  });

  it("markEditorialExported throws until gates pass, then sets exported", () => {
    expect(() => markEditorialExported(piece())).toThrow(/blocked/i);
    const exported = markEditorialExported(piece({ status: "approved", compliance: "cleared" }));
    expect(exported.status).toBe("exported");
    expect(exported.exportedAt).toBeTruthy();
    expect(exported.autoPublish).toBe(false);
  });
});

describe("applyEditorialPatch", () => {
  it("forces autoPublish false", () => {
    const next = applyEditorialPatch({ ...piece(), autoPublish: true as false }, { title: "Keep" });
    expect(next.autoPublish).toBe(false);
  });

  it("resets approve/compliance when body changes after sign-off", () => {
    const next = applyEditorialPatch(
      piece({ status: "exported", compliance: "cleared" }),
      { body: "Edited. We do not lend." },
    );
    expect(next.status).toBe("draft");
    expect(next.compliance).toBe("pending");
    expect(next.body).toBe("Edited. We do not lend.");
  });

  it("does not reset when the patch is a no-op", () => {
    const src = piece({ status: "approved", compliance: "cleared" });
    const next = applyEditorialPatch(src, { body: src.body });
    expect(next.status).toBe("approved");
    expect(next.compliance).toBe("cleared");
  });
});

describe("approve and reject", () => {
  it("approve never auto-clears compliance", () => {
    expect(approveEditorial(piece()).compliance).toBe("pending");
    expect(approveEditorial(piece({ compliance: "blocked" })).compliance).toBe("blocked");
    expect(approveEditorial(piece()).status).toBe("approved");
  });

  it("reject sets rejected", () => {
    expect(rejectEditorial(piece({ status: "approved" })).status).toBe("rejected");
  });
});

describe("generate input and prompts", () => {
  it("generate is an error without notes", () => {
    expect(editorialGenerateInputError(piece())).toMatch(/scan/i);
    expect(
      editorialGenerateInputError(
        piece({
          notes: [{ title: "Bank Rate held", url: "https://www.bankofengland.co.uk/n", snippet: "Held." }],
        }),
      ),
    ).toBeNull();
  });

  it("writer prompt is Isla, long-form, never invents", () => {
    expect(EDITORIAL_WRITER_PROMPT).toMatch(/Isla Quinn/i);
    expect(EDITORIAL_WRITER_PROMPT).toMatch(/MKT-2/);
    expect(EDITORIAL_WRITER_PROMPT).toMatch(/do not lend/i);
    expect(EDITORIAL_WRITER_PROMPT).toMatch(/never invent/i);
    expect(EDITORIAL_WRITER_PROMPT).not.toMatch(/gemini/i);
  });

  it("blog and press-release user prompts differ and ground in notes", () => {
    const withNotes = piece({
      notes: [{ title: "Bank Rate held", url: "https://www.bankofengland.co.uk/n", snippet: "The MPC held Bank Rate." }],
    });
    const blog = editorialUserPrompt(withNotes, "2026-08-31");
    const pr = editorialUserPrompt({ ...withNotes, type: "press_release" }, "2026-08-31");
    expect(blog).toMatch(/missing/i);
    expect(blog).toMatch(/packager/i);
    expect(blog).toMatch(/bankofengland\.co\.uk/);
    expect(blog).not.toMatch(/FOR IMMEDIATE RELEASE/);
    expect(pr).toMatch(/FOR IMMEDIATE RELEASE/);
    expect(pr).toMatch(/London, 2026-08-31/);
    expect(pr).toMatch(/\[Media contact\]/);
    expect(pr).toMatch(/About Strata Finance/);
  });
});

describe("markdown and export payload", () => {
  it("renders a heading, a link, and a list", () => {
    const html = editorialMarkdownToHtml(
      "# Hello\n\nSee [BoE](https://www.bankofengland.co.uk).\n\n- one\n- two\n",
      "Hello",
    );
    expect(html).toMatch(/<meta charset="utf-8">/);
    expect(html).toMatch(/<title>Hello<\/title>/);
    expect(html).toMatch(/<h1>Hello<\/h1>/);
    expect(html).toMatch(/<a href="https:\/\/www.bankofengland.co.uk">BoE<\/a>/);
    expect(html).toMatch(/<li>one<\/li>/);
    expect(html).not.toMatch(/googletagmanager|analytics|tracking/i);
  });

  it("builds filename strata-{type}-{id}", () => {
    const payload = editorialExportPayload(piece({ type: "press_release", id: 9, body: "# PR\n\nWe do not lend." }));
    expect(payload.filename).toBe("strata-press_release-9");
    expect(payload.markdown).toMatch(/We do not lend/);
    expect(payload.html).toMatch(/<h1>/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/editorial.test.ts`

Expected: FAIL — cannot find `@shared/editorial`.

- [ ] **Step 3: Export house-policy regexes from Craft**

In `shared/craftQueue.ts` change:

```ts
const BANNED =
  /\b(guaranteed|instant approval|payday|0%\s*apr|apr\b|consumer loan|no credit check|guaranteed funding|we will lend|we lend)\b/i;

const RATE_CLAIM = /\bfrom\s+\d+(\.\d+)?%|\b\d+(\.\d+)?%\s*(apr|p\.?a\.?|interest|per year)\b/i;

const PACKAGER_IDENTITY = /\b(do not lend|don't lend|does not lend|packager)\b/i;
```

to `export const BANNED`, `export const RATE_CLAIM`, `export const PACKAGER_IDENTITY`. Do not change the patterns.

- [ ] **Step 4: Write `shared/editorial.ts`**

```ts
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

export const EDITORIAL_WRITER_PROMPT = `You are Isla Quinn, Marketing Director / Creative Director (MKT-2) at Strata Finance. You write long-form blogs and press releases. You do not post. You do not invent research or numbers. If a data bite is missing, write missing.

Strata packages UK SME distress-refinance, CDFI / British Business Bank, and HMRC Time to Pay files. Strata does not lend. Never claim rates, APR, guarantees, payday, consumer-credit, or "we lend". Always include a plain packager-identity sentence. Markdown only. Never Gemini.`;

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
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>')
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
```

- [ ] **Step 5: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/editorial.test.ts server/__tests__/shared/craftQueue.test.ts`

Expected: PASS. Craft tests still pass after exporting the regexes.

- [ ] **Step 6: Commit**

```
git add shared/editorial.ts shared/craftQueue.ts server/__tests__/shared/editorial.test.ts
git commit -m "feat: editorial copy review, prompts, and markdown export"
```

---

### Task 2: Schema and storage

**Files:**
- Modify: `shared/schema.ts` (append after the email-campaign constants, around line 1327)
- Modify: `server/storage.ts` (`IStorage` interface, after campaign recipients)
- Modify: `server/sqliteStorage.ts` (imports + methods using collection `editorial_pieces`)
- Modify: `shared/editorial.ts` — `export type EditorialPieceLike = EditorialPiece` once schema exists (keep the structural type if a circular import appears; schema must NOT import `editorial.ts`)

**Interfaces:**
- Consumes: `normalizeEditorialPiece`, `applyEditorialPatch` from `@shared/editorial`
- Produces:
  - `editorialPieceSchema`, `insertEditorialPieceSchema`, `createEditorialPieceSchema`
  - types `EditorialPiece`, `InsertEditorialPiece`
  - `IStorage.listEditorialPieces(userId: string): Promise<EditorialPiece[]>`
  - `IStorage.getEditorialPiece(id: number, userId: string): Promise<EditorialPiece | undefined>`
  - `IStorage.createEditorialPiece(piece: { type: "blog" | "press_release"; title: string; topic: string }, userId: string): Promise<EditorialPiece>`
  - `IStorage.updateEditorialPiece(id: number, userId: string, updates: Partial<EditorialPiece>): Promise<EditorialPiece | undefined>`
  - `IStorage.deleteEditorialPiece(id: number, userId: string): Promise<void>`

- [ ] **Step 1: Write a schema parse test in `editorial.test.ts`**

Add:

```ts
import { createEditorialPieceSchema, insertEditorialPieceSchema } from "@shared/schema";

describe("editorial schema", () => {
  it("requires type, title, and topic on create", () => {
    expect(createEditorialPieceSchema.safeParse({}).success).toBe(false);
    expect(createEditorialPieceSchema.safeParse({ type: "blog", title: "A", topic: "B" }).success).toBe(true);
    expect(createEditorialPieceSchema.safeParse({ type: "tweet", title: "A", topic: "B" }).success).toBe(false);
  });

  it("cannot create with autoPublish true", () => {
    const parsed = insertEditorialPieceSchema.safeParse({
      type: "blog",
      title: "A",
      topic: "B",
      autoPublish: true,
    });
    expect(parsed.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/editorial.test.ts`

Expected: FAIL — `createEditorialPieceSchema` is not exported from `@shared/schema`.

- [ ] **Step 3: Add schema**

Append to `shared/schema.ts`. Do not import `craftScout` from schema (avoids a cycle). `caseyNoteSchema` is a local zod object with the same `{ title, url, snippet }` shape as `CaseyNote`.

```ts
export const editorialTypeEnum = z.enum(["blog", "press_release"]);
export const editorialStatusEnum = z.enum(["draft", "approved", "rejected", "exported"]);
export const editorialComplianceEnum = z.enum(["pending", "cleared", "blocked"]);

export const caseyNoteSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
});

export const editorialEngineSchema = z
  .object({
    provider: z.enum(["anthropic", "xai"]),
    model: z.string(),
  })
  .nullable();

export const editorialPieceSchema = z.object({
  id: z.number().optional(),
  userId: z.string(),
  type: editorialTypeEnum,
  title: z.string().min(1, "Title is required"),
  topic: z.string().min(1, "Topic is required"),
  body: z.string().default(""),
  notes: z.array(caseyNoteSchema).default([]),
  engine: editorialEngineSchema.default(null),
  status: editorialStatusEnum.default("draft"),
  compliance: editorialComplianceEnum.default("pending"),
  autoPublish: z.literal(false).default(false),
  exportedAt: dateSchema,
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type EditorialPiece = z.infer<typeof editorialPieceSchema>;
export const insertEditorialPieceSchema = editorialPieceSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  exportedAt: true,
});
export type InsertEditorialPiece = z.infer<typeof insertEditorialPieceSchema>;
export const createEditorialPieceSchema = editorialPieceSchema.pick({
  type: true,
  title: true,
  topic: true,
});
```

Keep `EditorialPieceLike` as the structural type in `shared/editorial.ts`. Routes use `EditorialPiece` from schema. Do not import `schema.ts` from `editorial.ts` in this task.

- [ ] **Step 4: Storage**

In `server/storage.ts` add the five method signatures on `IStorage` (after campaign recipients). Import `EditorialPiece` and `InsertEditorialPiece` from `@shared/schema`.

In `server/sqliteStorage.ts`:

1. Add `EditorialPiece, InsertEditorialPiece` to the `@shared/schema` import.
2. Add `import { applyEditorialPatch } from "@shared/editorial";` at the top.
3. Add methods (collection name **`editorial_pieces`**):

```ts
async listEditorialPieces(userId: string): Promise<EditorialPiece[]> {
  return (getCollection("editorial_pieces") as EditorialPiece[])
    .filter((row) => row.userId === userId)
    .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
}

async getEditorialPiece(id: number, userId: string): Promise<EditorialPiece | undefined> {
  return (getCollection("editorial_pieces") as EditorialPiece[]).find(
    (row) => row.id === id && row.userId === userId,
  );
}

async createEditorialPiece(piece: InsertEditorialPiece, userId: string): Promise<EditorialPiece> {
  return insertItem("editorial_pieces", {
    type: piece.type,
    title: piece.title,
    topic: piece.topic,
    body: "",
    notes: [],
    engine: null,
    status: "draft",
    compliance: "pending",
    autoPublish: false,
    exportedAt: null,
    userId,
  }) as EditorialPiece;
}

async updateEditorialPiece(
  id: number,
  userId: string,
  updates: Partial<EditorialPiece>,
): Promise<EditorialPiece | undefined> {
  const existing = await this.getEditorialPiece(id, userId);
  if (!existing) return undefined;
  const content = applyEditorialPatch(existing, {
    title: updates.title,
    topic: updates.topic,
    body: updates.body,
  });
  const next = {
    ...content,
    notes: updates.notes ?? content.notes,
    engine: updates.engine === undefined ? content.engine : updates.engine,
    status: updates.status ?? content.status,
    compliance: updates.compliance ?? content.compliance,
    exportedAt: updates.exportedAt === undefined ? content.exportedAt : updates.exportedAt,
    autoPublish: false as const,
  };
  // If title/topic/body changed, applyEditorialPatch already reset status/compliance.
  // Action endpoints pass status/compliance without those fields, so they stick.
  if (updates.title !== undefined || updates.topic !== undefined || updates.body !== undefined) {
    next.status = content.status;
    next.compliance = content.compliance;
  }
  return updateItem("editorial_pieces", id, next) as EditorialPiece;
}

async deleteEditorialPiece(id: number, userId: string): Promise<void> {
  const existing = await this.getEditorialPiece(id, userId);
  if (!existing) return;
  deleteItem("editorial_pieces", id);
}
```

Prefer a static import of `applyEditorialPatch` at the top of `sqliteStorage.ts` if the file already imports from `@shared/*`. Do not persist `autoPublish: true` in any branch.

- [ ] **Step 5: Run tests**

Run: `npx vitest run server/__tests__/shared/editorial.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```
git add shared/schema.ts shared/editorial.ts server/storage.ts server/sqliteStorage.ts server/__tests__/shared/editorial.test.ts
git commit -m "feat: editorial piece schema and storage"
```

---

### Task 3: Casey topic scan

**Files:**
- Modify: `shared/craftScout.ts` — export `caseyHostAllowed`
- Modify: `server/services/caseyScout.ts` — add `caseyFirecrawlTopicScan`, `researchTopic`, `houseAskWithEngine`
- Create: `server/__tests__/services/caseyTopic.test.ts`

**Interfaces:**
- Consumes: `caseyNotesFromFirecrawlSearch`, `caseyNoteOnScope`, `CaseyNote`, `caseyTextModel`, existing `anthropicChat` / `xaiChat` in `caseyScout.ts`
- Produces:
  - `export function caseyHostAllowed(url: string): boolean` (same body as today)
  - `export async function caseyFirecrawlTopicScan(query: string): Promise<CaseyNote[]>`
  - `export async function researchTopic(topic: string, crawl?: (query: string) => Promise<CaseyNote[]>): Promise<{ notes: CaseyNote[]; warning?: string }>`
  - `export async function houseAskWithEngine(prompt: string, model?: string, systemInstruction?: string): Promise<{ text: string; engine: CaseyTextEngine }>`
  - `houseAsk` becomes `return (await houseAskWithEngine(...)).text` — same signature as today

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/services/caseyTopic.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { caseyHostAllowed, scanWeek } from "@shared/craftScout";
import { researchTopic } from "../../services/caseyScout";

describe("researchTopic", () => {
  it("passes the trimmed topic to crawl and keeps on-scope official notes", async () => {
    let seen = "";
    const result = await researchTopic("  HMRC Time to Pay SME arrears  ", async (query) => {
      seen = query;
      return [
        { title: "TTP guidance", url: "https://www.gov.uk/time-to-pay", snippet: "HMRC Time to Pay for SMEs in tax arrears." },
        { title: "Random blog", url: "https://random.blog/hero", snippet: "refinance stacked debt" },
        { title: "Crypto treasury", url: "https://www.bankofengland.co.uk/crypto", snippet: "bitcoin on the balance sheet" },
      ];
    });
    expect(seen).toBe("HMRC Time to Pay SME arrears");
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]!.url).toContain("gov.uk");
    expect(result.warning).toBeUndefined();
  });

  it("does not inject the Craft seed library when crawl is empty", async () => {
    const result = await researchTopic("UK SME stacked short-term loans refinance", async () => []);
    expect(result.notes).toEqual([]);
    expect(result.warning).toMatch(/No in-scope official sources landed/);
    expect(result.notes).not.toEqual(scanWeek(Date.now()).slice(0, 1));
  });

  it("throws when crawl throws", async () => {
    await expect(
      researchTopic("BoE hold", async () => {
        throw new Error("Firecrawl down");
      }),
    ).rejects.toThrow(/Firecrawl down/);
  });

  it("caps at 8 unique URLs", async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      title: `HMRC Time to Pay note ${i}`,
      url: `https://www.gov.uk/ttp-${i}`,
      snippet: "HMRC Time to Pay SME tax arrears refinance packager",
    }));
    many.push(many[0]!);
    const result = await researchTopic("HMRC Time to Pay", async () => many);
    expect(result.notes).toHaveLength(8);
  });
});

describe("caseyHostAllowed", () => {
  it("allows official UK hosts and drops others", () => {
    expect(caseyHostAllowed("https://www.bankofengland.co.uk/news")).toBe(true);
    expect(caseyHostAllowed("https://random.blog/hero")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/caseyTopic.test.ts`

Expected: FAIL — `researchTopic` is not exported.

- [ ] **Step 3: Export `caseyHostAllowed`**

In `shared/craftScout.ts` change `function caseyHostAllowed` to `export function caseyHostAllowed`.

- [ ] **Step 4: Implement scan + engine wrapper**

In `server/services/caseyScout.ts`:

1. Import `caseyHostAllowed` from `@shared/craftScout`.

2. Replace `houseAsk` with:

```ts
export async function houseAskWithEngine(
  prompt: string,
  model?: string,
  systemInstruction?: string,
): Promise<{ text: string; engine: CaseyTextEngine }> {
  const system = systemInstruction || MARKET_RESEARCHER_PROMPT;
  const errors: string[] = [];
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    try {
      const engine = caseyTextModel({
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
      });
      const text = await anthropicChat(prompt, system, model?.startsWith("claude-") ? model : engine.model);
      return { text, engine };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (xaiBearer(process.env)) {
    try {
      const engine = caseyTextModel({
        XAI_API_KEY: process.env.XAI_API_KEY,
        XAI_MODEL: process.env.XAI_MODEL,
      });
      const text = await xaiChat(prompt, system, engine.model);
      return { text, engine };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors[0] || "Casey needs ANTHROPIC_API_KEY or XAI_API_KEY");
}

export async function houseAsk(
  prompt: string,
  model?: string,
  systemInstruction?: string,
): Promise<string> {
  return (await houseAskWithEngine(prompt, model, systemInstruction)).text;
}
```

3. Add:

```ts
export async function caseyFirecrawlTopicScan(query: string): Promise<CaseyNote[]> {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) return [];
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 8, sources: ["web"], country: "GB" }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Firecrawl topic scan failed (${res.status})`);
  return caseyNotesFromFirecrawlSearch(await res.json());
}

export async function researchTopic(
  topic: string,
  crawl: (query: string) => Promise<CaseyNote[]> = caseyFirecrawlTopicScan,
): Promise<{ notes: CaseyNote[]; warning?: string }> {
  const query = topic.trim();
  if (!query) return { notes: [], warning: "No in-scope official sources landed" };
  const raw = await crawl(query);
  const seen = new Set<string>();
  const notes: CaseyNote[] = [];
  for (const note of raw) {
    if (!caseyHostAllowed(note.url) || !caseyNoteOnScope(note)) continue;
    if (seen.has(note.url)) continue;
    seen.add(note.url);
    notes.push(note);
    if (notes.length >= 8) break;
  }
  if (!notes.length) return { notes: [], warning: "No in-scope official sources landed" };
  return { notes };
}
```

Do **not** call `scanWeek` from `researchTopic`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run server/__tests__/services/caseyTopic.test.ts server/__tests__/services/caseyScout.test.ts`

Expected: PASS. Existing `researchWeek` tests still pass because `houseAsk` signature is unchanged.

- [ ] **Step 6: Commit**

```
git add shared/craftScout.ts server/services/caseyScout.ts server/__tests__/services/caseyTopic.test.ts
git commit -m "feat: Casey topic scan for editorial pieces"
```

---

### Task 4: Editorial API

**Files:**
- Create: `server/routes/editorial.ts`
- Modify: `server/routes.ts` — import and `app.use("/api", editorialRouter)` next to `craftRouter`
- Modify: `server/__tests__/shared/editorial.test.ts` — add the generate-without-notes / export-filename assertions if any gap remains (they already exist in Task 1)

**Interfaces:**
- Consumes: storage methods from Task 2; `researchTopic`, `houseAskWithEngine` from Task 3; editorial kernel from Task 1; `createEditorialPieceSchema` from Task 2
- Produces: Express router mounted at `/api` with the paths in the spec

- [ ] **Step 1: Write `server/routes/editorial.ts`**

```ts
import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";
import { createEditorialPieceSchema } from "@shared/schema";
import {
  EDITORIAL_WRITER_PROMPT,
  approveEditorial,
  canExportPiece,
  editorialExportPayload,
  editorialGenerateInputError,
  editorialUserPrompt,
  markEditorialExported,
  rejectEditorial,
  reviewEditorialCopy,
  signOffEditorialCompliance,
} from "@shared/editorial";
import { houseAskWithEngine, researchTopic } from "../services/caseyScout";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();
const patchSchema = z.object({
  title: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  body: z.string().optional(),
});

async function loadPiece(req: AuthenticatedRequest, res: Response) {
  const id = parseInt(String(req.params.id), 10);
  const piece = await storage.getEditorialPiece(id, req.user.id);
  if (!piece) {
    res.status(404).json({ error: "Editorial piece not found" });
    return null;
  }
  return piece;
}

router.get("/editorial", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(await storage.listEditorialPieces(req.user.id));
  } catch (err: any) {
    handleApiError(res, err, "list-editorial");
  }
});

router.post("/editorial", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createEditorialPieceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: fromZodError(parsed.error).message });
    const piece = await storage.createEditorialPiece(parsed.data, req.user.id);
    res.status(201).json(piece);
  } catch (err: any) {
    handleApiError(res, err, "create-editorial");
  }
});

router.get("/editorial/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const piece = await loadPiece(req, res);
    if (!piece) return;
    res.json(piece);
  } catch (err: any) {
    handleApiError(res, err, "get-editorial");
  }
});

router.patch("/editorial/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: fromZodError(parsed.error).message });
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, parsed.data);
    res.json(piece);
  } catch (err: any) {
    handleApiError(res, err, "patch-editorial");
  }
});

router.delete("/editorial/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    await storage.deleteEditorialPiece(existing.id!, req.user.id);
    res.json({ ok: true });
  } catch (err: any) {
    handleApiError(res, err, "delete-editorial");
  }
});

router.post("/editorial/:id/scan", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const result = await researchTopic(existing.topic);
    const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, { notes: result.notes });
    res.json({ ...piece, warning: result.warning });
  } catch (err: any) {
    console.error("[Editorial] scan", err);
    res.status(502).json({ error: err.message || "Topic scan failed" });
  }
});

router.post("/editorial/:id/generate", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const blocked = editorialGenerateInputError(existing);
    if (blocked) return res.status(400).json({ error: blocked });
    const today = new Date().toISOString().slice(0, 10);
    const { text, engine } = await houseAskWithEngine(
      editorialUserPrompt(existing, today),
      undefined,
      EDITORIAL_WRITER_PROMPT,
    );
    const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, {
      body: text,
      engine,
      status: "draft",
      compliance: "pending",
    });
    res.json(piece);
  } catch (err: any) {
    console.error("[Editorial] generate", err);
    res.status(500).json({ error: err.message || "Failed to generate editorial copy" });
  }
});

router.post("/editorial/:id/approve", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const next = approveEditorial(existing);
    const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, {
      status: next.status,
      compliance: next.compliance,
    });
    res.json(piece);
  } catch (err: any) {
    handleApiError(res, err, "approve-editorial");
  }
});

router.post("/editorial/:id/reject", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const next = rejectEditorial(existing);
    const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, { status: next.status });
    res.json(piece);
  } catch (err: any) {
    handleApiError(res, err, "reject-editorial");
  }
});

router.post("/editorial/:id/compliance", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    const action = req.body?.action;
    if (action === "blocked") {
      const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, { compliance: "blocked" });
      return res.json(piece);
    }
    if (action !== "cleared") return res.status(400).json({ error: "action must be cleared or blocked" });
    try {
      const next = signOffEditorialCompliance(existing);
      const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, { compliance: next.compliance });
      return res.json(piece);
    } catch (err: any) {
      return res.status(400).json({ error: err.message, findings: reviewEditorialCopy(existing).findings });
    }
  } catch (err: any) {
    handleApiError(res, err, "compliance-editorial");
  }
});

router.post("/editorial/:id/export", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await loadPiece(req, res);
    if (!existing) return;
    if (!canExportPiece(existing)) {
      return res.status(400).json({
        error: "Export is blocked until marketing approve and compliance sign-off.",
        findings: reviewEditorialCopy(existing).findings,
      });
    }
    const next = markEditorialExported(existing);
    const piece = await storage.updateEditorialPiece(existing.id!, req.user.id, {
      status: next.status,
      exportedAt: next.exportedAt,
    });
    const payload = editorialExportPayload(piece || next);
    res.json({ ...payload, piece: piece || next });
  } catch (err: any) {
    handleApiError(res, err, "export-editorial");
  }
});

export default router;
```

Mount in `server/routes.ts`:

```ts
import editorialRouter from "./routes/editorial";
// next to craftRouter:
app.use("/api", editorialRouter);
```

- [ ] **Step 2: Confirm generate-without-notes and export gates still have tests**

They live in Task 1 (`editorialGenerateInputError`, `canExportPiece`). No live HTTP. Do not add a test that calls Anthropic or Firecrawl.

- [ ] **Step 3: Run tests**

Run: `npx vitest run server/__tests__/shared/editorial.test.ts server/__tests__/services/caseyTopic.test.ts server/__tests__/services/caseyScout.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```
git add server/routes/editorial.ts server/routes.ts
git commit -m "feat: editorial API for scan, generate, gates, and export"
```

---

### Task 5: Factory graph and org docs

**Files:**
- Modify: `shared/factoryGraph.ts`
- Modify: `server/__tests__/shared/factoryGraph.test.ts`
- Modify: `docs/agentic-org/agents/MKT-2.md`
- Modify: `docs/agentic-org/agents/MKT-3.md`
- Modify: `docs/agentic-org/corporate_structure.md`
- Modify: `docs/agentic-org/CLAUDE.md`
- Modify: `docs/agentic-org/delegation_matrix.csv`
- Modify: `docs/agentic-org/agents.mmd`
- Modify: `docs/CRAFT.md`

**Interfaces:**
- Consumes: existing `FACTORY_NODES` / `FACTORY_EDGES`
- Produces: nodes `mkt-editorial-scan`, `mkt-editorial-compose`, `mkt-editorial-approve`, `mkt-editorial-compliance`, `mkt-editorial-export` feeding existing `mkt-post`

- [ ] **Step 1: Extend the factory graph test**

In `server/__tests__/shared/factoryGraph.test.ts` add:

```ts
it("plots the Editorial lane from Casey through Isla to Shaun", () => {
  const ids = new Set(FACTORY_NODES.map((node) => node.id));
  for (const id of [
    "mkt-editorial-scan",
    "mkt-editorial-compose",
    "mkt-editorial-approve",
    "mkt-editorial-compliance",
    "mkt-editorial-export",
    "mkt-post",
  ]) {
    expect(ids.has(id)).toBe(true);
  }
  expect(FACTORY_NODES.find((node) => node.id === "mkt-editorial-scan")?.desk).toBe("Casey");
  expect(FACTORY_NODES.find((node) => node.id === "mkt-editorial-compose")?.desk).toBe("Isla");
  expect(FACTORY_EDGES.some((edge) => edge.source === "mkt-editorial-scan" && edge.target === "mkt-editorial-compose")).toBe(true);
  expect(FACTORY_EDGES.some((edge) => edge.source === "mkt-editorial-compose" && edge.target === "mkt-editorial-approve")).toBe(true);
  expect(FACTORY_EDGES.some((edge) => edge.source === "mkt-editorial-approve" && edge.target === "mkt-editorial-compliance")).toBe(true);
  expect(FACTORY_EDGES.some((edge) => edge.source === "mkt-editorial-compliance" && edge.target === "mkt-editorial-export")).toBe(true);
  expect(FACTORY_EDGES.some((edge) => edge.source === "mkt-editorial-export" && edge.target === "mkt-post")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/factoryGraph.test.ts`

Expected: FAIL — missing `mkt-editorial-scan`.

- [ ] **Step 3: Add nodes and edges**

Append to `FACTORY_NODES` (y = 1060 so it sits under the email lane at 880):

```ts
{ id: "mkt-editorial-scan", label: "Topic scan", desk: "Casey", kind: "trigger", detail: "Editorial · Firecrawl official UK hosts", x: 0, y: 1060 },
{ id: "mkt-editorial-compose", label: "Compose article", desk: "Isla", kind: "auto", detail: "Blog / press release · Markdown", x: 280, y: 1060 },
{ id: "mkt-editorial-approve", label: "Marketing approve", desk: "You", kind: "human", detail: "Copy on /editorial", x: 560, y: 1060 },
{ id: "mkt-editorial-compliance", label: "Compliance sign-off", desk: "You", kind: "gate", detail: "Packager · no rates · no payday", x: 840, y: 1060 },
{ id: "mkt-editorial-export", label: "Export article", desk: "Isla", kind: "output", detail: "Markdown / HTML", x: 1120, y: 1060 },
```

Append to `FACTORY_EDGES`:

```ts
{ id: "e-mkt-ed-scan-compose", source: "mkt-editorial-scan", target: "mkt-editorial-compose", label: "notes" },
{ id: "e-mkt-ed-compose-approve", source: "mkt-editorial-compose", target: "mkt-editorial-approve" },
{ id: "e-mkt-ed-approve-comp", source: "mkt-editorial-approve", target: "mkt-editorial-compliance" },
{ id: "e-mkt-ed-comp-export", source: "mkt-editorial-compliance", target: "mkt-editorial-export" },
{ id: "e-mkt-ed-export-post", source: "mkt-editorial-export", target: "mkt-post", label: "you publish" },
```

- [ ] **Step 4: Org docs (exact edits)**

`docs/agentic-org/agents/MKT-2.md`

- Function line: add “and the Editorial desk (blogs and press releases)”.
- Responsibilities: add `- Draft blogs and press releases on /editorial from Casey topic-scan notes; marketing-approve; never publish`
- Tools: add `- Editorial desk (/editorial, /api/editorial/*)`
- Can do without approval: add `draft editorial pieces, run Casey topic scan, generate copy`
- Requires Director approval: sending/publishing editorial (export is allowed after marketing approve **and** compliance)
- Outputs: add `- Editorial drafts on /editorial; Markdown/HTML export after both gates`

`docs/agentic-org/agents/MKT-3.md`

- Responsibilities: add `- Topic-scan official UK hosts for an Editorial piece on /editorial; return notes only`
- Tools: add `- Editorial topic scan (/api/editorial/:id/scan)`
- Outputs: add `- CaseyNote[] on the Editorial piece. Do not write the article.`
- Hard stops stay: never write final copy.

`docs/agentic-org/corporate_structure.md`

- MKT-2 function cell: add `+ Editorial blogs/press releases`
- MKT-3 function cell: add `+ Editorial topic-scan notes`
- MKT-2 department paragraph: add one sentence that Isla also drafts `/editorial`
- MKT-3 department paragraph: add that Casey topic-scans for Editorial as well as weekly Craft ammo
- Delegation table rows:

```
| Editorial topic scan | MKT-3 | Notes only; missing numbers stay missing |
| Editorial draft (blog / press release) | MKT-2 | Draft only on /editorial |
| Editorial export | MKT-2 → Shaun | Marketing approve then compliance; Markdown/HTML |
| Editorial publish | MKT-2 → Shaun | Off-platform; never auto-post |
```

`docs/agentic-org/delegation_matrix.csv` append:

```
editorial_topic_scan,MKT-3,no,Notes only; official UK hosts; never invent rates; never write the article
editorial_draft,MKT-2,no,Blog or press release on /editorial; draft only
editorial_export,MKT-2,yes,Marketing approve then compliance sign-off; Markdown/HTML
editorial_publish,MKT-2,yes,Off-platform; never auto-post
```

`docs/agentic-org/agents.mmd` — change Isla label to include Editorial; add:

```
MKT --> T_EDIT[("Editorial drafts · md/html export")]
SCOUT -->|topic notes| MKT
```

Keep existing Creative Ammo edge.

`docs/agentic-org/CLAUDE.md` Never list: add `- Auto-publish an Editorial blog or press release.`

`docs/CRAFT.md` after section 1 (What it is), add:

```
Editorial (`/editorial`) is a **separate** long-form desk for blogs and press releases. It is not a Craft compositor mode. Casey topic-scans for the piece; Isla drafts Markdown; export is `.md` / `.html` after marketing approve and compliance. Shaun publishes elsewhere.
```

- [ ] **Step 5: Run factory tests**

Run: `npx vitest run server/__tests__/shared/factoryGraph.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```
git add shared/factoryGraph.ts server/__tests__/shared/factoryGraph.test.ts docs/agentic-org docs/CRAFT.md
git commit -m "docs: Editorial lane on the factory graph and marketing desks"
```

---

### Task 6: Editorial page and nav

**Files:**
- Create: `client/src/pages/Editorial.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `/api/editorial*` from Task 4; `editorialMarkdownToHtml`, `reviewEditorialCopy`, `canExportPiece`, `editorialGenerateInputError` from `@shared/editorial`; `EditorialPiece` from `@shared/schema`
- Produces: `/editorial` list + editor; sidebar item after Campaigns

- [ ] **Step 1: Sidebar**

In `client/src/components/Sidebar.tsx`:

1. Add `Newspaper` to the `lucide-react` import.
2. In the Marketing group, insert after Campaigns:

```ts
{ path: "/editorial", label: "Editorial", icon: Newspaper, roles: FULL },
```

Final order: Templates, Campaigns, Editorial, Media, Craft.

- [ ] **Step 2: Route**

In `client/src/App.tsx`:

```ts
const Editorial = lazy(() => import("@/pages/Editorial"));
```

Next to the email-campaigns route:

```tsx
<Route path="/editorial">
  {!isAuthenticated ? <Redirect to="/auth" /> : <Editorial />}
</Route>
```

- [ ] **Step 3: Write `client/src/pages/Editorial.tsx`**

Use Email Campaigns patterns (`usePageTitle`, `apiRequest`, `queryClient`, Dialog, Table, Cards, sonner toast). No Unlayer, no Craft canvas, no publish button.

```tsx
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePageTitle } from "@/context/LayoutContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Loader2,
  Newspaper,
  FileText,
  ArrowLeft,
  ShieldCheck,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import type { EditorialPiece } from "@shared/schema";
import {
  canExportPiece,
  editorialGenerateInputError,
  editorialMarkdownToHtml,
  reviewEditorialCopy,
} from "@shared/editorial";

const statusFilterValues = ["all", "draft", "approved", "exported"] as const;

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Editorial() {
  usePageTitle("EDITORIAL", "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draftType, setDraftType] = useState<"blog" | "press_release">("blog");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTopic, setDraftTopic] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmGenerate, setConfirmGenerate] = useState(false);

  const { data: pieces = [], isLoading } = useQuery<EditorialPiece[]>({
    queryKey: ["/api/editorial"],
  });

  const selected = pieces.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setBody(selected.body || "");
  }, [selected?.id, selected?.title, selected?.body]);

  useEffect(() => {
    if (!selected) return;
    const handle = window.setTimeout(() => {
      if (title === selected.title && body === (selected.body || "")) return;
      apiRequest(`/api/editorial/${selected.id}`, "PATCH", { title, body }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/editorial"] });
      });
    }, 600);
    return () => window.clearTimeout(handle);
  }, [title, body, selected?.id]);

  const filtered = pieces.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q || p.title.toLowerCase().includes(q) || p.topic.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesType = typeFilter === "all" || p.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const stats = useMemo(
    () => ({
      total: pieces.length,
      draft: pieces.filter((p) => p.status === "draft").length,
      approved: pieces.filter((p) => p.status === "approved").length,
      exported: pieces.filter((p) => p.status === "exported").length,
    }),
    [pieces],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/editorial", "POST", {
        type: draftType,
        title: draftTitle,
        topic: draftTopic,
      });
      return res.json() as Promise<EditorialPiece>;
    },
    onSuccess: (piece) => {
      queryClient.invalidateQueries({ queryKey: ["/api/editorial"] });
      setWizardOpen(false);
      setDraftTitle("");
      setDraftTopic("");
      setSelectedId(piece.id!);
      toast.success("Draft created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function postAction(path: string, data?: unknown) {
    const res = await apiRequest(path, "POST", data);
    const json = await res.json();
    queryClient.invalidateQueries({ queryKey: ["/api/editorial"] });
    return json;
  }

  const review = selected ? reviewEditorialCopy({ ...selected, title, body, autoPublish: false } as EditorialPiece) : null;
  const exportOk = selected ? canExportPiece({ ...selected, title, body, autoPublish: false } as EditorialPiece) : false;
  const generateBlocked = selected ? editorialGenerateInputError(selected) : "Scan Casey before generating";

  if (selected) {
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setSelectedId(null)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Badge variant="outline">{selected.type === "blog" ? "Blog" : "Press release"}</Badge>
          <Badge variant="outline">{selected.status}</Badge>
          <Badge variant="outline">{selected.compliance}</Badge>
          {selected.engine && (
            <Badge variant="outline">{selected.engine.provider} · {selected.engine.model}</Badge>
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const json = await postAction(`/api/editorial/${selected.id}/scan`);
                if (json.warning) toast.message(json.warning);
                else toast.success("Casey scanned this topic");
              } catch (err: any) {
                toast.error(err.message || "Scan failed");
              }
            }}
          >
            Scan
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(generateBlocked)}
            onClick={() => {
              if ((body || "").trim()) setConfirmGenerate(true);
              else postAction(`/api/editorial/${selected.id}/generate`).then(() => toast.success("Draft written"));
            }}
          >
            Generate
          </Button>
          <Button variant="outline" onClick={() => postAction(`/api/editorial/${selected.id}/approve`).then(() => toast.success("Approved"))}>
            Approve
          </Button>
          <Button variant="outline" onClick={() => postAction(`/api/editorial/${selected.id}/reject`).then(() => toast.message("Rejected"))}>
            Reject
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              postAction(`/api/editorial/${selected.id}/compliance`, { action: "cleared" })
                .then(() => toast.success("Compliance cleared"))
                .catch((err: Error) => toast.error(err.message))
            }
          >
            <ShieldCheck className="h-4 w-4 mr-1" /> Compliance
          </Button>
          <Button
            disabled={!exportOk}
            onClick={async () => {
              const json = await postAction(`/api/editorial/${selected.id}/export`);
              downloadText(`${json.filename}.md`, json.markdown, "text/markdown");
              downloadText(`${json.filename}.html`, json.html, "text/html");
              toast.success("Exported Markdown and HTML");
            }}
          >
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>

        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        <p className="text-xs text-muted-foreground">Topic: {selected.topic}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Textarea
            className="min-h-[480px] font-mono text-sm lg:col-span-1"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="lg:col-span-1 rounded-md border border-white/10 p-4 bg-muted/30 overflow-auto min-h-[480px]">
            <div
              className="prose prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: editorialMarkdownToHtml(body, title) }}
            />
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Casey notes</h3>
            {(selected.notes || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No notes yet. Scan this topic, or write the body yourself.</p>
            )}
            {(selected.notes || []).map((note) => (
              <Card key={note.url}>
                <CardContent className="p-3 space-y-1">
                  <p className="text-sm font-medium">{note.title}</p>
                  <p className="text-[11px] text-muted-foreground break-all">{note.url}</p>
                  <p className="text-xs">{note.snippet}</p>
                </CardContent>
              </Card>
            ))}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Copy review</h3>
              {review?.ok ? (
                <p className="text-xs text-emerald-400">House policy clear</p>
              ) : (
                review?.findings.map((f) => (
                  <p key={f.code} className="text-xs text-red-400">{f.message}</p>
                ))
              )}
            </div>
          </div>
        </div>

        <AlertDialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace the body?</AlertDialogTitle>
              <AlertDialogDescription>
                Generate overwrites the current Markdown from Casey’s notes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  postAction(`/api/editorial/${selected.id}/generate`).then(() => toast.success("Draft written"))
                }
              >
                Generate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, icon: Newspaper },
          { label: "Draft", value: stats.draft, icon: FileText },
          { label: "Approved", value: stats.approved, icon: ShieldCheck },
          { label: "Exported", value: stats.exported, icon: Download },
        ].map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search pieces..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="h-9">
            {statusFilterValues.map((v) => (
              <TabsTrigger key={v} value={v} className="text-xs capitalize">{v}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={typeFilter} onValueChange={setTypeFilter}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">All types</TabsTrigger>
            <TabsTrigger value="blog" className="text-xs">Blog</TabsTrigger>
            <TabsTrigger value="press_release" className="text-xs">Press release</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => setWizardOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New piece
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Newspaper className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No pieces yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create a blog or press release. Casey researches; you publish elsewhere.</p>
            <Button onClick={() => setWizardOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> New piece
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Engine</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id!)}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>{row.type === "blog" ? "Blog" : "Press release"}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.compliance}</TableCell>
                  <TableCell>{row.engine ? `${row.engine.provider}` : "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.updatedAt ? new Date(row.updatedAt as string).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New piece</DialogTitle>
            <DialogDescription>Blog or press release. Casey will scan the topic next.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={draftType} onValueChange={(v) => setDraftType(v as "blog" | "press_release")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="blog">Blog</SelectItem>
                  <SelectItem value="press_release">Press release</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Topic</Label>
              <Textarea value={draftTopic} onChange={(e) => setDraftTopic(e.target.value)} placeholder="What Casey should research" />
            </div>
            <Button
              className="w-full"
              disabled={!draftTitle.trim() || !draftTopic.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create draft"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

Fix generate/approve/compliance `onError`: `apiRequest` throws `"${status}: ${text}"`. That is enough for toasts.

Add a Compliance **blocked** control only if it fits the header without clutter — spec asks for cleared/blocked. Add a second small button next to Compliance:

```tsx
<Button variant="ghost" onClick={() => postAction(`/api/editorial/${selected.id}/compliance`, { action: "blocked" })}>
  Block
</Button>
```

- [ ] **Step 4: Typecheck and tests**

Run: `npx tsc --noEmit` if it is fast enough; otherwise `npx vitest run server/__tests__/shared/editorial.test.ts server/__tests__/shared/factoryGraph.test.ts server/__tests__/services/caseyTopic.test.ts`

Expected: PASS. `Editorial.tsx` must typecheck against `EditorialPiece`.

If `useQuery` for `/api/editorial` needs the default queryFn (it does — queryKey `["/api/editorial"]` hits GET `/api/editorial`).

- [ ] **Step 5: Manual check**

Log in, open Marketing → Editorial. Create a blog, confirm Scan/Generate/Approve/Compliance/Export exist and there is **no** Publish button. Confirm Craft and Campaigns still load.

If a browser tool is available, click the path. If not, state that UI was not browser-verified.

- [ ] **Step 6: Commit**

```
git add client/src/pages/Editorial.tsx client/src/App.tsx client/src/components/Sidebar.tsx
git commit -m "feat: Editorial desk page for blogs and press releases"
```

---

## Spec coverage

| Spec section | Task |
|---|---|
| Data / schema / storage / autoPublish / patch reset | 1, 2 |
| Copy review, markdown, export payload, prompts | 1 |
| Casey topic scan, no seed library, host allowlist | 3 |
| houseAsk Anthropic then Grok + engine stamp | 3, 4 |
| REST API | 4 |
| Factory graph + agent docs + CRAFT.md pointer | 5 |
| Sidebar, `/editorial`, list, wizard, editor | 6 |
| No publish, no Gemini, no Craft/campaigns regression | Global + 6 manual check |
