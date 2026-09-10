import { describe, expect, it } from "vitest";
import {
  mailNeedsAttachmentBackfill,
  shouldKeepMailAttachment,
} from "@shared/agentMailAttachments";

describe("shouldKeepMailAttachment", () => {
  it("keeps a named PDF even when the part is inline", () => {
    expect(
      shouldKeepMailAttachment({
        filename: "March bank statement.pdf",
        contentType: "application/pdf",
        contentDisposition: "inline",
      }),
    ).toBe(true);
  });

  it("keeps xlsx and docx sent as attachments", () => {
    expect(
      shouldKeepMailAttachment({
        filename: "management-accounts.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        contentDisposition: "attachment",
      }),
    ).toBe(true);
    expect(
      shouldKeepMailAttachment({
        filename: "facility-letter.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        contentDisposition: "attachment",
      }),
    ).toBe(true);
  });

  it("skips unnamed CID logos", () => {
    expect(
      shouldKeepMailAttachment({
        filename: "",
        contentType: "image/png",
        contentDisposition: "inline",
        related: true,
        cid: "logo@mail",
      }),
    ).toBe(false);
    expect(
      shouldKeepMailAttachment({
        contentType: "image/jpeg",
        related: true,
      }),
    ).toBe(false);
  });

  it("skips named inline signature images", () => {
    expect(
      shouldKeepMailAttachment({
        filename: "logo.png",
        contentType: "image/png",
        contentDisposition: "inline",
        related: true,
      }),
    ).toBe(false);
  });
});

describe("mailNeedsAttachmentBackfill", () => {
  it("backfills already-logged mail that has keepable files and no stored attachments", () => {
    expect(mailNeedsAttachmentBackfill({ attachments: undefined }, 2)).toBe(true);
    expect(mailNeedsAttachmentBackfill({ attachments: [] }, 1)).toBe(true);
    expect(mailNeedsAttachmentBackfill({ attachments: [{ filename: "a.pdf" }] }, 1)).toBe(false);
    expect(mailNeedsAttachmentBackfill({ attachments: undefined }, 0)).toBe(false);
    expect(mailNeedsAttachmentBackfill(undefined, 1)).toBe(false);
  });
});
