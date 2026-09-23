import type { BriefingBind, FilledSlide } from "./briefingRender";
export { packHtmlFromPageImages } from "./briefingRender";

function isPlaceholderVeltroHref(href: string | undefined): boolean {
  const value = String(href || "").trim();
  return !value || /^\{\{\s*veltroUrl\s*\}\}$/.test(value);
}

export function slidesWithLiveVeltro(
  slides: FilledSlide[] | undefined,
  token?: string | null
): FilledSlide[] | undefined {
  if (!slides?.length) return slides;
  const live = String(token || "").trim();
  const href = live ? `/veltro?b=${live}` : "";
  if (!href) return slides;
  return slides.map((slide) => {
    if (slide.slideId !== "slide_6" && slide.theme !== "Outreach") return slide;
    if (!slide.links?.length) return slide;
    return {
      ...slide,
      links: slide.links.map((link) =>
        isPlaceholderVeltroHref(link.href) ? { ...link, href } : link
      ),
    };
  });
}

export type BriefingMergeFields = {
  companyName: string;
  dwellLine: string;
  filings: string;
  hypothesis: string;
  mechanism: string;
  enquiryUrl: string;
  veltroUrl: string;
  industry: string;
};

export function mergeFieldsFromBind(bound: BriefingBind): BriefingMergeFields {
  return {
    companyName: bound.companyName,
    dwellLine: bound.dwellLine,
    filings: bound.filingsLine,
    hypothesis: `${bound.hypothesis.headline}\n\n${bound.hypothesis.body}`,
    mechanism: bound.hypothesis.mechanism,
    enquiryUrl: bound.enquiryUrl || "",
    veltroUrl: bound.veltroUrl || "",
    industry: bound.industry || "",
  };
}

export function fillMergeTags(text: string, fields: Record<string, string>): string {
  return String(text || "").replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) return match;
    const value = fields[key];
    return value == null || value === "" ? match : value;
  });
}

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Fill the customer-visual-aids house pack. Empty website tags become blank, not leftover {{website}}. */
export function fillOutreachPackHtml(
  html: string,
  fields: { companyName: string; industry: string; website?: string }
): string {
  const companyName = escapeHtml(fields.companyName);
  const industry = escapeHtml(fields.industry);
  const website = escapeHtml(fields.website || "");
  const aliases: Record<string, string> = {
    companyName,
    industry,
    website,
    COMPANY_NAME: companyName,
    INDUSTRY: industry,
    URL: website,
  };
  let out = String(html || "").replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(aliases, key)) return match;
    return aliases[key];
  });
  out = out.replace(/>COMPANY NAME</g, `>${companyName}<`);
  out = out.replace(/>INDUSTRY</g, `>${industry}<`);
  return out.replace(/(['"(])brand\/logo\//g, "$1/brand/logo/");
}

export function refillOutreachPackIndustry(html: string, industry: string): string {
  const safe = escapeHtml(industry);
  return String(html || "").replace(/(data-industry)([^>]*)>([^<]*)</gi, `$1$2>${safe}<`);
}

function splitSentences(block: string): string[] {
  const compact = block.replace(/\s+/g, " ").trim();
  if (!compact) return [];
  const parts = compact.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  if (compact.length <= 220) return [compact];
  const out: string[] = [];
  let rest = compact;
  while (rest.length >= 24 && out.length < 8) {
    if (rest.length <= 220) {
      out.push(rest);
      break;
    }
    let cut = rest.lastIndexOf(" ", 220);
    if (cut < 24) cut = 220;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return out;
}

export function siteCopyToBullets(text: string, cap = 8): string[] {
  const seen = new Set<string>();
  const bullets: string[] = [];
  const chunks = String(text || "")
    .split(/\n+/)
    .flatMap((block) => splitSentences(block));
  for (const raw of chunks) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 24 || line.length > 220) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    bullets.push(line);
    if (bullets.length >= cap) break;
  }
  return bullets;
}
