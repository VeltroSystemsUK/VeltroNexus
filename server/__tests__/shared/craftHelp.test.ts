import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CRAFT_HELP,
  CRAFT_HELP_ACTION_TYPES,
  CRAFT_HELP_RECIPE_IDS,
  craftHelpRecipe,
} from "@shared/craftHelp";

const BANNED_ACTIONS = ["exportPng", "exportPack", "recordMotionGif", "save", "removeSelected"];

describe("Craft studio recipes", () => {
  it("ships five unique recipe ids", () => {
    expect(CRAFT_HELP.map((item) => item.id).sort()).toEqual([...CRAFT_HELP_RECIPE_IDS].sort());
    expect(new Set(CRAFT_HELP.map((item) => item.id)).size).toBe(5);
  });

  it("every recipe has a title, outcome, and at least one step", () => {
    for (const recipe of CRAFT_HELP) {
      expect(recipe.title.length).toBeGreaterThan(3);
      expect(recipe.outcome.length).toBeGreaterThan(8);
      expect(recipe.steps.length).toBeGreaterThan(0);
      for (const step of recipe.steps) {
        expect(step.title.length).toBeGreaterThan(2);
        expect(step.body.length).toBeGreaterThan(8);
      }
    }
  });

  it("step actions stay on the allowlist and never export or delete", () => {
    for (const recipe of CRAFT_HELP) {
      for (const step of recipe.steps) {
        if (!step.action) continue;
        expect(CRAFT_HELP_ACTION_TYPES).toContain(step.action.type);
        expect(BANNED_ACTIONS).not.toContain(step.action.type);
      }
    }
  });

  it("hook-gif stacks glass then slam", () => {
    const recipe = craftHelpRecipe("hook-gif");
    const motions = recipe?.steps
      .map((step) => (step.action?.type === "addMotion" ? step.action.presetId : null))
      .filter(Boolean);
    expect(motions).toEqual(["liquid-glass-shift", "cinematic-hook-slam"]);
  });

  it("stack-layers explains inspector adds and right-click replaces", () => {
    const recipe = craftHelpRecipe("stack-layers");
    const text = recipe?.steps.map((step) => `${step.title} ${step.body}`).join(" ") ?? "";
    expect(text.toLowerCase()).toMatch(/inspector/);
    expect(text.toLowerCase()).toMatch(/adds/);
    expect(text.toLowerCase()).toMatch(/right-click/);
    expect(text.toLowerCase()).toMatch(/replace/);
  });

  it("week-post uses announce-post and spawnPackPages then a human export hint", () => {
    const recipe = craftHelpRecipe("week-post");
    expect(recipe?.steps.some((step) => step.action?.type === "applyTemplate" && step.action.templateId === "announce-post")).toBe(true);
    expect(recipe?.steps.some((step) => step.action?.type === "spawnPackPages")).toBe(true);
    expect(recipe?.steps.at(-1)?.action).toBeUndefined();
    expect(recipe?.steps.at(-1)?.hint?.toLowerCase()).toMatch(/png|pack/);
  });
});

describe("Craft studio runner wiring", () => {
  it("store exposes runCraftHelpStep", () => {
    const store = readFileSync("client/src/components/craft/store.ts", "utf8");
    expect(store).toContain("runCraftHelpStep:");
    expect(store).toContain('error: "unknown step"');
    expect(store).toContain('toast.error("Select a motion plate first")');
  });

  it("ensureDoc email-letter awaits persist before the no-document guard", () => {
    const store = readFileSync("client/src/components/craft/store.ts", "utf8");
    const start = store.indexOf("runCraftHelpStep: async");
    const runner = store.slice(start, store.indexOf("applyCurrentDescription:", start));
    expect(runner).toContain('documentFromTemplate("email-letter"');
    expect(runner).toContain("await persistLocal(");
    expect(runner).toContain("loadDocument(");
    expect(runner).not.toContain('get().applyTemplate("email-letter")');
  });
});

describe("Craft studio chrome", () => {
  it("CraftHelp sheet lists recipes and run controls", () => {
    const help = readFileSync("client/src/components/craft/shell/CraftHelp.tsx", "utf8");
    expect(help).toContain("SWELL studio");
    expect(help).toContain("Idea, then board. Export is a decision, not a default.");
    expect(help).toContain("Run this step");
    expect(help).toContain("Run all remaining");
    expect(help).toContain("Reset ticks");
    expect(help).toContain("runCraftHelpStep");
    expect(help).toContain("CRAFT_HELP_DESK");
    expect(help).toContain("CRAFT_HELP_RULES");
  });

  it("CraftView opens help from the bar and question mark", () => {
    const view = readFileSync("client/src/components/craft/CraftView.tsx", "utf8");
    expect(view).toContain("CraftHelp");
    expect(view).toContain('aria-label="Studio help"');
    expect(view).toMatch(/event\.key === "\?"/);
    expect(view).toContain("isTypingTarget");
    expect(view).toContain("setHelpOpen");
  });

  it("Escape closes help before the no-document return and CraftHelp mounts once", () => {
    const view = readFileSync("client/src/components/craft/CraftView.tsx", "utf8");
    const start = view.indexOf("if (isTypingTarget(event.target)) return;");
    const handler = view.slice(start, view.indexOf("window.addEventListener('keydown', onKey)"));
    const endText = handler.indexOf("endTextEdit");
    const helpClose = handler.indexOf("setHelpOpen(false)");
    const noDoc = handler.indexOf("if (!state.doc) return;");
    expect(endText).toBeGreaterThan(-1);
    expect(helpClose).toBeGreaterThan(-1);
    expect(noDoc).toBeGreaterThan(-1);
    expect(endText).toBeLessThan(helpClose);
    expect(helpClose).toBeLessThan(noDoc);
    expect(view.match(/<CraftHelp /g)).toHaveLength(1);
  });
});
