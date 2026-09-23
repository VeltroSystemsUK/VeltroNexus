import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  assertBriefingPackLinks,
  checkBriefingHttpLinks,
  collectBriefingLinks,
} from "@shared/briefingLinks";
import { fillOutreachPackHtml } from "@shared/briefingCraft";

const HOUSE = fs.readFileSync(path.resolve("customer-visual-aids.html"), "utf8");

describe("collectBriefingLinks", () => {
  it("reads house pack CTAs and in-pack portal targets", () => {
    const html = fillOutreachPackHtml(HOUSE, { companyName: "North Peak Ltd", industry: "construction" });
    const found = collectBriefingLinks(html);
    expect(found.hrefs).toContain("https://www.stratafinance.co.uk/#tools");
    expect(found.hrefs).toContain("https://veltro.co.uk/#contact");
    expect(found.dataGo).toEqual(expect.arrayContaining(["slide_5a_finance", "slide_5b_sales"]));
  });
});

describe("assertBriefingPackLinks", () => {
  it("fails leftover merge tags and localhost", () => {
    expect(assertBriefingPackLinks(`<a href="{{veltroUrl}}">x</a>`).ok).toBe(false);
    expect(assertBriefingPackLinks(`<a href="http://localhost:5000/briefing/tok">x</a>`).ok).toBe(false);
    expect(assertBriefingPackLinks(`<a href="https://leads.stratanexus.co.uk/briefing/tok">x</a>`).ok).toBe(false);
  });

  it("fails data-go that does not match a slide data-id", () => {
    const html = `<div data-id="slide_1"></div><button data-go="slide_missing"></button>`;
    expect(assertBriefingPackLinks(html).ok).toBe(false);
  });

  it("passes the filled house pack structure", () => {
    const html = fillOutreachPackHtml(HOUSE, { companyName: "North Peak Ltd", industry: "construction" });
    const result = assertBriefingPackLinks(html);
    expect(result.ok).toBe(true);
  });
});

describe("checkBriefingHttpLinks", () => {
  it("treats allowlisted 200 as live and 404 as dead", async () => {
    const get = async (url: string) => ({ status: url.includes("missing") ? 404 : 200, url });
    const live = await checkBriefingHttpLinks(["https://www.stratafinance.co.uk/#tools"], { origin: "https://hello.stratanexus.co.uk", get });
    expect(live.ok).toBe(true);
    const dead = await checkBriefingHttpLinks(["https://veltro.co.uk/missing"], { origin: "https://hello.stratanexus.co.uk", get });
    expect(dead.ok).toBe(false);
  });
});
