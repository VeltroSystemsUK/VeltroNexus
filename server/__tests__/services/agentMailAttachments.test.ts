import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  persistMailAttachments,
  resolveMailAttachmentFile,
  setAgentMailAttachmentsDirForTests,
} from "../../services/agentMailAttachments";

afterEach(() => {
  setAgentMailAttachmentsDirForTests(null);
});

describe("persistMailAttachments", () => {
  it("writes keepable files under the mail id and skips CID logos", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-mail-att-"));
    setAgentMailAttachmentsDirForTests(root);
    const meta = persistMailAttachments("mail-uuid", [
      {
        filename: "pack.pdf",
        contentType: "application/pdf",
        contentDisposition: "attachment",
        content: Buffer.from("%PDF-pack"),
      },
      {
        filename: undefined,
        contentType: "image/png",
        contentDisposition: "inline",
        related: true,
        content: Buffer.from("png-bytes"),
      },
    ]);
    expect(meta).toEqual([
      {
        index: 0,
        filename: "pack.pdf",
        storedName: "0-pack.pdf",
        contentType: "application/pdf",
        size: 9,
      },
    ]);
    const dest = path.join(root, "mail-uuid", "0-pack.pdf");
    expect(fs.readFileSync(dest, "utf8")).toBe("%PDF-pack");
  });
});

describe("resolveMailAttachmentFile", () => {
  it("serves a stored file and rejects path traversal", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-mail-att-"));
    setAgentMailAttachmentsDirForTests(root);
    persistMailAttachments("mail-uuid", [
      {
        filename: "pack.pdf",
        contentType: "application/pdf",
        contentDisposition: "attachment",
        content: Buffer.from("%PDF-pack"),
      },
    ]);
    const hit = resolveMailAttachmentFile("mail-uuid", "0-pack.pdf");
    expect(hit && fs.readFileSync(hit, "utf8")).toBe("%PDF-pack");
    expect(resolveMailAttachmentFile("mail-uuid", "../secret.pdf")).toBeNull();
    expect(resolveMailAttachmentFile("mail-uuid", "0-pack.pdf/../../etc/passwd")).toBeNull();
    expect(resolveMailAttachmentFile("../mail-uuid", "0-pack.pdf")).toBeNull();
  });
});
