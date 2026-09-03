import { describe, expect, it } from "vitest";
import { createEditorialPieceSchema, insertEditorialPieceSchema } from "@shared/schema";
import {
  EDITORIAL_LINKEDIN_PROMPT,
  EDITORIAL_WRITER_PROMPT,
  applyEditorialPatch,
  approveEditorial,
  canExportPiece,
  editorialExportPayload,
  editorialGenerateInputError,
  editorialLinkedInUserPrompt,
  editorialReadiness,
  editorialMarkdownToHtml,
  editorialStillPrompt,
  editorialUserPrompt,
  formatEditorialLinkedInPost,
  insertEditorialImage,
  markEditorialExported,
  normalizeEditorialPiece,
  parseEditorialImageRequest,
  parseEditorialLinkedInPack,
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

  it("lets a Director override skip payday copy review", () => {
    const dirty = piece({ status: "approved", body: "Payday loans for directors." });
    expect(signOffEditorialCompliance(dirty, true).compliance).toBe("cleared");
    expect(() => signOffEditorialCompliance(piece({ status: "draft", body: "Payday loans." }), true)).toThrow(
      /approve/i,
    );
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

  it("quote-escapes href values", () => {
    const html = editorialMarkdownToHtml('See [x](https://example.com/?q="alert").', "T");
    expect(html).toContain('href="https://example.com/?q=&quot;alert&quot;"');
  });

  it("builds filename strata-{type}-{id}", () => {
    const payload = editorialExportPayload(piece({ type: "press_release", id: 9, body: "# PR\n\nWe do not lend." }));
    expect(payload.filename).toBe("strata-press_release-9");
    expect(payload.markdown).toMatch(/We do not lend/);
    expect(payload.html).toMatch(/<h1>/);
  });
});

describe("editorial schema", () => {
  it("requires type, title, and topic on create", () => {
    expect(createEditorialPieceSchema.safeParse({}).success).toBe(false);
    expect(createEditorialPieceSchema.safeParse({ type: "blog", title: "A", topic: "B" }).success).toBe(true);
    expect(createEditorialPieceSchema.safeParse({ type: "news", title: "A", topic: "B" }).success).toBe(true);
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

  it("accepts an optional hero still and LinkedIn pack", () => {
    const parsed = insertEditorialPieceSchema.safeParse({
      type: "blog",
      title: "A",
      topic: "B",
      heroImageUrl: "/uploads/media/u1/still.jpg",
      linkedinPack: {
        hook: "The refinance file sat for 11 months.",
        body: "Stacked short-term loans. No one owned the pack. Strata packages the file. We do not lend.",
        cta: "Talk to Strata",
        hashtags: ["#SMEFinance", "#UKBusiness", "#WorkingCapital"],
        keywords: ["SME refinance", "distress refinance", "UK packager", "working capital"],
      },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.heroImageUrl).toBe("/uploads/media/u1/still.jpg");
    expect(parsed.data.linkedinPack?.hashtags).toHaveLength(3);
  });
});

describe("editorial still prompt", () => {
  it("seeds a photographic prompt from title and topic, not slop or rates", () => {
    const prompt = editorialStillPrompt(piece());
    expect(prompt).toMatch(/Stacked debt, then the pack/);
    expect(prompt).toMatch(/UK SME stacked short-term loans refinance/);
    expect(prompt.toLowerCase()).toMatch(/no (readable )?text/);
    expect(prompt.toLowerCase()).not.toMatch(/\b(8k|masterpiece|octane|unreal engine)\b/);
    expect(prompt.toLowerCase()).not.toMatch(/\b(apr|payday|guaranteed)\b/);
  });

  it("uses a custom prompt when provided and still strips slop", () => {
    const prompt = editorialStillPrompt(piece(), "Oak desk, closed laptop, masterpiece 8k");
    expect(prompt).toMatch(/Oak desk, closed laptop/);
    expect(prompt.toLowerCase()).not.toMatch(/\b(8k|masterpiece)\b/);
  });

  it("strips hashtags from the seeded still prompt", () => {
    const prompt = editorialStillPrompt(piece({ topic: "Refinance #SMEFinance #UKBusiness" }));
    expect(prompt).toMatch(/Refinance/);
    expect(prompt).not.toMatch(/#SMEFinance|#UKBusiness/);
  });

  it("parseEditorialImageRequest accepts an optional prompt", () => {
    expect(parseEditorialImageRequest({})).toEqual({});
    expect(parseEditorialImageRequest({ prompt: "  Desk at dusk  " })).toEqual({ prompt: "Desk at dusk" });
    expect(() => parseEditorialImageRequest(null)).toThrow(/invalid/i);
  });
});

describe("editorial image insert and markdown", () => {
  it("prepends a markdown image for a media upload URL", () => {
    const next = insertEditorialImage("Body. We do not lend.", "/uploads/media/u1/still.jpg", "Stacked debt");
    expect(next).toBe("![Stacked debt](/uploads/media/u1/still.jpg)\n\nBody. We do not lend.");
  });

  it("rejects a non-media URL", () => {
    expect(() => insertEditorialImage("Body", "javascript:alert(1)", "x")).toThrow(/image url/i);
    expect(() => insertEditorialImage("Body", "/uploads/agent_jobs.json", "x")).toThrow(/image url/i);
  });

  it("renders a media image in the HTML preview", () => {
    const html = editorialMarkdownToHtml(
      "![Hero](/uploads/media/u1/still.jpg)\n\nStrata packages files. We do not lend.",
      "T",
    );
    expect(html).toContain('<img src="/uploads/media/u1/still.jpg" alt="Hero">');
    expect(html).not.toMatch(/javascript:/i);
  });
});

describe("editorial LinkedIn pack", () => {
  it("writer prompt is Isla, JSON-only, virality rules, house policy", () => {
    expect(EDITORIAL_LINKEDIN_PROMPT).toMatch(/Isla Quinn/i);
    expect(EDITORIAL_LINKEDIN_PROMPT).toMatch(/JSON/);
    expect(EDITORIAL_LINKEDIN_PROMPT).toMatch(/hashtag/i);
    expect(EDITORIAL_LINKEDIN_PROMPT).toMatch(/do not lend/i);
    expect(EDITORIAL_LINKEDIN_PROMPT).toMatch(/first line/i);
    expect(EDITORIAL_LINKEDIN_PROMPT).not.toMatch(/gemini/i);
  });

  it("user prompt grounds in the piece and asks for hook, hashtags, keywords", () => {
    const prompt = editorialLinkedInUserPrompt(piece({ body: "# Title\n\nStrata packages files. We do not lend." }));
    expect(prompt).toMatch(/Stacked debt, then the pack/);
    expect(prompt).toMatch(/We do not lend/);
    expect(prompt).toMatch(/hashtags/);
    expect(prompt).toMatch(/keywords/);
  });

  it("parses a JSON pack, caps hashtags at 5, prefixes #", () => {
    const pack = parseEditorialLinkedInPack(`{
      "hook": "The file sat for 11 months.",
      "body": "Stacked loans. No one owned the pack.\\n\\nStrata packages the file. We do not lend.",
      "cta": "Talk to Strata",
      "hashtags": ["SMEFinance", "#UKBusiness", "WorkingCapital", "Cashflow", "Directors", "Extra"],
      "keywords": ["SME refinance", "distress refinance", "UK packager", "working capital"]
    }`);
    expect(pack.hook).toBe("The file sat for 11 months.");
    expect(pack.cta).toBe("Talk to Strata");
    expect(pack.hashtags).toEqual([
      "#SMEFinance",
      "#UKBusiness",
      "#WorkingCapital",
      "#Cashflow",
      "#Directors",
    ]);
    expect(pack.keywords).toEqual(["SME refinance", "distress refinance", "UK packager", "working capital"]);
    expect(pack.body).toMatch(/do not lend/i);
  });

  it("appends packager identity when the model omits it", () => {
    const pack = parseEditorialLinkedInPack({
      hook: "Eleven months.",
      body: "Stacked short-term loans. No owner.",
      cta: "Talk to Strata",
      hashtags: ["#SMEFinance", "#UKBusiness", "#WorkingCapital"],
      keywords: ["SME refinance", "packager", "working capital", "UK SME"],
    });
    expect(pack.body).toMatch(/do not lend/i);
  });

  it("rejects banned terms in the pack", () => {
    expect(() =>
      parseEditorialLinkedInPack({
        hook: "Guaranteed funding from 4.9% APR.",
        body: "We lend. We do not lend.",
        cta: "Apply now",
        hashtags: ["#SMEFinance", "#UKBusiness", "#WorkingCapital"],
        keywords: ["APR", "loan", "funding", "rate"],
      }),
    ).toThrow(/house policy|rate|lend/i);
  });

  it("formats a clipboard-ready LinkedIn post", () => {
    const text = formatEditorialLinkedInPost({
      hook: "The file sat for 11 months.",
      body: "Stacked loans.\n\nStrata packages the file. We do not lend.",
      cta: "Talk to Strata",
      hashtags: ["#SMEFinance", "#UKBusiness", "#WorkingCapital"],
      keywords: ["SME refinance", "distress refinance", "UK packager", "working capital"],
    });
    expect(text).toBe(
      "The file sat for 11 months.\n\nStacked loans.\n\nStrata packages the file. We do not lend.\n\nTalk to Strata\n\n#SMEFinance #UKBusiness #WorkingCapital",
    );
  });

  it("keeps hero still and LinkedIn pack through normalize", () => {
    const next = normalizeEditorialPiece(
      piece({
        heroImageUrl: "/uploads/media/u1/still.jpg",
        linkedinPack: {
          hook: "The file sat.",
          body: "We do not lend.",
          cta: "Talk to Strata",
          hashtags: ["#SMEFinance", "#UKBusiness", "#WorkingCapital"],
          keywords: ["SME refinance", "packager", "working capital", "UK SME"],
        },
      }),
    );
    expect(next.heroImageUrl).toBe("/uploads/media/u1/still.jpg");
    expect(next.linkedinPack?.hashtags).toHaveLength(3);
  });
});

describe("editorialReadiness", () => {
  it("starts at 0 with no scan and no body", () => {
    const next = editorialReadiness(piece({ body: "", notes: [] }));
    expect(next.percent).toBe(0);
    expect(next.label).toMatch(/scan/i);
    expect(next.tone).toBe("idle");
  });

  it("steps 20% per gate: scan, body, policy, approve, compliance", () => {
    const scanned = piece({
      body: "",
      notes: [{ title: "BoE", url: "https://www.bankofengland.co.uk/n", snippet: "Held." }],
    });
    expect(editorialReadiness(scanned)).toMatchObject({ percent: 20, label: expect.stringMatching(/write/i) });

    const drafted = piece({ notes: scanned.notes });
    expect(editorialReadiness(drafted)).toMatchObject({ percent: 60, label: expect.stringMatching(/approve/i) });

    const approved = piece({ notes: scanned.notes, status: "approved" });
    expect(editorialReadiness(approved)).toMatchObject({ percent: 80, label: expect.stringMatching(/compliance/i) });

    const cleared = piece({ notes: scanned.notes, status: "approved", compliance: "cleared" });
    expect(editorialReadiness(cleared)).toMatchObject({ percent: 100, label: expect.stringMatching(/export/i), tone: "ready" });
  });

  it("holds at 40 until house policy is clear", () => {
    const dirty = piece({
      notes: [{ title: "BoE", url: "https://www.bankofengland.co.uk/n", snippet: "Held." }],
      body: "Guaranteed funding from 4.9% APR.",
    });
    expect(editorialReadiness(dirty).percent).toBe(40);
    expect(editorialReadiness(dirty).label).toMatch(/policy/i);
  });

  it("marks rejected and blocked as blocked tone without claiming 100", () => {
    expect(editorialReadiness(piece({ status: "rejected" })).tone).toBe("blocked");
    expect(editorialReadiness(piece({ status: "rejected" })).percent).toBeLessThan(100);
    expect(editorialReadiness(piece({ status: "approved", compliance: "blocked" })).tone).toBe("blocked");
    expect(editorialReadiness(piece({ status: "exported", compliance: "cleared" }))).toMatchObject({
      percent: 100,
      tone: "ready",
    });
  });
});
