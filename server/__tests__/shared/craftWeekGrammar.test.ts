import { describe, expect, it } from "vitest";
import { applyCreativeDirection, applyPostCopy, applyPostVisual } from "@/components/craft/lib/composePost";
import { gifFrameAtMs } from "@/components/craft/lib/export";
import {
  applyWeekRoute,
  canExportWeekPage,
  isoWeekId,
  isHouseWeekDoc,
  materialiseWeek,
  pickWeekVisual,
  reviewWeekPage,
  seedGrammarWeek,
  shouldHangWeekStill,
  weekContractReminder,
} from "@/components/craft/lib/weekGrammar";
import { composeSocialPost } from "@/components/craft/lib/composePost";
import { documentFromTemplate } from "@/components/craft/lib/templates";
import { applyAmmoToWeek, applyCopyPatch, generateWeek, normalizePost, PACKAGER_IDENTITY, shapePostToDay } from "@shared/craftQueue";
import { IDENTITY_LINES } from "@shared/craftDirector";
import { parseWeekGrammar } from "../../services/craftDesk";
import type { CraftAsset } from "@/components/craft/lib/types";

const TOWER: CraftAsset = {
  id: "gen_tower",
  name: "glass tower downtown",
  mime: "image/jpeg",
  dataUrl: "data:image/jpeg;base64,QQ==",
  source: "generated",
};

const STAMP: CraftAsset = {
  id: "analog_stamp",
  name: "desk stamp",
  mime: "image/jpeg",
  dataUrl: "data:image/jpeg;base64,QQ==",
  source: "analog-capture",
  analogKind: "stamp",
};

function pageNamed(doc: ReturnType<typeof materialiseWeek>, name: string) {
  return doc.pages.find((page) => page.name === name)!;
}

function textOn(page: ReturnType<typeof pageNamed>, name: string) {
  const node = page.nodes.find((item) => item.type === "text" && item.name === name);
  return node?.type === "text" ? node.text : "";
}

describe("week grammar", () => {
  it("materialises seven 1200×627 pages that already carry identity, type, shadow, paper", () => {
    const doc = materialiseWeek({ weekId: "2026-W36", route: "sharp-cultural" });
    expect(doc.id).toBe("week:2026-W36");
    expect(doc.pages).toHaveLength(7);
    expect(doc.pages.map((page) => page.name)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(doc.week?.route).toBe("sharp-cultural");
    expect(IDENTITY_LINES).toContain(doc.week?.identity);
    const identityTexts = new Set<string>();
    for (const page of doc.pages) {
      expect(page.width).toBe(1200);
      expect(page.height).toBe(627);
      expect(page.presetId).toBe("li-landscape");
      expect(page.daySlot).toMatch(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)-/);
      expect(page.background.color.toUpperCase()).toBe("#F7F5F1");
      const identity = page.nodes.find((node) => node.type === "text" && node.name === "Identity");
      const line = identity?.type === "text" ? identity.text : "";
      expect(IDENTITY_LINES).toContain(line);
      expect(PACKAGER_IDENTITY.test(line)).toBe(true);
      identityTexts.add(line);
      expect(identity?.locked).toBe(true);
      expect(identity?.type === "text" ? identity.fontFamily : "").toBe("JetBrains Mono");
      expect(page.nodes.some((node) => node.shadow && node.shadow.blur === 0 && node.shadow.x !== 0)).toBe(true);
      expect(doc.brand.headingFont).toBe("Unbounded");
      expect(doc.brand.bodyFont).toBe("Inter");
    }
    expect(identityTexts.size).toBeGreaterThan(1);
    expect(textOn(pageNamed(doc, "Mon"), "Hook 1")).toBe("");
    expect(textOn(pageNamed(doc, "Mon"), "Hook 2")).toBe("");
    expect(pageNamed(doc, "Mon").nodes.filter((node) => node.type === "motion").map((node) => node.name)).toEqual([
      "Playbook horizon-shift",
      "Playbook cinematic-hook-slam",
    ]);
    expect(textOn(pageNamed(doc, "Fri"), "DataTicker")).toBe("00");
    expect(pageNamed(doc, "Sun").nodes.some((node) => node.name === "Visual" || node.name === "Media frame")).toBe(
      false,
    );
  });

  it("reviewWeekPage accepts a rotated packager footer, not only the badge", () => {
    const doc = materialiseWeek({ weekId: "2026-W36", route: "sharp-cultural" });
    const page = doc.pages[0]!;
    const line = "We are the packager. The lender decides, not us.";
    expect(PACKAGER_IDENTITY.test(line)).toBe(true);
    const next = {
      ...page,
      nodes: page.nodes.map((node) =>
        node.type === "text" && node.name === "Identity" ? { ...node, text: line } : node,
      ),
    };
    expect(reviewWeekPage(next).findings.some((item) => item.code === "identity")).toBe(false);
    const empty = {
      ...page,
      nodes: page.nodes.map((node) =>
        node.type === "text" && node.name === "Identity" ? { ...node, text: "STRATA" } : node,
      ),
    };
    expect(reviewWeekPage(empty).findings.some((item) => item.code === "identity")).toBe(true);
  });

  it("names the ISO week from a date in that week", () => {
    expect(isoWeekId("2026-09-04")).toBe("2026-W36");
  });

  it("seeds seven queue posts without writing seven hooks", () => {
    const week = seedGrammarWeek("2026-09-01", "sharp-cultural");
    expect(week).toHaveLength(7);
    expect(week.map((post) => post.weekday)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(week.every((post) => post.hook === "")).toBe(true);
    expect(week.every((post) => post.hook2 === "")).toBe(true);
    expect(week.every((post) => post.weekId === "2026-W36")).toBe(true);
    expect(week.every((post) => post.route === "sharp-cultural")).toBe(true);
    expect(week[0]!.daySlot).toBe("monday-two-beat");
    expect(week[4]!.body).toBe("00");
    expect(normalizePost(week[0]!).weekId).toBe("2026-W36");
    expect(normalizePost(week[0]!).daySlot).toBe("monday-two-beat");
    expect(parseWeekGrammar({ route: "beautiful-insane", from: "2026-09-04" })).toEqual({
      from: "2026-09-04",
      route: "beautiful-insane",
    });
    expect(parseWeekGrammar({}).route).toBe("sharp-cultural");
  });
});

describe("day contracts", () => {
  it("blocks Monday export without Hook 2", () => {
    const doc = materialiseWeek({ weekId: "2026-W36", route: "sharp-cultural" });
    const monday = applyPostCopy(doc, {
      ...seedGrammarWeek("2026-09-01", "sharp-cultural")[0]!,
      hook: "They wanted a lender.",
      hook2: "",
    }).pages[0]!;
    const review = reviewWeekPage(monday);
    expect(canExportWeekPage(monday)).toBe(false);
    expect(review.findings.some((item) => /hook 2/i.test(item.message))).toBe(true);
  });

  it("blocks Thursday when a banned myth sits in Body, and allows the same words on a copyExempt node", () => {
    const doc = materialiseWeek({ weekId: "2026-W36", route: "sharp-cultural" });
    const posts = seedGrammarWeek("2026-09-01", "sharp-cultural");
    const thursday = applyPostCopy(doc, {
      ...posts[3]!,
      hook: "Packaged. Not promised.",
      hook2: "We do not lend.",
      body: "instant approval",
    }).pages.find((page) => page.name === "Thu")!;
    expect(canExportWeekPage(thursday)).toBe(false);
    expect(reviewWeekPage(thursday).findings.some((item) => item.code === "thursday_myth")).toBe(true);

    const exempt = {
      ...thursday,
      nodes: thursday.nodes.map((node) =>
        node.type === "text" && node.name === "Body"
          ? { ...node, text: "Packaged. Not promised.", copyExempt: false }
          : node.name === "RedactSweep"
            ? { ...node, copyExempt: true, ...(node.type === "text" ? { text: "instant approval" } : {}) }
            : node,
      ),
    };
    expect(canExportWeekPage(exempt)).toBe(true);
  });

  it("rejects Friday percent language in Body or ticker", () => {
    const doc = materialiseWeek({ weekId: "2026-W36", route: "sharp-cultural" });
    const fridayPost = seedGrammarWeek("2026-09-01", "sharp-cultural")[4]!;
    const dirty = applyPostCopy(doc, { ...fridayPost, body: "3.4%", hook2: "We do not lend." }).pages.find(
      (page) => page.name === "Fri",
    )!;
    expect(canExportWeekPage(dirty)).toBe(false);
    expect(reviewWeekPage(dirty).findings.some((item) => item.code === "friday_rate")).toBe(true);
    expect(() => applyCopyPatch(fridayPost, { body: "3.4%" })).toThrow(/friday/i);
  });

  it("allows Sunday export with eight words and no image", () => {
    const doc = materialiseWeek({ weekId: "2026-W36", route: "sharp-cultural" });
    const sundayPost = seedGrammarWeek("2026-09-01", "sharp-cultural")[6]!;
    const sunday = applyPostCopy(doc, {
      ...sundayPost,
      hook: "Leave the board empty",
      hook2: "We do not lend.",
      body: "enough to hear.",
      cta: "",
    }).pages.find((page) => page.name === "Sun")!;
    expect(sunday.nodes.some((node) => node.type === "image")).toBe(false);
    expect(canExportWeekPage(sunday)).toBe(true);
  });

  it("surfaces canExport reasons as a list, not a generic fail", () => {
    const doc = materialiseWeek({ weekId: "2026-W36", route: "sharp-cultural" });
    const reasons = reviewWeekPage(doc.pages[0]!).findings.map((item) => item.message);
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.every((message) => message.length > 8)).toBe(true);
    expect(weekContractReminder("thursday-redact")).toMatch(/myth is artwork only/i);
  });

  it("applies the locked day contract instead of a mood adjective", () => {
    const doc = materialiseWeek({ weekId: "2026-W36", route: "sharp-cultural" });
    const directed = applyCreativeDirection(doc);
    const monday = directed.pages.find((page) => page.name === "Mon")!;
    const thursday = directed.pages.find((page) => page.name === "Thu")!;
    expect(monday.nodes.some((node) => node.name === "Hook 1")).toBe(true);
    expect(monday.nodes.some((node) => node.name === "Hook 2")).toBe(true);
    expect(thursday.nodes.some((node) => node.name === "RedactSweep" && node.copyExempt)).toBe(true);
  });

  it("mutates Friday into a ticker hero and Sunday into silence, not the same type stack", () => {
    const doc = materialiseWeek({ weekId: "2026-W36", route: "sharp-cultural" });
    const friday = doc.pages.find((page) => page.name === "Fri")!;
    const sunday = doc.pages.find((page) => page.name === "Sun")!;
    const wednesday = doc.pages.find((page) => page.name === "Wed")!;
    const ticker = friday.nodes.find((node) => node.name === "DataTicker");
    const fridayHook = friday.nodes.find((node) => node.name === "Hook 1");
    expect(ticker && !ticker.hidden).toBe(true);
    expect(ticker && ticker.y < 120 && ticker.height >= 140).toBe(true);
    expect(fridayHook?.hidden).toBe(true);
    expect(sunday.nodes.find((node) => node.name === "Body")?.hidden).toBe(true);
    expect(sunday.nodes.find((node) => node.name === "CTA label")?.hidden).toBe(true);
    const voice = wednesday.nodes.find((node) => node.name === "Voice");
    expect(voice && !voice.hidden).toBe(true);
    expect(wednesday.nodes.find((node) => node.name === "Body")?.hidden).toBe(true);
  });

  it("does not clone one LinkedIn card seven times", () => {
    const doc = materialiseWeek({ weekId: "2026-W36", route: "sharp-cultural" });
    const hookGeom = doc.pages.map((page) => {
      const hook = page.nodes.find((node) => node.name === "Hook 1");
      return hook ? `${Math.round(hook.x)}:${Math.round(hook.y)}:${Math.round(hook.width)}:${hook.hidden ? "h" : "v"}` : "missing";
    });
    expect(new Set(hookGeom).size).toBeGreaterThan(3);
    const mediaVisible = doc.pages.filter((page) =>
      page.nodes.some((node) => node.name === "Media frame" && !node.hidden),
    );
    expect(mediaVisible.map((page) => page.name).sort()).toEqual(["Sat", "Tue", "Wed"]);
    expect(pageNamed(doc, "Mon").nodes.some((node) => node.name === "Media frame")).toBe(false);
    expect(pageNamed(doc, "Fri").nodes.find((node) => node.name === "DataTicker")?.width).toBeGreaterThan(800);
  });

  it("weekday posters use editorial scale, not a padded slide", () => {
    const doc = materialiseWeek({ weekId: "2026-W36", route: "sharp-cultural" });
    const monHook = pageNamed(doc, "Mon").nodes.find((node) => node.name === "Hook 1");
    expect(monHook?.type === "text" ? monHook.fontSize : 0).toBeGreaterThanOrEqual(72);
    const monGround = pageNamed(doc, "Mon").nodes.find((node) => node.name === "Ground");
    expect(monGround?.type === "shape" ? monGround.role : "").toBe("primary");
    const ticker = pageNamed(doc, "Fri").nodes.find((node) => node.name === "DataTicker");
    expect(ticker?.type === "text" ? ticker.fontSize : 0).toBeGreaterThanOrEqual(140);
    expect(ticker && ticker.x < 24).toBe(true);
    const tueFrame = pageNamed(doc, "Tue").nodes.find((node) => node.name === "Media frame");
    expect(tueFrame && tueFrame.x < 80).toBe(true);
    const voice = pageNamed(doc, "Wed").nodes.find((node) => node.name === "Voice");
    expect(voice?.type === "text" ? voice.fontSize : 0).toBeGreaterThanOrEqual(40);
    const sunHook = pageNamed(doc, "Sun").nodes.find((node) => node.name === "Hook 1");
    expect(sunHook?.type === "text" ? sunHook.align : "").toBe("left");
  });

  it("Sunday ammo cannot keep a CTA or a two-beat deck", () => {
    const seeded = seedGrammarWeek("2026-09-01", "sharp-cultural");
    const sunday = shapePostToDay({
      ...seeded[6]!,
      hook: "A meeting with no pack is theatre",
      hook2: "The list is the deal.",
      body: "Missing stays listed until it is not.",
      cta: "Talk to Strata",
      hashtags: ["#SMEFinance"],
    });
    expect(sunday.cta).toBe("");
    expect(sunday.body).toBe("");
    expect(sunday.hashtags).toEqual([]);
    expect(sunday.hook.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(8);
  });

  it("only hangs week stills on object and voice days", () => {
    expect(shouldHangWeekStill("saturday-object")).toBe(true);
    expect(shouldHangWeekStill("wednesday-voice")).toBe(true);
    expect(shouldHangWeekStill("sunday-silence")).toBe(false);
    expect(shouldHangWeekStill("monday-two-beat")).toBe(false);
    expect(shouldHangWeekStill("friday-number")).toBe(false);
  });
});

describe("ship laws", () => {
  it("samples GIF frame 0 from the settled poster", () => {
    expect(gifFrameAtMs(0, 12, true)).toBe(Number.POSITIVE_INFINITY);
    expect(gifFrameAtMs(1, 12, true)).toBeCloseTo(1000 / 12);
    expect(gifFrameAtMs(0, 12, false)).toBe(0);
  });

  it("does not auto-drop a glass tower when analog is empty", () => {
    const empty = pickWeekVisual([TOWER], "saturday-object");
    expect(empty).toEqual({ empty: true, reason: "no analog still — shoot or scan" });
    const analog = pickWeekVisual([TOWER, STAMP], "tuesday-stamp");
    expect("asset" in analog && analog.asset.id).toBe("analog_stamp");
  });

  it("leaves applyPostVisual empty when the analog tray is empty rather than hanging generated stock", () => {
    const doc = materialiseWeek({ weekId: "2026-W36", route: "sharp-cultural" });
    const hung = applyPostVisual(doc, TOWER, "plain", { weekFill: true });
    const saturday = hung.pages.find((page) => page.name === "Sat")!;
    const visual = saturday.nodes.find((node) => node.name === "Visual" || node.name === "Media frame");
    expect(visual?.type === "image" ? visual.assetId : "").not.toBe(TOWER.id);
  });

  it("switching route does not wipe copy", () => {
    const doc = materialiseWeek({ weekId: "2026-W36", route: "sharp-cultural" });
    const posted = applyPostCopy(doc, {
      ...seedGrammarWeek("2026-09-01", "sharp-cultural")[0]!,
      hook: "They wanted a lender.",
      hook2: "They needed a packager.",
    });
    const routed = applyWeekRoute(posted, "beautiful-insane");
    expect(routed.week?.route).toBe("beautiful-insane");
    expect(textOn(routed.pages[0]!, "Hook 1")).toBe("They wanted a lender.");
    expect(textOn(routed.pages[0]!, "Hook 2")).toBe("They needed a packager.");
  });
});

describe("ad-hoc boards stay as today", () => {
  it("queue posts with mkt- ids open the house week, not og-banner", () => {
    const post = generateWeek("2026-08-31")[0]!;
    const doc = composeSocialPost(post);
    expect(doc.week).toBeTruthy();
    expect(doc.pages.every((page) => page.presetId === "li-landscape")).toBe(true);
    expect(doc.pages[0]!.daySlot).toBeTruthy();
  });

  it("does not treat seven og-banner pages as the house week", () => {
    const house = materialiseWeek({ weekId: "2026-W36", route: "sharp-cultural" });
    const og = documentFromTemplate("og-banner").pages[0]!;
    const fake = {
      ...house,
      pages: house.pages.map((page) => ({
        ...og,
        id: page.id,
        name: page.name,
        daySlot: page.daySlot,
      })),
    };
    expect(isHouseWeekDoc(house)).toBe(true);
    expect(isHouseWeekDoc(fake)).toBe(false);
  });

  it("ignores leftover og/square/story presets on a queue post", () => {
    const post = { ...generateWeek("2026-08-31")[0]!, presetId: "og" };
    const doc = composeSocialPost(post);
    expect(doc.pages.every((page) => page.presetId === "li-landscape")).toBe(true);
    expect(doc.pages.some((page) => page.nodes.some((node) => node.name === "Rail"))).toBe(false);
  });
});

describe("compose week uses the house file", () => {
  it("stamps ammo onto grammar posts and opens li-landscape, not og-banner", () => {
    const seeded = seedGrammarWeek("2026-09-01", "sharp-cultural");
    const week = applyAmmoToWeek(
      seeded,
      seeded.map((post) => ({
        id: post.id,
        track: post.track,
        headline: "The wait is the product",
        source: "test",
        coreFact: "Clearing takes weeks",
        smeImpact: "Directors wait with no plan",
        trigger: "decline",
        freshAngle: "The file is the decision",
        dataBites: ["missing"],
        socialAngle: "The bank took eight weeks to say no. Here is week one.",
        emailAngle: "email",
        stockId: "desk",
        imagePrompt: "UK desk",
      })),
    );
    expect(week.every((post) => post.weekId === "2026-W36")).toBe(true);
    expect(week[0]!.daySlot).toBe("monday-two-beat");
    expect(week[0]!.presetId).toBe("li-landscape");
    expect(week[0]!.hook.length).toBeGreaterThan(0);

    const doc = composeSocialPost(week[0]!);
    expect(doc.week?.weekId).toBe("2026-W36");
    expect(doc.pages).toHaveLength(7);
    expect(doc.pages.every((page) => page.presetId === "li-landscape")).toBe(true);
    expect(doc.pages[0]!.daySlot).toBe("monday-two-beat");
    expect(doc.pages.some((page) => page.presetId === "og")).toBe(false);
    expect(isHouseWeekDoc(doc)).toBe(true);
    const identity = doc.pages[0]!.nodes.find((node) => node.name === "Identity");
    expect(identity?.type === "text" ? identity.text : "").toMatch(/do not lend/i);
  });
});
