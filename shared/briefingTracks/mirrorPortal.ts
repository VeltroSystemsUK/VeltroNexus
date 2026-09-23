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
    theme: "The Mirror",
    title: "Mirror",
    visualNote: "Clean, upward-trending motion widgets, display company logo and website screenshot.",
    bodyTemplate:
      "Making a mark in the {{industry}} space takes relentless momentum. We see exactly what you are building at {{companyName}}. You have the vision and the traction, but as any founder knows, scaling introduces two massive, invisible weights.",
  },
  {
    slideId: "slide_2",
    theme: "The Agitation",
    title: "Agitation",
    visualNote: "Scale balancing two pressures: a ticking pressure gauge (finance) and a leaky funnel (sales).",
    bodyTemplate:
      "First, the financial squeeze: Capital gets trapped, supply chains tighten, and navigating HMRC or restructuring debt drains your energy. Second, the leaky bucket: High-value prospects 'dwell' on your site and leave in silence. You are fighting friction on both ends.",
  },
  {
    slideId: "slide_3",
    theme: "The Paradigm Shift",
    title: "Shift",
    visualNote: "Tension breaks. Scale transforms into a sleek, synchronized engine with smooth flow animations.",
    bodyTemplate:
      "It doesn't have to be a grind. What if you could deploy intelligent systems to solve both? We build bespoke engines that unlock trapped capital to give you breathing room, and AI-driven outreach that turns invisible traffic into jaw-dropping engagement.",
  },
  {
    slideId: "slide_4",
    theme: "The Portal",
    title: "Portal",
    visualNote: "Highly interactive. Two distinct, glowing pathways/widgets appear on screen.",
    bodyTemplate:
      "We've analyzed {{companyName}}'s profile, and the blueprint is ready. Where is the friction heaviest right now? Choose your playbook to see how we solve it.",
    linkTemplates: [
      { label: "I Need Financial Breathing Room & Cashflow", hrefTemplate: "#slide-5" },
      { label: "I Need to Weaponize My Sales & Leads", hrefTemplate: "#slide-6" },
    ],
  },
  {
    slideId: "slide_5",
    theme: "Financial CTA",
    title: "Cashflow",
    visualNote: "Calm, steady, professional layout.",
    bodyTemplate:
      "By intelligently restructuring debt and implementing a tailored Time-To-Pay strategy, we inject immediate cashflow runway back into the business. You built this company to lead it, not to be a full-time crisis manager. Let's get your capital working as hard as you do.",
    linkTemplates: [{ label: "Unlock Our Cashflow Blueprint", hrefTemplate: "{{enquiryUrl}}" }],
  },
  {
    slideId: "slide_6",
    theme: "Sales Booster CTA",
    title: "Outreach",
    visualNote: "Sleek, high-authority, urgent.",
    bodyTemplate:
      "You are actually experiencing our Sales Engine right now. Our AI tracked your dwell time and built this bespoke playbook instantly just to get your attention. Imagine arming your team with this exact weapon to capture your own site visitors. You just proved it works.",
    linkTemplates: [{ label: "Weaponize My Outreach", hrefTemplate: "{{veltroUrl}}" }],
  },
];

function sicPrefix2(code: string): number | null {
  const digits = String(code || "").replace(/\D/g, "");
  if (digits.length < 2) return null;
  const n = Number(digits.slice(0, 2));
  return Number.isFinite(n) ? n : null;
}

const SIC_INDUSTRY: Array<{ min: number; max: number; label: string }> = [
  { min: 1, max: 3, label: "agriculture" },
  { min: 5, max: 9, label: "mining" },
  { min: 10, max: 33, label: "manufacturing" },
  { min: 35, max: 35, label: "energy" },
  { min: 36, max: 39, label: "water and waste" },
  { min: 41, max: 43, label: "construction" },
  { min: 45, max: 45, label: "motor trade" },
  { min: 46, max: 46, label: "wholesale" },
  { min: 47, max: 47, label: "retail" },
  { min: 49, max: 53, label: "transport" },
  { min: 55, max: 56, label: "hospitality" },
  { min: 58, max: 58, label: "publishing" },
  { min: 59, max: 60, label: "media" },
  { min: 61, max: 61, label: "telecoms" },
  { min: 62, max: 62, label: "software" },
  { min: 63, max: 63, label: "information services" },
  { min: 64, max: 66, label: "financial services" },
  { min: 68, max: 68, label: "property" },
  { min: 69, max: 69, label: "legal and accounting" },
  { min: 70, max: 70, label: "consulting" },
  { min: 71, max: 71, label: "architecture and engineering" },
  { min: 72, max: 72, label: "scientific research" },
  { min: 73, max: 73, label: "advertising" },
  { min: 74, max: 75, label: "professional services" },
  { min: 77, max: 77, label: "rental" },
  { min: 78, max: 78, label: "recruitment" },
  { min: 79, max: 79, label: "travel" },
  { min: 80, max: 82, label: "business support" },
  { min: 84, max: 84, label: "public sector" },
  { min: 85, max: 85, label: "education" },
  { min: 86, max: 88, label: "health and care" },
  { min: 90, max: 93, label: "arts and leisure" },
  { min: 94, max: 94, label: "membership" },
  { min: 95, max: 95, label: "repair" },
  { min: 96, max: 96, label: "personal services" },
];

const FORBIDDEN_INDUSTRY = new Set(["", "your trade", "{{industry}}", "industry"]);

export function isForbiddenIndustry(value: string): boolean {
  return FORBIDDEN_INDUSTRY.has(String(value || "").trim().toLowerCase());
}

/** Construction 41–43 wins over manufacturing 10–33. Software 62 wins over generic IT. */
export function industryFromSic(sicCodes: string[]): string | null {
  const prefixes = sicCodes.map(sicPrefix2).filter((n): n is number => n != null);
  if (prefixes.some((n) => n >= 41 && n <= 43)) return "construction";
  if (prefixes.some((n) => n === 62)) return "software";
  for (const prefix of prefixes) {
    const hit = SIC_INDUSTRY.find((row) => prefix >= row.min && prefix <= row.max);
    if (hit) return hit.label;
  }
  return null;
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
