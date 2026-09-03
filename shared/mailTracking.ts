export function ensureMailLinksOpenInNewTab(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
    if (/\btarget\s*=/i.test(attrs)) return full;
    return `<a${attrs} target="_blank" rel="noopener noreferrer">`;
  });
}

export function stripMailTracking(html: string): string {
  return html
    .replace(/<img\b[^>]*\/api\/agent-mail\/track\/[^>]*>/gi, "")
    .replace(/<img\b[^>]*\/api\/email-tracking\/open\/[^>]*>/gi, "")
    .replace(/href="[^"]*\/api\/agent-mail\/click\/[^"]*\?url=([^"]+)"/gi, (_match, encoded: string) => {
      try {
        return `href="${decodeURIComponent(encoded)}"`;
      } catch {
        return `href="${encoded}"`;
      }
    });
}

export function shouldRecordMailTracking(opts: { staffSession?: boolean; referer?: string } = {}): boolean {
  if (opts.staffSession) return false;
  const referer = (opts.referer || "").trim().toLowerCase();
  if (!referer) return true;
  if (referer.startsWith("about:")) return false;
  if (referer.includes("/agent-mail")) return false;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\b/.test(referer)) return false;
  return true;
}

export function lastMailOpenAt(opens?: string[]): string | undefined {
  if (!opens?.length) return undefined;
  return opens[opens.length - 1];
}

export function isOpenedOutboundMail(item: { direction?: string; opens?: string[] }): boolean {
  return item.direction === "outbound" && Boolean(lastMailOpenAt(item.opens));
}
