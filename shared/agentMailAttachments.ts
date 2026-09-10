export type MailAttachmentHint = {
  filename?: string;
  contentType?: string;
  contentDisposition?: string;
  related?: boolean;
  cid?: string;
  contentId?: string;
};

export type AgentMailAttachment = {
  index: number;
  filename: string;
  storedName: string;
  contentType: string;
  size: number;
};

const DOCUMENT_NAME =
  /\.(pdf|xlsx|xls|csv|docx|doc|pptx|ppt|zip|txt|rtf|odt|ods|eml|msg)$/i;
const DOCUMENT_TYPE =
  /application\/(pdf|vnd\.|msword|zip|rtf)|text\/(csv|plain)/i;

export function shouldKeepMailAttachment(att: MailAttachmentHint): boolean {
  const filename = String(att.filename || "").trim();
  if (!filename) return false;
  const disposition = String(att.contentDisposition || "").toLowerCase();
  if (disposition === "attachment") return true;
  if (DOCUMENT_NAME.test(filename) || DOCUMENT_TYPE.test(String(att.contentType || ""))) {
    return true;
  }
  return false;
}

export function mailNeedsAttachmentBackfill(
  item: { attachments?: unknown[] } | undefined,
  keepableCount: number,
): boolean {
  if (!item || keepableCount <= 0) return false;
  return !Array.isArray(item.attachments) || item.attachments.length === 0;
}
