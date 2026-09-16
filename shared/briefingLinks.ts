import { helloPublicOrigin } from "./helloHost";

export type BriefingHttpGet = (url: string) => Promise<{ status: number; url?: string }>;
export type BriefingLinkFailure = { href: string; reason: string };

const ALLOWED_HOSTS = new Set([
  "www.stratafinance.co.uk",
  "stratafinance.co.uk",
  "hello.stratanexus.co.uk",
  "veltro.co.uk",
  "www.veltro.co.uk",
]);

const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/i;
const MERGE_TAG = /\{\{/;
const HREF_RE = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
const DATA_GO_RE = /\bdata-go\s*=\s*["']([^"']+)["']/gi;
const DATA_ID_RE = /\bdata-id\s*=\s*["']([^"']+)["']/gi;
const ID_RE = /\sid\s*=\s*["']([^"']+)["']/gi;
const LOGO_CSS_RE = /url\(\s*['"]?([^'")]*brand\/logo\/[^'")]*)['"]?\s*\)/gi;

let httpGetForTests: BriefingHttpGet | null = null;

export function setBriefingHttpGetForTests(fn: BriefingHttpGet | null): void {
  httpGetForTests = fn;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

export function collectBriefingLinks(html: string): { hrefs: string[]; dataGo: string[] } {
  const hrefs: string[] = [];
  const dataGo: string[] = [];
  const source = String(html || "");
  for (const match of source.matchAll(HREF_RE)) {
    const href = match[1] || "";
    if (/^(javascript:|mailto:)/i.test(href)) continue;
    hrefs.push(href);
  }
  for (const match of source.matchAll(LOGO_CSS_RE)) hrefs.push(match[1] || "");
  for (const match of source.matchAll(DATA_GO_RE)) dataGo.push(match[1] || "");
  return { hrefs: unique(hrefs), dataGo: unique(dataGo) };
}

function originHost(origin: string): string {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function allowedHosts(origin: string): Set<string> {
  const hosts = new Set(ALLOWED_HOSTS);
  const extra = originHost(origin);
  if (extra) hosts.add(extra);
  return hosts;
}

function stripWww(host: string): string {
  return host.replace(/^www\./, "");
}

function isPrivateHost(host: string): boolean {
  if (PRIVATE_HOST.test(host)) return true;
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

export function resolveBriefingHref(href: string, origin: string): URL | null {
  const raw = String(href || "").trim();
  if (!raw || MERGE_TAG.test(raw)) return null;
  try {
    return new URL(raw, origin.endsWith("/") ? origin : `${origin}/`);
  } catch {
    return null;
  }
}

export function assertBriefingPackLinks(
  html: string,
  origin = helloPublicOrigin()
): { ok: boolean; failures: BriefingLinkFailure[] } {
  const { hrefs, dataGo } = collectBriefingLinks(html);
  const dataIds = new Set(unique([...html.matchAll(DATA_ID_RE)].map((match) => match[1] || "")));
  const ids = new Set(unique([...html.matchAll(ID_RE)].map((match) => match[1] || "")));
  const failures: BriefingLinkFailure[] = [];
  const hosts = allowedHosts(origin);

  for (const target of dataGo) {
    if (!dataIds.has(target)) failures.push({ href: target, reason: "missing_slide" });
  }

  for (const href of hrefs) {
    if (MERGE_TAG.test(href)) {
      failures.push({ href, reason: "merge_tag" });
      continue;
    }
    if (href.startsWith("#")) {
      const id = href.slice(1);
      if (id && !ids.has(id) && !dataIds.has(id)) failures.push({ href, reason: "missing_slide" });
      continue;
    }
    const parsed = resolveBriefingHref(href, origin);
    if (!parsed) {
      failures.push({ href, reason: "invalid" });
      continue;
    }
    const host = parsed.hostname.toLowerCase();
    if (isPrivateHost(host) || host === "leads.stratanexus.co.uk") {
      failures.push({ href, reason: "forbidden_host" });
      continue;
    }
    if (![...hosts].some((allowed) => stripWww(allowed) === stripWww(host))) {
      failures.push({ href, reason: "forbidden_host" });
    }
  }

  return { ok: failures.length === 0, failures };
}

function cacheKey(url: URL): string {
  return `${url.origin}${url.pathname}`;
}

async function defaultGet(url: string): Promise<{ status: number; url?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    return { status: response.status, url: response.url };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkBriefingHttpLinks(
  hrefs: string[],
  opts: {
    origin: string;
    get?: BriefingHttpGet;
    cache?: Map<string, { ok: boolean; reason?: string }>;
  }
): Promise<{ ok: boolean; failures: BriefingLinkFailure[] }> {
  const get = opts.get || httpGetForTests || defaultGet;
  const cache = opts.cache || new Map<string, { ok: boolean; reason?: string }>();
  const hosts = allowedHosts(opts.origin);
  const failures: BriefingLinkFailure[] = [];

  for (const href of unique(hrefs)) {
    if (href.startsWith("#") || MERGE_TAG.test(href)) continue;
    const parsed = resolveBriefingHref(href, opts.origin);
    if (!parsed) {
      failures.push({ href, reason: "invalid" });
      continue;
    }
    parsed.hash = "";
    const host = parsed.hostname.toLowerCase();
    if (isPrivateHost(host) || host === "leads.stratanexus.co.uk") {
      failures.push({ href, reason: "forbidden_host" });
      continue;
    }
    if (![...hosts].some((allowed) => stripWww(allowed) === stripWww(host))) {
      failures.push({ href, reason: "forbidden_host" });
      continue;
    }
    const key = cacheKey(parsed);
    const cached = cache.get(key);
    if (cached) {
      if (!cached.ok) failures.push({ href, reason: cached.reason || "http" });
      continue;
    }
    try {
      const result = await get(parsed.toString());
      const finalHost = result.url ? new URL(result.url).hostname.toLowerCase() : host;
      const hostOk = [...hosts].some((allowed) => stripWww(allowed) === stripWww(finalHost));
      const ok = result.status >= 200 && result.status < 400 && hostOk;
      const reason = ok ? undefined : result.status >= 400 ? "http" : "forbidden_host";
      cache.set(key, { ok, reason });
      if (!ok) failures.push({ href, reason: reason || "http" });
    } catch {
      cache.set(key, { ok: false, reason: "timeout" });
      failures.push({ href, reason: "timeout" });
    }
  }

  return { ok: failures.length === 0, failures };
}
