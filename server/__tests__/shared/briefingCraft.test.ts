import { describe, expect, it } from "vitest";
import {
  fillMergeTags,
  mergeFieldsFromBind,
  packHtmlFromPageImages,
  siteCopyToBullets,
} from "@shared/briefingCraft";
import { pickBriefingHypothesis } from "@shared/briefingHypothesis";
import { fillMirrorPortal } from "@shared/briefingTracks/mirrorPortal";

describe("fillMergeTags", () => {
  it("replaces known fields and leaves unknown tags", () => {
    expect(
      fillMergeTags("Note for {{companyName}}. {{mystery}}", { companyName: "North Peak Ltd" })
    ).toBe("Note for North Peak Ltd. {{mystery}}");
  });
});

describe("mergeFieldsFromBind", () => {
  it("exposes the locked briefing slots", () => {
    const hypothesis = pickBriefingHypothesis({
      nonBankChargeCount: 2,
      sicCodes: [],
      dwellCount: 6,
    });
    const fields = mergeFieldsFromBind({
      companyName: "North Peak Ltd",
      dwellLine: "You've been back on the site several times.",
      filingsLine: "8 years trading",
      hypothesis,
    });
    expect(fields.companyName).toBe("North Peak Ltd");
    expect(fields.hypothesis).toContain("stacked");
    expect(fields.mechanism).toMatch(/packager/i);
  });
});

describe("siteCopyToBullets", () => {
  it("keeps short factual lines and caps the list", () => {
    const bullets = siteCopyToBullets(
      [
        "We fit commercial kitchens across the South West.",
        "Hi",
        "Established in 2014 we employ 40 people on live contracts.",
        "We fit commercial kitchens across the South West.",
      ].join("\n"),
      6
    );
    expect(bullets).toEqual([
      "We fit commercial kitchens across the South West.",
      "Established in 2014 we employ 40 people on live contracts.",
    ]);
  });

  it("splits a single collapsed homepage blob into usable lines", () => {
    const bullets = siteCopyToBullets(
      "Home Crafters Ltd We design and install fitted kitchens across Nottinghamshire and Derbyshire. Trading since 2014 with forty staff on live contracts. Call the showroom for a measured survey."
    );
    expect(bullets.length).toBeGreaterThan(0);
    expect(bullets.some((line) => /fitted kitchens/i.test(line))).toBe(true);
  });
});

describe("packHtmlFromPageImages", () => {
  it("wraps page stills in the private pack chrome", () => {
    const html = packHtmlFromPageImages({
      companyName: "North Peak Ltd",
      images: ["data:image/png;base64,aaa", "data:image/png;base64,bbb"],
      enquiryUrl: "https://www.stratafinance.co.uk/#contact",
    });
    expect(html).toMatch(/briefing-pack/);
    expect(html).toMatch(/Prepared for the directors of North Peak Ltd/);
    expect(html).toMatch(/data:image\/png;base64,aaa/);
    expect(html).toMatch(/Enquire or apply/);
    expect(html).toMatch(/noindex/);
  });

  it("wraps stills with portal and CTA hrefs", () => {
    const html = packHtmlFromPageImages({
      companyName: "North Peak Ltd",
      images: ["data:image/jpeg;base64,aaa", "b", "c", "d", "e", "f"],
      enquiryUrl: "https://www.stratafinance.co.uk/#contact",
      veltroUrl: "/veltro?b=tok",
      slides: fillMirrorPortal({
        companyName: "North Peak Ltd",
        industry: "construction",
        dwellLine: "You've been back on the site several times.",
        filingsLine: "8 years trading · SIC 43210",
        hypothesis: pickBriefingHypothesis({ nonBankChargeCount: 2, sicCodes: ["43210"], dwellCount: 6 }),
        enquiryUrl: "https://www.stratafinance.co.uk/#contact",
        veltroUrl: "/veltro?b=tok",
      }),
    });
    expect(html).toMatch(/id="slide-5"/);
    expect(html).toMatch(/id="slide-6"/);
    expect(html).toMatch(/href="#slide-5"/);
    expect(html).toMatch(/href="#slide-6"/);
    expect(html).toMatch(/stratafinance\.co\.uk\/#contact/);
    expect(html).toMatch(/\/veltro\?b=tok/);
  });
});
