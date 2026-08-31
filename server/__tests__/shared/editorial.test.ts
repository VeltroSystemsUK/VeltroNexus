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
