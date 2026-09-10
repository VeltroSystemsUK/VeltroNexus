import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyCreativeDirection,
  applyPostCopy,
  applyPostVisual,
  canvasCopyLimit,
  composeSocialPost,
  copyPatchFromNode,
  creativeDirectionFor,
} from "@/components/craft/lib/composePost";
import { FRAME_SHAPES } from "@/components/craft/lib/looks";
import type { CraftAsset } from "@/components/craft/lib/types";
import { applyCopyPatch, COPY_LIMITS, generateWeek } from "@shared/craftQueue";

const STILL: CraftAsset = {
  id: "visual_test",
  name: "desk.jpg",
  mime: "image/jpeg",
  dataUrl: "data:image/jpeg;base64,QQ==",
};

describe("composeSocialPost", () => {
  it("lays the queue post onto the house week file, not og-banner", () => {
    const post = generateWeek("2026-08-31")[0]!;
    const doc = composeSocialPost(post);

    expect(doc.week).toBeTruthy();
    expect(doc.pages).toHaveLength(7);
    expect(doc.pages.every((page) => page.presetId === "li-landscape")).toBe(true);
    const home = doc.pages.find((page) => page.name === post.weekday) ?? doc.pages[0]!;
    const texts = home.nodes.filter((n) => n.type === "text").map((n) => n.text);
    expect(texts.some((t) => t.includes(post.hook) || t.startsWith(post.hook.slice(0, 24)))).toBe(true);
    expect(texts.join(" ")).toMatch(/\b(do not lend|packager)\b/i);
    expect(home.daySlot).toBeTruthy();
    const names = home.nodes.filter((n) => n.type === "text").map((n) => n.name.toLowerCase());
    expect(names.some((n) => n.includes("cta"))).toBe(true);
    expect(names).toContain("identity");
  });

  it("uses borrower vs introducer labels on the board", () => {
    const week = generateWeek("2026-08-31");
    const borrowerPost = week.find((p) => p.track === "borrower")!;
    const introducerPost = week.find((p) => p.track === "introducer")!;
    const borrower = composeSocialPost(borrowerPost);
    const introducer = composeSocialPost(introducerPost);
    const borrowerPage = borrower.pages.find((page) => page.name === borrowerPost.weekday) ?? borrower.pages[0]!;
    const introducerPage = introducer.pages.find((page) => page.name === introducerPost.weekday) ?? introducer.pages[0]!;
    const borrowerText = borrowerPage.nodes
      .filter((n) => n.type === "text")
      .map((n) => n.text)
      .join(" ")
      .toUpperCase();
    const introducerText = introducerPage.nodes
      .filter((n) => n.type === "text")
      .map((n) => n.text)
      .join(" ")
      .toUpperCase();
    expect(borrowerText).toContain("DIRECTOR");
    expect(introducerText).toContain("INTRODUCER");
  });

  it("relays ammo copy onto an already-composed board", () => {
    const post = generateWeek("2026-08-31")[0]!;
    const doc = composeSocialPost(post);
    const fed = applyPostCopy(doc, {
      ...post,
      hook: "Ammo hook on the board",
      hook2: "We do not lend.",
      body: "Casey wrote this. We do not lend.",
    });
    const texts = fed.pages[0]!.nodes.filter((n) => n.type === "text").map((n) => n.text).join(" ");
    expect(texts).toContain("Ammo hook on the board");
    expect(texts).toContain("Casey wrote this");
  });

  it("relays edited copy onto existing named layers without wiping the board", () => {
    const post = generateWeek("2026-08-31")[0]!;
    const doc = composeSocialPost(post);
    const nodeCount = doc.pages[0]!.nodes.length;
    const edited = applyPostCopy(doc, {
      ...post,
      hook: "Edited hook that must land on the board.",
      cta: "Talk to Strata",
    });
    expect(edited.pages[0]!.nodes.length).toBe(nodeCount);
    const texts = edited.pages.flatMap((page) =>
      page.nodes.filter((n) => n.type === "text").map((n) => n.text)
    );
    expect(texts.some((t) => t.includes("Edited hook that must land on the board."))).toBe(true);
  });

  it("writes a named layer edit back onto the week copy", () => {
    const post = generateWeek("2026-08-31")[0]!;
    const doc = composeSocialPost(post);
    const page = doc.pages[0]!;
    const byName = (name: string) =>
      page.nodes.find((node) => node.type === "text" && node.name === name);

    expect(copyPatchFromNode(byName("Hook 1")!.name, "  File first. Then the lender.  ")).toEqual({
      hook: "File first. Then the lender.",
    });
    expect(copyPatchFromNode(byName("Hook 2")!.name, "  We do not lend.  ")).toEqual({
      hook2: "We do not lend.",
    });
    expect(copyPatchFromNode(byName("Body")!.name, "We package. We do not lend.")).toEqual({
      body: "We package. We do not lend.",
    });
    expect(copyPatchFromNode(byName("CTA label")!.name, "Talk to Strata")).toEqual({
      cta: "Talk to Strata",
    });
    expect(copyPatchFromNode(byName("Hashtags")!.name, "#SMEFinance  #UKBusiness")).toEqual({
      hashtags: "#SMEFinance  #UKBusiness",
    });
    expect(copyPatchFromNode(byName("Link")!.name, "https://stratafinance.co.uk")).toEqual({
      links: "https://stratafinance.co.uk",
    });
    expect(copyPatchFromNode(byName("Eyebrow")?.name ?? "Eyebrow", "  SME DESKS  ·  STRATA  ")).toEqual({
      eyebrow: "SME DESKS  ·  STRATA",
    });
    expect(copyPatchFromNode("Headline", "x".repeat(COPY_LIMITS.hook + 8))?.hook?.length).toBe(
      COPY_LIMITS.hook,
    );
    expect(canvasCopyLimit("Title", "linkedin-banner")).toBeUndefined();
    expect(canvasCopyLimit("Title", "mkt-2")).toBe(COPY_LIMITS.hook);
    expect(canvasCopyLimit("Hook 1", "mkt-2")).toBe(COPY_LIMITS.hook);

    const patch = copyPatchFromNode("Hook 1", "Rewritten hook from the board.");
    const next = applyCopyPatch(post, patch!);
    expect(next.hook).toBe("Rewritten hook from the board.");
    const relaid = applyPostCopy(doc, next);
    const hero = relaid.pages[0]!.nodes.find((node) => node.type === "text" && node.name === "Hook 1");
    expect(hero?.type === "text" ? hero.text : "").toBe("Rewritten hook from the board.");
  });

  it("relays an edited eyebrow onto the kicker layer", () => {
    const post = { ...generateWeek("2026-08-31")[0]!, eyebrow: "PACKAGER  ·  STRATA" };
    const doc = composeSocialPost(post);
    const line = doc.pages.flatMap((page) => page.nodes).find((node) => node.type === "text" && node.name === "Eyebrow");
    expect(line?.type === "text" ? line.text : "").toBe("PACKAGER  ·  STRATA");
    const next = applyCopyPatch(post, { eyebrow: "INTRODUCER DESK" });
    expect(next.eyebrow).toBe("INTRODUCER DESK");
    const relaid = applyPostCopy(doc, next);
    const updated = relaid.pages.flatMap((page) => page.nodes).find((node) => node.type === "text" && node.name === "Eyebrow");
    expect(updated?.type === "text" ? updated.text : "").toBe("INTRODUCER DESK");
  });

  it("splits the hero into two coloured lines", () => {
    const post = { ...generateWeek("2026-08-31")[0]!, hook: "The pack is the product.", hook2: "We do not lend." };
    const doc = composeSocialPost(post);
    const heroes = doc.pages[0]!.nodes.filter(
      (node) => node.type === "text" && (node.name === "Hook 1" || node.name === "Hook 2"),
    );
    expect(heroes.map((node) => node.name)).toEqual(["Hook 1", "Hook 2"]);
    const a = heroes[0]!;
    const b = heroes[1]!;
    expect(a.type === "text" && a.text).toBe("The pack is the product.");
    expect(b.type === "text" && b.text).toBe("We do not lend.");
    expect(a.type === "text" && b.type === "text" && a.color !== b.color).toBe(true);
    expect(b.type === "text" && b.role).toBe("accent");
  });

  it("directs Hook 1 and Hook 2 motion on compose before a still hangs", () => {
    const post = generateWeek("2026-08-31")[0]!;
    const doc = composeSocialPost(post);
    const hook1 = doc.pages[0]!.nodes.find((node) => node.type === "text" && node.name === "Hook 1");
    expect(hook1?.animation?.type && hook1.animation.type !== "none").toBe(true);
  });

  it("lets Creative Design hang a framed, shadowed, moving still instead of a blob", () => {
    const post = generateWeek("2026-08-31")[5]!;
    const doc = applyCreativeDirection(applyPostVisual(composeSocialPost(post), STILL, "plain", { weekday: post.weekday }), post);
    const page = doc.pages.find((item) => item.name === post.weekday) ?? doc.pages[0]!;
    const visual = page.nodes.find(
      (node) => (node.type === "image" && node.name === "Visual") || node.name === "Media frame",
    );
    expect(visual).toBeTruthy();
    expect(visual?.shadow).toBeTruthy();
    expect(visual?.type === "image" ? visual.tintOpacity ?? 0 : 0).toBe(0);
    const hook1 = page.nodes.find((node) => node.type === "text" && node.name === "Hook 1");
    const hook2 = page.nodes.find((node) => node.type === "text" && node.name === "Hook 2");
    expect(hook1?.animation?.type && hook1.animation.type !== "none").toBe(true);
    expect(hook2?.type === "text" && hook1?.type === "text" && hook2.color !== hook1.color).toBe(true);
  });

  it("varies frame, shadow and motion across the week", () => {
    const week = generateWeek("2026-08-31");
    const looks = week.map((post) => creativeDirectionFor(post.weekday));
    expect(new Set(looks.map((look) => look.frame)).size).toBeGreaterThan(3);
    expect(looks.every((look) => FRAME_SHAPES.some((shape) => shape.id === look.frame && shape.id !== "plain"))).toBe(
      true,
    );
    expect(looks.every((look) => look.shadow !== "none")).toBe(true);
    expect(looks.every((look) => look.visualMotion !== "none" && look.hookMotion !== "none")).toBe(true);
    expect(creativeDirectionFor("Mon").frame).not.toBe(creativeDirectionFor("Fri").frame);
  });

  it("keeps the directed frame when ammo copy is relaid", () => {
    const post = generateWeek("2026-08-31")[5]!;
    const directed = applyCreativeDirection(applyPostVisual(composeSocialPost(post), STILL, "plain", { weekday: post.weekday }), post);
    const pageOf = (doc: ReturnType<typeof composeSocialPost>) =>
      doc.pages.find((item) => item.name === post.weekday) ?? doc.pages[0]!;
    const before = pageOf(directed).nodes.find((node) => node.type === "image" && (node.name === "Visual" || node.name === "Media frame"));
    const relaid = applyPostCopy(directed, { ...post, hook: "Ammo hook on the board", hook2: "We do not lend." });
    const after = pageOf(relaid).nodes.find((node) => node.type === "image" && (node.name === "Visual" || node.name === "Media frame"));
    expect(after?.type === "image" ? after.mask : undefined).toBe(before?.type === "image" ? before.mask : "missing");
    expect(after?.shadow?.blur).toBe(before?.shadow?.blur);
    expect(after?.animation?.type).toBe(before?.animation?.type);
  });
});

describe("compose executes Isla playbook stacks", () => {
  function motionNames(doc: ReturnType<typeof composeSocialPost>, weekday: string): string[] {
    const page = doc.pages.find((item) => item.name === weekday) ?? doc.pages[0]!;
    return page.nodes.filter((node) => node.type === "motion").map((node) => node.name);
  }

  it("lays Monday glass-and-slam plates and writes the hook on the overlay", () => {
    const post = {
      ...generateWeek("2026-08-31")[0]!,
      hook: "They wanted a lender.",
      hook2: "They needed a packager.",
    };
    const doc = composeSocialPost(post);
    expect(motionNames(doc, "Mon")).toEqual(["Playbook horizon-shift", "Playbook cinematic-hook-slam"]);
    const monday = doc.pages.find((page) => page.name === "Mon")!;
    const slam = monday.nodes.find((node) => node.type === "motion" && node.name === "Playbook cinematic-hook-slam");
    expect(slam?.type === "motion" ? slam.text : "").toBe("They wanted a lender.");
    expect(slam?.type === "motion" ? slam.text2 : "").toBe("They needed a packager.");
  });

  it("does not duplicate plates when copy is relaid", () => {
    const post = generateWeek("2026-08-31")[0]!;
    const doc = composeSocialPost(post);
    const relaid = applyPostCopy(doc, { ...post, hook: "File first. Then the lender." });
    expect(motionNames(relaid, "Mon")).toEqual(["Playbook horizon-shift", "Playbook cinematic-hook-slam"]);
    const slam = relaid.pages[0]!.nodes.find((node) => node.name === "Playbook cinematic-hook-slam");
    expect(slam?.type === "motion" ? slam.text : "").toBe("File first. Then the lender.");
  });

  it("builds every weekday stack from the studio playbook", () => {
    const week = generateWeek("2026-08-31");
    const doc = composeSocialPost(week[0]!);
    expect(motionNames(doc, "Tue")).toEqual(["Playbook stamp-pulse", "Playbook light-leak"]);
    expect(motionNames(doc, "Wed")).toEqual(["Playbook grain-breath", "Playbook vellum-crease"]);
    expect(motionNames(doc, "Thu")).toEqual(["Playbook redact-sweep", "Playbook declassified-text"]);
    expect(motionNames(doc, "Fri")).toEqual(["Playbook ledger-ticker", "Playbook odometer-roll"]);
    expect(motionNames(doc, "Sat")).toEqual(["Playbook vapor-drift"]);
    expect(motionNames(doc, "Sun")).toEqual(["Playbook breathing-monument"]);
    const thursday = doc.pages.find((page) => page.name === "Thu")!;
    const sweep = thursday.nodes.find((node) => node.name === "Playbook redact-sweep");
    expect(sweep?.copyExempt).toBe(true);
  });
});

describe("Isla card lands on the weekday board", () => {
  it("Friday ticker is the count, not the body paragraph", () => {
    const week = generateWeek("2026-08-31");
    const friday = {
      ...week[4]!,
      daySlot: "friday-number" as const,
      hook: "22 files on the desk.",
      hook2: "Then a decision.",
      body: "A complete pack is the job. Missing stays listed.",
    };
    const doc = composeSocialPost(friday);
    const page = doc.pages.find((item) => item.name === "Fri")!;
    const ticker = page.nodes.find((node) => node.name === "DataTicker");
    expect(ticker?.type === "text" ? ticker.text : "").toBe("22");
  });

  it("Wednesday Voice is the spoken line, and week posters hide hashtags", () => {
    const week = generateWeek("2026-08-31");
    const wednesday = {
      ...week[2]!,
      daySlot: "wednesday-voice" as const,
      hook: "He rebranded my judgement.",
      hook2: "Accountant, referral partner.",
      body: "",
      cta: "",
    };
    const doc = composeSocialPost(wednesday);
    const wed = doc.pages.find((item) => item.name === "Wed")!;
    const voice = wed.nodes.find((node) => node.name === "Voice");
    expect(voice?.type === "text" ? voice.text : "").toMatch(/rebranded my judgement/i);
    const monday = composeSocialPost(week[0]!).pages.find((item) => item.name === "Mon")!;
    const tags = monday.nodes.find((node) => node.name === "Hashtags");
    expect(tags?.hidden).toBe(true);
  });
});

describe("Casey scan vs Isla generate", () => {
  it("scan writes ammo only — empty week, no compose, no stills, no seed boards", () => {
    const desk = readFileSync("server/services/craftDesk.ts", "utf8");
    const scan = desk.slice(desk.indexOf("export async function runCraftScan"), desk.indexOf("export async function runCraftComposeWeek"));
    expect(scan).not.toContain("craftWeek(");
    expect(scan).not.toContain("applyAmmoToWeek");
    expect(scan).not.toContain("stampAmmoOnPost");
    expect(scan).not.toContain("seedGrammarWeek");
    expect(scan).not.toContain("generateStillsForWeek");
    expect(scan).toContain("research.briefs");
    expect(scan).toContain("week: []");
    const routes = readFileSync("server/routes/craft.ts", "utf8");
    const scanRoute = routes.slice(routes.indexOf('router.post("/craft/scan"'), routes.indexOf("router.patch"));
    expect(scanRoute).toContain("week: []");
    const ui = readFileSync("client/src/pages/Craft.tsx", "utf8");
    const scanUi = ui.slice(ui.indexOf("scanAmmo"), ui.indexOf("patchPost"));
    expect(scanUi).not.toContain("generateStillsForWeek");
    expect(scanUi).not.toContain("paintWeekFromPosts");
    expect(scanUi).not.toContain("createWeek");
    expect(scanUi).not.toContain("syncFromPost");
    expect(scanUi).toContain("await purgeAllCraftDocs()");
    expect(scanUi).toContain("week: []");
    expect(scanUi).toMatch(/Casey landed ammo/);
  });

  it("generate uses Casey ammo then Isla copy, paints the week file, and hangs stills", () => {
    const desk = readFileSync("server/services/craftDesk.ts", "utf8");
    const compose = desk.slice(desk.indexOf("export async function runCraftComposeWeek"));
    expect(compose).toContain("desk.briefs");
    expect(compose).toContain("craftWeek(source)");
    expect(compose).toContain("applyAmmoToWeek");
    const ui = readFileSync("client/src/pages/Craft.tsx", "utf8");
    expect(ui).toContain("paintWeekFromPosts");
    expect(ui).toContain("generateStillsForWeek");
    expect(ui).toContain("createWeek");
  });
});

describe("week stills hang on the week file", () => {
  it("generateStillsForWeek no longer skips grammar week posts", () => {
    const store = readFileSync("client/src/components/craft/store.ts", "utf8");
    const start = store.indexOf("generateStillsForWeek: async");
    const fn = store.slice(start, store.indexOf("applyLook:", start));
    expect(fn).not.toMatch(/if \(post\.weekId \|\| post\.daySlot\) return/);
    expect(fn).toContain("shouldHangWeekStill");
    expect(fn).toContain("week:");
  });

  it("applyPostVisual can target one weekday without painting the whole week", () => {
    const week = generateWeek("2026-08-31");
    const doc = composeSocialPost(week[5]!);
    const hung = applyPostVisual(doc, STILL, "plain", { daySlot: "saturday-object" });
    const saturday = hung.pages.find((page) => page.name === "Sat")!;
    const monday = hung.pages.find((page) => page.name === "Mon")!;
    expect(saturday.nodes.some((node) => node.type === "image" && node.name === "Media frame")).toBe(true);
    expect(monday.nodes.some((node) => node.type === "image")).toBe(false);
  });
});

