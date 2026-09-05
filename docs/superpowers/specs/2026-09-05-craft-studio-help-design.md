# Craft studio help (recipe runner)

Date: 2026-09-05
Status: draft for review
Repo: Nexus
Owner: Shaun Tuhey

## Goal

Give Shaun (and Isla) an in-Craft **studio help** that teaches the desk by running jobs on the live board: high-quality artwork, week posts, and GIFs. The same recipes are Isla's knowledge — she reads the module, she does not keep a second, stale inventory in her persona file.

User-facing editor remains SWELL. Help is a studio sheet, not a second app.

## Locked decisions

- **Approach:** recipe runner (option A) with a thin handbook index (option C). Not overlay tours. Not Ask-Isla chat.
- **Source of truth:** `shared/craftHelp.ts`. UI, store, tests, and Isla all read that file.
- **Interactive:** each step has copy plus an optional store action. **Run this step** / **Run all remaining**. Ticks are session-only.
- **Never auto-run:** export PNG/pack/formats, Record GIF, save, delete, close, or anything that leaves the browser as a file. Those steps are copy plus a “you click this control” hint.
- **No new API, no database, no persistence of help state.**
- **`?` opens help** when the focus is not a typing target (same `isTypingTarget` gate as Craft shortcuts).

## Non-goals

- Overlay / spotlight tours that highlight inspector DOM.
- In-Craft chat with Isla.
- Auto-download GIF or PNG.
- Persisting which steps were ticked.
- Physics-slider tutorials.
- A new Learn-hub course.
- Changing inspector-add vs right-click-replace behaviour (already shipped; help only explains it).

## Architecture

```
Help button / ? key
    → CraftHelp sheet (CraftView chrome)
         reads CRAFT_HELP from shared/craftHelp.ts
         Run this step / Run all remaining
              → store.runCraftHelpStep(recipeId, stepIndex)
                   allowlisted action → existing store methods
                   no action → copy only, tick
```

Isla: `docs/agentic-org/agents/MKT-2.md` **Studio recipes** section points at `shared/craftHelp.ts` and lists the five ids. She does not duplicate step lists in the persona file.

`docs/CRAFT.md` gets one **Studio help** paragraph so the module spec matches the desk.

## Data model

```ts
type CraftHelpAction =
  | { type: "ensureDoc"; mode: "blank" | "email-letter" }
  | { type: "applyTemplate"; templateId: string }
  | { type: "addMotion"; presetId: string }
  | { type: "replaceMotionPreset"; presetId: string }
  | { type: "addText"; style?: "heading" | "body" | "caption"; text?: string }
  | { type: "captureMotionStill" }
  | { type: "spawnPackPages" };

type CraftHelpStep = {
  title: string;
  body: string;
  action?: CraftHelpAction;
  hint?: string; // e.g. "You click Record GIF on the plate (right-click) or in the inspector."
};

type CraftHelpRecipe = {
  id: "week-post" | "hook-gif" | "still-art" | "stack-layers" | "email-letter";
  title: string;
  outcome: string;
  steps: CraftHelpStep[];
};

type CraftHelpNav = "desk" | "recipes" | "rules";
```

Allowlist is the `CraftHelpAction` union. Anything else (including `exportPng`, `exportPack`, `recordMotionGif`, `save`, `removeSelected`) is a test failure if it appears on a step `action`.

`ensureDoc`: if `doc` is null, `blank` calls `newBlank`; `email-letter` calls `applyTemplate("email-letter")` (600×900 Strata Layer Email). If a doc already exists, no-op.

## Recipes (v1)

### `week-post` — High-quality social post

Outcome: a branded board with named copy, a visual decision, and a spawned pack. Stops before export.

1. `ensureDoc` blank. Copy: week desk vs blank; Casey ammo then Isla copy; you do not invent rates.
2. `applyTemplate` `announce-post` (Introducer Post, 1080×1350). Copy: named slots (eyebrow, hook, body, CTA) are law.
3. `addMotion` `ledger-current` as the living plate option. Copy: still photography from Kit is also valid; do not stack every preset.
4. `spawnPackPages`. Copy: inspect story / square / OG. 9:16 safe zone.
5. No action. Hint: PNG / Export pack in the top bar. Blocked until marketing approve + compliance sign-off on week posts.

### `hook-gif` — Scroll-stop GIF

Outcome: atmosphere under a transparent hook slam, line typed, human records the GIF.

1. `ensureDoc` blank.
2. `addMotion` `liquid-glass-shift`. Copy: dark glass plate; sheen should move.
3. `addMotion` `cinematic-hook-slam`. Copy: inspector **adds** a layer; slam is a transparent overlay.
4. No action. Copy: double-click the slam, type the hook, click off. Hint: right-click the plate → Record GIF (or inspector). First frame must read as a still.

### `still-art` — Artwork still

Outcome: one living plate captured into the kit as photography.

1. `ensureDoc` blank.
2. `addMotion` `vapor-drift`. Copy: mist, not ellipses. Other atmosphere plates are valid after this.
3. `captureMotionStill`. Copy: the still hangs as a kit asset; email and Learn use the still, not the live sim.

### `stack-layers` — Motion as layers

Outcome: two plates, both live; overlay readable on atmosphere.

1. No action. Copy: inspector click **adds** a new plate. Right-click a plate **replaces that plate's look**. Same look on the selected plate replays.
2. `addMotion` `liquid-glass-shift`.
3. `addMotion` `cinematic-hook-slam`. Copy: slam / viral hook are transparent. Opaque cards cover what is underneath.
4. No action. Copy: live cap is 8. Send back to grab the plate underneath.

### `email-letter` — Email from the same file

Outcome: 600px letter, merge tags, no living WebGL.

1. `ensureDoc` `email-letter`.
2. No action. Copy: merge-tag chips in the inspector. Same document, calmer board. No Three.js. Capture stills if a motion plate is present.
3. No action. Hint: email HTML export lives on the campaign, not as a social PNG.

## UI

- **Help** text button in the Craft top bar (social and email modes), left of undo, `aria-label="Studio help"`.
- Sheet: fixed right, above the inspector, width ~22rem, max-height viewport minus chrome, same dark treatment as `CraftContextMenu` (`bg-[#12141c]/95`, `z-[80]`, scrollable). Canvas stays visible.
- Header: “SWELL studio” and the line *Idea, then board. Export is a decision, not a default.*
- Left rail ~160px: Desk · Recipes · House rules (`CraftHelpNav`).
- **Desk:** what Craft is (canvas compositor + week pipeline); social vs email; motion is a node; overlay vs atmosphere; compliance gate.
- **Recipes:** the five jobs; selecting one shows outcome + steps.
- **House rules:** Strata packages, does not lend; no rates/APR; packager line; inspector adds / right-click replaces; overlays transparent; vapor is mist; no auto-publish.
- Each step: title, body, **Run this step** if `action` is set, hint if present, tick after a successful run this session.
- Footer: **Run all remaining** · **Reset ticks**.
- Close: sheet X, Escape (does not steal Escape from text edit; if `editingTextId` is set, Escape still ends edit first).

## Store

```ts
runCraftHelpStep: (recipeId: string, stepIndex: number) => { ok: boolean; error?: string }
```

- Looks up recipe/step. Missing → `{ ok: false, error: "unknown step" }`.
- No action → `{ ok: true }`.
- Action: call the matching existing method. On throw or known guard (no doc after ensureDoc failed) → toast + `{ ok: false, error }`.
- `Run all remaining` is UI-only: calls `runCraftHelpStep` in order, skips already ticked, stops on first `{ ok: false }`.

No new Zustand fields required. Tick state lives in `CraftHelp` React state.

## Error handling

- No document and `ensureDoc` cannot create one: toast, stop.
- Compliance lock does not apply to recipe actions (they do not export). Export hints mention the lock.
- `captureMotionStill` with no selected motion plate: toast “Select a motion plate first”; `still-art` step 3 should select the plate it just added (addMotion already selects).
- `?` while typing: ignored.
- Help open during text edit: allowed; Run this step still works.

## Isla knowledgebase

Edit `docs/agentic-org/agents/MKT-2.md`:

1. New **Studio recipes** section: canonical file `shared/craftHelp.ts`; the five ids and one-line jobs; laws (inspector adds, right-click replaces, overlays transparent, vapor is mist, no auto-export, no rates).
2. Replace the MotionNode row that still says “v1 presets: Ledger Current, Paper Sparks, Grain Breath, Corporate Ribbon” with: 66 house presets in Atmosphere / Graphic devices / Structure / Occasional; live cap 8; overlay plates (Hook Slam, Viral Hook) use transparent backgrounds; recipes in `shared/craftHelp.ts`.
3. Feature-use law: a week that never produces a hook GIF or a spawned pack, and cannot point at `hook-gif` / `week-post` or an equivalent board spec, is incomplete.

`docs/CRAFT.md`: one paragraph under tools — Help / `?` opens SWELL studio; recipes run on the board; inspector vs right-click.

## Files

| File | Role |
|---|---|
| `shared/craftHelp.ts` | Recipes, nav copy for Desk/Rules, action union |
| `client/src/components/craft/shell/CraftHelp.tsx` | Sheet UI |
| `client/src/components/craft/CraftView.tsx` | Help button, `?` key, mount sheet |
| `client/src/components/craft/store.ts` | `runCraftHelpStep` |
| `server/__tests__/shared/craftHelp.test.ts` | Shape, allowlist, chrome, Isla pointer |
| `docs/agentic-org/agents/MKT-2.md` | Studio recipes + motion inventory |
| `docs/CRAFT.md` | Help mention |

## Tests

`server/__tests__/shared/craftHelp.test.ts`:

- Every recipe id is unique and one of the five.
- Every recipe has a title, outcome, and ≥1 step.
- Every `action.type` is in the allowlist union.
- No step action is `exportPng`, `exportPack`, `recordMotionGif`, `save`, or `removeSelected`.
- `hook-gif` adds `liquid-glass-shift` then `cinematic-hook-slam`.
- `stack-layers` copy mentions inspector adds and right-click replaces.
- Store source contains `runCraftHelpStep`.
- CraftView contains `CraftHelp` and a `?` handler that bails on `isTypingTarget`.
- MKT-2 contains `shared/craftHelp.ts` and `hook-gif`.
- Existing `craftMotion.test.ts` still passes.

## Success

Shaun can open Help, run **Hook GIF**, see glass then slam land as two layers, type a line, and know to Record GIF himself. Isla, given `shared/craftHelp.ts`, describes the same job without quoting four-preset motion history.
