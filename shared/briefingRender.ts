import type { BriefingHypothesis } from "./briefingHypothesis";
import { CONVERT_STOP_LINE } from "./smeConvert";

export const BRIEFING_ENQUIRY_URL = "https://www.stratafinance.co.uk/#contact";

export type BriefingSlide = {
  title: string;
  body: string;
  enquiryUrl?: string;
  veltroUrl?: string;
};

export type BriefingRecord = {
  id: string;
  token: string;
  openerId: string;
  companyName: string;
  status: "draft" | "live" | "revoked";
  slides: BriefingSlide[];
  cover: { subject: string; html: string };
  sentAt?: string;
  revokedAt?: string;
  dwellAt?: string;
  openedAt?: string;
  slidesViewed: number[];
  createdAt: string;
};

export type BriefingBind = {
  companyName: string;
  dwellLine: string;
  filingsLine: string;
  hypothesis: BriefingHypothesis;
  enquiryUrl?: string;
  veltroUrl?: string;
};

export function defaultBriefingSlides(bound: BriefingBind): BriefingSlide[] {
  return [
    {
      title: "Cover",
      body: `${bound.companyName}\n\n${bound.dwellLine}`,
    },
    {
      title: "What we can see",
      body: bound.filingsLine,
    },
    {
      title: "Hypothesis",
      body: `${bound.hypothesis.headline}\n\n${bound.hypothesis.body}`,
    },
    {
      title: "How Strata would attack it",
      body: bound.hypothesis.mechanism,
    },
    {
      title: "Next step",
      body: "If this is in the right area, reply and I'll put a file together.",
      enquiryUrl: bound.enquiryUrl || BRIEFING_ENQUIRY_URL,
      veltroUrl: bound.veltroUrl,
    },
  ];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => `<p>${escapeHtml(chunk).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const PACK_CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #0b0d10; color: #e8eaed; }
body {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  line-height: 1.55;
  min-height: 100vh;
}
.pack, .wall {
  max-width: 42rem;
  margin: 0 auto;
  padding: 3.5rem 1.5rem 4rem;
}
.chrome {
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #9aa3ad;
  margin: 0 0 2.5rem;
}
section {
  min-height: 100vh;
  padding: 18vh 0 4rem;
  border-top: 1px solid #1c2128;
}
section:first-of-type { border-top: 0; padding-top: 0; }
h1 {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #8b949e;
  margin: 0 0 1rem;
}
p { margin: 0 0 1rem; font-size: 1.15rem; }
p { color: #d0d5db; }
.ctas { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.5rem; }
.ctas a {
  color: #e8eaed;
  text-decoration: none;
  border-bottom: 1px solid #6e7a86;
  padding-bottom: 0.1rem;
}
.stop {
  margin-top: 3rem;
  font-size: 0.85rem;
  color: #8b949e;
}
.wall p { font-size: 1.15rem; color: #c9d1d9; }
`.trim();

function documentHtml(opts: { title: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(opts.title)}</title>
<style>${PACK_CSS}</style>
</head>
<body>
${opts.body}
</body>
</html>`;
}

export function privateWallHtml(): string {
  return documentHtml({
    title: "Private",
    body: `<main class="wall" data-testid="briefing-private-wall"><p>This note is private.</p></main>`,
  });
}

export function renderBriefingHtml(record: BriefingRecord, opts: { live: boolean }): string {
  const chrome = `Prepared for the directors of ${record.companyName} · private · not for circulation.`;
  const slides = record.slides
    .map((slide, index) => {
      const links: string[] = [];
      if (slide.enquiryUrl) {
        links.push(`<a href="${escapeHtml(slide.enquiryUrl)}">Enquire or apply</a>`);
      }
      if (slide.veltroUrl) {
        links.push(`<a href="${escapeHtml(slide.veltroUrl)}">Veltro</a>`);
      }
      const cta = links.length ? `<div class="ctas">${links.join("")}</div>` : "";
      return `<section data-testid="briefing-slide-${index + 1}"><h1>${escapeHtml(slide.title)}</h1>${paragraphs(slide.body)}${cta}</section>`;
    })
    .join("");
  const rootAttr = opts.live ? ` class="pack" data-testid="briefing-pack"` : ` class="pack"`;
  const body = `<article${rootAttr}><p class="chrome">${escapeHtml(chrome)}</p>${slides}<p class="stop">${escapeHtml(CONVERT_STOP_LINE)}</p></article>`;
  return documentHtml({
    title: "Private briefing",
    body,
  });
}
