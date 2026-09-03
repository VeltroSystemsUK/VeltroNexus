# CRAFT — Full Module Spec

Internal schema id: `quires.craft.v1` · Internal app name: `QUIRES CRAFT` · User-facing name: **SWELL** (social mode) / **TEMPLATE** (email mode)

## 1. What it is

CRAFT is a browser canvas design compositor built into NEXUS — a Photoshop/Canva-style 2D editor (nodes, templates, brand kits, undo/redo, multi-page artboards, animation, raster export) with a marketing-automation layer on top. One React component tree (`CraftView.tsx` + Zustand `store.ts`) is reused in two contexts:

- **Social mode** (`/craft`, `Craft.tsx`) — the marketing desk's week-queue tool. Composes branded social posts (LinkedIn/Instagram/Facebook/TikTok crops) from AI-generated "Creative Ammo Briefs," lets a human edit copy/visuals on the canvas, gates export behind marketing-approve → compliance-sign-off, and exports PNG/pack/multi-format assets.
- **Email mode** (`CraftEmailEditor.tsx`, embedded in `EmailCampaigns.tsx` / `EmailTemplates.tsx`) — the same canvas restricted to a single 600px "letter" artboard, offered as an alternative to the existing Unlayer email builder, with merge-tag chips and HTML table export for sending.

Editorial (`/editorial`) is a **separate** long-form desk for blogs and press releases. It is not a Craft compositor mode. Casey topic-scans for the piece; Isla drafts Markdown; export is `.md` / `.html` after marketing approve and compliance. Shaun publishes elsewhere. Editorial blogs may Publish to Learn; press releases stay export-only.

## 2. Canvas / editor capabilities

### Node types (`lib/types.ts`)
All nodes share `NodeBase`: x/y/width/height/rotation/opacity, locked/hidden, flipX/flipY, groupId/groupName, per-axis `constraints` (`start|end|center|scale|stretch`, used when adapting a page to a new preset size), optional brand `role`, optional `animation`, optional `shadow`.

| Type | Fields |
|---|---|
| **text** | text, fontFamily, fontWeight (400/600/700/800), fontSize, align, letterSpacing, lineHeight, color, fontRole (heading/body), optional outline (stroke color+width), uppercase toggle, textFit (`none\|shrink`), overflow (`visible\|clip`) |
| **shape** | 18 variants: rect, ellipse, rounded-rect, triangle, diamond, star, arrow, line, hexagon, pentagon, octagon, chevron, heart, speech, cloud, banner, cross, parallelogram. Fill (solid/gradient), stroke/strokeWidth, borderRadius |
| **image** | assetId, objectFit (cover/contain/fill), brightness, contrast, grayscale, tint+tintOpacity, stroke/strokeWidth, crop rect, mask (14 shapes + `arch`/`ticket` custom paths) |
| **path** | freeform point array, closed flag, fill/stroke/strokeWidth — typed and rendered, but **no tool in the UI currently creates one** |

### Tools & interaction
- Left rail: Select (V), Text (T), Shape (S), Image (I).
- Select/marquee/move/resize/rotate via 9 handles, shift-click multi-select, shift-drag to lock aspect (auto-locked for the brand logo slot).
- Arrow keys nudge 1px (10px with shift), Cmd/Ctrl+D duplicate, Delete/Backspace remove, Escape deselect/cancel edit, Enter opens text edit, double-click edits text inline.
- Right-click → context menu. Space+drag or middle-drag pans. Ctrl/Cmd+scroll zooms toward cursor (0.08×–8×). Plain scroll pans (shift = horizontal).
- Fit-to-view on resize/page switch; zoom % readout with in/out/reset controls.
- Full undo/redo history stack, Cmd/Ctrl+Z / Shift+Z, plus a clickable **History** panel to jump to any checkpoint.
- Drag-and-drop a `.craft.json` file or an image onto the canvas; "Open file" button; opening an image with no doc open auto-creates a blank canvas.
- Debounced autosave to local storage whenever the doc is dirty.

### Context menu (`CraftContextMenu.tsx`)
Edit text (label adapts to field, e.g. "Edit hook 1"), shape-variant swap grid (all 18), image frame-shape grid (14 masks), shadow presets, opacity presets (100/85/70/50/25%), colour swatch picker, motion presets, bring-forward/send-back, duplicate, replace image, delete.

### Inspector rail (`Inspector.tsx` + `CraftView.tsx`)
- **Page** — page switcher, dimensions readout, background colour.
- **Merge** (email mode only) — clickable merge-tag chips.
- **Images** (when an AI-image panel is supplied) — prompt textarea + "Generate still."
- **Brand** — name, logo upload/replace/remove (auto palette extraction from the logo), 6 colour-role swatches, heading/body font pickers, Apply / Save kit / Use kit (persists to local storage, reusable across designs).
- **Size** — 17 presets in 4 categories + one-click "spawn story/square/OG" pack generation.
- **Templates** — 16 built-in templates, one-click apply.
- **Shapes** — grouped palette (Basics / Arrows & marks / Polygons / Icons).
- **Selection** — per-node fields (below) + multi-select toolbar (duplicate, delete, align L/C/R/T/M/B).
- **Export** (social mode only) — Export PNG, Export pack, Export formats; disabled with a hint while export-locked.
- **History** — checkpoint list, click to jump.

**Per-node fields:** name, opacity, shadow preset, motion preset. Text: body textarea (commits on blur, syncs back to structured copy), 6 type-style presets (Eyebrow/Heading/Subhead/Body/Caption/Stat), font size, align, font family (system + doc-embedded custom fonts), weight, letter-spacing, uppercase, colour. Shape: fill colour. Image: object-fit, 14 frame-shape buttons, 16 "look" presets, brightness/contrast, tint/wash colour, replace-image. All: X/Y/W/H.

## 3. Templates & Looks

**Size presets (17)** — Social/Web/Motion/Docs categories: Social Post 1080×1350, Story 1080×1920, IG Square 1080×1080, X/Twitter 1200×675, LinkedIn Banner 1584×396, Open Graph 1200×630, Web Banner 1200×628, Hero 1920×600, Email Header 600×200, Email letter 600×900, Reels/TikTok 1080×1920, YouTube Thumb 1280×720, Pinterest Pin 1000×1500, GIF Square 800×800, GIF Story 720×1280, App Icon 512×512, A4 Portrait 794×1123.

**Design templates (16)** — Announcement, Launch Story, Quote Card, Promo, Event Story, X Post, Open Graph, LinkedIn Banner, Email Header, Email letter (pre-wired with `{{firstName}}` / `{{companyName}}` / `{{senderName}}` / `{{senderCompany}}` / `{{unsubscribeLink}}`), Caption GIF, YouTube Thumb, Pinterest Pin, Testimonial, Speaker card, Menu/price-list. Every template's nodes are re-branded to the active kit at instantiation.

**Insertable components (19, defined but not currently wired to any visible button):** caption bars, CTA pill, badge, quote stack, price tag, handle bar, live pill, story-progress segments, follow chip, heading stack, stat block, numbered step, phone device frame, avatar, image frame, logo mark, divider, content card, feature row, countdown card, burst, loop badge.

**Image looks (17)** — Plain, Editorial, White frame, Gallery frame, Ink frame, Gold frame, Round, Arch, Diamond, Hex, Polaroid, Ticket, Drop shadow, Dim, Colour wash, Mono, Punch.

**Frame masks (14)** — Rect, Round, Arch, Diamond, Hex, Polaroid, Ticket, Star, Triangle, Heart, Speech, Banner, Cloud, Chevron.

**Shadow presets (4):** None, Soft, Drop, Hard. **Motion presets (5, per-node):** Still, Fade in, Slide in, Pop, Pulse (plus renderer-level `bounce`/`spin` used only by insertable components).

**Weekday creative direction** — `composePost.ts` maps each weekday to a fixed frame/shadow/motion combination, applied automatically when a social post is composed, so the week gets visual variety without manual styling.

**Brand kit** — name, 6 colour roles (primary/secondary/accent/background/text/muted), heading/body font, optional logo. Persisted to local storage, reusable across designs.

**Fonts** — 13 bundled system fonts (Unbounded, Plus Jakarta Sans, Space Mono, Lexend, Inter, IBM Plex Sans, Playfair Display, Montserrat, Poppins, Merriweather, Work Sans, Libre Baskerville, JetBrains Mono) plus per-document custom font upload (TTF/OTF/WOFF/WOFF2) via the `FontFace` API.

## 4. Composition & rendering pipeline

**Renderer (`lib/renderer.ts`)** — pure `<canvas>` 2D, no DOM/SVG/library. Hand-drawn geometry for all 18 shapes and mask paths (bezier heart, arc-based cloud/speech-bubble/ticket-notch, star points, etc.). Images clip through the mask path with CSS-canvas `filter` for brightness/contrast/grayscale plus a tint overlay. Text uses manual word-wrap and optional auto-shrink-to-fit. A small hand-rolled tween engine (`evaluateAnimation`) drives one-shot (cubic ease-out) and looping (sine-wave) motion — `requestAnimationFrame` only runs when a page actually has an animated node.

**Export** — `exportRaster` renders a page off-canvas to native-resolution PNG; `exportPack` adapts the current page to story/square/OG dimensions (constraint-aware repositioning) and downloads all three; `exportFormats` produces PNG/JPEG/WebP/SVG.

**Export gate** — any asset ID starting with `mkt-` (a marketing week-queue post) is export-locked until it has passed both marketing-approve and compliance-sign-off. Ad-hoc designs are never locked.

**Social post composition (`composePost.ts`)** —
- `composeSocialPost(post, brand, logo)` picks a template by post shape/track, applies brand, spawns square+story size variants, fills copy, applies logo and weekday creative direction.
- `applyPostCopy` locates text nodes by inferred field from their **layer name** (regex on eyebrow/hook/deck/cta/hashtag/link), auto-splits an overlong hook into two nodes, and auto-adds missing CTA/hashtag/link slots if a template lacks them.
- Editing a text node's content on canvas fires the inverse mapping back to the host page, so the sidebar "Draft copy" fields and the server-side `CraftPost` record stay in sync — a genuine two-way binding, gated by the same character limits (`eyebrow 36, hook 40, hook2 36, body 120, cta 28, ≤3 hashtags, ≤2 links`) used server-side.
- `applyPostVisual` finds the "Media frame"/"Visual" layer and drops in an image with the given look — used for both stock-photo attach and AI-generated stills.

## 5. Email-specific features

- `CraftEmailEditor.tsx` mounts `CraftView` in `mode="email"` (hides Save/PNG/Export/New/Open/close; inspector limited to Page/Merge/Brand/Size/Templates/Shapes/Selection/History). Loads an existing Craft design, a normalizable doc, or falls back to the `email-letter` template. Exposes `exportHtml()` returning `{ design, html }`.
- **Storage format** (`lib/emailHtml.ts`): `CraftEmailDesign = { engine: "craft.email.v1", doc: CraftDocument }`. Type guards let `EmailCampaigns.tsx`/`EmailTemplates.tsx` tell a Craft design apart from a legacy Unlayer design and route to the right editor — Craft is a **parallel, opt-in** email engine, not a replacement for Unlayer.
- **Merge tags** — clickable chips insert `{{tag}}` with smart spacing. Defaults: `{{firstName}}`, `{{companyName}}`, `{{senderName}}`, `{{senderCompany}}`, `{{unsubscribeLink}}`.
- **HTML export** — nodes sorted top-to-bottom/left-to-right into a single-column `<table>` (email-safe pattern): text → styled `<td>` with inline styles, image → centred `<img>` capped at 536px, shape → a solid-colour spacer row capped at 48px height. All text HTML-escaped except `{{tag}}` syntax, left raw for the send pipeline to substitute. Confirmed to flow through the same `prepareCampaignSend` personalization path as Unlayer emails.
- **Not implemented:** responsive/mobile breakpoints, multi-column layout, client-specific font fallbacks, dark-mode styling, preheader text field.

## 6. AI agents / automation

None of these auto-post — all are gated behind human approval.

| Agent | File(s) | Role |
|---|---|---|
| **Casey Wren — MKT-3, Content Scout** | `shared/craftScout.ts`, `server/services/caseyScout.ts` | Stays on the Strata desk (stacked short-term debt, HMRC TTP, CDFI). Firecrawl-searches official UK hosts with desk-locked queries, drops off-scope notes and briefs, then briefs Anthropic (`claude-sonnet-5`) or xAI (`grok-4`). Never Gemini. Public news only when it changes cost, speed, or availability of that capital. Missing numbers stay missing. Fills from the seed library if live briefs are thin or off-desk. |
| **Isla Quinn — MKT-2, Marketing/Creative Director** | `shared/craftDirector.ts` | Deterministic (not a live LLM call) — turns a brief into title/hook/hook2/body/CTA/hashtags via `copyFromAmmo()`, auto-appends "We do not lend." if missing, and picks a stock visual from a fixed 6-entry library by keyword heuristics. |
| **Kit Lang — MKT-4, Media Curator** | `shared/mediaCurator.ts`, `server/services/mediaCurator.ts`, `server/routes/curator.ts` | Hunt/dedupe/tag/index pipeline (§7). On the org roster (CLAUDE.md, corporate_structure.md). Click a curated still to save it to My Uploads. |
| **"Yaffle" still-image generation** | `server/services/grokImages.ts`, route `/api/craft/yaffle/*` | Builds a prompt from the matched brief (stripped of AI-slop terms like "masterpiece/8k/trending on artstation") or a user override, calls Grok (`grok-imagine-image-2.0` via `api.x.ai`) using `XAI_API_KEY` or a live Grok CLI session. Job polled and fetched as a blob, dropped onto the canvas's "Visual" slot. Falls back conceptually to a local sidecar if Grok is unconfigured. |

**Week-queue mechanics (`shared/craftQueue.ts`)** — synchronous, file-backed CRUD (not an async job queue). A `CraftPost` has independent `status` (draft/approved/rejected/exported) and `compliance` (pending/cleared/blocked) — both must clear before export unlocks. `reviewMarketingCopy()` regex-checks for banned terms (guaranteed/instant approval/payday/APR/consumer loan/no credit check/"we lend"), rate-claim patterns, and a missing packager-identity disclaimer; `autoPublish` is hard-pinned `false` in the type itself. `generateWeek()` builds Mon–Sun posts from 7 briefs. `mergeGeneratedWeek()` supports Replace all / Keep approved / This post only regeneration. Desk state persists per-user to `uploads/craft_desk.json` (flat JSON, not a DB table).

## 7. Media Gallery integration

`MediaGallery.tsx` is the UI for Kit Lang's curator index: search (`POST /curator/search`), ingest-by-URL, and a "Run curator" bulk scan (`POST /curator/run`). Selecting a still logs usage against a campaign/channel.

**Data model (`CuratedAsset`)** — title/description/altText, original + CDN URL, 4 serving variants (thumbnail/square/landscape/story — *currently all aliased to the same URL, no real resizing pipeline*), format/dimensions/aspect ratio (auto-classified), file size, SHA-256 + a custom byte-sampled perceptual hash for near-dupe detection, 3 crude dominant-colour swatches, tags/categories, a 64-dim bag-of-words embedding for hybrid search (hashed tokens + cosine similarity, no ML model), licence, attribution, usage history.

**Ingest** — fetches or accepts a buffer, hashes it, rejects near/exact duplicates, reads PNG/JPEG dimensions via hand-rolled binary parsers (no image library), auto-tags from title/source text, saves to `uploads/curator/{userId}/{id}.{ext}`, indexes to `uploads/curator_index.json`.

**Bulk desk scan** — fans out over 12 fixed UK-business stock-photo queries against Unsplash (no key), Pexels (`PEXELS_API_KEY`), Openverse (no key), and optionally Firecrawl (`FIRECRAWL_API_KEY`), merged round-robin (cap 60, URL-deduped), filtered through an image-host allowlist (Unsplash/Pexels/Wikimedia/Flickr/Pixabay/Openverse CDNs only) and a banned-terms filter.

**Collections** — simple named boards (`{id, name, assetIds[]}`) with list/create endpoints.

## 8. API surface

All routes require `isAuthenticated`, mounted under `/api`.

**`server/routes/craft.ts`**

| Method | Path | Purpose |
|---|---|---|
| GET | `/craft/desk` | Load the user's week queue + channels + briefs |
| POST | `/craft/week` | Generate/regenerate the week (`replace` / `keep_approved` / `selected`) |
| POST | `/craft/scan` | Run Casey now, stamp fresh ammo onto drafts without touching held posts |
| PATCH | `/craft/week/:id` | Patch a post's copy/status/compliance (validated, 400 on failure) |
| PUT | `/craft/channels/:id` | Update a channel's handle/URL/accountId (rejects payloads containing `password`/`secret`/`token`) |
| GET | `/craft/yaffle/status` | Health/provider check for image generation |
| POST | `/craft/yaffle/image` | Kick off a still-image generation job |
| GET | `/craft/yaffle/jobs/:id` | Poll job status |
| GET | `/craft/yaffle/jobs/:id/image` | Fetch generated image bytes |

**`server/routes/curator.ts`**

| Method | Path | Purpose |
|---|---|---|
| POST | `/curator/ingest` | Ingest one image by URL/buffer |
| POST | `/curator/search` | Hybrid text/tag/aspect/colour search |
| GET | `/curator/assets` | List all curated assets |
| GET | `/curator/assets/:id` | Fetch one asset |
| POST | `/curator/assets/:id/use` | Log a usage event against an asset |
| GET | `/curator/collections` | List collections |
| POST | `/curator/collections` | Create a collection |
| POST | `/curator/run` | Bulk desk scan (180s timeout) |

> Craft **design documents** (`.craft.json` canvas state) are not persisted server-side — they live in browser local storage (`persist.ts`: `saveCraftDoc`/`loadCraftForAsset`/brand kit/logo). Only the structured `CraftPost` copy fields round-trip through the API.

## 9. Data model

**`CraftDocument`** — schema/app/version stamp, id, title, `brand`, `pages[]`, `activePageId`, `assets[]` (data-URL-embedded images/logos), `fonts[]` (custom font uploads), `deck` (`{lines: string[]}` — typed but not visibly used), `versions[]` (named snapshots), timestamps.

**`CraftPage`** — id, name, presetId, width, height, `background` (solid or angled gradient), `nodes[]`, optional `layouts` (per-group `AutoLayout` — typed but not exercised by any read code path, likely scaffolding for a future flex-layout feature).

**`CraftBrand`** — name, 6 fixed colour roles, headingFont, bodyFont, optional logoAssetId.

**Validation** — `normalizeDocument()` defensively type/enum-checks every field with sensible fallbacks (unknown shape → `rect`, invalid weight → `700`, etc.), throwing only if `pages` is missing/empty ("This file is not a SWELL / Craft design.").

**`CraftPost`** (marketing record, linked to the canvas doc by `id`/assetId convention `mkt-{date}-{track}`) — date/weekday/track (borrower|introducer)/status/compliance/`autoPublish` (always false)/primaryChannel (always "linkedin")/channels[]/presetId/extraPresets/title/eyebrow/hook/hook2/body/cta/links[]/hashtags[]/adsDraft/optional visual `{stockId, query, prompt}`.

## 10. Known gaps / limitations

- No pen/path tool in the UI, though `PathNode` is fully typed and rendered.
- 19 insertable components are defined but have no visible trigger in the read UI code.
- `AutoLayout`/`layouts` on `CraftPage` is modeled but not applied anywhere.
- `CraftDeck.lines` exists on the schema with no read/write site found.
- Email export is single-column table only — no responsive breakpoints, multi-column, or dark-mode support.
- Media curator's 4 "variants" all point at the same original URL — no real image-resizing pipeline yet.
- Perceptual hash and dominant-colour extraction are crude byte-sampled placeholders, not real image decoding.
- Kit Lang (MKT-4) is on the roster; Workforce Strategy now plots Casey → Kit → Isla → Shaun.
- Casey's live research path is Anthropic, then xAI; it degrades to a fixed 14-brief library if both fail.
- Grok stills require a paid `XAI_API_KEY` or a live CLI login session; no verified fallback path confirmed in this pass.
- Canvas artwork itself is local-storage-only — no server-side sync/backup beyond the structured copy fields.
