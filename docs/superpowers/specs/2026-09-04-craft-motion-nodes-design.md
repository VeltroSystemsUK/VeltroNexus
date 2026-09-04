# Craft live motion nodes

Date: 2026-09-04
Status: draft for review
Repo: Nexus
Owner: Shaun Tuhey

## Goal

Let designers (and Isla) drop a **living plate** onto a Craft board the same way they drop an image: a named, transformable, brand-aware `MotionNode`. The sim runs **inside that node’s bitmap**. Still + GIF export, week compositor, compliance gate, and `quires.craft.v1` stay as they are.

User-facing editor remains SWELL. Internal app name remains QUIRES CRAFT.

## Locked decisions

- **Approach:** offscreen bitmap per node + shared 2D kernel. `drawNode` blits the bitmap into the existing page canvas. No DOM overlay canvases. No web workers.
- **Inspector preset picker:** all 15 house presets, grouped by job (Atmosphere / Graphic devices / Structure / Occasional), matching the drawer.
- **GIF:** real animated GIF via `gifenc`. `exportGif` stops being a PNG stub. Record **4 s at 12 fps** (48 frames); first frame must read as a still.
- **Three.js:** lazy-load from cdnjs only when a live node uses `CustomShaderDistortion` (After-hours Warp). Never on the critical path.
- **Week templates** stay photo/object unless the user inserts motion. Motion is not the default visual slot.
- **Paths:** follow the tree. Lib lives at `client/src/components/craft/lib/`, not `client/lib/`.

## Non-goals

- Web-worker sim.
- Auto-publish.
- Passwords in channel payloads.
- Lead-magnet or quarterly-brand-review routes.
- Replacing Kit / Grok still generation.
- Purple default palettes, glass-orb look, handshake stock inside generated stills.
- Making MotionNode the default visual on weekday templates.
- A second document format or schema bump.
- Wiring the unused 19 `INSERT_COMPONENTS` into a general component library. Only Motion presets are newly insertable in the inspector.

## Architecture

```
CraftView rAF (already loops when pageHasMotion)
    │
    ├─ motionRuntime.tick(live nodes ≤ 2)
    │     ├─ 2D kernel (14 categories)
    │     └─ motionThree.ts (Warp only, dynamic import + cdnjs)
    │
    └─ drawFrame → drawNode
          blits offscreen canvas (or captured still)
          then opacity / shadow / mask / stroke
```

Persistence is unchanged: the CraftDocument blob (including `MotionNode.schema`) autosaves to IndexedDB `nexus-craft` / `craftdoc:<id>`. Copy stays on the server; polish stays local. No new state library.

## Document model

Schema id stays `quires.craft.v1`. Old documents without motion need no migration.

### MotionNode

```ts
type MotionNode = NodeBase & {
  type: "motion"
  name: string
  schema: WebAnimationIntegrationSchema
  preview: "live" | "still" | "reduced"
  capturedAssetId?: string
  seed?: number
  mask?: Exclude<MaskShape, "none">
  stroke?: string
  strokeWidth?: number
}
```

`CraftNode` = `TextNode | ShapeNode | ImageNode | PathNode | MotionNode`.

`mask` / `stroke` / `strokeWidth` live on the node, not in the animation schema, so weekday `applyCreativeDirection` can frame the **output bitmap** without touching category enums.

Name is first-class. `Media frame` and `Visual` are valid visual-slot names.

### AnimationType

Existing: `none | fadeIn | slideIn | pop | pulse | bounce | spin`.
Add: `hook-turn | stamp-down`.
Unknown values still coerce to `none` on normalize.

### CraftAsset (optional fields only)

```ts
source?: "motion-capture"
metadata?: { schemaHash?: string }
```

Missing fields remain valid. Capture still writes both. `schemaHash` is a stable hash of the validated schema (sorted-key JSON, djb2 hex).

### normalizeDocument

- Accepts `type: "motion"` and never strips `schema`.
- If `schema` fails the validator: replace with Ledger Current, keep the rest of the node, and set a **session** warning keyed by node id for the inspector. Do not persist the bad JSON. Do not add a new error field on the document.
- `preview` other than `live | still | reduced` → `live`.
- Assets without `source` / `metadata` stay as they are.

## Locked schema: WebAnimationIntegrationSchema v1.0.0

File: `client/src/components/craft/lib/motionSchema.ts`.

Required keys: `schemaId`, `version`, `category`, `engine`, `domTarget`, `visual`, `physicsAndMath`, `interactionRules`, `performance`.

`meta: { title: string, vibe: string }` is allowed (needed for the AI panel). No other extra keys. Extra keys fail validation. Invalid JSON never reaches the runtime.

### Enums

- `schemaId`: `WebAnimationIntegrationSchema`
- `version`: `1.0.0`
- `category` (locked, no others):
  - Atmosphere: `ParticleSystem`, `FlowField`, `GrainField`, `CustomShaderDistortion`
  - Graphic devices: `StampPulse`, `RedactSweep`, `InkBleed`, `LightLeak`
  - Structure / type: `SineWaveRibbon`, `PerspectiveGrid`, `NetworkGraph`, `TypeKinetic`, `DataTicker`
  - Occasional: `MetaballGoo`, `VoronoiShatter`
- `engine.library`: `VanillaCanvas2D | ThreeJS`
- `engine.renderContext`: `2d | webgl`
- VanillaCanvas2D ⇒ `2d`. ThreeJS ⇒ `webgl` + required `engine.cdn` (cdnjs three.js only).
- `CustomShaderDistortion` ⇒ ThreeJS / webgl only.
- FlowField `physicsAndMath.noise`: `Perlin | Simplex` only.
- `visual.blending`: `source-over | screen | additive | multiply | overlay`
- `interactionRules.triggerType`: `none | mousemove | click | scroll | touch | hover`
- `interactionRules.falloff`: `smooth` (house default; reject unknown)
- `performance.fpsCap`: `24 | 30 | 60 | 120`
- House presets always set `respectReducedMotion: true`

`domTarget` is kept for contract completeness. The runtime does **not** mount a DOM canvas; it owns an offscreen canvas and blits into the page.

Numeric clamps (validator, then runtime): `densityCount` 8–4000, `friction` 0–1, `speed` 0–4, `amplitude` 0–200, `frequency` 0–8, `octaves` 1–6, `timestep` 0.008–0.05, `visual.opacity` 0–1, `visual.grain` 0–0.4, `influenceRadius` 0–800, `strength` 0–4, `maxDpr` 1–2.

## House presets

File: `client/src/components/craft/lib/motionPresets.ts`.

Insertable list, grouped by job. Every preset has a `vibe` string for the AI panel. Palettes are ink / paper / blue unless the row says otherwise. No purple.

| Group | Id | Name | Category | Notes |
|---|---|---|---|---|
| Atmosphere | `ledger-current` | Ledger Current | FlowField 2D | **Default on insert.** Paper ground, ink + blue filaments, grain 0.06, mouse pull. Not glitter, not a visualizer. |
| Atmosphere | `paper-sparks` | Paper Sparks | ParticleSystem 2D | Screen blend, dust/sparks. |
| Atmosphere | `grain-breath` | Grain Breath | GrainField 2D | Almost still; paper tooth. |
| Atmosphere | `after-hours-warp` | After-hours Warp | CustomShaderDistortion | Three.js, lazy CDN. |
| Graphic | `stamp-pulse` | Stamp Pulse | StampPulse 2D | Gold needle on a thin ring only; gold area ≤ 10% of the bitmap. |
| Graphic | `redact-sweep` | Redact Sweep | RedactSweep 2D | Red bar. Never writes copy into text nodes. Never writes banned copy. |
| Graphic | `ink-bleed` | Ink Bleed | InkBleed 2D | Letterpress squash / misregistration. |
| Graphic | `light-leak` | Light Leak | LightLeak 2D | One optical flash; gold ≤ 10% of the bitmap. |
| Structure | `corporate-ribbon` | Corporate Ribbon | SineWaveRibbon 2D | Trigger none or scroll. |
| Structure | `perspective-grid` | Perspective Grid | PerspectiveGrid 2D | Scroll trigger. |
| Structure | `network-map` | Network Map | NetworkGraph 2D | Nodes + thin edges. |
| Structure | `hook-turn` | Hook Turn | TypeKinetic 2D | Reads sibling Hook 1 / Hook 2 text if present; does not mutate those nodes. Also sets node `animation.type = hook-turn`. |
| Structure | `ledger-ticker` | Ledger Ticker | DataTicker 2D | JetBrains Mono. Sample strings: `LEDGER`, `ON TIME`, ISO dates, `FILE 04`. Never APR, `%`, `rate`, `loan`, `approved`. |
| Occasional | `goo-merge` | Goo Merge | MetaballGoo 2D | Lawful palette. |
| Occasional | `shatter-plate` | Shatter Plate | VoronoiShatter 2D | Trigger click or none. |

Ledger Current JSON is the house default (palette `#1A1D21`, `#2F5199`, `#F7F5F1`; background `#F7F5F1`; density 640; Simplex; mousemove influence 160). Gold is **not** in Atmosphere palettes.

`applyBrand` remaps `schema.visual.palette` and `schema.visual.background` by matching previous brand-role hexes (ink/paper/accent/blue/text/muted). Gold (`accent`) is never introduced into a palette that did not already name that hex.

## Runtime

Files:

- `client/src/components/craft/lib/motionRuntime.ts` — registry, tick, capture, pointer map, live cap
- `client/src/components/craft/lib/motionThree.ts` — dynamic import only for Warp

### Registry

Keyed by node id. Each live node owns an offscreen canvas sized `width × height × min(devicePixelRatio, schema.performance.maxDpr)`. Destroyed on node delete or when the page unmounts.

`drawNode` treats the bitmap like an image, then applies the node’s opacity, shadow, mask, and stroke. Filaments never see those transforms.

### When the page loops

`pageHasMotion` is true if any node has a CSS-style `animation` other than `none`, **or** any `MotionNode` with `preview === "live"` that the runtime would tick. CraftView’s existing rAF then calls `motionRuntime.tick` before `drawFrame`.

### Live policy

A node ticks only if all of:

1. `preview === "live"`
2. not `hidden`, not `locked`
3. `prefers-reduced-motion: reduce` is off
4. the node’s screen-space AABB intersects the canvas host (implementation of `pauseOffscreen`; no dummy DOM node)

If more than two nodes on the **page** qualify, keep selected ones live first, then the most recently selected, then document order. The rest freeze on last capture or last frame. This is a **runtime override** — do not rewrite saved `preview`. Never more than one Three.js context.

`prefers-reduced-motion` forces a session `preview = "reduced"` and draws one frame. Do not persist that onto the document.

Locked or hidden → freeze (no tick, last bitmap remains).

### Pointer

The offscreen canvas is not in the DOM. Mouse / scroll / click / hover / touch are sampled from the editor viewport and mapped through pan/zoom into node-local coordinates using the node box. `pointer-events` on a DOM canvas is irrelevant.

### Shared 2D kernel

One particle/field buffer, simplex (and a cheap Perlin for FlowField when asked), palette, blend, grain, timestep, seed. Category is a draw function, not a class.

| Kernel | Categories |
|---|---|
| Flow / particles | FlowField, ParticleSystem, GrainField, LightLeak, StampPulse, InkBleed, MetaballGoo |
| Geometry | SineWaveRibbon, PerspectiveGrid, NetworkGraph, DataTicker, VoronoiShatter |
| Type overlay | TypeKinetic, RedactSweep |
| WebGL blit | CustomShaderDistortion via `motionThree.ts` |

Ledger Current must look like expensive paper with ink and blue filaments.

TypeKinetic: if the page has text nodes named `Hook 1` and/or `Hook 2`, render those strings inside the motion bitmap (swap/stack). Do not call `updateNode` on them.

RedactSweep: draw a red bar across the node. Do not write into any text field.

### After-hours Warp

First tick of a live Warp node: `import("./motionThree.ts")`, which injects three.js from cdnjs once. Render WebGL into an auxiliary canvas, copy one frame into the node bitmap. Dispose the GL context when the node leaves live. CDN / GL failure: freeze last frame or paper still, set a session inspector hint, do not crash the doc.

### Capture

`captureStill(node)`:

1. Grab current bitmap (or tick one frame if empty).
2. Append a PNG `CraftAsset` with `source: "motion-capture"` and `metadata.schemaHash`.
3. Set `capturedAssetId`.

## Insert, inspector, compositor, export

### Insert

Store: `addMotionNode(presetId?, x?, y?)`. Default preset `ledger-current`. Default name `Motion`. Default box: width `page.width * 0.56`, height `page.height * 0.42`, centred on the page. Then select the node.

No new toolbar tool. Insert is inspector / strip click, same commit+select path as `addShape`.

**Inspector “Motion” group** (always, like Shapes): 15 presets grouped Atmosphere / Graphic devices / Structure / Occasional. Click inserts (or, if a MotionNode is already selected, replaces its schema and seed).

**Empty-state TemplateStrip:** add a **Ledger Current** button that ensures a doc exists and inserts the default motion node.

If the user names the node `Media frame` or `Visual`, it is the visual slot. Do not auto-rename on insert.

### Inspector when a MotionNode is selected

Name field stays first. If it is the visual slot, keep the name `Media frame` unless the user edits it.

Motion section:

- Preset picker (all 15, grouped)
- Density, speed, friction, influence radius, trigger
- Palette chips bound to brand roles (ink / paper / secondary). Gold chip only if the schema already names accent
- Preview: live / still / reduced
- Capture still, Record GIF, Reset seed
- Category / library read-only until Advanced
- Advanced: raw JSON. Validator on every edit. Extra keys or invalid JSON → inline error, document unchanged

Session warnings (bad schema on load, Three.js fail) show here.

### Compositor

`applyPostVisual`:

- Visual slot = node named `Media frame` or `Visual` (existing `isVisualSlot` also treats a large `Accent` shape as a slot; that path still becomes an `ImageNode`).
- If the slot is a `MotionNode`: set `capturedAssetId` to the incoming Kit/Grok asset, keep `schema` and `type: "motion"`. Do **not** replace with `ImageNode`.
- Otherwise keep today’s replace-with-image behaviour.

`applyCreativeDirection`: if the visual slot is motion, apply frame + shadow (`applyFrameShape` / `applyNodeShadow` extended to accept `MotionNode`). Do not change `category`. Hook text nodes still get `hookMotion`.

`applyBrand` / `applyBrandToNode`: for motion, remap `schema.visual.palette` and `background` by previous role hex as above.

`applyFrameShape`: today takes `ImageNode`. Extend to `ImageNode | MotionNode` (mask + stroke on the node).

`adaptPage` / `spawnSizes`: resize the motion box with the page. When `height / width >= 1.5` (9:16 story), multiply `schema.physicsAndMath.densityCount` by 0.65 and persist that. Do not letterbox a 16:9 field into a story.

### Export

- Raster (PNG/JPEG/WebP): `drawFrame` uses the live bitmap if present, else `capturedAssetId`, else a just-in-time one-frame grab.
- SVG: embed a PNG of that frame. No `<canvas>` in the SVG.
- Email (`emailHtmlFromCraft`): `<img>` of the captured still (or just-in-time grab). Never a canvas tag. If grab fails, skip the node (same as a missing image).
- Learn publish-to-Learn: snapshot the still the same way week images are snapshotted today. No live sim on Learn.
- GIF: `gifenc`. `exportGif(page, …)` records the **page** (all nodes, motion ticking). Inspector **Record GIF** records **this node only** (node bitmap frames) and downloads. 4 s × 12 fps, first frame a still. Async; inspector stays usable; small progress chip on the node / status bar. Week `canExportPost()` still gates export/publish.

Add dependency `gifenc`. No other new libraries. Three.js is CDN-only, not an npm dep. Pin `https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js` (global `THREE`). Do not load it until a live Warp node ticks.

## Same-pass extras

Do these after the node boots, not instead of it.

1. **Timeline.** `evaluateAnimation` implements `hook-turn` (Hook 1 → Hook 2 swap/stack on the text node’s own transform/opacity) and `stamp-down` (scale 1.18 → 1 once, then hold). Original six types unchanged. MotionNode may also set these as overlays; the sim is separate.

2. **Capture-to-Kit.** Covered under Capture. Isla reuses the still as photography. No new Kit pipeline.

3. **Pack spawn.** Covered under `adaptPage`.

4. **Email / Learn.** Covered under Export.

5. **Describe a current.** Extra input on the existing Images / Yaffle inspector panel. Maps vibe language onto locked enums and the 15 preset `vibe` strings. Patches the **selected** MotionNode only (preset + schema). No free-form keys. If nothing motion is selected, insert Ledger Current then patch.

   Category hints (in addition to preset vibe match):
   - moody / starry / dust / sparks → ParticleSystem (`paper-sparks`)
   - liquid / wind / current / silk / smoke → FlowField (`ledger-current`)
   - grain / film / paper tooth → GrainField (`grain-breath`)
   - distortion / glass / heat / warp → CustomShaderDistortion (`after-hours-warp`)
   - clean / wave / ribbon / flag → SineWaveRibbon (`corporate-ribbon`)
   - stamp / slam / seal → StampPulse
   - redact / bar / myth → RedactSweep
   - letterpress / bleed → InkBleed
   - leak / flare → LightLeak
   - grid / retro / city → PerspectiveGrid
   - network / introducer map → NetworkGraph
   - hook / kinetic / word → TypeKinetic
   - ticker / numerals / ledger → DataTicker
   - goo / blob / merge → MetaballGoo
   - shatter / crack → VoronoiShatter

   Prefer the best-matching **preset id**, not a hand-built schema.

6. **Performance HUD.** Hold Alt, or `localStorage.craftMotionHud === "1"`. Overlay: fps and live node count. If fps &lt; 24, apply a runtime density multiplier of 0.8 on live nodes. Do not rewrite saved `densityCount` until the user captures or the 9:16 spawn rule runs.

## Errors

| Case | Behaviour |
|---|---|
| Invalid inspector JSON / extra keys | Inline error. Document unchanged. Runtime keeps last valid schema. |
| Bad schema on load | Ledger Current. Session warning on that node id. |
| Three.js CDN / GL fail | Freeze last frame or paper still. Session hint. Doc stays open. |
| Missing capture on email | Just-in-time grab; if that fails, skip the node. |
| Reduced motion | One frame, no loop. Session only. |
| >2 live nodes | Extras freeze. Saved preview unchanged. |

## Files to touch

- `client/src/components/craft/lib/types.ts` — MotionNode, AnimationType, CraftAsset, normalize
- `client/src/components/craft/lib/motionSchema.ts` — validator
- `client/src/components/craft/lib/motionPresets.ts` — 15 presets + vibe strings
- `client/src/components/craft/lib/motionRuntime.ts` — registry / tick / capture
- `client/src/components/craft/lib/motionThree.ts` — lazy Warp
- `client/src/components/craft/lib/looks.ts` — frame/shadow on motion; `pageHasMotion`
- `client/src/components/craft/lib/renderer.ts` — blit motion bitmap; `hook-turn` / `stamp-down`
- `client/src/components/craft/lib/composePost.ts` — applyPostVisual keep-motion; creative direction
- `client/src/components/craft/lib/brand.ts` — palette remap
- `client/src/components/craft/lib/export.ts` — frame grab + gifenc
- `client/src/components/craft/lib/emailHtml.ts` — still `<img>`
- `client/src/components/craft/lib/adapt.ts` — box + story density
- `client/src/components/craft/lib/templates.ts` — motion insert helper if needed
- `client/src/components/craft/store.ts` — addMotionNode, captureStill, recordGif, applyMotionPreset
- `client/src/components/craft/CraftView.tsx` — rAF tick, inspector Motion group + section, Describe a current, HUD, GIF chip
- `package.json` — `gifenc`
- Tests under `server/__tests__/shared/craftMotion*.test.ts` (same pattern as `craftLooks.test.ts`)
- `docs/CRAFT.md` — add the motion node type when this ships (implementation task, not a second spec)

## Tests

Vitest, next to the other craft tests.

- `normalizeDocument` round-trips a MotionNode and keeps `schema`
- Bad schema on load → Ledger Current
- Extra keys rejected; required key missing rejected
- `applyBrand` remaps ink/paper/blue; does not inject gold into a three-colour Atmosphere palette
- `applyPostVisual` on a motion `Media frame` keeps `type: "motion"` and sets `capturedAssetId`
- `applyPostVisual` on a shape visual slot still becomes `ImageNode` (no regression)
- `applyCreativeDirection` changes frame/shadow on motion, not `category`
- `emailHtmlFromCraft` contains `<img` and not `<canvas` for a motion slot with a capture
- `adaptPage` to 1080×1920 resizes the box and lowers `densityCount`
- `evaluateAnimation` still handles the original six; `hook-turn` and `stamp-down` return defined transforms
- Validator accepts Ledger Current JSON and rejects `category: "Galaxy"`
- GIF helper: given N frames, returns a blob with `type` `image/gif` (no pixel assertions)
- Vibe map: `"liquid wind"` → `ledger-current`; `"glass warp"` → `after-hours-warp`

## Acceptance

- Insert Ledger Current onto a 1200×627 LinkedIn page, name it `Media frame`, type Unbounded hooks beside it, export PNG + GIF.
- Mouse pull is obvious in the editor when the node is selected and live.
- Reduced-motion users never see a running loop.
- `applyBrand` shifting paper/ink recolors the field without editing JSON.
- Two live fields on one page does not melt the tab; extras freeze to stills.
- Opening the doc on a second browser still behaves as today for copy (server) vs polish (local IDB). Motion schema persists inside the CraftDocument blob.
- Week compliance / copy limits unchanged. `canExportPost()` still gates export.
- CustomShaderDistortion does not load Three.js until that preset is used.
- Inspector lists all 15 presets grouped by job.
- Email HTML for a motion slot is a still image.

## Out of scope reminders

Default week templates stay photo. Gold stays a needle, not a particle colour, unless the schema already names it and painted area stays under 10%.
