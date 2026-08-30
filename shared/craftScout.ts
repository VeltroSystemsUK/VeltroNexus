export type AmmoTrack = "borrower" | "introducer";

export type CreativeAmmoBrief = {
  id: string;
  track: AmmoTrack;
  headline: string;
  source: string;
  coreFact: string;
  smeImpact: string;
  trigger: string;
  freshAngle: string;
  dataBites: string[];
  socialAngle: string;
  emailAngle: string;
  stockId: string;
  imagePrompt: string;
};

export const MARKET_RESEARCHER_PROMPT = `Role Identifier: CommercialFinance_MarketResearcher_v1
You are Casey Wren, Content Scout (MKT-3) at Strata Finance. Sector intelligence analyst for the UK commercial lending and SME debt market. You report to Isla Quinn, Creative Director (CreativeDirector_MarketingExec_v1 / MKT-2).

Sole mission: scan the UK macro, lending, and SME landscape. Harvest high-signal raw material. Unpick the commercial reality for UK SME owners, directors, and brokers. Package it as Creative Ammo Briefs. You do not write final ad copy. Isla writes the line and hangs the picture.

Verticals:
- Commercial mortgages, development finance, asset finance, refinance, invoice finance, unsecured SME term, CDFIs, British Business Bank / Nations & Regions funds, specialist debt, challenger banks.
- Macro & regulatory: Bank of England, FCA, Treasury, Budgets.
- Trade press: NACFB, FLA, UK Finance, Commercial Reporter, Bridging & Commercial, Leasing Life, Property Week.
- SME health: ONS insolvency, Companies House, FSB, BCC. Competitor risk-appetite and product moves.

Workflow:
1. Horizon scan.
2. "So what?" translation into cashflow, borrowing capacity, growth, survival.
3. Contrarian angle — where mainstream commentary is dry, stale, or wrong.
4. Handoff as a Creative Ammo Brief.

Deliverable:
### [BRIEF] {Headline}
- Source & Verification
- The Core Fact / Development
- The Real-World SME Impact
- Emotional / Psychological Trigger
- The Contrarian / Fresh Angle
- Key Data Bites (2–3). If a number is missing, say missing — never invent.
- Recommended Content Angles: Angle 1 (Social/Provocative), Angle 2 (Email/Value-Add)
- Image prompt for Isla / Yaffle: photographic still, UK, tactile, no luxury-cliché, no distressed-people, no logos, no rates.

House policy:
- Strata packages. We do not lend. We do not decide credit.
- No rates, APR, guarantees, payday, consumer-credit, or "we lend".
- No bank PR puffery. Signal only: cost, speed, or availability of capital.
- Never auto-publish. Never buy ads. Never name a client.
- Deep UK terms when true: debenture, PG, charge, DSCR, HMRC time-to-pay, BBB accreditation.

Tone: pragmatic, fact-driven, precise UK commercial English.`;

const AMMO: CreativeAmmoBrief[] = [
  {
    id: "ammo-expensive-facilities",
    track: "borrower",
    headline: "Expensive short-term facilities",
    source: "House policy + UK Finance / NACFB trade commentary — no invented base rate.",
    coreFact: "Short-term SME facilities often cost more than the problem they were meant to cover. High-street DSCR appetite tightens when serviceability looks thin.",
    smeImpact: "Directors keep rolling expensive lines instead of packaging a refinance file. We package. We do not lend.",
    trigger: "Frustration with slow high-street banks; fear of cash-flow squeeze.",
    freshAngle: "The expensive facility is not a badge of being 'funded'. It is often the problem.",
    dataBites: [
      "Missing: latest Bank of England Bank Rate — cite BoE, do not invent.",
      "Complete file beats a dear revolving line.",
    ],
    socialAngle: "If the facility costs more than the problem, look again.",
    emailAngle: "A refinance pack is a process: accounts, bank, ID, use of funds. We package. We do not lend.",
    stockId: "desk",
    imagePrompt:
      "Late-afternoon UK limited-company office, oak desk, leaning stack of manila files, coffee ring on blotting paper, empty chair, dirty sash window, 35mm available light, no people",
  },
  {
    id: "ammo-sterling-ready",
    track: "introducer",
    headline: "Sterling-ready files",
    source: "Strata packager mandate. Sterling receives complete files only.",
    coreFact: "Incomplete introducer files stall. The file that moves is the complete one.",
    smeImpact: "You bring the client. Thin files do not go to Sterling. We package. We do not lend.",
    trigger: "Ambition to look professional; frustration with bounced cases.",
    freshAngle: "Speed is completeness, not a louder email.",
    dataBites: [
      "Required: accounts, bank statements, ID, use of funds.",
      "Missing items stay listed. Never guessed.",
    ],
    socialAngle: "The complete file is the one that moves.",
    emailAngle: "Send a willing director and a company number. We package for Sterling. We do not lend.",
    stockId: "paper",
    imagePrompt:
      "Overhead of a clipped SME document pack on grey board, printed accounts, bank statements, passport face-down, steel paperclip, hard overhead, no people",
  },
  {
    id: "ammo-complete-pack",
    track: "borrower",
    headline: "What a complete pack looks like",
    source: "Sterling pack list. House completeness gate.",
    coreFact: "No pack, no funding conversation. A conversation without documents is theatre.",
    smeImpact: "Accounts, bank, ID, use of funds. Missing stays listed. We package. We do not lend.",
    trigger: "Confusion around terms; relief at a clear list.",
    freshAngle: "The pack is the product. The meeting is not.",
    dataBites: [
      "SFP PARTIAL blocks send.",
      "Never invent a figure to fill a gap.",
    ],
    socialAngle: "No pack. No funding conversation.",
    emailAngle: "Here is the list. Send it once. We package. We do not lend.",
    stockId: "paper",
    imagePrompt:
      "Overhead of a clipped SME document pack on grey board, printed accounts, bank statements, passport face-down, steel paperclip, hard overhead, no people",
  },
  {
    id: "ammo-keep-relationship",
    track: "introducer",
    headline: "Why package with Strata",
    source: "Strata introducer track. Packager identity.",
    coreFact: "Introducers keep the client relationship. Strata runs the pack. Credit sits with Shaun and then David.",
    smeImpact: "You keep the relationship. Thin files do not go to Sterling. We do not lend.",
    trigger: "Status as the trusted adviser; fear of losing the client to a lender brand.",
    freshAngle: "The packager should be invisible to the relationship and ruthless about the file.",
    dataBites: [
      "Shaun signs the memo. David recommends the lender.",
      "Strata does not decide credit.",
    ],
    socialAngle: "You keep the relationship. We run the pack.",
    emailAngle: "Bring the client. We package. We do not lend.",
    stockId: "hands",
    imagePrompt:
      "Two pairs of working hands over an open commercial-finance file on a scuffed meeting table, UK, documentary, shallow depth, no handshake",
  },
  {
    id: "ammo-distress-process",
    track: "borrower",
    headline: "Distress refinance is a process",
    source: "Strata Stream A mandate. ONS / Gazette as scan sources — no invented insolvency counts.",
    coreFact: "Cash-flow pressure is a file, not a slogan. Distress-refinance is packaging, not a consumer-credit pitch.",
    smeImpact: "We package UK SME distress-refinance for Sterling. We do not lend.",
    trigger: "Fear of losing assets; need for a calm process.",
    freshAngle: "The honest move is a complete file, not a louder promise.",
    dataBites: [
      "Missing: latest ONS insolvency print — cite ONS, do not invent.",
      "Facility band £25k–£250k. Turnover £250k–£5m.",
    ],
    socialAngle: "Cash-flow pressure is a file, not a slogan.",
    emailAngle: "Distress-refinance is a pack. We package. We do not lend.",
    stockId: "city",
    imagePrompt:
      "Dusk on a wet UK high street, independent shop lights in puddles, closed shutters, empty pavement, 50mm, cool grade, no people",
  },
  {
    id: "ammo-what-we-need",
    track: "introducer",
    headline: "What we need from you",
    source: "Introducer intake. Companies House identity.",
    coreFact: "A case starts with a name, a company number, and a willing director. Everything else is packaging.",
    smeImpact: "Send that. We package the rest. We do not lend.",
    trigger: "Relief at a short ask; impatience with long onboarding forms.",
    freshAngle: "The first email should be three facts, not a brochure.",
    dataBites: [
      "Company number is not optional.",
      "No contact, no file that counts.",
    ],
    socialAngle: "Name, company number, willing director.",
    emailAngle: "Three facts. We package. We do not lend.",
    stockId: "paper",
    imagePrompt:
      "Overhead of a clipped SME document pack on grey board, printed accounts, bank statements, passport face-down, steel paperclip, hard overhead, no people",
  },
  {
    id: "ammo-say-it-plainly",
    track: "borrower",
    headline: "We package. We do not lend.",
    source: "House policy. Packager identity.",
    coreFact: "The market is noisy with lender-shaped language. Strata is a UK commercial finance packager.",
    smeImpact: "Strata is a UK commercial finance packager. We do not lend.",
    trigger: "Trust; irritation at disguised lenders.",
    freshAngle: "Saying we do not lend is the most commercial sentence on the page.",
    dataBites: [
      "No rates. No guarantees. No consumer-credit ads.",
      "Shaun posts. Agents never auto-publish.",
    ],
    socialAngle: "Say it plainly. The market is noisy.",
    emailAngle: "We package UK SME finance. We do not lend.",
    stockId: "studio",
    imagePrompt:
      "Empty pack box and a black notebook on a paper sweep, single hard key from camera left, quiet studio, clean digital colour, no people",
  },
];

export function scanWeek(): CreativeAmmoBrief[] {
  return AMMO.map((brief) => ({ ...brief, dataBites: [...brief.dataBites] }));
}

export function normalizeAmmo(input: unknown): CreativeAmmoBrief[] {
  if (!Array.isArray(input)) return [];
  const rows: CreativeAmmoBrief[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.headline !== "string" || typeof item.socialAngle !== "string") continue;
    const bites = Array.isArray(item.dataBites)
      ? item.dataBites.filter((bite): bite is string => typeof bite === "string")
      : [];
    rows.push({
      id: typeof item.id === "string" && item.id ? item.id : `ammo-${rows.length}`,
      track: item.track === "introducer" ? "introducer" : "borrower",
      headline: item.headline.trim(),
      source: typeof item.source === "string" ? item.source.trim() : "",
      coreFact: typeof item.coreFact === "string" ? item.coreFact.trim() : "",
      smeImpact: typeof item.smeImpact === "string" ? item.smeImpact.trim() : "",
      trigger: typeof item.trigger === "string" ? item.trigger.trim() : "",
      freshAngle: typeof item.freshAngle === "string" ? item.freshAngle.trim() : "",
      dataBites: bites.slice(0, 4),
      socialAngle: item.socialAngle.trim(),
      emailAngle: typeof item.emailAngle === "string" ? item.emailAngle.trim() : "",
      stockId: typeof item.stockId === "string" && item.stockId ? item.stockId : "desk",
      imagePrompt: typeof item.imagePrompt === "string" ? item.imagePrompt.trim() : "",
    });
  }
  return rows;
}

export function formatBriefMarkdown(brief: CreativeAmmoBrief): string {
  const bites = brief.dataBites.map((bite) => `  - ${bite}`).join("\n");
  return [
    `### [BRIEF] ${brief.headline}`,
    "",
    `- **Source & Verification:** ${brief.source}`,
    `- **The Core Fact / Development:** ${brief.coreFact}`,
    `- **The Real-World SME Impact:** ${brief.smeImpact}`,
    `- **Emotional / Psychological Trigger:** ${brief.trigger}`,
    `- **The Contrarian / Fresh Angle:** ${brief.freshAngle}`,
    `- **Key Data Bites:**`,
    bites,
    `- **Recommended Content Angles for Creative Director:**`,
    `  - *Angle 1 (Social/Provocative):* ${brief.socialAngle}`,
    `  - *Angle 2 (Email/Value-Add):* ${brief.emailAngle}`,
  ].join("\n");
}
