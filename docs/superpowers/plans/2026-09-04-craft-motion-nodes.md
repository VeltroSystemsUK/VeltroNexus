# Craft Live Motion Nodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Craft’s living-plate `MotionNode` so Isla can insert any of 15 house presets, run the sim inside the node bitmap, and export PNG + GIF without breaking week compose, brand, email, or compliance.

**Architecture:** Offscreen canvas per live node, blit into the existing page `drawFrame` loop. Shared 2D kernel with category draw functions; After-hours Warp lazy-loads three.js from cdnjs. Validator rejects extra keys. `gifenc` encodes GIFs. Week templates stay photo unless the user inserts motion.

**Tech Stack:** TypeScript, Vitest, existing Craft canvas renderer, Zustand `store.ts`, `gifenc`, cdnjs three.js r160 (not an npm dep). No workers. No new state library.

**Spec:** `docs/superpowers/specs/2026-09-04-craft-motion-nodes-design.md`

## Global Constraints

- Schema stays `quires.craft.v1`. No second document format
- Follow `client/src/components/craft/lib/`, not `client/lib/`
- Sim runs inside the node bitmap, not a page-level WebGL overlay
- At most two live MotionNodes per page; extras freeze (runtime override, do not rewrite saved `preview`)
- `CustomShaderDistortion` ⇒ ThreeJS / webgl + cdnjs; load only when a live Warp node ticks
- House palettes: ink `#1A1D21`, paper `#F7F5F1`, blue `#2F5199`. Gold `#C69123` only as a needle, ≤10% of the bitmap, and only if the schema already names it
- `respectReducedMotion: true` on every house preset; `prefers-reduced-motion` draws one frame and does not persist
- Week `canExportPost()` still gates export. No autoPublish
- No purple defaults, no glass-orb, no handshake stock
- Default week templates stay photo/object
- Windows PowerShell: `git commit -m "message"` (no bash heredocs)
- There is already uncommitted WIP (`motion.ts`, `motionSchema.ts`, `gifEncode.ts`, compositor hooks, a four-preset inspector). **Do not revert it.** Grow it to this spec. Tests in `server/__tests__/shared/craftMotion.test.ts` that lock four categories / no `domTarget` / no Three.js are wrong relative to the spec — replace them in Task 1

## File map

- Modify: `client/src/components/craft/lib/motionSchema.ts` — 15 categories, `domTarget`, ThreeJS engine, clamps, `hashMotionSchema`
- Create: `client/src/components/craft/lib/motionPresets.ts` — 15 presets, groups, vibe matcher
- Create: `client/src/components/craft/lib/motionRuntime.ts` — offscreen registry, tick, capture, live cap, 2D draw
- Create: `client/src/components/craft/lib/motionThree.ts` — lazy Warp
- Modify: `client/src/components/craft/lib/motion.ts` — thin re-export barrel only
- Modify: `client/src/components/craft/lib/gifEncode.ts` — wrap `gifenc`, delete hand-rolled LZW
- Modify: `client/src/components/craft/lib/types.ts` — `hook-turn` / `stamp-down`, optional `CraftAsset.source` / `metadata`
- Modify: `client/src/components/craft/lib/looks.ts` — `applyFrameShape` on motion
- Modify: `client/src/components/craft/lib/renderer.ts` — blit bitmap; new animation types
- Modify: `client/src/components/craft/lib/composePost.ts` — frame motion visual slots
- Modify: `client/src/components/craft/lib/adapt.ts` — story density `* 0.65` when `height/width >= 1.5`
- Modify: `client/src/components/craft/lib/export.ts` — 4s × 12fps page GIF; node-only record helper
- Modify: `client/src/components/craft/lib/brand.ts` — already remaps; keep gold out of Atmosphere
- Modify: `client/src/components/craft/store.ts` — insert box/name, capture metadata, `recordMotionGif`
- Modify: `client/src/components/craft/CraftView.tsx` — grouped picker, Advanced JSON, Record GIF, Describe a current, HUD
- Modify: `docs/CRAFT.md` — document the motion node
- Modify: `package.json` — add `gifenc`
- Modify: `server/__tests__/shared/craftMotion.test.ts` — spec-aligned tests
- Modify: `server/__tests__/shared/craftLooks.test.ts` — `hook-turn` / `stamp-down` do not break existing six

---

### Task 1: Schema contract (15 categories, domTarget, ThreeJS)

**Files:**
- Modify: `client/src/components/craft/lib/motionSchema.ts`
- Modify: `server/__tests__/shared/craftMotion.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces:
  - `MOTION_CATEGORIES` — the 15 spec names in spec order
  - `MOTION_SCHEMA_ID = "WebAnimationIntegrationSchema"`
  - `MOTION_SCHEMA_VERSION = "1.0.0"`
  - `THREE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js"`
  - `DOM_TARGET` house object (selector `#motion-node`, `createIfMissing: true`, `tag: "canvas"`, `positioning: "absolute"`, `zIndex: 0`, `pointerEvents: "none"`, `fit: "cover"`)
  - `type MotionEngine = { library: "VanillaCanvas2D"; renderContext: "2d" } | { library: "ThreeJS"; renderContext: "webgl"; cdn: string }`
  - `type MotionFps = 24 | 30 | 60 | 120`
  - `MotionSchema` includes required `domTarget`, `engine` as `MotionEngine`
  - `LEDGER_CURRENT: MotionSchema` with `domTarget: DOM_TARGET`
  - `validateMotionSchema(raw: unknown): { ok: boolean; error?: string; schema: MotionSchema }`
  - `hashMotionSchema(schema: MotionSchema): string`

- [ ] **Step 1: Write the failing tests**

In `server/__tests__/shared/craftMotion.test.ts` replace the “four 2D categories / no Three.js / no domTarget” cases with:

```ts
it("keeps a MotionNode and its schema through normalizeDocument", () => {
  const node = makeMotionNode({ name: "Media frame", x: 40, y: 40, width: 640, height: 400 });
  const doc = normalizeDocument(JSON.parse(JSON.stringify(motionDoc(node))));
  const next = doc.pages[0]!.nodes[0];
  expect(next?.type).toBe("motion");
  if (next?.type !== "motion") return;
  expect(next.schema.category).toBe("FlowField");
  expect(next.schema.domTarget.tag).toBe("canvas");
  expect(next.schema.visual.palette).toEqual(LEDGER_CURRENT.visual.palette);
});

it("falls back to Ledger Current when the schema is illegal", () => {
  const result = validateMotionSchema({
    schemaId: "WebAnimationIntegrationSchema",
    version: "1.0.0",
    category: "Galaxy",
    extra: true,
  });
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/extra keys|illegal/i);
  expect(result.schema.category).toBe("FlowField");
});

it("accepts the 15 locked categories and requires ThreeJS for CustomShaderDistortion", () => {
  expect(MOTION_CATEGORIES).toEqual([
    "ParticleSystem",
    "FlowField",
    "SineWaveRibbon",
    "CustomShaderDistortion",
    "PerspectiveGrid",
    "StampPulse",
    "RedactSweep",
    "GrainField",
    "NetworkGraph",
    "TypeKinetic",
    "InkBleed",
    "LightLeak",
    "MetaballGoo",
    "DataTicker",
    "VoronoiShatter",
  ]);
  const warp = validateMotionSchema({
    ...LEDGER_CURRENT,
    category: "CustomShaderDistortion",
    engine: { library: "VanillaCanvas2D", renderContext: "2d" },
  });
  expect(warp.ok).toBe(false);
  const ok = validateMotionSchema({
    ...LEDGER_CURRENT,
    category: "CustomShaderDistortion",
    engine: { library: "ThreeJS", renderContext: "webgl", cdn: THREE_CDN },
  });
  expect(ok.ok).toBe(true);
  expect(ok.schema.engine.library).toBe("ThreeJS");
});

it("clamps density and never injects gold into Ledger Current", () => {
  const next = validateMotionSchema({
    ...LEDGER_CURRENT,
    visual: { ...LEDGER_CURRENT.visual, opacity: 9, grain: 2 },
    physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 99999, speed: 99 },
  });
  expect(next.ok).toBe(true);
  expect(next.schema.physicsAndMath.densityCount).toBe(4000);
  expect(next.schema.physicsAndMath.speed).toBe(4);
  expect(next.schema.visual.opacity).toBe(1);
  expect(next.schema.visual.grain).toBeLessThanOrEqual(0.4);
  expect(next.schema.visual.palette.join(" ")).not.toMatch(/#C69123/i);
});
```

Export `THREE_CDN` from `motion.ts` barrel (or import from `motionSchema` in the test).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts`

Expected: FAIL — `MOTION_CATEGORIES` still length 4; Ledger Current has no `domTarget`; Warp with VanillaCanvas2D currently may coerce instead of reject.

- [ ] **Step 3: Expand `motionSchema.ts`**

Keep `ALLOWED_ROOT` as `schemaId, version, meta, category, engine, domTarget, visual, physicsAndMath, interactionRules, performance`. Extra root keys ⇒ `ok: false`, schema `LEDGER_CURRENT`.

`MOTION_CATEGORIES` = the 15 names above.

`MotionSchema.engine`:
- `VanillaCanvas2D` ⇒ `{ library: "VanillaCanvas2D", renderContext: "2d" }`
- `ThreeJS` ⇒ `{ library: "ThreeJS", renderContext: "webgl", cdn: THREE_CDN }` (ignore other CDN hosts; rewrite to `THREE_CDN`)

If `category === "CustomShaderDistortion"` and library is not `ThreeJS`, `ok: false`.

If `category === "FlowField"` and noise is not `Perlin` or `Simplex`, coerce to `Simplex`.

Clamps: density 8–4000, friction 0–1, speed 0–4, amplitude 0–200, frequency 0–8, octaves 1–6, timestep 0.008–0.05, opacity 0–1, grain 0–0.4, influenceRadius 0–800, strength 0–4, maxDpr 1–2, fpsCap `24|30|60|120`.

`LEDGER_CURRENT` must include `domTarget: DOM_TARGET`. Runtime still does not mount a DOM canvas.

```ts
export function hashMotionSchema(schema: MotionSchema): string {
  const json = JSON.stringify(schema);
  let h = 5381;
  for (let i = 0; i < json.length; i++) h = ((h << 5) + h) ^ json.charCodeAt(i);
  return (h >>> 0).toString(16);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts`

Expected: PASS. Existing compositor / live-cap / email tests still pass.

- [ ] **Step 5: Commit**

```powershell
git add client/src/components/craft/lib/motionSchema.ts server/__tests__/shared/craftMotion.test.ts
git commit -m "feat: lock Craft motion schema to 15 categories"
```

---

### Task 2: Fifteen house presets and vibe matcher

**Files:**
- Create: `client/src/components/craft/lib/motionPresets.ts`
- Modify: `client/src/components/craft/lib/motion.ts` — re-export presets from here; stop defining them in `motionSchema.ts` (leave `LEDGER_CURRENT` in schema)
- Modify: `server/__tests__/shared/craftMotion.test.ts`

**Interfaces:**
- Consumes: `LEDGER_CURRENT`, `MotionSchema`, `THREE_CDN`, `DOM_TARGET` from `motionSchema.ts`
- Produces:
  - `type MotionPresetGroup = "Atmosphere" | "Graphic devices" | "Structure" | "Occasional"`
  - `type MotionPreset = { id: string; name: string; group: MotionPresetGroup; schema: MotionSchema }`
  - `MOTION_PRESET_GROUPS: MotionPresetGroup[]`
  - `MOTION_PRESETS: MotionPreset[]` length 15
  - `presetById(id: string): MotionPreset`
  - `matchMotionPreset(phrase: string): string` — returns a preset id

- [ ] **Step 1: Write the failing tests**

```ts
import { MOTION_PRESETS, matchMotionPreset, presetById } from "@/components/craft/lib/motionPresets";

it("ships 15 grouped presets with vibe strings", () => {
  expect(MOTION_PRESETS.map((p) => p.id)).toEqual([
    "ledger-current",
    "paper-sparks",
    "grain-breath",
    "after-hours-warp",
    "stamp-pulse",
    "redact-sweep",
    "ink-bleed",
    "light-leak",
    "corporate-ribbon",
    "perspective-grid",
    "network-map",
    "hook-turn",
    "ledger-ticker",
    "goo-merge",
    "shatter-plate",
  ]);
  expect(MOTION_PRESETS.every((p) => p.schema.meta?.vibe && p.schema.domTarget.tag === "canvas")).toBe(true);
  expect(presetById("grain-breath").schema.category).toBe("GrainField");
  expect(presetById("after-hours-warp").schema.engine.library).toBe("ThreeJS");
  expect(presetById("ledger-ticker").schema.visual.palette.join(" ")).not.toMatch(/#C69123/i);
});

it("maps vibe language onto locked preset ids", () => {
  expect(matchMotionPreset("liquid wind")).toBe("ledger-current");
  expect(matchMotionPreset("glass warp")).toBe("after-hours-warp");
  expect(matchMotionPreset("moody starry sparks")).toBe("paper-sparks");
  expect(matchMotionPreset("clean wave ribbon")).toBe("corporate-ribbon");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts`

Expected: FAIL — module missing / only four presets / Grain Breath is still `ParticleSystem`.

- [ ] **Step 3: Implement presets**

Each preset spreads `LEDGER_CURRENT` then overrides `meta`, `category`, `engine` (Warp only), `visual`, `physicsAndMath`, `interactionRules` per the spec table.

Musts:
- Atmosphere palettes = ink / blue / paper. No gold
- `grain-breath` category `GrainField`, almost still (speed ≤ 0.1, grain ≥ 0.1)
- `after-hours-warp` engine ThreeJS + `THREE_CDN`
- `stamp-pulse` / `light-leak` may include `#C69123` in palette (needle only)
- `redact-sweep` trigger none; palette may include `#C91B25` for the bar, never writes copy
- `ledger-ticker` no `%` / `APR` / `rate` / `loan` / `approved` in `meta.vibe` or title
- `hook-turn` category `TypeKinetic`
- `perspective-grid` trigger `scroll`
- `shatter-plate` trigger `click`
- `corporate-ribbon` trigger `none`

`matchMotionPreset`: lowercase the phrase; score each preset by hits in `meta.vibe` plus this keyword table; return the highest-scoring id, default `ledger-current`.

```
liquid|wind|current|silk|smoke → ledger-current
moody|starry|dust|sparks → paper-sparks
grain|film|tooth → grain-breath
distortion|glass|heat|warp → after-hours-warp
stamp|slam|seal → stamp-pulse
redact|bar|myth → redact-sweep
letterpress|bleed → ink-bleed
leak|flare → light-leak
clean|wave|ribbon|flag → corporate-ribbon
grid|retro|city → perspective-grid
network|introducer → network-map
hook|kinetic|word → hook-turn
ticker|numerals|ledger → ledger-ticker
goo|blob|merge → goo-merge
shatter|crack → shatter-plate
```

Move `MOTION_PRESETS` out of `motionSchema.ts`. `motion.ts` re-exports `MOTION_PRESETS` from `motionPresets.ts` so CraftView keeps compiling.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add client/src/components/craft/lib/motionPresets.ts client/src/components/craft/lib/motionSchema.ts client/src/components/craft/lib/motion.ts server/__tests__/shared/craftMotion.test.ts
git commit -m "feat: add 15 Craft motion presets and vibe map"
```

---

### Task 3: Offscreen 2D runtime (FlowField, ParticleSystem, SineWaveRibbon)

**Files:**
- Create: `client/src/components/craft/lib/motionRuntime.ts`
- Modify: `client/src/components/craft/lib/motion.ts` — re-export `makeMotionNode`, `liveMotionIds`, `resolveMotionPreview`, `drawMotionNode`, `remapMotionSchema` from runtime
- Modify: `client/src/components/craft/lib/renderer.ts` — keep calling `drawMotionNode` (blit already happens inside runtime)
- Modify: `server/__tests__/shared/craftMotion.test.ts`

**Interfaces:**
- Consumes: `MotionSchema`, `validateMotionSchema`, `LEDGER_CURRENT`, `hashMotionSchema`
- Produces:
  - `makeMotionNode(partial?: MotionDraft): MotionNode` — default name `"Motion"`, default preview `"live"`
  - `liveMotionIds(nodes, selectedIds, cap = 2): Set<string>`
  - `resolveMotionPreview(node, prefersReduced): MotionPreview`
  - `nodeOnscreen(node, view: { panX: number; panY: number; zoom: number; hostW: number; hostH: number }): boolean` — AABB vs host; implements `pauseOffscreen`
  - `motionBitmap(node, assets, opts): HTMLCanvasElement` — CSS pixels × `min(dpr, maxDpr)`
  - `drawMotionNode(ctx, node, assets, opts)` — `ctx.drawImage(bitmap, node.x, node.y, node.width, node.height)`
  - `captureMotionFrame(node, assets): { dataUrl: string; width: number; height: number }`
  - `remapMotionSchema(schema, fromColors, toColors): MotionSchema`
  - `opts: { live: boolean; reduced: boolean; pointer?: { x: number; y: number } | null; atMs: number; dpr?: number }`

- [ ] **Step 1: Write the failing tests**

```ts
it("makeMotionNode defaults to Ledger Current named Motion", () => {
  const node = makeMotionNode();
  expect(node.name).toBe("Motion");
  expect(node.schema.category).toBe("FlowField");
  expect(node.preview).toBe("live");
});

it("liveMotionIds prefers selection and caps at two", () => {
  const nodes = [0, 1, 2].map((i) => makeMotionNode({ id: `m${i}`, preview: "live" }));
  expect(liveMotionIds(nodes, ["m2"])).toEqual(new Set(["m2", "m0"]));
});
```

Keep the existing reduced-motion test.

If `HTMLCanvasElement` is missing in Vitest, skip bitmap tests; do not add jsdom just for this task. Runtime must still be importable in Node (guard `typeof document === "undefined"`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts`

Expected: FAIL — `makeMotionNode` currently names the node `"Media frame"`.

- [ ] **Step 3: Move drawing into `motionRuntime.ts` as an offscreen blit**

Registry: `Map<nodeId, { canvas: HTMLCanvasElement; key: string; particles: Particle[] }>`.

`motionBitmap`:
1. If `typeof document === "undefined"` throw is not allowed — return a dummy by skipping; `drawMotionNode` no-ops in Node
2. Size `round(width * dpr)` × `round(height * dpr)`, `ctx.setTransform(dpr,0,0,dpr,0,0)`
3. Draw in **local** coordinates (0,0)–(width,height), not page x/y
4. Freeze path: if `!live || preview !== "live"`, draw `capturedAssetId` if present, else one still frame at `atMs = 0`
5. FlowField / ParticleSystem: keep the existing filament look (paper ground, ink + blue strokes, grain). Mouse: `pointer` is page-space; convert to local `pointer.x - node.x`
6. SineWaveRibbon: keep the existing band strokes

`drawMotionNode` then `ctx.drawImage(bitmap, node.x, node.y, node.width, node.height)` so mask/shadow/opacity applied by `drawNode` still wrap the blit.

Delete the in-place page-space drawing from `motion.ts`. Leave `motion.ts` as re-exports so CraftView/store/renderer imports keep working.

`makeMotionNode` default name `"Motion"` (callers that need the visual slot pass `name: "Media frame"`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts server/__tests__/shared/craftLooks.test.ts server/__tests__/shared/craftCompose.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add client/src/components/craft/lib/motionRuntime.ts client/src/components/craft/lib/motion.ts client/src/components/craft/lib/renderer.ts server/__tests__/shared/craftMotion.test.ts
git commit -m "feat: run Craft motion sims on an offscreen bitmap"
```

---

### Task 4: Remaining 2D category draws

**Files:**
- Modify: `client/src/components/craft/lib/motionRuntime.ts`
- Modify: `server/__tests__/shared/craftMotion.test.ts`

**Interfaces:**
- Consumes: `motionBitmap` switch on `schema.category`
- Produces: draw functions for `GrainField`, `StampPulse`, `RedactSweep`, `InkBleed`, `LightLeak`, `PerspectiveGrid`, `NetworkGraph`, `TypeKinetic`, `DataTicker`, `MetaballGoo`, `VoronoiShatter`
- `drawMotionNode` accepts optional `hooks?: { hook1?: string; hook2?: string }` for TypeKinetic. Renderer passes sibling text named `Hook 1` / `Hook 2`. **Never** call `updateNode`

- [ ] **Step 1: Write the failing test**

```ts
it("TypeKinetic reads hook copy and DataTicker never emits rate claims", () => {
  expect(presetById("ledger-ticker").schema.meta?.vibe).not.toMatch(/apr|rate|loan|approved|%/i);
  expect(presetById("hook-turn").schema.category).toBe("TypeKinetic");
  expect(presetById("redact-sweep").schema.category).toBe("RedactSweep");
});
```

Looks are visual; do not snapshot canvases. The test locks copy/category contracts. Implement draws so a live tick of each category does not throw (wrap each branch; default to FlowField filaments if unknown).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts -t TypeKinetic`

Expected: FAIL if ticker vibe still generic, or PASS if Task 2 already set it — then this task is draw-only. If the test already passes, still implement the draws.

- [ ] **Step 3: Implement category draws (paper/ink/blue, no glitter)**

| Category | Look |
|---|---|
| GrainField | sparse ink dots, almost still |
| StampPulse | circle scale 1.18→1 once per loop; optional gold ring, gold fill area ≤10% (stroke only) |
| RedactSweep | `#C91B25` bar wiping across; no text |
| InkBleed | fat ink strokes with slight offset duplicate at 0.15 alpha |
| LightLeak | one gold-ish wedge, area small |
| PerspectiveGrid | blue hairlines to a vanishing point; scroll uses `atMs` |
| NetworkGraph | 12–20 nodes, thin ink edges |
| TypeKinetic | draw `hooks.hook1` then crossfade/stack `hooks.hook2` in Unbounded; if missing, draw “HOOK” |
| DataTicker | JetBrains Mono strings `LEDGER` / `ON TIME` / `FILE 04` / ISO date only |
| MetaballGoo | overlapping ink ellipses, `source-over` |
| VoronoiShatter | cracked cells; on `click` with pointer, expand a cell |

Unknown category → FlowField filaments (never throw).

Renderer: when drawing a motion node, collect page text nodes:

```ts
const hook1 = page.nodes.find((n) => n.type === "text" && n.name === "Hook 1");
const hook2 = page.nodes.find((n) => n.type === "text" && n.name === "Hook 2");
drawMotionNode(ctx, node, assets, { ..., hooks: { hook1: hook1?.text, hook2: hook2?.text } });
```

Pass `page` into `drawNode` or compute hooks in `drawFrame` and put them on `DrawOptions.motion.hooks`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts server/__tests__/shared/craftLooks.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add client/src/components/craft/lib/motionRuntime.ts client/src/components/craft/lib/renderer.ts server/__tests__/shared/craftMotion.test.ts
git commit -m "feat: draw the remaining Craft 2D motion categories"
```

---

### Task 5: After-hours Warp (lazy Three.js)

**Files:**
- Create: `client/src/components/craft/lib/motionThree.ts`
- Modify: `client/src/components/craft/lib/motionRuntime.ts`
- Modify: `server/__tests__/shared/craftMotion.test.ts`

**Interfaces:**
- Consumes: `THREE_CDN`
- Produces:
  - `ensureThree(): Promise<void>` — inject script once
  - `drawWarp(canvas: HTMLCanvasElement, node: MotionNode, atMs: number): boolean` — false on failure
  - Runtime calls this **only** when `category === "CustomShaderDistortion"` and the node is live. Dynamic `import("./motionThree.ts")`

- [ ] **Step 1: Write the failing tests**

```ts
import { readFileSync } from "node:fs";
import { THREE_CDN } from "@/components/craft/lib/motionSchema";

it("does not import three.js from the 2D runtime module", () => {
  const runtime = readFileSync("client/src/components/craft/lib/motionRuntime.ts", "utf8");
  expect(runtime).not.toMatch(/cdnjs\.cloudflare\.com\/ajax\/libs\/three/);
  expect(runtime).toMatch(/import\("\.\/motionThree"/);
  const three = readFileSync("client/src/components/craft/lib/motionThree.ts", "utf8");
  expect(three).toContain(THREE_CDN);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts -t "does not import three"`

Expected: FAIL — `motionThree.ts` missing.

- [ ] **Step 3: Implement lazy Warp**

`motionThree.ts`:
- `ensureThree` appends `<script src=THREE_CDN>` once if `window.THREE` is missing; reject on error
- Draw a paper-coloured plane with a mild ink/blue UV warp (not a cosmic tunnel). Copy GL canvas into the node’s 2D bitmap via `drawImage`
- On failure return `false`; runtime freezes last frame / paper fill. Do not throw

`motionRuntime.ts` Warp branch:

```ts
if (schema.category === "CustomShaderDistortion" && !freeze) {
  void import("./motionThree").then((mod) => {
    void mod.ensureThree().then(() => mod.drawWarp(canvas, node, opts.atMs));
  }).catch(() => {});
  // blit whatever is already on the offscreen canvas (paper still until GL lands)
}
```

Dispose GL when the node leaves `liveMotionIds` (delete registry entry + `mod.dispose(node.id)` if you add it). Never more than one GL context.

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add client/src/components/craft/lib/motionThree.ts client/src/components/craft/lib/motionRuntime.ts server/__tests__/shared/craftMotion.test.ts
git commit -m "feat: lazy-load Three.js only for Craft Warp"
```

---

### Task 6: Timeline extras `hook-turn` and `stamp-down`

**Files:**
- Modify: `client/src/components/craft/lib/types.ts` — `AnimationType`
- Modify: `client/src/components/craft/lib/renderer.ts` — `evaluateAnimation`
- Modify: `client/src/components/craft/lib/looks.ts` — add to `IMAGE_MOTIONS` so the picker can set them
- Modify: `server/__tests__/shared/craftLooks.test.ts`

**Interfaces:**
- Consumes: existing `evaluateAnimation(spec, atMs): AnimTransform`
- Produces: `hook-turn` and `stamp-down` transforms; original six unchanged

- [ ] **Step 1: Write the failing tests**

Append to `craftLooks.test.ts`:

```ts
import { evaluateAnimation } from "@/components/craft/lib/renderer";

it("keeps the original six motion types and adds hook-turn and stamp-down", () => {
  const fade = evaluateAnimation({ type: "fadeIn", duration: 700, delay: 0 }, 0);
  expect(fade.opacity).toBe(0);
  const done = evaluateAnimation({ type: "fadeIn", duration: 700, delay: 0 }, 800);
  expect(done.opacity).toBe(1);

  const turn0 = evaluateAnimation({ type: "hook-turn", duration: 900, delay: 0 }, 0);
  expect(turn0.opacity).toBeLessThan(1);
  const turn1 = evaluateAnimation({ type: "hook-turn", duration: 900, delay: 0 }, 900);
  expect(turn1.opacity).toBe(1);

  const slam0 = evaluateAnimation({ type: "stamp-down", duration: 420, delay: 0 }, 0);
  expect(slam0.scaleX).toBeGreaterThan(1);
  const slam1 = evaluateAnimation({ type: "stamp-down", duration: 420, delay: 0 }, 500);
  expect(slam1.scaleX).toBe(1);
  expect(slam1.scaleY).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/craftLooks.test.ts -t hook-turn`

Expected: FAIL — `evaluateAnimation` returns IDENTITY for unknown types.

- [ ] **Step 3: Implement**

`AnimationType` add `"hook-turn" | "stamp-down"`.

`hook-turn`: from 0–duration, opacity 0→1 and `dx` from −24→0 (eased cubic). After duration, IDENTITY. (The TypeKinetic bitmap does the word swap; this is the overlay on the text node.)

`stamp-down`: local 0 → scale 1.18; ease to 1 by duration; after duration hold IDENTITY (scale 1).

`IMAGE_MOTIONS` append `{ id: "hook-turn", label: "Hook turn" }`, `{ id: "stamp-down", label: "Stamp down" }` and durations in `MOTION_MS` (900 / 420).

`applyNodeMotion` already writes `animation.type` from `ImageMotionId` — extend that type from the new ids.

Unknown animation types still coerce to `"none"` in `normalizeNode` unless they are in the union.

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/__tests__/shared/craftLooks.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add client/src/components/craft/lib/types.ts client/src/components/craft/lib/renderer.ts client/src/components/craft/lib/looks.ts server/__tests__/shared/craftLooks.test.ts
git commit -m "feat: add hook-turn and stamp-down Craft animations"
```

---

### Task 7: Compositor gaps (frame, spawn density, capture metadata)

**Files:**
- Modify: `client/src/components/craft/lib/looks.ts` — `applyFrameShape(node: ImageNode | MotionNode, id)`
- Modify: `client/src/components/craft/lib/composePost.ts` — motion visual slot gets frame + shadow
- Modify: `client/src/components/craft/lib/adapt.ts` — `height/width >= 1.5` ⇒ density `* 0.65` (replace the current `> 1.4` / `* 0.7`)
- Modify: `client/src/components/craft/lib/types.ts` — `CraftAsset.source?`, `metadata?`; preserve on normalize
- Modify: `client/src/components/craft/store.ts` — capture writes `source: "motion-capture"` and `metadata.schemaHash`
- Modify: `server/__tests__/shared/craftMotion.test.ts`
- Modify: `server/__tests__/shared/craftLooks.test.ts` if frame tests need a motion node

**Interfaces:**
- Consumes: `applyFrameShape`, `applyNodeShadow`, `hashMotionSchema`, `adaptPage`
- Produces: spec behaviour below

- [ ] **Step 1: Write the failing tests**

```ts
import { adaptPage } from "@/components/craft/lib/adapt";
import { applyCreativeDirection, creativeDirectionFor } from "@/components/craft/lib/composePost";
import { applyFrameShape } from "@/components/craft/lib/looks";
import { generateWeek } from "@shared/craftQueue";

it("applyCreativeDirection frames a motion visual slot without swapping category", () => {
  const post = generateWeek("2026-08-31")[0]!;
  const node = makeMotionNode({ name: "Media frame", width: 400, height: 300 });
  const doc = applyCreativeDirection(motionDoc(node), post);
  const next = doc.pages[0]!.nodes[0];
  expect(next?.type).toBe("motion");
  if (next?.type !== "motion") return;
  expect(next.schema.category).toBe("FlowField");
  expect(next.shadow).toBeTruthy();
  const look = creativeDirectionFor(post.weekday);
  if (look.frame !== "plain") expect(next.mask || next.strokeWidth).toBeTruthy();
});

it("applyPostVisual on a shape slot still becomes an image", () => {
  const doc = blankDocument();
  doc.pages[0]!.nodes = [{
    id: "s1", name: "Visual", type: "shape", variant: "rect",
    x: 0, y: 0, width: 400, height: 300, rotation: 0, opacity: 1,
    locked: false, hidden: false, constraints: { horizontal: "scale", vertical: "scale" },
    fill: "#eee", fillMode: "solid", stroke: "transparent", strokeWidth: 0, borderRadius: 0,
  }];
  const hung = applyPostVisual(doc, STILL);
  expect(hung.pages[0]!.nodes[0]?.type).toBe("image");
});

it("adaptPage to 9:16 resizes the box and drops density", () => {
  const node = makeMotionNode({
    name: "Media frame",
    x: 0, y: 0, width: 1200, height: 627,
    constraints: { horizontal: "scale", vertical: "scale" },
    schema: { ...LEDGER_CURRENT, physicsAndMath: { ...LEDGER_CURRENT.physicsAndMath, densityCount: 640 } },
  });
  const page = { ...motionDoc(node).pages[0]!, width: 1200, height: 627, nodes: [node] };
  const story = adaptPage(page, 1080, 1920, "story");
  const next = story.nodes[0];
  expect(next?.type).toBe("motion");
  if (next?.type !== "motion") return;
  expect(next.width).not.toBe(1200);
  expect(next.schema.physicsAndMath.densityCount).toBe(Math.round(640 * 0.65));
});

it("normalizeDocument keeps motion-capture asset metadata", () => {
  const doc = blankDocument();
  doc.assets = [{
    id: "a1", name: "plate", mime: "image/png", dataUrl: "data:image/png;base64,QQ==",
    source: "motion-capture", metadata: { schemaHash: "abc" },
  }];
  const next = normalizeDocument(JSON.parse(JSON.stringify(doc)));
  expect(next.assets[0]?.source).toBe("motion-capture");
  expect(next.assets[0]?.metadata?.schemaHash).toBe("abc");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts`

Expected: FAIL — creative direction does not frame motion; adapt uses 0.7 / 1.4; assets drop `source`.

- [ ] **Step 3: Implement**

`applyFrameShape`: change argument type to `ImageNode | MotionNode`, same body.

`applyCreativeDirection` motion branch:

```ts
if (node.type === "motion") {
  return applyNodeMotion(
    applyNodeShadow(applyFrameShape(node, look.frame), look.shadow),
    look.visualMotion,
  );
}
```

`adapt.ts`: use `newH / Math.max(newW, 1) >= 1.5` and `* 0.65`.

`CraftAsset`:

```ts
source?: "motion-capture";
metadata?: { schemaHash?: string };
```

`normalizeDocument` asset map copies `source` if it is `"motion-capture"` and `metadata.schemaHash` if a string.

`captureMotionStill`: set `source: "motion-capture"`, `metadata: { schemaHash: hashMotionSchema(node.schema) }`. Do **not** force `preview: "still"` unless the user is on still — spec capture writes the asset and `capturedAssetId`; leave `preview` as the user set it (change from current store which sets `preview: "still"`).

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts server/__tests__/shared/craftLooks.test.ts server/__tests__/shared/craftCompose.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add client/src/components/craft/lib/looks.ts client/src/components/craft/lib/composePost.ts client/src/components/craft/lib/adapt.ts client/src/components/craft/lib/types.ts client/src/components/craft/store.ts server/__tests__/shared/craftMotion.test.ts
git commit -m "feat: frame, spawn, and capture metadata for Craft motion"
```

---

### Task 8: Real GIFs via gifenc

**Files:**
- Modify: `package.json` / lockfile — add `gifenc`
- Modify: `client/src/components/craft/lib/gifEncode.ts` — wrap gifenc
- Modify: `client/src/components/craft/lib/export.ts` — `recordGifFrames`, keep `exportGif` at 4000ms / 12fps
- Modify: `client/src/components/craft/store.ts` — `recordMotionGif(id?: string)`
- Modify: `server/__tests__/shared/craftMotion.test.ts`

**Interfaces:**
- Consumes: `gifenc` `GIFEncoder`, `quantize`, `applyPalette`
- Produces:
  - `encodeGif(frames: Uint8Array[], width: number, height: number, fps: number): Uint8Array`
  - `exportGif(page, assets, title, durationMs = 4000, fps = 12): Promise<void>`
  - `recordNodeGif(node, assets, title): Promise<void>` — node bitmap only, same 4s × 12fps

- [ ] **Step 1: Write the failing test (keep GIF89a assertion)**

Existing test already checks `GIF89a` and trailer `0x3b`. Add:

```ts
it("encodeGif returns image/gif bytes for N frames", () => {
  const a = new Uint8Array(4).fill(247);
  a[3] = 255;
  const b = new Uint8Array([26, 29, 33, 255]);
  const gif = encodeGif([a, b, a, b], 1, 1, 12);
  expect(gif.byteLength).toBeGreaterThan(20);
  expect(String.fromCharCode(...gif.slice(0, 6))).toBe("GIF89a");
});
```

- [ ] **Step 2: Run test (may already pass on the hand-rolled encoder)**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts -t encodeGif`

Expected: PASS on WIP encoder. Still replace internals with gifenc this task.

- [ ] **Step 3: Install gifenc and rewrite `encodeGif`**

```powershell
npm install gifenc
```

```ts
import { GIFEncoder, quantize, applyPalette } from "gifenc";

export function encodeGif(frames: Uint8Array[], width: number, height: number, fps: number): Uint8Array {
  const gif = GIFEncoder();
  const delay = Math.max(2, Math.round(100 / Math.max(1, fps))); // GIF hundredths
  frames.forEach((frame, i) => {
    const palette = quantize(frame, 256);
    const index = applyPalette(frame, palette);
    gif.writeFrame(index, width, height, { palette, delay, first: i === 0, repeat: 0 });
  });
  gif.finish();
  return gif.bytes();
}
```

gifenc’s `delay` is GIF delay units (hundredths of a second). 12 fps ⇒ 8. First frame is `frames[0]` (still).

`exportGif` already records 4s × 12fps — keep those defaults. First iteration `atMs: 0`.

`recordNodeGif`: create a canvas `node.width × node.height`, tick `drawMotionNode` with the node moved to 0,0, encode, `downloadBlob`. Store field `gifProgress: number | null` (null when idle, 0–1 while recording). `recordMotionGif` sets it around the async loop and clears it in `finally`. CraftView shows `Recording GIF…` when `gifProgress != null`. Do not block the inspector.

Delete the hand-rolled LZW / palette code from `gifEncode.ts`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts`

Expected: PASS, `GIF89a` still true.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json client/src/components/craft/lib/gifEncode.ts client/src/components/craft/lib/export.ts client/src/components/craft/store.ts server/__tests__/shared/craftMotion.test.ts
git commit -m "feat: encode Craft GIFs with gifenc"
```

---

### Task 9: Inspector — grouped presets, Advanced JSON, Record GIF

**Files:**
- Modify: `client/src/components/craft/CraftView.tsx`
- Modify: `client/src/components/craft/store.ts` — `applyMotionPreset(id)`, `recordMotionGif`

**Interfaces:**
- Consumes: `MOTION_PRESETS`, `MOTION_PRESET_GROUPS`, `validateMotionSchema`, `presetById`
- Produces: UI only; no new schema fields

- [ ] **Step 1: Write a source assertion test**

Create or append:

```ts
import { readFileSync } from "node:fs";

it("inspector lists grouped motion presets and an Advanced JSON editor", () => {
  const view = readFileSync("client/src/components/craft/CraftView.tsx", "utf8");
  expect(view).toMatch(/Atmosphere/);
  expect(view).toMatch(/Graphic devices/);
  expect(view).toMatch(/Structure/);
  expect(view).toMatch(/Occasional/);
  expect(view).toMatch(/Record GIF/);
  expect(view).toMatch(/validateMotionSchema/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts -t inspector`

Expected: FAIL — current Motion section is a flat list of four, no Record GIF, no JSON editor.

- [ ] **Step 3: Implement UI**

Always-visible inspector **Motion** group (already exists): render `MOTION_PRESET_GROUPS`, under each the presets in that group. Click: if selected node is motion, `updateNode` with `schema: preset.schema` and new `seed`; else `addMotion(preset.id)`.

`addMotion` default box: width `page.width * 0.56`, height `page.height * 0.42`, centred. Default name `"Motion"`.

Selected MotionNode fields (name stays first in `NodeFields`):
- Density, speed, friction, influence radius, trigger (`none|mousemove|click|scroll|touch|hover`)
- Palette chips: brand `primary` / `background` / `secondary`. Gold (`accent`) chip only if `node.schema.visual.palette` already has that hex
- Preview live / still / reduced
- Capture still, Record GIF (`recordMotionGif`), Reset seed
- Category / library as read-only text until Advanced is open
- Advanced: `<Textarea>` of `JSON.stringify(node.schema, null, 2)`. On blur/Apply run `validateMotionSchema(JSON.parse(text))`. If `!ok` or parse throw, show `InspectorHint` with `error`, do not `updateNode`. If ok, write `schema`

Empty-state `TemplateStrip`: add a Ledger Current button calling `addMotion("ledger-current")` (strip currently returns null when not empty — when `empty`, show it next to templates).

Progress chip: if `gifProgress != null`, show `Recording GIF…` in the Motion section.

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add client/src/components/craft/CraftView.tsx client/src/components/craft/store.ts server/__tests__/shared/craftMotion.test.ts
git commit -m "feat: group Craft motion presets and add GIF/JSON controls"
```

---

### Task 10: Describe a current, HUD, reduced-motion session

**Files:**
- Modify: `client/src/components/craft/CraftView.tsx` — Yaffle panel + HUD overlay
- Modify: `client/src/components/craft/lib/motionRuntime.ts` — fps sample + density multiplier
- Modify: `server/__tests__/shared/craftMotion.test.ts`

**Interfaces:**
- Consumes: `matchMotionPreset`, `presetById`
- Produces:
  - `applyCurrentDescription(phrase: string)` in the store: if selected is motion, patch schema from matcher; else `addMotion(matchMotionPreset(phrase))` then patch
  - HUD when `altHeld` or `localStorage.craftMotionHud === "1"`: `fps` and `live node count`
  - If fps < 24, runtime density multiplier 0.8 (do not write schema until capture / 9:16 spawn)

- [ ] **Step 1: Write the failing tests**

```ts
it("matchMotionPreset stays on locked ids", () => {
  expect(["ledger-current", "paper-sparks", "after-hours-warp", "corporate-ribbon"]).toContain(
    matchMotionPreset("liquid glass wave sparks"),
  );
});

it("HUD flag and Describe a current exist in CraftView", () => {
  const view = readFileSync("client/src/components/craft/CraftView.tsx", "utf8");
  expect(view).toMatch(/Describe a current/);
  expect(view).toMatch(/craftMotionHud/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts -t "Describe a current"`

Expected: FAIL — string missing.

- [ ] **Step 3: Implement**

Yaffle / Images section: add an input labelled `Describe a current` and a button that calls `applyCurrentDescription`. No free-form schema keys.

CraftCanvas: `altHeld` ref from keydown/keyup `Alt`. Overlay a 11px mono chip: `{fps} fps · {live} live`. Sample fps from the rAF loop.

Runtime: keep `densityScale` (default 1). If HUD enabled and fps < 24, set `densityScale = 0.8` for particle spawn count only.

Reduced motion: CraftView already passes `reduced` into `drawFrame`. Do not persist `preview = "reduced"` onto the document.

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add client/src/components/craft/CraftView.tsx client/src/components/craft/store.ts client/src/components/craft/lib/motionRuntime.ts server/__tests__/shared/craftMotion.test.ts
git commit -m "feat: add Craft motion vibe prompt and performance HUD"
```

---

### Task 11: CRAFT.md + regression sweep

**Files:**
- Modify: `docs/CRAFT.md` — add `motion` to the node-type table and inspector Motion section
- Modify: anything that still imports four-preset-only assumptions

**Interfaces:** none

- [ ] **Step 1: Write the failing assertion**

```ts
it("docs/CRAFT.md documents MotionNode", () => {
  const md = readFileSync("docs/CRAFT.md", "utf8");
  expect(md).toMatch(/MotionNode|\*\*motion\*\*/);
  expect(md).toMatch(/Ledger Current/);
});
```

Put this in `craftMotion.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/craftMotion.test.ts -t CRAFT.md`

Expected: FAIL.

- [ ] **Step 3: Update `docs/CRAFT.md`**

In §2 node types, add:

| **motion** | `schema` (WebAnimationIntegrationSchema v1), `preview` live/still/reduced, optional `capturedAssetId` / `seed` / mask / stroke. Sim blits an offscreen bitmap. 15 house presets. |

Inspector: Motion group (15 grouped presets), selected Motion section (physics sliders, capture, Record GIF, Advanced JSON). Email export uses the captured still.

Note: `INSERT_COMPONENTS` countdown/burst/loop stay CSS-animation components; they are not MotionNodes.

- [ ] **Step 4: Full Craft regression**

Run: `npx vitest run server/__tests__/shared/craftLooks.test.ts server/__tests__/shared/craftCompose.test.ts server/__tests__/shared/craftEmail.test.ts server/__tests__/shared/craftBrand.test.ts server/__tests__/shared/craftMotion.test.ts server/__tests__/shared/craftDirector.test.ts`

Expected: all PASS.

- [ ] **Step 5: Commit**

```powershell
git add docs/CRAFT.md server/__tests__/shared/craftMotion.test.ts
git commit -m "docs: document Craft MotionNode in CRAFT.md"
```

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| MotionNode + normalize keeps schema | 1 |
| 15 categories, extra keys rejected, Ledger fallback | 1 |
| domTarget required, ThreeJS for Warp | 1, 5 |
| 15 grouped presets + vibe strings | 2 |
| Offscreen bitmap blit | 3 |
| Live cap 2, reduced motion session | 3, 10 |
| Mouse in node-local space | 3 |
| Remaining 2D looks + TypeKinetic reads hooks | 4 |
| Lazy cdnjs three.js | 5 |
| hook-turn / stamp-down | 6 |
| applyPostVisual keeps motion | already WIP; guarded in 1/7 |
| applyBrand remap, no gold inject | WIP + 1/2 |
| applyCreativeDirection frame/shadow, not category | 7 |
| adaptPage 9:16 density 0.65 | 7 |
| capture source + schemaHash | 7 |
| email still, no canvas | WIP, kept |
| gifenc 4s × 12fps | 8 |
| Inspector groups, Advanced JSON, Record GIF | 9 |
| Insert box 0.56×0.42, name Motion | 9 |
| TemplateStrip Ledger Current | 9 |
| Describe a current | 10 |
| HUD Alt / localStorage, fps&lt;24 density 0.8 | 10 |
| docs/CRAFT.md | 11 |
| No workers, no autoPublish, week templates stay photo | constraints |

## Placeholder / consistency notes

- `encodeGif` stays the public name; internals become gifenc
- `makeMotionNode` default name is `Motion` from Task 3; visual-slot tests pass `name: "Media frame"`
- `MOTION_PRESETS` live in `motionPresets.ts`; `motion.ts` only re-exports
- `applyFrameShape` accepts `ImageNode | MotionNode` from Task 7
- Do not keep the WIP test that forbids `domTarget` or locks four categories
