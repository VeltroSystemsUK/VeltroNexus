import fs from "fs";
import path from "path";
import { shouldKeepMailAttachment, type AgentMailAttachment, type MailAttachmentHint } from "@shared/agentMailAttachments";
import { sanitizeFilename } from "../utils/security";

export type MailAttachmentInput = MailAttachmentHint & {
  content?: Buffer | Uint8Array | string;
};

const DEFAULT_DIR = path.resolve(process.cwd(), "uploads", ".private", "agent-mail");
let dirOverride: string | null = null;

export function setAgentMailAttachmentsDirForTests(dir: string | null) {
  dirOverride = dir;
}

function attachmentsRoot(): string {
  return dirOverride || DEFAULT_DIR;
}

function isSafeSegment(value: string): boolean {
  if (!value) return false;
  if (value !== path.basename(value)) return false;
  if (value.includes("..") || value.includes("/") || value.includes("\\")) return false;
  return true;
}

function asBuffer(content: MailAttachmentInput["content"]): Buffer | null {
  if (!content) return null;
  if (Buffer.isBuffer(content)) return content;
  if (content instanceof Uint8Array) return Buffer.from(content);
  if (typeof content === "string") return Buffer.from(content);
  return null;
}

export function persistMailAttachments(mailId: string, attachments: MailAttachmentInput[]): AgentMailAttachment[] {
  if (!isSafeSegment(mailId)) return [];
  const kept = attachments.filter(shouldKeepMailAttachment);
  if (!kept.length) return [];
  const dir = path.join(attachmentsRoot(), mailId);
  fs.mkdirSync(dir, { recursive: true });
  const stored: AgentMailAttachment[] = [];
  for (const att of kept) {
    const buf = asBuffer(att.content);
    if (!buf || buf.length === 0) continue;
    const index = stored.length;
    const filename = sanitizeFilename(String(att.filename || `attachment-${index + 1}`));
    const storedName = `${index}-${filename}`;
    fs.writeFileSync(path.join(dir, storedName), buf);
    stored.push({
      index,
      filename,
      storedName,
      contentType: String(att.contentType || "application/octet-stream"),
      size: buf.length,
    });
  }
  return stored;
}

export function resolveMailAttachmentFile(mailId: string, storedName: string): string | null {
  if (!isSafeSegment(mailId) || !isSafeSegment(storedName)) return null;
  const root = path.resolve(attachmentsRoot(), mailId);
  const full = path.resolve(root, storedName);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (full !== root && !full.startsWith(prefix)) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return full;
}
