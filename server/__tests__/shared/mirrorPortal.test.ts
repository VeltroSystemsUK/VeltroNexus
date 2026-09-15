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
    expect(industryFromSic([])).toBe("your trade");
  });
});

describe("fillMirrorPortal", () => {
  it("fills six slides from bind and stays packager-true", () => {
    const slides = fillMirrorPortal(bind);
    expect(MIRROR_PORTAL_TRACK_ID).toBe("mirror_portal");
    expect(slides.map((s) => s.slideId)).toEqual([
      "slide_1", "slide_2", "slide_3", "slide_4", "slide_5", "slide_6",
    ]);
    const blob = slides.map((s) => s.body).join("\n");
    expect(blob).toMatch(/North Peak Ltd/);
    expect(blob).toMatch(/construction/);
    expect(blob.toLowerCase()).toMatch(/packag/);
    expect(blob.toLowerCase()).not.toMatch(/dwell on your site/);
    expect(blob.toLowerCase()).not.toMatch(/ai tracked/);
    expect(blob.toLowerCase()).not.toMatch(/inject immediate/);
    expect(blob.toLowerCase()).not.toMatch(/built this bespoke playbook instantly/);
    expect(briefingCopyOk(blob).ok).toBe(true);
    expect(slides[3]!.links?.some((l) => l.href === "#slide-5")).toBe(true);
    expect(slides[3]!.links?.some((l) => l.href === "#slide-6")).toBe(true);
    expect(slides[4]!.links?.[0]?.href).toMatch(/#contact/);
    expect(slides[5]!.links?.[0]?.href).toMatch(/\/veltro/);
  });
});
