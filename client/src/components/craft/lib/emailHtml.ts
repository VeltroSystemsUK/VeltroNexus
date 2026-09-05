import { EMAIL_MERGE_TAGS } from "@shared/schema";
import { captureMotionFrame } from "./motion";
import { displayText } from "./text";
import { normalizeDocument, type CraftDocument, type CraftNode, type MotionNode, type TextNode } from "./types";

export const CRAFT_EMAIL_MARK = "craft.email.v1";

export type CraftEmailDesign = {
  engine: typeof CRAFT_EMAIL_MARK;
  doc: CraftDocument;
};

export function isCraftEmailDesign(value: unknown): value is CraftEmailDesign {
  if (!value || typeof value !== "object") return false;
  const raw = value as { engine?: unknown; doc?: unknown };
  return raw.engine === CRAFT_EMAIL_MARK && !!raw.doc && typeof raw.doc === "object";
}

export function isUnlayerEmailDesign(value: unknown): boolean {
  if (!value || value === "plaintext" || isCraftEmailDesign(value)) return false;
  return typeof value === "object" && Array.isArray((value as { body?: { rows?: unknown } }).body?.rows);
}

export function wrapCraftEmailDesign(doc: CraftDocument): CraftEmailDesign {
  return { engine: CRAFT_EMAIL_MARK, doc };
}

export function unwrapCraftEmailDesign(value: unknown): CraftDocument | null {
  if (!isCraftEmailDesign(value)) return null;
  return normalizeDocument(value.doc);
}

export const EMAIL_MERGE_CHIP = EMAIL_MERGE_TAGS;

export function insertMergeTag(text: string, tag: string, at = text.length): string {
  const index = Math.max(0, Math.min(at, text.length));
  const before = text.slice(0, index);
  const after = text.slice(index);
  const left = before && !/\s$/.test(before) ? " " : "";
  const right = after && !/^[,\s.!?;:)]/.test(after) ? " " : "";
  return `${before}${left}${tag}${right}${after}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailText(node: TextNode): string {
  const raw = /\{\{[a-zA-Z]+\}\}/.test(node.text) ? node.text : displayText(node);
  return escapeHtml(raw).replace(/\n/g, "<br/>");
}

function motionEmailSrc(node: MotionNode, assets: CraftDocument["assets"]): string | null {
  const captured = assets.find((item) => item.id === node.capturedAssetId)?.dataUrl;
  if (captured) return captured;
  const frame = captureMotionFrame(node, assets);
  return frame.dataUrl || null;
}

function nodeRow(node: CraftNode, assets: CraftDocument["assets"]): string {
  if (node.hidden) return "";
  const pad = "8px 32px";
  if (node.type === "text") {
    const align = node.align === "center" ? "center" : node.align === "right" ? "right" : "left";
    return `<tr><td style="padding:${pad};font-family:'${escapeHtml(node.fontFamily)}',Arial,sans-serif;font-size:${Math.round(node.fontSize)}px;font-weight:${node.fontWeight};color:${escapeHtml(node.color)};text-align:${align};line-height:${node.lineHeight};letter-spacing:${node.letterSpacing}px;opacity:${node.opacity};">${emailText(node)}</td></tr>`;
  }
  if (node.type === "image" || node.type === "motion") {
    const src = node.type === "image"
      ? assets.find((item) => item.id === node.assetId)?.dataUrl
      : motionEmailSrc(node, assets);
    if (!src) return "";
    const width = Math.min(536, Math.round(node.width));
    return `<tr><td style="padding:${pad};text-align:center;"><img src="${escapeHtml(src)}" width="${width}" alt="" style="max-width:100%;height:auto;display:block;margin:0 auto;border:0;opacity:${node.opacity};"/></td></tr>`;
  }
  if (node.type === "shape") {
    const height = Math.max(4, Math.round(Math.min(node.height, 48)));
    return `<tr><td style="padding:0 32px;height:${height}px;background:${escapeHtml(node.fill)};font-size:0;line-height:0;">&nbsp;</td></tr>`;
  }
  return "";
}

export function emailHtmlFromCraft(doc: CraftDocument): string {
  const page = doc.pages.find((item) => item.id === doc.activePageId) ?? doc.pages[0];
  if (!page) return "";
  const width = Math.min(600, page.width);
  const nodes = [...page.nodes].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = nodes.map((node) => nodeRow(node, doc.assets)).join("");
  const bg = escapeHtml(page.background.color || "#ffffff");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:0;background:${bg};"><table role="presentation" width="${width}" cellpadding="0" cellspacing="0" style="margin:0 auto;width:${width}px;background:${bg};border-collapse:collapse;">${rows}</table></body></html>`;
}
