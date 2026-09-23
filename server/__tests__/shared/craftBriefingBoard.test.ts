import { describe, expect, it } from "vitest";
import {
  briefingDocumentFromBind,
  fillDocumentMergeTags,
  placeImageAssetOnPage,
} from "@/components/craft/lib/briefingBoard";
import { pickBriefingHypothesis } from "@shared/briefingHypothesis";

const bind = {
  companyName: "North Peak Ltd",
  dwellLine: "You've been back on the site several times.",
  filingsLine: "8 years trading · SIC 43210",
  hypothesis: pickBriefingHypothesis({ nonBankChargeCount: 2, sicCodes: [], dwellCount: 6 }),
};

describe("briefingDocumentFromBind", () => {
  it("builds six themed pages with this company's copy", () => {
    const doc = briefingDocumentFromBind({
      ...bind,
      industry: "construction",
    });
    expect(doc.pages.map((page) => page.name)).toEqual([
      "Mirror", "Agitation", "Shift", "Portal", "Cashflow", "Outreach",
    ]);
    const cover = doc.pages[0]!.nodes.find((node) => node.type === "text" && node.name === "Body");
    expect(cover && "text" in cover && cover.text).toMatch(/North Peak Ltd/);
    expect(doc.pages.every((page) => page.nodes.every((node) => !node.locked))).toBe(true);
  });

  it("places a gallery image on the current briefing page when there is no Visual slot", () => {
    const doc = briefingDocumentFromBind(bind);
    const page = doc.pages[0]!;
    const next = placeImageAssetOnPage(doc, page.id, {
      id: "asset_gallery_1",
      name: "workshop.jpg",
      mime: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,aaa",
      source: "upload",
    });
    const placed = next.pages[0]!.nodes.find((node) => node.type === "image");
    expect(placed?.type).toBe("image");
    expect(placed && "assetId" in placed && placed.assetId).toBe("asset_gallery_1");
    expect(next.assets.some((asset) => asset.id === "asset_gallery_1")).toBe(true);
    expect(next.pages.slice(1).every((item) => item.nodes.every((node) => node.type !== "image"))).toBe(true);
  });

  it("fills leftover merge tags from this company", () => {
    const doc = briefingDocumentFromBind(bind);
    doc.pages[0]!.nodes = doc.pages[0]!.nodes.map((node) =>
      node.type === "text" && node.name === "Body" ? { ...node, text: "For {{companyName}}" } : node
    );
    const filled = fillDocumentMergeTags(doc, bind);
    const body = filled.pages[0]!.nodes.find((node) => node.type === "text" && node.name === "Body");
    expect(body && "text" in body && body.text).toBe("For North Peak Ltd");
  });
});
