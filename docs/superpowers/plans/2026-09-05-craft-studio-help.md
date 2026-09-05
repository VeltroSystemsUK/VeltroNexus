# Craft Studio Help Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an in-Craft SWELL studio sheet that runs five recipes on the live board, with the same file as Isla's knowledge.

**Architecture:** `shared/craftHelp.ts` is the only recipe source. `store.runCraftHelpStep` executes allowlisted actions. `CraftHelp` is a right-hand sheet. MKT-2 and `docs/CRAFT.md` point at the module. No new API, no persistence of ticks.

**Tech Stack:** TypeScript, Vitest, Zustand `useCraftStore`, existing Craft chrome (`Button`, context-menu dark sheet). Client imports shared via `@shared/craftHelp`.

**Spec:** `docs/superpowers/specs/2026-09-05-craft-studio-help-design.md`

## Global Constraints

- Schema stays `quires.craft.v1`. No second document format
- No new HTTP route, database, or IndexedDB key for help
- Never auto-run `exportPng`, `exportPack`, `recordMotionGif`, `save`, `removeSelected`, or any file download
- Inspector still **adds** a motion layer; right-click still **replaces** this plate. Help only explains that
- House copy: no rates/APR claims, no em dashes, UK spelling, Strata packages and does not lend
- `?` ignored while `isTypingTarget`; Escape ends text edit before closing help
- `runCraftHelpStep` is **async** (`newBlank` is already `Promise`) even though the spec sketch showed a sync return
- Windows PowerShell: `git commit -m "message"` (no bash heredocs)
- Do not revert uncommitted Craft motion WIP. Do not commit that WIP in these tasks unless a file this plan modifies already contains it and the change is required
- Build with `npm run build --ignore-scripts` (Shaun restarts the server)

## File map

- Create: `shared/craftHelp.ts` — types, allowlist, desk/rules copy, five recipes
- Create: `server/__tests__/shared/craftHelp.test.ts` — shape, allowlist, chrome, Isla pointer
- Modify: `client/src/components/craft/store.ts` — `runCraftHelpStep` on the Zustand interface and implementation
- Create: `client/src/components/craft/shell/CraftHelp.tsx` — studio sheet
- Modify: `client/src/components/craft/CraftView.tsx` — Help button, `?`, Escape, mount sheet (empty + document)
- Modify: `docs/agentic-org/agents/MKT-2.md` — Studio recipes section, MotionNode row, feature-use law
- Modify: `docs/CRAFT.md` — Studio help paragraph under tools

---

### Task 1: Recipe module (source of truth)

**Files:**
- Create: `shared/craftHelp.ts`
- Create: `server/__tests__/shared/craftHelp.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `CRAFT_HELP_ACTION_TYPES` — `["ensureDoc","applyTemplate","addMotion","replaceMotionPreset","addText","captureMotionStill","spawnPackPages"]`
  - `CRAFT_HELP_RECIPE_IDS` — `["week-post","hook-gif","still-art","stack-layers","email-letter"]`
  - `type CraftHelpAction` — the spec union
  - `type CraftHelpStep` — `{ title: string; body: string; action?: CraftHelpAction; hint?: string }`
  - `type CraftHelpRecipe` — `{ id: (typeof CRAFT_HELP_RECIPE_IDS)[number]; title: string; outcome: string; steps: CraftHelpStep[] }`
  - `type CraftHelpNav` — `"desk" | "recipes" | "rules"`
  - `CRAFT_HELP: CraftHelpRecipe[]`
  - `CRAFT_HELP_DESK: { title: string; body: string }[]`
  - `CRAFT_HELP_RULES: { title: string; body: string }[]`
  - `craftHelpRecipe(id: string): CraftHelpRecipe | undefined`
  - `craftHelpStep(id: string, index: number): CraftHelpStep | undefined`

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/shared/craftHelp.test.ts`:

```ts
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
```

Do not import store or CraftView in this file yet.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/craftHelp.test.ts`

Expected: FAIL — cannot resolve `@shared/craftHelp` (module missing).

- [ ] **Step 3: Write the module**

Create `shared/craftHelp.ts` with this content (keep the copy; do not invent extra recipes):

```ts
export const CRAFT_HELP_ACTION_TYPES = [
  "ensureDoc",
  "applyTemplate",
  "addMotion",
  "replaceMotionPreset",
  "addText",
  "captureMotionStill",
  "spawnPackPages",
] as const;

export type CraftHelpActionType = (typeof CRAFT_HELP_ACTION_TYPES)[number];

export type CraftHelpAction =
  | { type: "ensureDoc"; mode: "blank" | "email-letter" }
  | { type: "applyTemplate"; templateId: string }
  | { type: "addMotion"; presetId: string }
  | { type: "replaceMotionPreset"; presetId: string }
  | { type: "addText"; style?: "heading" | "body" | "caption"; text?: string }
  | { type: "captureMotionStill" }
  | { type: "spawnPackPages" };

export type CraftHelpStep = {
  title: string;
  body: string;
  action?: CraftHelpAction;
  hint?: string;
};

export const CRAFT_HELP_RECIPE_IDS = [
  "week-post",
  "hook-gif",
  "still-art",
  "stack-layers",
  "email-letter",
] as const;

export type CraftHelpRecipeId = (typeof CRAFT_HELP_RECIPE_IDS)[number];

export type CraftHelpRecipe = {
  id: CraftHelpRecipeId;
  title: string;
  outcome: string;
  steps: CraftHelpStep[];
};

export type CraftHelpNav = "desk" | "recipes" | "rules";

export const CRAFT_HELP_DESK: { title: string; body: string }[] = [
  {
    title: "What this desk is",
    body: "SWELL is a canvas compositor plus the week pipeline. You place type, stills, shapes, and living motion plates on a page, then export PNG, a size pack, or a GIF. Email uses the same canvas as a 600px letter.",
  },
  {
    title: "Week vs blank vs email",
    body: "The queue opens seven house boards from Casey ammo and Isla copy. A blank is a studio file. Email is the letter preset with merge tags. Do not spawn story/square/OG onto a week file.",
  },
  {
    title: "Motion is a node",
    body: "A motion plate is a layer, like an image. Inspector click adds a new plate. Right-click a plate to change that plate's look. Overlay plates (hook slam, viral hook) are transparent so atmosphere can show through.",
  },
  {
    title: "Export is a decision",
    body: "Week posts need marketing approve then compliance sign-off. Recipes never download files. You click PNG, Export pack, or Record GIF yourself.",
  },
];

export const CRAFT_HELP_RULES: { title: string; body: string }[] = [
  {
    title: "Packager, not lender",
    body: "Strata packages. Strata does not lend. Copy needs the packager identity. Never write rates, APR, guaranteed, payday, or we lend.",
  },
  {
    title: "Layers",
    body: "Inspector adds a plate. Right-click replaces this plate. Same look on the selected plate replays it. Up to eight plates can run live.",
  },
  {
    title: "Overlays and mist",
    body: "Hook slam and viral hook sit on glass as transparent type. Vapor Drift is soft mist, not ellipses.",
  },
  {
    title: "No auto-publish",
    body: "Shaun ships. Recipes do not save, delete, or post.",
  },
];

export const CRAFT_HELP: CraftHelpRecipe[] = [
  {
    id: "week-post",
    title: "High-quality social post",
    outcome: "Branded board with named copy, a visual decision, and a spawned pack. You export.",
    steps: [
      {
        title: "Open a studio file",
        body: "Week desk is Casey ammo then Isla copy. A blank is for one-off artwork. Do not invent rates.",
        action: { type: "ensureDoc", mode: "blank" },
      },
      {
        title: "Start from Introducer Post",
        body: "Named slots (eyebrow, hook, body, CTA) are law. Mutate the template. Do not rebuild from empty boxes.",
        action: { type: "applyTemplate", templateId: "announce-post" },
      },
      {
        title: "Decide the visual",
        body: "A living Ledger Current plate is one option. Kit photography is also valid. Do not stack every preset on one node.",
        action: { type: "addMotion", presetId: "ledger-current" },
      },
      {
        title: "Spawn the pack",
        body: "Story, square, and OG. Inspect the 9:16 safe zone. Reflow is not a crop. Skip this on a week file (the desk will say so).",
        action: { type: "spawnPackPages" },
      },
      {
        title: "You export",
        body: "PNG or Export pack in the top bar. Week posts stay locked until marketing approve and compliance sign-off.",
        hint: "You click PNG or Export pack. The recipe will not download a file.",
      },
    ],
  },
  {
    id: "hook-gif",
    title: "Scroll-stop GIF",
    outcome: "Dark glass under a transparent hook slam. You type the line and record the GIF.",
    steps: [
      {
        title: "Open a studio file",
        body: "A blank square is enough. First frame of the GIF must still read as a poster.",
        action: { type: "ensureDoc", mode: "blank" },
      },
      {
        title: "Lay the glass",
        body: "Liquid Glass Shift is a dark plate with a moving sheen. This is the atmosphere layer.",
        action: { type: "addMotion", presetId: "liquid-glass-shift" },
      },
      {
        title: "Slam the hook on top",
        body: "Inspector adds a second plate. Cinematic Hook Slam is a transparent overlay, not a card that covers the glass.",
        action: { type: "addMotion", presetId: "cinematic-hook-slam" },
      },
      {
        title: "Type, then you record",
        body: "Double-click the slam, type the hook, click off.",
        hint: "Right-click the plate and choose Record GIF, or use Record GIF in the inspector.",
      },
    ],
  },
  {
    id: "still-art",
    title: "Artwork still",
    outcome: "One living plate captured into the kit as photography.",
    steps: [
      {
        title: "Open a studio file",
        body: "Email and Learn use the captured still, not the live sim.",
        action: { type: "ensureDoc", mode: "blank" },
      },
      {
        title: "Drop vapor",
        body: "Vapor Drift is slow mist across paper, not a grid of ellipses. Other atmosphere plates are valid after this.",
        action: { type: "addMotion", presetId: "vapor-drift" },
      },
      {
        title: "Capture the still",
        body: "The frame hangs as a kit asset on this document.",
        action: { type: "captureMotionStill" },
      },
    ],
  },
  {
    id: "stack-layers",
    title: "Motion as layers",
    outcome: "Two live plates. Overlay readable on atmosphere.",
    steps: [
      {
        title: "How plates stack",
        body: "Inspector click adds a new plate. Right-click a plate replaces that plate's look. Same look on the selected plate replays it.",
      },
      {
        title: "Atmosphere",
        body: "Glass (or any Atmosphere look) is the ground.",
        action: { type: "addMotion", presetId: "liquid-glass-shift" },
      },
      {
        title: "Overlay",
        body: "Hook slam and viral hook are transparent. An opaque card hides what is underneath.",
        action: { type: "addMotion", presetId: "cinematic-hook-slam" },
      },
      {
        title: "Eight live",
        body: "Up to eight plates can run. Right-click Send back to grab the plate underneath.",
      },
    ],
  },
  {
    id: "email-letter",
    title: "Email from the same file",
    outcome: "600px letter with merge tags. No living WebGL.",
    steps: [
      {
        title: "Open the letter",
        body: "Strata Layer Email is 600 by 900 with merge tags already wired.",
        action: { type: "ensureDoc", mode: "email-letter" },
      },
      {
        title: "Merge tags",
        body: "Click chips in the inspector onto selected text. Same document, calmer board. No Three.js. If a motion plate is present, capture a still before send.",
      },
      {
        title: "You send from campaigns",
        body: "Email HTML export lives on the campaign, not as a social PNG.",
        hint: "Do not use Export pack here. Use the email campaign send path.",
      },
    ],
  },
];

export function craftHelpRecipe(id: string): CraftHelpRecipe | undefined {
  return CRAFT_HELP.find((item) => item.id === id);
}

export function craftHelpStep(id: string, index: number): CraftHelpStep | undefined {
  return craftHelpRecipe(id)?.steps[index];
}
```

If `@shared/craftHelp` fails to resolve, check `vitest.config.ts` / `tsconfig` aliases: they already map `@shared/*` to `shared/*` for `craftQueue`. Do not add a new alias unless the test cannot import. If needed, add `"@shared/craftHelp": path.resolve("shared/craftHelp.ts")` next to the existing shared alias.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/craftHelp.test.ts`

Expected: PASS (all cases in this file).

- [ ] **Step 5: Commit**

```powershell
git add shared/craftHelp.ts server/__tests__/shared/craftHelp.test.ts
git commit -m "feat: add Craft studio help recipes"
```

---

### Task 2: Store runner

**Files:**
- Modify: `client/src/components/craft/store.ts` (interface near `applyMotionPreset`, implementation after `replaceMotionPreset`)
- Modify: `server/__tests__/shared/craftHelp.test.ts`

**Interfaces:**
- Consumes: `craftHelpStep` from `@shared/craftHelp`; existing `newBlank`, `applyTemplate`, `addMotion`, `replaceMotionPreset`, `addText`, `captureMotionStill`, `spawnPackPages`
- Produces: `runCraftHelpStep: (recipeId: string, stepIndex: number) => Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/shared/craftHelp.test.ts`:

```ts
describe("Craft studio runner wiring", () => {
  it("store exposes runCraftHelpStep", () => {
    const store = readFileSync("client/src/components/craft/store.ts", "utf8");
    expect(store).toContain("runCraftHelpStep:");
    expect(store).toContain('error: "unknown step"');
    expect(store).toContain('toast.error("Select a motion plate first")');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/craftHelp.test.ts`

Expected: FAIL — `runCraftHelpStep` not in store.

- [ ] **Step 3: Implement the runner**

In `client/src/components/craft/store.ts`:

1. Import `{ craftHelpStep }` from `@shared/craftHelp` (same alias as `@shared/craftQueue`).
2. Add to `CraftState` (after `replaceMotionPreset`):

```ts
runCraftHelpStep: (recipeId: string, stepIndex: number) => Promise<{ ok: boolean; error?: string }>;
```

3. Add implementation after `replaceMotionPreset`. Use this body:

```ts
runCraftHelpStep: async (recipeId, stepIndex) => {
  const step = craftHelpStep(recipeId, stepIndex);
  if (!step) return { ok: false, error: "unknown step" };
  const action = step.action;
  if (!action) return { ok: true };
  try {
    if (action.type === "ensureDoc") {
      if (get().doc) return { ok: true };
      if (action.mode === "email-letter") {
        get().applyTemplate("email-letter");
      } else {
        await get().newBlank({ silent: true });
      }
      if (!get().doc) {
        toast.error("Could not create design");
        return { ok: false, error: "no document" };
      }
      return { ok: true };
    }
    if (action.type === "applyTemplate") {
      get().applyTemplate(action.templateId);
      return { ok: true };
    }
    if (action.type === "addMotion") {
      get().addMotion(action.presetId);
      return { ok: true };
    }
    if (action.type === "replaceMotionPreset") {
      get().replaceMotionPreset(action.presetId);
      return { ok: true };
    }
    if (action.type === "addText") {
      get().addText(undefined, undefined, action.style ?? "heading");
      if (action.text) {
        const doc = get().doc;
        const page = doc ? currentPage(doc, get().pageId) : null;
        const created = page?.nodes.filter((node) => node.type === "text").at(-1);
        if (created?.type === "text") get().updateNode(created.id, { text: action.text });
      }
      return { ok: true };
    }
    if (action.type === "captureMotionStill") {
      const { doc, pageId, selectedIds } = get();
      if (!doc) {
        toast.error("Select a motion plate first");
        return { ok: false, error: "no document" };
      }
      const page = currentPage(doc, pageId);
      const node = page.nodes.find((item) => item.id === selectedIds[0]);
      if (node?.type !== "motion") {
        toast.error("Select a motion plate first");
        return { ok: false, error: "no motion plate" };
      }
      get().captureMotionStill(node.id);
      return { ok: true };
    }
    get().spawnPackPages();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "step failed";
    toast.error(message);
    return { ok: false, error: message };
  }
},
```

Do not call export, GIF record, save, or delete from this function.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/craftHelp.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add client/src/components/craft/store.ts server/__tests__/shared/craftHelp.test.ts
git commit -m "feat: run Craft studio help steps from the store"
```

---

### Task 3: Studio sheet and chrome

**Files:**
- Create: `client/src/components/craft/shell/CraftHelp.tsx`
- Modify: `client/src/components/craft/CraftView.tsx` (imports; `helpOpen` state; empty-state Help; top-bar Help left of Undo; `?` and Escape; mount `<CraftHelp />`)
- Modify: `server/__tests__/shared/craftHelp.test.ts`

**Interfaces:**
- Consumes: `CRAFT_HELP`, `CRAFT_HELP_DESK`, `CRAFT_HELP_RULES`, `type CraftHelpNav`, `type CraftHelpRecipeId` from `@shared/craftHelp`; `useCraftStore().runCraftHelpStep`
- Produces: `export function CraftHelp({ open, onClose }: { open: boolean; onClose: () => void })`

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/shared/craftHelp.test.ts`:

```ts
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
    expect(view).toMatch(/event\.key === "\\?"/);
    expect(view).toContain("isTypingTarget");
    expect(view).toContain("setHelpOpen");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/craftHelp.test.ts`

Expected: FAIL — `CraftHelp.tsx` missing.

- [ ] **Step 3: Write CraftHelp.tsx**

Create `client/src/components/craft/shell/CraftHelp.tsx`:

```tsx
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CRAFT_HELP,
  CRAFT_HELP_DESK,
  CRAFT_HELP_RULES,
  type CraftHelpNav,
  type CraftHelpRecipeId,
} from "@shared/craftHelp";
import { useCraftStore } from "../store";

export function CraftHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [nav, setNav] = useState<CraftHelpNav>("recipes");
  const [recipeId, setRecipeId] = useState<CraftHelpRecipeId>("hook-gif");
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  if (!open) return null;
  const recipe = CRAFT_HELP.find((item) => item.id === recipeId) ?? CRAFT_HELP[0]!;
  const tickKey = (index: number) => `${recipe.id}:${index}`;

  const runStep = async (index: number) => {
    const result = await useCraftStore.getState().runCraftHelpStep(recipe.id, index);
    if (result.ok) setTicks((prev) => ({ ...prev, [tickKey(index)]: true }));
  };

  const runRemaining = async () => {
    for (let i = 0; i < recipe.steps.length; i++) {
      if (ticks[tickKey(i)]) continue;
      const result = await useCraftStore.getState().runCraftHelpStep(recipe.id, i);
      if (!result.ok) return;
      setTicks((prev) => ({ ...prev, [tickKey(i)]: true }));
    }
  };

  return (
    <div
      className="fixed top-12 right-2 z-[80] flex h-[min(36rem,calc(100vh-4rem))] w-[22rem] overflow-hidden rounded-lg border border-white/10 bg-[#12141c]/95 shadow-2xl backdrop-blur-md"
      role="dialog"
      aria-label="SWELL studio"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex w-36 shrink-0 flex-col gap-1 border-r border-white/10 p-2">
        {(["desk", "recipes", "rules"] as CraftHelpNav[]).map((id) => (
          <button
            key={id}
            type="button"
            className={cn(
              "rounded-md px-2 py-1.5 text-left text-[11px] uppercase tracking-[0.12em] text-white/70 hover:bg-white/10",
              nav === id && "bg-white/15 text-white",
            )}
            onClick={() => setNav(id)}
          >
            {id === "desk" ? "Desk" : id === "recipes" ? "Recipes" : "House rules"}
          </button>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2 border-b border-white/10 px-3 py-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">SWELL studio</p>
            <p className="text-[11px] text-white/70">Idea, then board. Export is a decision, not a default.</p>
          </div>
          <Button size="icon" variant="ghost" aria-label="Close studio help" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-width:thin]">
          {nav === "desk" &&
            CRAFT_HELP_DESK.map((item) => (
              <section key={item.title} className="mb-3">
                <h3 className="text-[10px] uppercase tracking-[0.14em] text-white/45">{item.title}</h3>
                <p className="mt-1 text-xs text-white/80">{item.body}</p>
              </section>
            ))}
          {nav === "rules" &&
            CRAFT_HELP_RULES.map((item) => (
              <section key={item.title} className="mb-3">
                <h3 className="text-[10px] uppercase tracking-[0.14em] text-white/45">{item.title}</h3>
                <p className="mt-1 text-xs text-white/80">{item.body}</p>
              </section>
            ))}
          {nav === "recipes" && (
            <>
              <div className="mb-3 flex flex-wrap gap-1">
                {CRAFT_HELP.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "rounded-md px-1.5 py-1 text-[10px] text-white/75 hover:bg-white/10",
                      item.id === recipe.id && "bg-white/15 text-white ring-1 ring-white/25",
                    )}
                    onClick={() => setRecipeId(item.id)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
              <p className="mb-2 text-xs text-white/70">{recipe.outcome}</p>
              <ol className="space-y-2">
                {recipe.steps.map((step, index) => (
                  <li key={step.title} className="rounded-md border border-white/10 p-2">
                    <p className="text-[11px] font-medium text-white">
                      {ticks[tickKey(index)] ? "Done · " : `${index + 1}. `}
                      {step.title}
                    </p>
                    <p className="mt-1 text-[11px] text-white/70">{step.body}</p>
                    {step.hint && <p className="mt-1 text-[10px] text-white/45">{step.hint}</p>}
                    {step.action && (
                      <Button size="sm" variant="secondary" className="mt-2 h-7 text-[11px]" onClick={() => void runStep(index)}>
                        Run this step
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
        {nav === "recipes" && (
          <div className="flex gap-1 border-t border-white/10 p-2">
            <Button size="sm" className="h-7 text-[11px]" onClick={() => void runRemaining()}>
              Run all remaining
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setTicks({})}>
              Reset ticks
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire CraftView**

In `client/src/components/craft/CraftView.tsx`:

1. Import `CircleHelp` from `lucide-react` (add to the existing lucide import).
2. Import `{ CraftHelp } from "./shell/CraftHelp"`.
3. Inside `CraftView`, add `const [helpOpen, setHelpOpen] = useState(false);` next to the other state.

4. Keyboard handler (the `useEffect` that already uses `isTypingTarget`):
   - After `if (isTypingTarget(event.target)) return;` add:

```ts
if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
  event.preventDefault();
  setHelpOpen(true);
  return;
}
```

   - This must run **even when `!state.doc`**. Move the `if (!state.doc) return;` to **after** the `?` handler.
   - In the existing Escape branch, after `endTextEdit` return, close help if open:

```ts
if (event.key === "Escape") {
  if (state.editingTextId) {
    state.endTextEdit();
    return;
  }
  if (helpOpen) {
    event.preventDefault();
    setHelpOpen(false);
    return;
  }
  state.select([]);
  state.setTool("select");
  return;
}
```

   Add `helpOpen` to the `useEffect` dependency array.

5. Empty state (`if (!doc)`): add a Help button in `EmptyState` `actions`:

```tsx
<Button variant="outline" onClick={() => setHelpOpen(true)} aria-label="Studio help">
  <CircleHelp />
  Help
</Button>
```

   Render `<CraftHelp open={helpOpen} onClose={() => setHelpOpen(false)} />` in that empty-state tree (inside the dropzone wrapper).

6. Document chrome: in the `ml-auto` button group, **before** the Undo button:

```tsx
<Button size="sm" variant="ghost" aria-label="Studio help" onClick={() => setHelpOpen(true)}>
  <CircleHelp />
  Help
</Button>
```

   Mount `<CraftHelp open={helpOpen} onClose={() => setHelpOpen(false)} />` as the last child of the document root wrapper (sibling of the top bar, not inside the canvas).

Do not put Help only on social mode; email mode uses the same `CraftView`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run server/__tests__/shared/craftHelp.test.ts`

Expected: PASS.

Also run: `npx vitest run server/__tests__/shared/craftMotion.test.ts`

Expected: PASS (existing file, no regressions).

- [ ] **Step 6: Build**

Run: `npm run build --ignore-scripts`

Expected: exit 0.

- [ ] **Step 7: Commit**

```powershell
git add client/src/components/craft/shell/CraftHelp.tsx client/src/components/craft/CraftView.tsx server/__tests__/shared/craftHelp.test.ts
git commit -m "feat: add SWELL studio help sheet to Craft"
```

---

### Task 4: Isla knowledgebase and CRAFT.md

**Files:**
- Modify: `docs/agentic-org/agents/MKT-2.md` (MotionNode table row ~678; feature-use checklist ~586; new section before §12 or as §12.8)
- Modify: `docs/CRAFT.md` (Tools & interaction, after the right-click bullet)
- Modify: `server/__tests__/shared/craftHelp.test.ts`

**Interfaces:**
- Consumes: recipe ids from Task 1
- Produces: Isla can name `shared/craftHelp.ts` and `hook-gif`; CRAFT.md mentions Help / `?`

- [ ] **Step 1: Write the failing tests**

Append to `server/__tests__/shared/craftHelp.test.ts`:

```ts
describe("Isla and CRAFT.md", () => {
  it("MKT-2 points at the studio recipes file", () => {
    const md = readFileSync("docs/agentic-org/agents/MKT-2.md", "utf8");
    expect(md).toContain("shared/craftHelp.ts");
    expect(md).toContain("hook-gif");
    expect(md).toContain("week-post");
    expect(md).not.toMatch(/v1 presets: Ledger Current \(FlowField\), Paper Sparks, Grain Breath, Corporate Ribbon/);
  });

  it("CRAFT.md documents studio help", () => {
    const md = readFileSync("docs/CRAFT.md", "utf8");
    expect(md).toMatch(/Studio help|SWELL studio/);
    expect(md).toMatch(/Help/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/craftHelp.test.ts`

Expected: FAIL — MKT-2 still has the four-preset MotionNode row.

- [ ] **Step 3: Edit MKT-2.md**

Replace the MotionNode table row (the line that starts `| MotionNode | Canvas2D living plate` and currently lists four v1 presets) with:

```
| MotionNode | Canvas2D living plate inside the node bitmap. 66 house presets in Atmosphere / Graphic devices / Structure / Occasional. Live cap 8. Overlay plates (Cinematic Hook Slam, Viral Hook Drop) use transparent backgrounds so they sit on atmosphere. Recipes: `shared/craftHelp.ts`. | Insert from the Motion inspector (adds a layer) or right-click the plate (replaces this look). Name it `Media frame` or `Visual` on week boards. Do not make it the default week visual. Email and Learn use the captured still. |
```

In **10.2 Craft file** checklist, after the pack-spawned bullet, add:

```
- [ ] A week that never produces a hook GIF or a spawned pack must point at `hook-gif` / `week-post` in `shared/craftHelp.ts` or an equivalent board spec. Otherwise the week is incomplete.
```

Insert a new subsection immediately before `### 12.1 What Craft is` (or after 12.7 if 12.1 is easier to find: add **12.8 Studio recipes**):

```
### 12.8 Studio recipes

Canonical file: `shared/craftHelp.ts`. Isla reads it. She does not rewrite recipes in this persona file.

Ids: `week-post` (social post + pack), `hook-gif` (glass + slam, human records GIF), `still-art` (vapor then capture still), `stack-layers` (inspector adds, right-click replaces), `email-letter` (600px letter, merge tags).

Laws: inspector adds a layer; right-click replaces this plate; hook slam and viral hook are transparent overlays; Vapor Drift is mist not ellipses; recipes never auto-export; no rates.

Shaun runs the same jobs from Help / `?` in SWELL. If live Craft and this file disagree, obey the live app and `shared/craftHelp.ts`.
```

Do not paste the full step lists into MKT-2.

- [ ] **Step 4: Edit CRAFT.md**

In `docs/CRAFT.md` under **Tools & interaction**, after the right-click bullet, add:

```
- **Studio help:** Help in the top bar (or `?` when not typing) opens SWELL studio. Recipes run on the live board (week post, hook GIF, artwork still, motion layers, email letter). Inspector click adds a motion layer; right-click a plate replaces that plate's look. Recipes never download PNG/GIF; you export yourself.
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run server/__tests__/shared/craftHelp.test.ts server/__tests__/shared/craftMotion.test.ts`

Expected: PASS both files.

- [ ] **Step 6: Commit**

```powershell
git add docs/agentic-org/agents/MKT-2.md docs/CRAFT.md server/__tests__/shared/craftHelp.test.ts
git commit -m "docs: point Isla and CRAFT.md at studio recipes"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| `shared/craftHelp.ts` source of truth | 1 |
| Five recipes with specified steps | 1 |
| Allowlist; no export/GIF/save/delete actions | 1 |
| `runCraftHelpStep` | 2 |
| Toast on missing motion plate | 2 |
| Help sheet UI, Run this step / Run all / Reset | 3 |
| Help button, `?`, Escape vs text edit | 3 |
| Help on empty board (ensureDoc) | 3 EmptyState button |
| Email mode included | 3 (same CraftView) |
| MKT-2 studio section, motion inventory, feature-use | 4 |
| CRAFT.md paragraph | 4 |
| Tests listed in spec | 1–4 |
| Non-goals (tours, chat, auto-GIF, persist ticks) | not tasked |

`runCraftHelpStep` is async in this plan because `newBlank` returns a Promise. That is the only spec sketch that had to change to be implementable.
