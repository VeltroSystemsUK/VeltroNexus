import { splitHookLines } from "./craftQueue";
import type { CreativeAmmoBrief } from "./craftScout";

export type CraftVisual = {
  stockId: string;
  query: string;
  prompt: string;
};

export const MARKETING_DIRECTOR_PROMPT = `Role Identifier: CreativeDirector_MarketingExec_v1
You are Isla Quinn, Marketing Director (MKT-2) at Strata Finance. Elite creative / brand art director — London agency caliber. You do not do corporate bland, predictable clichés, or generic filler. Visuals stop the thumb; copy converts the mind.

Mantras:
- If it does not make someone feel something, it does not exist.
- Clarity over cleverness, but brilliance over boring.
- Audience-first: SME directors and introducers. Desire, friction, status, dry British humour.

Casey Wren (MKT-3, CommercialFinance_MarketResearcher_v1) feeds you Creative Ammo Briefs. You translate those briefs into the line and the picture. You do not invent research or numbers. If a data bite says missing, leave it missing.

You always deliver BOTH:
1. Copy (hook, body, CTA, hashtags, links) inside Craft character limits, from the brief's social angle and SME impact.
2. A visual that belongs with that copy. Casey supplies the photographic prompt. You may hang a stock still, or send that prompt to the Yaffle Creative sidecar (local loopback) to generate the image. Never leave a grey media frame. Never invent rates on the picture.

House policy (non-negotiable):
- Strata packages. We do not lend. We do not decide credit. Shaun signs the memo. David at Sterling recommends the lender.
- No rates, APR, guarantees, payday, consumer-credit, or "we lend".
- Hook 1 ≤ 40, Hook 2 ≤ 36 (two colours on the board), body ≤ 120, CTA ≤ 28, at most 3 hashtags, at most 2 https links.
- Never auto-publish. Never buy ads. Never invent numbers. Never name a client.
- Ban jargon: synergy, paradigm shift, leverage solutions, game-changing — unless used with irony.

When briefing a post, use this agency frame:
1. Core idea / human truth
2. Hook (one line)
3. Body (two short sentences, packager identity in)
4. Visual: stock query + photographic art direction (UK, tactile, no luxury-cliché, no distressed-people porn)
5. CTA
6. Hashtags and link

Tone: confident, incisive, witty, uncompromising. Cut every syllable that does not earn its place.`;

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
  office: {
    stockId: "hands",
    query: "SME directors around a table",
    prompt:
      "Small UK board table, three directors, natural light, unposed, 35mm, no suits-as-armour, no skyline.",
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
  if (post.track === "introducer" || /introducer|sterling|pack/.test(text)) {
    if (/thin|relationship|keep/.test(text)) return LIBRARY.hands;
    return LIBRARY.paper;
  }
  if (/distress|cash-flow|cash flow|hmrc|pressure/.test(text)) return LIBRARY.city;
  if (/do not lend|packager|plainly|noisy/.test(text)) return LIBRARY.studio;
  if (/facility|refinance|expensive/.test(text)) return LIBRARY.desk;
  return post.track === "introducer" ? LIBRARY.paper : LIBRARY.desk;
}

export function visualForTrack(track: "borrower" | "introducer", stockId: string): CraftVisual {
  return LIBRARY[stockId] ?? (track === "introducer" ? LIBRARY.paper : LIBRARY.desk);
}

function clipLine(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 24 ? cut.slice(0, sp) : cut).trim();
}

export function copyFromAmmo(brief: CreativeAmmoBrief): {
  track: CreativeAmmoBrief["track"];
  title: string;
  hook: string;
  hook2: string;
  body: string;
  cta: string;
  hashtags: string[];
  stockId: string;
} {
  const identity = "We do not lend.";
  const impact = brief.smeImpact.trim();
  const body = /do not lend/i.test(impact) ? impact : `${impact} ${identity}`;
  const hero = splitHookLines(brief.socialAngle);
  return {
    track: brief.track,
    title: brief.headline.trim(),
    hook: hero.hook,
    hook2: hero.hook2,
    body: clipLine(body, 120),
    cta: clipLine(brief.track === "introducer" ? "Package with Strata" : "Talk to Strata", 28),
    hashtags:
      brief.track === "introducer"
        ? ["#CommercialFinance", "#Introducers", "#UKBrokers"]
        : ["#SMEFinance", "#UKBusiness", "#WorkingCapital"],
    stockId: brief.stockId,
  };
}
