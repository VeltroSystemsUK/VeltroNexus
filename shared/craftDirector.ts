import { COPY_LIMITS, PACKAGER_IDENTITY, completeLine, splitHookLines } from "./craftQueue";
import type { CreativeAmmoBrief } from "./craftScout";
export { MARKETING_DIRECTOR_PROMPT } from "./islaQuinn";

export type CraftVisual = {
  stockId: string;
  query: string;
  prompt: string;
};

const LIBRARY: Record<string, CraftVisual> = {
  desk: {
    stockId: "desk",
    query: "UK SME office desk late afternoon",
    prompt:
      "Photographed UK limited-company office, late afternoon window light, oak desk, stacked files, no faces, 35mm, muted teal and warm paper, editorial, not stock-smile.",
  },
  paper: {
    stockId: "paper",
    query: "complete document pack on a desk",
    prompt:
      "Close, tactile still of a complete SME pack: accounts, bank statements, ID sleeve, clipped, overhead, hard light, grain, no logos, no people.",
  },
  city: {
    stockId: "city",
    query: "UK high street at dusk cash-flow pressure",
    prompt:
      "Dusk UK high street, wet pavement, independent shop lights, quiet tension, 50mm, cool grade, no homelessness, no luxury cars.",
  },
  hands: {
    stockId: "hands",
    query: "introducer and packager working a file",
    prompt:
      "Two pairs of hands over a commercial-finance file, meeting table, UK, documentary, shallow depth, no handshakes-as-cliché, no glass towers.",
  },
  studio: {
    stockId: "studio",
    query: "quiet studio light honesty",
    prompt:
      "Quiet studio, single hard key, empty pack box and a black notebook, negative space, honest, no neon, no 'fintech' gradients.",
  },
  "boardroom-small": {
    stockId: "boardroom-small",
    query: "SME directors around a small table",
    prompt:
      "Small UK board table, four chairs, one window with natural daylight, unposed, 35mm, no suits-as-armour, no skyline.",
  },
  ledger: {
    stockId: "ledger",
    query: "handwritten ledger and pencil, UK small business accounts",
    prompt:
      "Open paper ledger, columns of figures, a well-used pencil resting across the page, no laptop or screen in frame, overhead close, hard directional light, grain, UK, no logos, no people.",
  },
  yard: {
    stockId: "yard",
    query: "UK trade yard early morning with vans",
    prompt:
      "UK trade yard at first light, liveried vans parked in a row, cold blue-grey morning light, breath visible, wet tarmac, 35mm, documentary, no faces, no luxury vehicles.",
  },
  letterbox: {
    stockId: "letterbox",
    query: "brown envelope on a doormat, UK terraced house",
    prompt:
      "Brown envelope half through a letterbox onto a hallway mat, low morning light through a UK front door, shallow depth, quiet tension, no visible logo or crest, no people.",
  },
  site: {
    stockId: "site",
    query: "UK construction site office, hi-vis jacket on a hook",
    prompt:
      "Site cabin interior, a hi-vis jacket on a wall hook, hard hat on a desk beside rolled drawings, single window light, UK, tactile, grain, no people, no crane-against-skyline cliché.",
  },
  kitchen: {
    stockId: "kitchen",
    query: "restaurant kitchen pass, quiet after service",
    prompt:
      "Restaurant kitchen pass gone quiet after service, stainless steel catching low warm light, one cloth folded, no chefs in frame, documentary, UK independent restaurant, no neon signage.",
  },
  accountant: {
    stockId: "accountant",
    query: "accountant's desk, client file, two coffees",
    prompt:
      "Accountant's desk, a client file open beside two coffee cups mid-meeting, natural window light, UK office, documentary, shallow depth, no laptops-as-hero, no people.",
  },
  slabs: {
    stockId: "slabs",
    query: "physical layered stone slabs, strata brand object",
    prompt:
      "Physical strata-cut slabs stacked like geological layers in blue, gold, green and red toned stone or resin, single hard studio key light, deep shadow, negative space, honest and structural, no neon, no gradients.",
  },
};

export function curateVisual(post: {
  track: "borrower" | "introducer";
  title: string;
  hook: string;
  body: string;
  visual?: CraftVisual;
}): CraftVisual {
  if (post.visual?.stockId && LIBRARY[post.visual.stockId]) {
    return { ...LIBRARY[post.visual.stockId], ...post.visual, stockId: post.visual.stockId };
  }
  const text = `${post.title} ${post.hook} ${post.body}`.toLowerCase();
  if (/hmrc|letter|enforcement|winding.?up|arrears/.test(text)) return LIBRARY.letterbox;
  if (/ledger|bookkeeping|figures|accounts\b/.test(text)) return LIBRARY.ledger;
  if (/construction|building site|hi-?vis|trade\b/.test(text)) return LIBRARY.site;
  if (/hospitality|restaurant|kitchen|service industry/.test(text)) return LIBRARY.kitchen;
  if (/haulage|logistics|trade yard|van fleet/.test(text)) return LIBRARY.yard;
  if (/\blayer|strata\b|structural|foundation/.test(text)) return LIBRARY.slabs;
  if (post.track === "introducer" || /introducer|sterling|pack/.test(text)) {
    if (/accountant|cfo|adviser/.test(text)) return LIBRARY.accountant;
    if (/thin|relationship|keep/.test(text)) return LIBRARY.hands;
    if (/board|directors meeting/.test(text)) return LIBRARY["boardroom-small"];
    return LIBRARY.paper;
  }
  if (/distress|cash-flow|cash flow|pressure/.test(text)) return LIBRARY.city;
  if (/do not lend|packager|plainly|noisy/.test(text)) return LIBRARY.studio;
  if (/facility|refinance|expensive/.test(text)) return LIBRARY.desk;
  return post.track === "introducer" ? LIBRARY.paper : LIBRARY.desk;
}

export function visualForTrack(track: "borrower" | "introducer", stockId: string): CraftVisual {
  return LIBRARY[stockId] ?? (track === "introducer" ? LIBRARY.paper : LIBRARY.desk);
}

function ctaForSlot(daySlot: string | undefined, written: string | undefined, track: CreativeAmmoBrief["track"]): string {
  if (
    daySlot === "sunday-silence" ||
    daySlot === "tuesday-stamp" ||
    daySlot === "wednesday-voice" ||
    daySlot === "thursday-redact" ||
    daySlot === "saturday-object"
  ) {
    return "";
  }
  const line = (written ?? "").trim();
  if (line) return completeLine(line, COPY_LIMITS.cta);
  return completeLine(track === "introducer" ? "Package with Strata" : "Talk to Strata", COPY_LIMITS.cta);
}

// Job first, disclosure second, never the reverse — see shared/islaQuinn.ts section 4.3.
// Rotated (not a single fixed clause) so a week of seven cards doesn't stamp the same
// negation on every one of them.
export const IDENTITY_LINES = [
  "We build the file. We do not lend it.",
  "We package the case. We do not lend.",
  "One structure, built properly. We do not lend on it.",
  "We are the packager. The lender decides, not us.",
] as const;

export function identityLineFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return IDENTITY_LINES[hash % IDENTITY_LINES.length]!;
}

export function copyFromAmmo(brief: CreativeAmmoBrief, daySlot?: string): {
  track: CreativeAmmoBrief["track"];
  title: string;
  hook: string;
  hook2: string;
  body: string;
  cta: string;
  hashtags: string[];
  stockId: string;
} {
  const identity = identityLineFor(brief.headline || brief.coreFact || brief.track);
  const writtenHook = brief.hook?.trim();
  const hero = writtenHook
    ? { hook: completeLine(writtenHook, COPY_LIMITS.hook), hook2: completeLine(brief.hook2 ?? "", COPY_LIMITS.hook2) }
    : splitHookLines(brief.socialAngle);
  const writtenBody = brief.body?.trim();
  const impact = (writtenBody || brief.smeImpact).trim();
  const body = writtenBody
    ? completeLine(writtenBody, COPY_LIMITS.body)
    : PACKAGER_IDENTITY.test(impact) || impact.length + 1 + identity.length > COPY_LIMITS.body
      ? completeLine(impact, COPY_LIMITS.body)
      : completeLine(`${impact} ${identity}`, COPY_LIMITS.body);
  const hashtags =
    brief.track === "introducer"
      ? ["#CommercialFinance", "#Introducers", "#UKBrokers"]
      : ["#SMEFinance", "#UKBusiness", "#WorkingCapital"];
  const cta = ctaForSlot(daySlot, brief.cta, brief.track);
  if (daySlot === "sunday-silence") {
    const line = (hero.hook || brief.socialAngle.split(/[.!?]/)[0] || "").trim();
    const words = line.split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
    return {
      track: brief.track,
      title: brief.headline.trim(),
      hook: completeLine(words, COPY_LIMITS.hook),
      hook2: identity,
      body: "",
      cta: "",
      hashtags: [],
      stockId: brief.stockId,
    };
  }
  return {
    track: brief.track,
    title: brief.headline.trim(),
    hook: hero.hook,
    hook2: hero.hook2,
    body,
    cta,
    hashtags,
    stockId: brief.stockId,
  };
}
