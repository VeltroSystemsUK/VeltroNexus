import { fillMergeTags } from "../briefingCraft";
import type { BriefingBind, BriefingSlide } from "../briefingRender";
import { BRIEFING_ENQUIRY_URL } from "../briefingRender";

export const MIRROR_PORTAL_TRACK_ID = "mirror_portal";

export type FilledSlide = {
  slideId: string;
  theme: string;
  title: string;
  body: string;
  visualNote: string;
  links?: { label: string; href: string }[];
};

type HouseSlide = {
  slideId: string;
  theme: string;
  title: string;
  bodyTemplate: string;
  visualNote: string;
  linkTemplates?: { label: string; hrefTemplate: string }[];
};

const HOUSE: HouseSlide[] = [
  {
    slideId: "slide_1",
    theme: "Mirror",
    title: "Mirror",
    visualNote: "company name, industry, room for logo or site screenshot from Gallery.",
    bodyTemplate: `{{companyName}}
{{industry}}

{{dwellLine}}

We can see the company on the register, and that you came back to the site. That is what this note is built from.`,
  },
  {
    slideId: "slide_2",
    theme: "Agitation",
    title: "Agitation",
    visualNote: "two weights — capital (filings) and this visit (dwell). Not a leaky funnel on *their* site.",
    bodyTemplate: `Two weights, from what we can actually see.

{{filings}}

{{hypothesis}}

And you spent time on this site. That is why this note exists — not a claim about traffic on your own website.`,
  },
  {
    slideId: "slide_3",
    theme: "Shift",
    title: "Shift",
    visualNote: "two engines, still, not a live machine.",
    bodyTemplate: `It does not have to stay a grind on both sides.

{{mechanism}}

The other door is a briefing like this one, made for a director who actually sat on a site. You are reading that proof.`,
  },
  {
    slideId: "slide_4",
    theme: "Portal",
    title: "Portal",
    visualNote: "two labelled paths. Links are HTML under the still, not widgets.",
    bodyTemplate: `From what we can see for {{companyName}}, which friction is heavier right now?`,
    linkTemplates: [
      { label: "Cashflow and the file", hrefTemplate: "#slide-5" },
      { label: "This briefing, for my own traffic", hrefTemplate: "#slide-6" },
    ],
  },
  {
    slideId: "slide_5",
    theme: "Cashflow",
    title: "Cashflow",
    visualNote: "calm, professional.",
    bodyTemplate: `{{mechanism}}

If this is in the right area, reply and I'll put a file together.`,
    linkTemplates: [{ label: "Enquire or apply", hrefTemplate: "{{enquiryUrl}}" }],
  },
  {
    slideId: "slide_6",
    theme: "Outreach",
    title: "Outreach",
    visualNote: "the pack itself is the artefact.",
    bodyTemplate: `You are reading a private briefing because you spent time on the site. We made this pack. Veltro is how you do this for directors who sit on your pages — not a claim that software built it while you waited.`,
    linkTemplates: [{ label: "Veltro", hrefTemplate: "{{veltroUrl}}" }],
  },
];

function sicPrefix2(code: string): number | null {
  const digits = String(code || "").replace(/\D/g, "");
  if (digits.length < 2) return null;
  const n = Number(digits.slice(0, 2));
  return Number.isFinite(n) ? n : null;
}

/** Construction 41–43 wins over manufacturing 10–33. */
export function industryFromSic(sicCodes: string[]): string {
  const prefixes = sicCodes.map(sicPrefix2).filter((n): n is number => n != null);
  if (prefixes.some((n) => n >= 41 && n <= 43)) return "construction";
  if (prefixes.some((n) => n === 62)) return "software";
  if (prefixes.some((n) => n >= 10 && n <= 33)) return "manufacturing";
  return "your trade";
}

function mergeFields(bind: BriefingBind & { industry: string }): Record<string, string> {
  return {
    companyName: bind.companyName,
    industry: bind.industry,
    dwellLine: bind.dwellLine,
    filings: bind.filingsLine,
    hypothesis: `${bind.hypothesis.headline}\n\n${bind.hypothesis.body}`,
    mechanism: bind.hypothesis.mechanism,
    enquiryUrl: bind.enquiryUrl || BRIEFING_ENQUIRY_URL,
    veltroUrl: bind.veltroUrl || "",
  };
}

export function fillMirrorPortal(bind: BriefingBind & { industry: string }): FilledSlide[] {
  const fields = mergeFields(bind);
  return HOUSE.map((slide) => {
    const filled: FilledSlide = {
      slideId: slide.slideId,
      theme: slide.theme,
      title: slide.title,
      body: fillMergeTags(slide.bodyTemplate, fields),
      visualNote: slide.visualNote,
    };
    if (slide.linkTemplates?.length) {
      filled.links = slide.linkTemplates.map((link) => ({
        label: link.label,
        href: fillMergeTags(link.hrefTemplate, fields),
      }));
    }
    return filled;
  });
}

export function slidesFromFilled(filled: FilledSlide[]): BriefingSlide[] {
  return filled.map((slide) => {
    const out: BriefingSlide = { title: slide.title, body: slide.body };
    if (slide.slideId === "slide_5") {
      const href = slide.links?.[0]?.href;
      if (href) out.enquiryUrl = href;
    }
    if (slide.slideId === "slide_6") {
      const href = slide.links?.[0]?.href;
      if (href) out.veltroUrl = href;
    }
    return out;
  });
}
