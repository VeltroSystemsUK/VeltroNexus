import { useCallback, type SyntheticEvent } from "react";
import DOMPurify from "dompurify";
import { escapeHtml, extractGmailBody, type GmailPart } from "@shared/gmail";

const FRAME_CSS = `
  html, body { margin: 0; padding: 12px 4px; background: #fff; color: #111; }
  body { font: 14px/1.5 system-ui, Segoe UI, Helvetica, Arial, sans-serif; word-break: break-word; }
  img { max-width: 100% !important; height: auto !important; }
  table { max-width: 100% !important; }
  a { color: #0b57d0; }
`;

export function EmailBody({ payload }: { payload?: GmailPart | null }) {
  const extracted = extractGmailBody(payload);
  const raw = extracted.html
    ? extracted.html
    : extracted.text
      ? `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(extracted.text)}</pre>`
      : "<p style='color:#666'>No message body.</p>";

  const html = DOMPurify.sanitize(raw, {
    ADD_TAGS: ["style"],
    ADD_ATTR: [
      "target",
      "style",
      "class",
      "align",
      "valign",
      "bgcolor",
      "width",
      "height",
      "cellpadding",
      "cellspacing",
      "border",
      "colspan",
      "rowspan",
    ],
    ALLOW_DATA_ATTR: false,
  });

  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light"><style>${FRAME_CSS}</style></head><body>${html}</body></html>`;

  const onLoad = useCallback((event: SyntheticEvent<HTMLIFrameElement>) => {
    const frame = event.currentTarget;
    const doc = frame.contentDocument;
    if (!doc?.body) return;
    frame.style.height = `${Math.max(320, doc.documentElement.scrollHeight + 8)}px`;
  }, []);

  return (
    <div className="rounded-md border bg-white overflow-x-auto">
      <iframe
        title="Email message"
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        className="w-full min-h-[320px] border-0 bg-white"
        srcDoc={srcDoc}
        onLoad={onLoad}
      />
    </div>
  );
}
