import { describe, expect, it } from "vitest";
import { COPY_LIMITS, generateWeek, weekCopyIsClean } from "@shared/craftQueue";
import { copyFromAmmo, MARKETING_DIRECTOR_PROMPT } from "@shared/craftDirector";
import {
  formatBriefMarkdown,
  MARKET_RESEARCHER_PROMPT,
  scanWeek,
} from "@shared/craftScout";

describe("Content Scout", () => {
  it("is a researcher, not a copywriter, and hands Isla a Creative Ammo Brief", () => {
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/CommercialFinance_MarketResearcher_v1/);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/Creative Ammo Brief/i);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/do not write final ad copy/i);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/CreativeDirector_MarketingExec_v1/);
    expect(MARKET_RESEARCHER_PROMPT).toMatch(/do not lend/i);
    expect(MARKET_RESEARCHER_PROMPT).not.toMatch(/guaranteed funding/i);
    expect(MARKETING_DIRECTOR_PROMPT).toMatch(/Creative Ammo Brief/i);
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
});
