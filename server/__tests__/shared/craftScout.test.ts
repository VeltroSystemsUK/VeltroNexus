import { describe, expect, it } from "vitest";
import { COPY_LIMITS, generateWeek, weekCopyIsClean } from "@shared/craftQueue";
import { copyFromAmmo, MARKETING_DIRECTOR_PROMPT } from "@shared/craftDirector";
import {
  CASEY_FIRECRAWL_QUERIES,
  caseyBriefOnScope,
  caseyNotesFromFirecrawlSearch,
  editorialNotesFromFirecrawlSearch,
  editorialNotesFromTavilySearch,
  caseyTextModel,
  formatBriefMarkdown,
  formatCaseyNotes,
  MARKET_RESEARCHER_PROMPT,
  parseCaseyBriefs,
  scanWeek,
  type CreativeAmmoBrief,
} from "@shared/craftScout";

function sampleBrief(over: Partial<CreativeAmmoBrief> & Pick<CreativeAmmoBrief, "headline">): CreativeAmmoBrief {
  return {
    id: "ammo-test",
    track: "borrower",
    source: "test",
    coreFact: over.headline,
    smeImpact: "We package. We do not lend.",
    trigger: "fear",
    freshAngle: "plain",
    dataBites: ["missing"],
    socialAngle: over.headline,
    emailAngle: over.headline,
    stockId: "desk",
    imagePrompt: "desk",
    ...over,
  };
}

describe("Content Scout", () => {
  it("is a researcher, not a copywriter, and hands Isla a Creative Ammo Brief", () => {
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/CommercialFinance_MarketIntelligence_v2/);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/Creative Ammo Brief/i);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/you never do/i);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/Isla Quinn/i);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/MKT-2/);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/do not lend/i);
    expect(MARKET_RESEARCHER_PROMPT).not.toMatch(/guaranteed funding/i);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/stratafinance\.co\.uk/i);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/stack/i);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/HMRC|Time to Pay/i);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/CDFI/i);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/off the desk/i);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/residential mortgage/i);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/crypto/i);
    expect(MARKETING_DIRECTOR_PROMPT).toMatch(/Creative Ammo Brief/i);
  });

  it("keeps Strata-desk briefs and relevant public news, drops tangents", () => {
    expect(
      caseyBriefOnScope(
        sampleBrief({
          headline: "HMRC time to pay is a pack",
          coreFact: "Tax arrears sit in front of refinance.",
        }),
      ),
    ).toBe(true);
    expect(
      caseyBriefOnScope(
        sampleBrief({
          headline: "Stacked short-term loans",
          coreFact: "Directors roll expensive facilities instead of a refinance pack.",
        }),
      ),
    ).toBe(true);
    expect(
      caseyBriefOnScope(
        sampleBrief({
          headline: "Bank Rate held",
          coreFact: "Bank Rate changes the cost of SME refinance capital.",
        }),
      ),
    ).toBe(true);
    expect(
      caseyBriefOnScope(
        sampleBrief({
          headline: "Crypto treasury for SMEs",
          coreFact: "Bitcoin on the balance sheet as working capital.",
        }),
      ),
    ).toBe(false);
    expect(
      caseyBriefOnScope(
        sampleBrief({
          headline: "Guaranteed payday for directors",
          coreFact: "Same-day payday loans for company owners.",
        }),
      ),
    ).toBe(false);
    expect(
      caseyBriefOnScope(
        sampleBrief({
          headline: "Buy-to-let yields",
          coreFact: "Residential BTL mortgages beat commercial finance.",
        }),
      ),
    ).toBe(false);
    expect(
      caseyBriefOnScope(
        sampleBrief({
          headline: "Development finance pipeline",
          coreFact: "Ground-up development finance and commercial mortgages in Property Week.",
        }),
      ),
    ).toBe(false);
  });

  it("library briefs stay on the Strata desk", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      for (const row of scanWeek(seed)) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        expect(caseyBriefOnScope(row), row.headline).toBe(true);
      }
    }
    expect(seen.size).toBeGreaterThan(10);
  });

  it("asks Anthropic or xAI, never Gemini", () => {
    expect(caseyTextModel({ ANTHROPIC_API_KEY: "sk-ant-test" })).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-5",
    });
    expect(caseyTextModel({ ANTHROPIC_API_KEY: "sk-ant-test", ANTHROPIC_MODEL: "claude-opus-4-1" }).model).toBe(
      "claude-opus-4-1",
    );
    expect(caseyTextModel({ XAI_API_KEY: "xai-test" })).toEqual({ provider: "xai", model: "grok-4" });
    expect(caseyTextModel({ ANTHROPIC_API_KEY: "sk-ant-test", XAI_API_KEY: "xai-test" }).provider).toBe("anthropic");
    expect(caseyTextModel({ ANTHROPIC_MODEL: "gemini-2.0-flash", ANTHROPIC_API_KEY: "sk" }).model).not.toMatch(/gemini/i);
    expect(JSON.stringify(caseyTextModel({ ANTHROPIC_API_KEY: "sk" }))).not.toMatch(/gemini/i);
  });

  it("reads Firecrawl search notes from official UK hosts only", () => {
    expect(CASEY_FIRECRAWL_QUERIES.join(" ")).toMatch(/HMRC|Time to Pay/i);
    expect(CASEY_FIRECRAWL_QUERIES.join(" ")).toMatch(/CDFI|British Business Bank/i);
    expect(CASEY_FIRECRAWL_QUERIES.join(" ")).toMatch(/lender|insolvency|broker/i);
    const notes = caseyNotesFromFirecrawlSearch({
      data: {
        web: [
          {
            title: "Bank Rate held",
            url: "https://www.bankofengland.co.uk/news/rate",
            description: "The MPC held Bank Rate.",
          },
          {
            title: "Climate stress test",
            url: "https://www.bankofengland.co.uk/news/climate",
            description: "A climate scenario for the largest banks.",
          },
          {
            title: "Payday promo",
            url: "https://easy-cash.example/apr",
            description: "Guaranteed funding",
          },
        ],
      },
    });
    expect(notes).toEqual([
      {
        title: "Bank Rate held",
        url: "https://www.bankofengland.co.uk/news/rate",
        snippet: "The MPC held Bank Rate.",
      },
    ]);
  });

  it("reads Editorial Firecrawl notes from any host", () => {
    const notes = editorialNotesFromFirecrawlSearch({
      data: {
        web: [
          {
            title: "Hidden commission",
            url: "https://www.ft.com/content/fees",
            description: "Brokers take large fees on stacked facilities.",
          },
          {
            title: "Payday promo",
            url: "https://easy-cash.example/apr",
            description: "Guaranteed funding",
          },
        ],
      },
    });
    expect(notes.map((note) => note.url)).toEqual([
      "https://www.ft.com/content/fees",
      "https://easy-cash.example/apr",
    ]);
  });

  it("reads Editorial Tavily notes from title url content", () => {
    const notes = editorialNotesFromTavilySearch({
      results: [
        {
          title: "NACFB on packager fees",
          url: "https://www.nacfb.org/news/fees",
          content: "Introducers must disclose commission.",
        },
        { title: "No url", content: "Skip me" },
      ],
    });
    expect(notes).toEqual([
      {
        title: "NACFB on packager fees",
        url: "https://www.nacfb.org/news/fees",
        snippet: "Introducers must disclose commission.",
      },
    ]);
  });

  it("scans a week of briefs with source, SME impact, and angles — no invented rates", () => {
    const week = scanWeek();
    expect(week).toHaveLength(7);
    expect(week.some((brief) => brief.track === "borrower")).toBe(true);
    expect(week.some((brief) => brief.track === "introducer")).toBe(true);
    for (const brief of week) {
      expect(brief.headline.length).toBeGreaterThan(8);
      expect(brief.source.length).toBeGreaterThan(8);
      expect(brief.coreFact.length).toBeGreaterThan(20);
      expect(brief.smeImpact.length).toBeGreaterThan(20);
      expect(brief.trigger.length).toBeGreaterThan(4);
      expect(brief.freshAngle.length).toBeGreaterThan(8);
      expect(brief.dataBites.length).toBeGreaterThanOrEqual(2);
      expect(brief.socialAngle.length).toBeGreaterThan(8);
      expect(brief.emailAngle.length).toBeGreaterThan(8);
      expect(brief.stockId).toBeTruthy();
      const blob = [
        brief.headline,
        brief.coreFact,
        brief.smeImpact,
        brief.socialAngle,
        brief.emailAngle,
        ...brief.dataBites,
      ].join(" ");
      expect(blob).not.toMatch(/\b(guaranteed|apr\b|payday|we lend|we will lend)\b/i);
      expect(blob).not.toMatch(/\bfrom\s+\d+(\.\d+)?%/i);
    }
  });

  it("packages a brief in the Creative Ammo Brief markdown shape", () => {
    const md = formatBriefMarkdown(scanWeek()[0]!);
    expect(md).toMatch(/^### \[BRIEF\] /);
    expect(md).toMatch(/\*\*Source & Verification:\*\*/);
    expect(md).toMatch(/\*\*The Core Fact \/ Development:\*\*/);
    expect(md).toMatch(/\*\*The Real-World SME Impact:\*\*/);
    expect(md).toMatch(/\*\*Emotional \/ Psychological Trigger:\*\*/);
    expect(md).toMatch(/\*\*The Contrarian \/ Fresh Angle:\*\*/);
    expect(md).toMatch(/\*\*Key Data Bites:\*\*/);
    expect(md).toMatch(/\*\*Recommended Content Angles for Creative Director:\*\*/);
    expect(md).toMatch(/Angle 1 \(Social\/Provocative\)/);
    expect(md).toMatch(/Angle 2 \(Email\/Value-Add\)/);
  });

  it("lets Isla turn ammo into Craft copy inside limits", () => {
    for (const brief of scanWeek()) {
      const copy = copyFromAmmo(brief);
      expect(copy.hook.length).toBeLessThanOrEqual(COPY_LIMITS.hook);
      expect(copy.hook2.length).toBeLessThanOrEqual(COPY_LIMITS.hook2);
      expect(copy.body.length).toBeLessThanOrEqual(COPY_LIMITS.body);
      expect(copy.cta.length).toBeLessThanOrEqual(COPY_LIMITS.cta);
      expect(copy.body).toMatch(/do not lend/i);
    }
    const week = generateWeek("2026-08-31");
    expect(week).toHaveLength(7);
    for (const post of week) {
      expect(weekCopyIsClean(post)).toBe(true);
      expect(post.visual?.stockId).toBeTruthy();
    }
  });

  it("parses Casey's JSON briefs so a live scan can replace the library", () => {
    const briefs = parseCaseyBriefs(`Here you go
[
  {
    "id": "ammo-live-1",
    "track": "borrower",
    "headline": "HMRC time to pay is a pack",
    "source": "HMRC Time to Pay guidance — no invented arrears figure.",
    "coreFact": "Tax arrears sit in front of refinance. A Time to Pay file is packaging, not a slogan.",
    "smeImpact": "Directors wait for a lender smile. We package the arrears file first. We do not lend.",
    "trigger": "Fear of the brown envelope.",
    "freshAngle": "Clear the tax file before you ask for a facility.",
    "dataBites": ["Missing: current HMRC late-payment rate — cite gov.uk.", "Do not invent arrears."],
    "socialAngle": "Tax arrears first. Then the refinance pack.",
    "emailAngle": "A Time to Pay file is a pack. We package. We do not lend.",
    "stockId": "paper",
    "imagePrompt": "UK desk, HMRC brown envelope face down, clipped accounts, no people"
  }
]`);
    expect(briefs).toHaveLength(1);
    expect(briefs[0]!.headline).toBe("HMRC time to pay is a pack");
    expect(briefs[0]!.socialAngle).toMatch(/tax arrears/i);
  });

  it("drops live briefs that wander off the Strata desk", () => {
    const briefs = parseCaseyBriefs(`[
  {
    "id": "ammo-live-1",
    "track": "borrower",
    "headline": "HMRC time to pay is a pack",
    "source": "HMRC Time to Pay guidance.",
    "coreFact": "Tax arrears sit in front of refinance.",
    "smeImpact": "We package the arrears file first. We do not lend.",
    "trigger": "Fear of the brown envelope.",
    "freshAngle": "Clear the tax file before you ask for a facility.",
    "dataBites": ["Missing: current HMRC late-payment rate."],
    "socialAngle": "Tax arrears first. Then the refinance pack.",
    "emailAngle": "A Time to Pay file is a pack. We package. We do not lend.",
    "stockId": "paper",
    "imagePrompt": "UK desk, brown envelope, no people"
  },
  {
    "id": "ammo-live-crypto",
    "track": "borrower",
    "headline": "Crypto treasury for SMEs",
    "source": "A blog.",
    "coreFact": "Bitcoin on the balance sheet as working capital.",
    "smeImpact": "Directors should hold crypto.",
    "trigger": "FOMO.",
    "freshAngle": "Treasury is a token.",
    "dataBites": ["No figure."],
    "socialAngle": "Stack satoshi, not loans.",
    "emailAngle": "A bitcoin pack.",
    "stockId": "studio",
    "imagePrompt": "neon"
  }
]`);
    expect(briefs.map((row) => row.id)).toEqual(["ammo-live-1"]);
  });

  it("rotates the library so a second scan is not the same seven headlines", () => {
    const first = scanWeek();
    const second = scanWeek(7, first.map((brief) => brief.headline));
    expect(second).toHaveLength(7);
    expect(second.map((brief) => brief.headline)).not.toEqual(first.map((brief) => brief.headline));
  });
});
