import { describe, expect, it } from "vitest";
import { applyPostCopy, composeSocialPost, copyPatchFromNode } from "@/components/craft/lib/composePost";
import { applyCopyPatch, COPY_LIMITS, generateWeek } from "@shared/craftQueue";

describe("composeSocialPost", () => {
  it("lays the post onto a CRAFT template instead of a blank board", () => {
    const post = generateWeek("2026-08-31")[0]!;
    const doc = composeSocialPost(post);

    expect(doc.title).toBe(post.title);
    expect(doc.pages.length).toBeGreaterThanOrEqual(3);

    const texts = doc.pages.flatMap((page) =>
      page.nodes.filter((n) => n.type === "text").map((n) => n.text)
    );
    expect(texts.some((t) => t.includes(post.hook) || t.startsWith(post.hook.slice(0, 24)))).toBe(true);
    expect(texts.join(" ").toUpperCase()).toContain("STRATA");
    expect(doc.pages.some((p) => p.presetId === "og" || p.presetId === post.presetId)).toBe(true);
    expect(doc.pages.some((p) => p.presetId === "square")).toBe(true);
    expect(doc.pages.some((p) => p.presetId === "story")).toBe(true);
    expect(doc.pages[0]!.nodes.length).toBeGreaterThan(3);
    for (const page of doc.pages) {
      const names = page.nodes.filter((n) => n.type === "text").map((n) => n.name.toLowerCase());
      expect(names.some((n) => n.includes("cta"))).toBe(true);
      expect(names.some((n) => n.includes("hashtag"))).toBe(true);
      expect(names.some((n) => n === "link")).toBe(true);
    }
    expect(texts.some((t) => t.includes(post.cta) || t === post.cta)).toBe(true);
    expect(texts.join(" ")).toContain(post.hashtags[0]!);
  });

  it("uses borrower vs introducer labels on the board", () => {
    const week = generateWeek("2026-08-31");
    const borrower = composeSocialPost(week.find((p) => p.track === "borrower")!);
    const introducer = composeSocialPost(week.find((p) => p.track === "introducer")!);
    const borrowerText = borrower.pages[0]!.nodes
      .filter((n) => n.type === "text")
      .map((n) => n.text)
      .join(" ")
      .toUpperCase();
    const introducerText = introducer.pages[0]!.nodes
      .filter((n) => n.type === "text")
      .map((n) => n.text)
      .join(" ")
      .toUpperCase();
    expect(borrowerText).toContain("DIRECTOR");
    expect(introducerText).toContain("INTRODUCER");
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
    expect(copyPatchFromNode(byName("Deck")!.name, "We package. We do not lend.")).toEqual({
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
    expect(copyPatchFromNode("Eyebrow", "INTRODUCERS")).toBeNull();
    expect(copyPatchFromNode("Headline", "x".repeat(COPY_LIMITS.hook + 8))?.hook?.length).toBe(
      COPY_LIMITS.hook,
    );

    const patch = copyPatchFromNode("Hook 1", "Rewritten hook from the board.");
    const next = applyCopyPatch(post, patch!);
    expect(next.hook).toBe("Rewritten hook from the board.");
    const relaid = applyPostCopy(doc, next);
    const hero = relaid.pages[0]!.nodes.find((node) => node.type === "text" && node.name === "Hook 1");
    expect(hero?.type === "text" ? hero.text : "").toBe("Rewritten hook from the board.");
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
});
