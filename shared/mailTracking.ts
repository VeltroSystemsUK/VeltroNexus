export const MAIL_DWELL_MS = 10_000;

export function shouldTrackMailHref(url: string): boolean {
  if (/^https:\/\/explore\.stratanexus\.co\.uk\/?$/i.test(url)) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "stratafinance.co.uk") return true;
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    const hash = (parsed.hash || "").replace(/^#/, "");
    if (path !== "/") return true;
    if (hash) return true;
    if (parsed.searchParams.has("sf")) return true;
    return false;
  } catch {
    return true;
  }
}

export function mailDwellScript(base: string): string {
  const origin = String(base || "").replace(/\/$/, "");
  const pixelBase = `${origin}/api/agent-mail/dwell/`;
  return `(() => {
  try {
    const q = new URLSearchParams(location.search);
    const d = q.get("d");
    if (!d || !/^[0-9a-f-]{8,}$/i.test(d)) return;
    const sentKey = "sf_dwell_sent_" + d;
    if (sessionStorage.getItem(sentKey)) return;
    const startKey = "sf_dwell_" + d;
    if (!sessionStorage.getItem(startKey)) sessionStorage.setItem(startKey, String(Date.now()));
    const wait = Math.max(0, ${MAIL_DWELL_MS} - (Date.now() - Number(sessionStorage.getItem(startKey) || Date.now())));
    setTimeout(() => {
      if (sessionStorage.getItem(sentKey)) return;
      sessionStorage.setItem(sentKey, "1");
      const img = new Image();
      img.src = ${JSON.stringify(pixelBase)} + encodeURIComponent(d) + ".gif?sf=" + encodeURIComponent(q.get("sf") || "") + "&p=" + encodeURIComponent(location.pathname + location.hash);
    }, wait);
  } catch (e) {}
})();`;
}

export function withMailDwellToken(url: string, mailId: string): string {
  const token = String(mailId || "").trim();
  if (!token) return url;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "stratafinance.co.uk") return url;
    if (!parsed.searchParams.has("d")) parsed.searchParams.set("d", token);
    return parsed.toString();
  } catch {
    return url;
  }
}

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

export function outboundTrackingState(item: {
  direction?: string;
  status?: string;
  html?: string;
  opens?: string[];
  clicks?: unknown[];
}): { kind: "failed" | "mock" | "untracked" | "unopened" | "opened"; label: string; detail: string } | null {
  if (item.direction !== "outbound") return null;
  if (item.status === "failed") {
    return { kind: "failed", label: "Not sent", detail: "Blocked or failed — this did not go to the recipient." };
  }
  if (item.status === "mock") {
    return { kind: "mock", label: "Not sent", detail: "Logged locally only — no SMTP send." };
  }
  const tracked = typeof item.html === "string" && /\/api\/agent-mail\/track\//.test(item.html);
  const opens = item.opens || [];
  const clicks = item.clicks || [];
  if (!tracked && opens.length === 0) {
    return { kind: "untracked", label: "Not tracked", detail: "Sent before the open pixel was on." };
  }
  if (opens.length === 0) {
    return { kind: "unopened", label: "Not opened", detail: "Pixel not loaded yet. Mail apps can block images." };
  }
  const last = opens[opens.length - 1]!;
  const clickBit = clicks.length ? ` · ${clicks.length} click${clicks.length === 1 ? "" : "s"}` : "";
  return {
    kind: "opened",
    label: opens.length === 1 ? "Opened" : `Opened ${opens.length}×`,
    detail: `${last}${clickBit}`,
  };
}
