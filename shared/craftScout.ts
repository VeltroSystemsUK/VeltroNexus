export type CaseyTextEngine = { provider: "anthropic" | "xai"; model: string };

export const CASEY_FIRECRAWL_QUERIES = [
  "UK SME stacked short-term loans refinance",
  "HMRC Time to Pay SME arrears",
  "CDFI British Business Bank SME lending",
];

export const STRATA_CASEY_SCOPE =
  "Stay on the Strata Finance desk (stratafinance.co.uk): stacked expensive short-term loans, HMRC Time to Pay, CDFI / British Business Bank, cashflow gaps, bank declines, distress-refinance. Packager, not lender. Public news or press is in ONLY when it changes cost, speed, or availability of that capital for UK SMEs. One fact per brief. No tangents.";

const CASEY_SOURCE_HOSTS = [
  "bankofengland.co.uk",
  "gov.uk",
  "ons.gov.uk",
  "ukfinance.org.uk",
  "nacfb.org",
  "british-business-bank.co.uk",
  "fca.org.uk",
  "thegazette.co.uk",
];

const CASEY_TANGENT =
  /\b(crypto|bitcoin|blockchain|buy[- ]to[- ]let|\bbtl\b|residential mortgage|development finance|commercial mortgage|property week|luxury|guaranteed funding|venture capital|series [abc]\b|bnpl|buy now pay later|climate)\b/i;

const CASEY_IN_SCOPE =
  /\b(refinanc|distress|hmrc|time[- ]to[- ]pay|\bttp\b|cdfi|british business bank|\bbbb\b|stack(ed|ing)?|short[- ]term|cash[- ]?flow|packag|sme (debt|lending|finance)|introducer|gazette|bank rate|insolvency|bank decline|working capital|invoice finance|purchase finance|debenture|companies house|sterling|consolidat|unmanageable|affordabilit)\b/i;

export function caseyOnScope(text: string): boolean {
  const blob = text.replace(/\s+/g, " ").trim();
  if (!blob) return false;
  if (CASEY_TANGENT.test(blob)) return false;
  return CASEY_IN_SCOPE.test(blob);
}

export function caseyBriefOnScope(brief: {
  headline: string;
  source?: string;
  coreFact?: string;
  smeImpact?: string;
  trigger?: string;
  freshAngle?: string;
  dataBites?: string[];
  socialAngle?: string;
  emailAngle?: string;
}): boolean {
  return caseyOnScope(
    [
      brief.headline,
      brief.source,
      brief.coreFact,
      brief.smeImpact,
      brief.trigger,
      brief.freshAngle,
      brief.socialAngle,
      brief.emailAngle,
      ...(brief.dataBites ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function caseyNoteOnScope(note: CaseyNote): boolean {
  return caseyOnScope(`${note.title} ${note.url} ${note.snippet}`);
}

export type CaseyNote = { title: string; url: string; snippet: string };

function caseyHostAllowed(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return CASEY_SOURCE_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

export function caseyNotesFromFirecrawlSearch(data: unknown): CaseyNote[] {
  const root = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const nested = root?.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : null;
  const web = Array.isArray(root?.web) ? root.web : Array.isArray(nested?.web) ? nested.web : [];
  const notes: CaseyNote[] = [];
  for (const item of web) {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
    const url = typeof row?.url === "string" ? row.url : "";
    if (!caseyHostAllowed(url)) continue;
    const title = typeof row?.title === "string" ? row.title : "Untitled";
    const snippet =
      (typeof row?.description === "string" && row.description) ||
      (typeof row?.markdown === "string" && row.markdown.slice(0, 280)) ||
      "";
    notes.push({ title, url, snippet: snippet.replace(/\s+/g, " ").trim().slice(0, 280) });
  }
  return notes.filter(caseyNoteOnScope);
}

export function formatCaseyNotes(notes: CaseyNote[]): string {
  if (!notes.length) return "";
  return notes.map((note) => `- ${note.title} | ${note.url} | ${note.snippet}`).join("\n");
}

export function caseyTextModel(
  env: Record<string, string | undefined> = {},
): CaseyTextEngine {
  const anthropicKey = env.ANTHROPIC_API_KEY?.trim();
  const xaiKey = env.XAI_API_KEY?.trim();
  if (anthropicKey) {
    const requested = env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5";
    return {
      provider: "anthropic",
      model: requested.startsWith("claude-") ? requested : "claude-sonnet-5",
    };
  }
  if (xaiKey) {
    const requested = env.XAI_MODEL?.trim() || "grok-4";
    return {
      provider: "xai",
      model: /gemini/i.test(requested) ? "grok-4" : requested,
    };
  }
  return { provider: "anthropic", model: "claude-sonnet-5" };
}

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

${STRATA_CASEY_SCOPE}

Sole mission: harvest high-signal raw material for that desk only. Unpick the commercial reality for UK SME directors sitting under stacked short-term debt, and for introducers who send those files. Package it as Creative Ammo Briefs. You do not write final ad copy. Isla writes the line and hangs the picture.

On the desk:
- Stacked expensive short-term loans. HMRC Time to Pay. CDFI / British Business Bank. Cashflow gaps. Bank declines. Distress-refinance packs. Introducer completeness.
- Public news and press releases only when they change cost, speed, or availability of that capital (Bank Rate, ONS insolvency, Gazette, BBB/CDFI, HMRC TTP, NACFB broker conduct).
Off the desk — do not brief: development finance, commercial mortgages, asset-finance product tours, Property Week, crypto, BTL, consumer credit, payday, equity raises.

Workflow:
1. Horizon scan the desk — not the whole lending market.
2. "So what?" translation into cashflow, stacked-debt service, refinance, survival.
3. One fact. Straight. No tangent.
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
  {
    id: "ammo-hmrc-ttp",
    track: "borrower",
    headline: "HMRC time to pay is a pack",
    source: "HMRC Time to Pay guidance — no invented arrears figure.",
    coreFact: "Tax arrears sit in front of refinance. A Time to Pay file is packaging, not a slogan.",
    smeImpact: "Directors wait for a lender smile. We package the arrears file first. We do not lend.",
    trigger: "Fear of the brown envelope.",
    freshAngle: "Clear the tax file before you ask for a facility.",
    dataBites: [
      "Missing: current HMRC late-payment rate — cite gov.uk, do not invent.",
      "Arrears stay listed until evidenced.",
    ],
    socialAngle: "Tax arrears first. Then the refinance pack.",
    emailAngle: "A Time to Pay file is a pack. We package. We do not lend.",
    stockId: "paper",
    imagePrompt:
      "UK accounts desk, brown envelope face down beside clipped statements, hard overhead, no people",
  },
  {
    id: "ammo-cdfi-not-last",
    track: "borrower",
    headline: "CDFI is a fit, not a last resort",
    source: "British Business Bank / CDFI panel commentary — no invented scheme rates.",
    coreFact: "Community lenders underwrite a complete file. They are not a consolation prize after a high-street no.",
    smeImpact: "A declined bank letter is not the end of the pack. We package for the right panel. We do not lend.",
    trigger: "Shame after a bank decline; relief that another door exists.",
    freshAngle: "The specialist panel wants the file the high street would not sit with.",
    dataBites: [
      "Missing: live BBB scheme names for this week — cite BBB, do not invent.",
      "Facility band £25k–£250k. Turnover £250k–£5m.",
    ],
    socialAngle: "A bank no is a file, not a funeral.",
    emailAngle: "We package for CDFIs when the high street will not. We do not lend.",
    stockId: "city",
    imagePrompt:
      "Wet UK high street at dusk, independent shop lights in puddles, empty pavement, 50mm, no people",
  },
  {
    id: "ammo-debenture-talk",
    track: "introducer",
    headline: "A debenture is a conversation",
    source: "Sterling security language. House packager mandate.",
    coreFact: "Security is explained, not sprung. The introducer keeps the relationship while the pack lists the charge.",
    smeImpact: "You stay in the room. We write the pack. We do not lend.",
    trigger: "Fear of looking like the person who hid the small print.",
    freshAngle: "The trusted adviser names the charge before the lender does.",
    dataBites: [
      "Shaun signs the memo. David recommends the lender.",
      "Never surprise a director with a floating charge in week six.",
    ],
    socialAngle: "Name the charge. Keep the client.",
    emailAngle: "You keep the relationship. We package the security conversation. We do not lend.",
    stockId: "hands",
    imagePrompt:
      "Two pairs of working hands over an open commercial-finance file, scuffed meeting table, UK, no handshake",
  },
  {
    id: "ammo-invoice-not-stack",
    track: "borrower",
    headline: "Invoice finance is not another stack",
    source: "UK Finance / FLA trade commentary — no invented advance rates.",
    coreFact: "Receivables funding is a structure, not a third short-term loan on top of two already hurting.",
    smeImpact: "Stacking another line to service the last one is the trap. We package. We do not lend.",
    trigger: "Exhaustion from juggling facilities.",
    freshAngle: "The honest move is one structure that matches the debtor book, not a louder broker.",
    dataBites: [
      "Missing: latest UK Finance invoice-finance volumes — cite UK Finance, do not invent.",
      "No consumer-credit language. No payday pitch.",
    ],
    socialAngle: "Stop stacking. Package the book.",
    emailAngle: "Invoice finance is a pack against invoices, not another short-term line. We do not lend.",
    stockId: "desk",
    imagePrompt:
      "Oak SME desk, stacked invoices under a steel clip, late window light, empty chair, no people",
  },
  {
    id: "ammo-no-teaser",
    track: "introducer",
    headline: "Do not send the lender a teaser",
    source: "Sterling completeness gate. House policy.",
    coreFact: "A name and a hope is not a file. Incomplete teasers stall on the first read.",
    smeImpact: "Send a company number and a willing director. We package the rest. We do not lend.",
    trigger: "Impatience with bounced cases; pride in looking professional.",
    freshAngle: "Speed is the complete pack, not the first email.",
    dataBites: [
      "Required: accounts, bank statements, ID, use of funds.",
      "SFP PARTIAL blocks send.",
    ],
    socialAngle: "A teaser is not a file.",
    emailAngle: "Company number, director, documents. We package. We do not lend.",
    stockId: "paper",
    imagePrompt:
      "Overhead clipped SME pack, printed accounts, bank statements, steel paperclip, hard overhead, no people",
  },
  {
    id: "ammo-companies-house",
    track: "borrower",
    headline: "Companies House is identity",
    source: "Companies House public record. House intake.",
    coreFact: "A company number is how the file starts. It is not a credit score and not a promise.",
    smeImpact: "We identify the company, then we package. We do not lend.",
    trigger: "Confusion between a filing and a facility.",
    freshAngle: "The number gets us into the record. The pack gets us into a conversation.",
    dataBites: [
      "Company number is not optional.",
      "Never treat a Gazette hit as a slogan.",
    ],
    socialAngle: "The company number opens the file. The pack opens the conversation.",
    emailAngle: "Send the number. We package. We do not lend.",
    stockId: "studio",
    imagePrompt:
      "Quiet studio, black notebook and a printed Companies House extract, single hard key, no people",
  },
  {
    id: "ammo-working-capital",
    track: "borrower",
    headline: "Working capital is not payday",
    source: "House policy. Packager identity.",
    coreFact: "Working-capital packaging is for UK limited companies with a file. It is not a consumer loan and not a payday product.",
    smeImpact: "We package working capital for SME directors. We do not lend.",
    trigger: "Irritation at consumer-credit language in a B2B market.",
    freshAngle: "If the copy could sit on a payday site, it does not sit on this desk.",
    dataBites: [
      "No rates. No guarantees. No consumer-credit ads.",
      "Turnover band £250k–£5m. Facility band £25k–£250k.",
    ],
    socialAngle: "Working capital is a pack. Not a payday pitch.",
    emailAngle: "UK limited-company working capital. We package. We do not lend.",
    stockId: "desk",
    imagePrompt:
      "UK limited-company office at dusk, cashbook and a closed laptop, oak desk, no people",
  },
];

function cloneBrief(brief: CreativeAmmoBrief): CreativeAmmoBrief {
  return { ...brief, dataBites: [...brief.dataBites] };
}

function seedNumber(seed: number | string = 0): number {
  if (typeof seed === "number" && Number.isFinite(seed)) return Math.abs(Math.floor(seed));
  let hash = 0;
  const text = String(seed);
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export function parseCaseyBriefs(text: string): CreativeAmmoBrief[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    return normalizeAmmo(JSON.parse(text.slice(start, end + 1))).filter(caseyBriefOnScope);
  } catch {
    return [];
  }
}

export function scanWeek(seed: number | string = 0, exclude: string[] = []): CreativeAmmoBrief[] {
  const skip = new Set(exclude.map((headline) => headline.trim().toLowerCase()).filter(Boolean));
  const start = seedNumber(seed) % AMMO.length;
  const rotated = [...AMMO.slice(start), ...AMMO.slice(0, start)];
  const picked: CreativeAmmoBrief[] = [];
  for (const brief of rotated) {
    if (skip.has(brief.headline.toLowerCase())) continue;
    picked.push(cloneBrief(brief));
    if (picked.length === 7) return picked;
  }
  for (const brief of rotated) {
    if (picked.length === 7) break;
    if (picked.some((item) => item.id === brief.id)) continue;
    picked.push(cloneBrief(brief));
  }
  return picked;
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
