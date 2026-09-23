import { describe, expect, it } from "vitest";
import { pickBriefingHypothesis } from "@shared/briefingHypothesis";
import {
  MIRROR_PORTAL_TRACK_ID,
  fillMirrorPortal,
  industryFromSic,
} from "@shared/briefingTracks/mirrorPortal";
import { briefingCopyOk } from "@shared/briefingHypothesis";

const bind = {
  companyName: "North Peak Ltd",
  industry: "construction",
  dwellLine: "You've been back on the site several times.",
  filingsLine: "8 years trading · SIC 43210",
  hypothesis: pickBriefingHypothesis({ nonBankChargeCount: 2, sicCodes: ["43210"], dwellCount: 6 }),
  enquiryUrl: "https://www.stratafinance.co.uk/#contact",
  veltroUrl: "/veltro?b=tok",
};

describe("industryFromSic", () => {
  it("maps construction prefixes and falls back", () => {
    expect(industryFromSic(["43210"])).toBe("construction");
    expect(industryFromSic(["62012"])).toBe("software");
    expect(industryFromSic(["46900"])).toBe("wholesale");
    expect(industryFromSic(["49320"])).toBe("transport");
    expect(industryFromSic([])).toBeNull();
    expect(industryFromSic(["99999"])).toBeNull();
  });

  it("construction wins over manufacturing when mixed", () => {
    expect(industryFromSic(["25620", "43210"])).toBe("construction");
  });
});

describe("fillMirrorPortal", () => {
  it("fills six slides from the Gemini house script", () => {
    const slides = fillMirrorPortal(bind);
    expect(MIRROR_PORTAL_TRACK_ID).toBe("mirror_portal");
    expect(slides.map((s) => s.slideId)).toEqual([
      "slide_1", "slide_2", "slide_3", "slide_4", "slide_5", "slide_6",
    ]);
    expect(slides.map((s) => s.title)).toEqual([
      "Mirror", "Agitation", "Shift", "Portal", "Cashflow", "Outreach",
    ]);
    const blob = slides.map((s) => s.body).join("\n");
    expect(blob).toMatch(/Making a mark in the construction space/);
    expect(blob).toMatch(/North Peak Ltd/);
    expect(blob).toMatch(/'dwell' on your site/);
    expect(blob).toMatch(/AI tracked your dwell/);
    expect(blob).toMatch(/inject immediate cashflow/);
    expect(blob).toMatch(/built this bespoke playbook instantly/);
    expect(blob).not.toMatch(/book-finance-consultation/);
    expect(blob).not.toMatch(/book-sales-booster-demo/);
    expect(briefingCopyOk(blob).ok).toBe(true);
    expect(slides[3]!.links).toEqual([
      { label: "I Need Financial Breathing Room & Cashflow", href: "#slide-5" },
      { label: "I Need to Weaponize My Sales & Leads", href: "#slide-6" },
    ]);
    expect(slides[4]!.links?.[0]).toEqual({
      label: "Unlock Our Cashflow Blueprint",
      href: "https://www.stratafinance.co.uk/#contact",
    });
    expect(slides[5]!.links?.[0]).toEqual({
      label: "Weaponize My Outreach",
      href: "/veltro?b=tok",
    });
  });
});
