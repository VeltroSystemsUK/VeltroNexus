export function gmailListQuery(folder: string, search?: string): string {
  const folderQuery =
    folder === "inbox"
      ? "in:inbox"
      : folder === "sent"
        ? "in:sent"
        : folder === "drafts"
          ? "in:drafts"
          : folder === "trash"
            ? "in:trash"
            : folder && folder !== "all"
              ? `label:${folder}`
              : "";
  return [folderQuery, String(search || "").trim()].filter(Boolean).join(" ");
}

export function gmailHeader(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string {
  const target = name.toLowerCase();
  return headers?.find((header) => String(header.name || "").toLowerCase() === target)?.value || "";
}

export function decodeGmailBase64(data?: string | null): string {
  if (!data) return "";
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = typeof atob === "function" ? atob(pad) : Buffer.from(pad, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

export type GmailPart = {
  mimeType?: string | null;
  filename?: string | null;
  body?: { data?: string | null; size?: number | null; attachmentId?: string | null } | null;
  parts?: GmailPart[] | null;
};

export function extractGmailBody(payload?: GmailPart | null): { html: string; text: string } {
  const html: string[] = [];
  const text: string[] = [];

  const walk = (part?: GmailPart | null) => {
    if (!part) return;
    if (part.parts?.length) {
      for (const child of part.parts) walk(child);
      return;
    }
    if (!part.body?.data) return;
    const mime = String(part.mimeType || "").toLowerCase();
    const decoded = decodeGmailBase64(part.body.data);
    if (mime.includes("text/html")) html.push(decoded);
    else if (mime.includes("text/plain")) text.push(decoded);
  };

  walk(payload);
  return { html: html[0] || "", text: text[0] || "" };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type GmailAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
};

export function listGmailAttachments(payload?: GmailPart | null): GmailAttachment[] {
  const files: GmailAttachment[] = [];
  const walk = (part?: GmailPart | null) => {
    if (!part) return;
    if (part.parts?.length) {
      for (const child of part.parts) walk(child);
      return;
    }
    if (part.filename && part.body?.attachmentId) {
      files.push({
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: Number(part.body.size || 0),
        attachmentId: part.body.attachmentId,
      });
    }
  };
  walk(payload);
  return files;
}

export function appendGmailSignature(body: string, signature: string): string {
  const html = String(body || "");
  const sig = String(signature || "").trim();
  if (!sig || html.includes("gmail_signature")) return html;
  return `${html}<div class="gmail_signature" dir="ltr">${sig}</div>`;
}

export function parseFromHeader(raw?: string): { name: string; email: string; display: string } {
  const value = String(raw || "").trim();
  const match = value.match(/^(?:"?([^"]*)"?\s*)?<([^>]+)>$/) || value.match(/^(.*)\s+<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    const email = match[2].trim();
    return { name: name || email, email, display: name || email };
  }
  if (value.includes("@")) return { name: value, email: value, display: value };
  return { name: value || "Unknown", email: "", display: value || "Unknown" };
}
