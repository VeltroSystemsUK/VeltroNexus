# Editorial desk — blogs and press releases

Date: 2026-08-31  
Status: draft for review  
Repo: Nexus

## Goal

Add a Marketing **Editorial** desk where Shaun drafts blogs and press releases that drive interest in Strata. Nexus stores, researches, writes, gates, and exports. Shaun publishes elsewhere. Nothing is posted from the app.

## Locked decisions

- **Draft desk only.** No public CMS, no site blog, no newswire send, no social post.
- **Types:** `blog` and `press_release` only. Text posts stay on Craft.
- **Casey (MKT-3)** does a **topic scan** for the piece (not the Craft week of seven Creative Ammo Briefs).
- **House default copy:** Anthropic first via `houseAsk`; Grok (xAI) only if Anthropic is down. Never Gemini.
- **UI shell** follows Email Campaigns (list, search, status, short New wizard). **Rules** follow Craft (marketing approve → compliance → export; `autoPublish` hard-false; packager not lender; no invented rates).
- **No new agent.** Isla (MKT-2) owns the desk. Casey researches. Shaun exports and publishes.
- **One Markdown body** for both types. Press-release shape comes from the generate prompt, not extra schema fields.
- Generate stays disabled until notes exist. Hand-written body with no scan is allowed.

## Non-goals

- Dual-model side-by-side drafts.
- Reusing Craft week ammo as the default research path.
- Unlayer, Craft canvas, TipTap, or a new Markdown library.
- Recipients, open rates, scheduling, or send.
- Auto-publish, OAuth to CMS/social, or paid distribution.
- A third “text post” type.
- Inventing a new marketing agent.

## Architecture

```
Shaun
  → /editorial list (Campaigns shell)
  → New piece (type + title + topic)
  → Casey topic scan (Firecrawl, official UK hosts, on-scope)
  → Generate (houseAsk: Anthropic, then Grok) grounded in notes
  → Markdown editor
  → Marketing approve
  → Compliance sign-off (reviewEditorialCopy)
  → Export .md + simple .html
  → Shaun publishes off-platform
```

Persistence follows Campaigns: one SQLite collection record per piece (`editorial_pieces`), not Craft’s single week JSON. Copy review, scan host rules, and `houseAsk` are shared logic; Editorial does not import Craft post shapes or email campaign send fields.

## Data

`shared/schema.ts` adds `editorialPieceSchema` (zod) plus insert type. Collection name: `editorial_pieces`.

| Field | Type | Notes |
|---|---|---|
| `id` | number | Storage-assigned |
| `userId` | string | Owner |
| `type` | `"blog"` \| `"press_release"` | Required on create |
| `title` | string | Working title; min 1 |
| `topic` | string | What Casey is asked to research; min 1 |
| `body` | string | Markdown. Empty string until generate or hand-write |
| `notes` | `CaseyNote[]` | `{ title, url, snippet }` from the topic scan. Default `[]` |
| `engine` | `{ provider: "anthropic" \| "xai"; model: string } \| null` | Last successful generate. Default `null` |
| `status` | `"draft"` \| `"approved"` \| `"rejected"` \| `"exported"` | Default `draft` |
| `compliance` | `"pending"` \| `"cleared"` \| `"blocked"` | Default `pending` |
| `autoPublish` | `false` | Hard-pinned. Storage and normalize always write `false` |
| `exportedAt` | date \| null | Set on successful export |
| `createdAt` | date | |
| `updatedAt` | date | |

`CaseyNote` is the existing type in `shared/craftScout.ts`. Do not fork it.

`IStorage` methods (same shape as email campaigns):

- `listEditorialPieces(userId)`
- `getEditorialPiece(id, userId)`
- `createEditorialPiece(insert, userId)`
- `updateEditorialPiece(id, userId, updates)`
- `deleteEditorialPiece(id, userId)`

`updateEditorialPiece` must refuse to persist `autoPublish: true`. If the incoming patch changes `title`, `topic`, or `body` while `status` is `approved` or `exported`, or while `compliance` is `cleared`, the stored row is reset to `status: "draft"` and `compliance: "pending"`. Topic change does not clear `notes` automatically; Scan overwrites notes.

## Copy review (`shared/editorial.ts`)

Export `reviewEditorialCopy(piece)` and `canExportPiece(piece)` as siblings of Craft’s `reviewMarketingCopy` / `canExportPost`. Reuse the same banned-term, rate-claim, and packager-identity regexes (lift the shared patterns so Craft and Editorial do not drift). Do **not** apply Craft `COPY_LIMITS` — this is long-form.

Block findings:

- Banned terms or rate claims → `house_policy`
- Missing packager identity (`do not lend` / `don't lend` / `does not lend` / `packager`) → `identity`
- `autoPublish !== false` → `autopost`

`canExportPiece` is true only when `status === "approved"` and `compliance === "cleared"` and `reviewEditorialCopy(piece).ok` and `autoPublish === false`.

`signOffEditorialCompliance(piece)` throws if status is not `approved` or review is not ok; otherwise returns the piece with `compliance: "cleared"` and `autoPublish: false`.

Markdown → simple HTML for export lives in the same module (`editorialMarkdownToHtml`). Support: headings, paragraphs, `**bold**`, `*italic*`, links, unordered lists. No new dependency. Wrapper HTML includes a charset meta and the title; no tracking, no live publish URL.

## Casey topic scan

Add `researchTopic(topic, crawl?)` in `server/services/caseyScout.ts` (and a pure query helper in `shared/craftScout.ts` if the Firecrawl query construction is testable without I/O).

Behaviour:

- Firecrawl search, `country: "GB"`, query = the piece `topic` (trimmed). Reuse `caseyNotesFromFirecrawlSearch` so host allowlist and `caseyNoteOnScope` still apply (BoE, gov.uk, ONS, UK Finance, NACFB, BBB, FCA, Gazette).
- Deduplicate by URL. Cap at 8 notes.
- **Do not** fall back to the seven-brief seed library. That library is Craft ammo, not article sources.
- **Do not** write final article copy. Casey returns notes only.
- Empty in-scope results: notes stay `[]`; the API responds 200 with `{ notes: [], warning: "No in-scope official sources landed" }`.
- Firecrawl/network throw: notes unchanged; API 502 with a clear message.

## Generate

`POST /api/editorial/:id/generate` calls `houseAsk` from `server/services/caseyScout.ts` (already Anthropic then xAI). System prompt is Isla as editorial writer (MKT-2), not Casey’s researcher prompt.

Grounding rules (must appear in the user prompt):

- Use only the attached Casey notes for facts and URLs.
- If a number is not in the notes, write `missing` — never invent Bank Rate, APR, insolvency counts, or live URLs.
- House policy: packager not lender; no rates, guarantees, payday, consumer-credit, or “we lend”.
- Always include a plain packager-identity sentence.

**Blog** prompt asks for Markdown: title as `#`, short standfirst, 400–800 words, H2 sections, close with how Strata packages distress-refinance / CDFI / HMRC TTP for UK SMEs and does not lend.

**Press release** prompt asks for Markdown: `FOR IMMEDIATE RELEASE`, headline, `London, <today’s UK date>`, lead, two to four short body paragraphs, `About Strata Finance` boilerplate (packager, does not lend), media contact placeholder `[Media contact]`.

400 if `notes.length === 0`. Success writes `body`, `engine` (from `caseyTextModel` for the provider that answered), leaves `status: "draft"` and `compliance: "pending"`. Confirm-replace is a client concern; the API overwrites `body`.

## API

Router `server/routes/editorial.ts`, mounted at `/api` in `server/routes.ts`, `isAuthenticated` on every route.

| Method | Path | Behaviour |
|---|---|---|
| GET | `/editorial` | List current user’s pieces, newest `updatedAt` first |
| POST | `/editorial` | Create from `{ type, title, topic }`. Body `""`, notes `[]`, draft/pending, `autoPublish: false` |
| GET | `/editorial/:id` | 404 if missing or other user |
| PATCH | `/editorial/:id` | Update title/topic/body. Apply the sign-off reset rule above |
| DELETE | `/editorial/:id` | 404 if missing |
| POST | `/editorial/:id/scan` | Topic scan; writes `notes` |
| POST | `/editorial/:id/generate` | `houseAsk`; 400 without notes |
| POST | `/editorial/:id/approve` | `status: "approved"`. If compliance is `blocked`, it stays `blocked`; otherwise it stays `pending`. Approve never auto-clears compliance |
| POST | `/editorial/:id/reject` | `status: "rejected"` |
| POST | `/editorial/:id/compliance` | Body `{ action: "cleared" \| "blocked" }`. `cleared` runs `signOffEditorialCompliance` (requires approved + review ok) |
| POST | `/editorial/:id/export` | 400 unless `canExportPiece`. Returns `{ markdown, html, filename }` where `filename` is `strata-{type}-{id}` (no extension). Sets `status: "exported"` and `exportedAt`. Client downloads `{filename}.md` and `{filename}.html` |

Both models down on generate: 500 with `houseAsk`’s message (needs `ANTHROPIC_API_KEY` or `XAI_API_KEY`).

## UI

- Sidebar Marketing item **Editorial** (Newspaper or FileText), `FULL` roles, path `/editorial`, after Campaigns.
- Route in `client/src/App.tsx` → `client/src/pages/Editorial.tsx`.
- `usePageTitle("EDITORIAL", "")`.

**List** (Campaigns family): four stat cards (total, draft, approved, exported); search on title/topic; tabs All / Draft / Approved / Exported plus a Blog / Press release type filter; table columns title, type, status, compliance, engine, updated; row click opens the editor on the same route; empty state + **New piece**.

**New piece** dialog: type (Blog / Press release), title, topic. Submit `POST /editorial` then switch to the editor. No recipient/content/review steps.

**Editor:** Markdown textarea left, preview right (client uses `editorialMarkdownToHtml` + `dangerouslySetInnerHTML` on a sandboxed preview; no extra package). Notes rail lists Casey sources as title + host + snippet. Header: Back, Scan, Generate (disabled when `notes.length === 0`; confirm dialog if `body` is non-empty), Approve, Reject, Compliance (cleared/blocked), Export. Copy-review findings under the preview. Export downloads `filename.md` and `filename.html` from the API payload (client-side blob download). No publish button.

Autosave: debounced PATCH of `body` (and title) like a normal form; rely on the server reset rule after sign-off.

## Agents and factory

No new roster row. Extend existing desks:

- **MKT-3:** topic scan for Editorial in addition to weekly Craft ammo. Still never writes final copy.
- **MKT-2:** Editorial drafts, marketing approve. Still never posts.
- **Shaun:** compliance (as today on Craft), export, publish off-platform.

Update: `docs/agentic-org/agents/MKT-2.md`, `MKT-3.md`, `corporate_structure.md`, `CLAUDE.md`, `delegation_matrix.csv`, `agents.mmd` (Isla also owns Editorial; Casey topic-scan output includes Editorial notes).

Factory graph parallel lane (do not overload `mkt-scan`, which is the Craft week):

- `mkt-editorial-scan` Casey — topic scan
- `mkt-editorial-compose` Isla — blog / press release
- `mkt-editorial-approve` You
- `mkt-editorial-compliance` You
- `mkt-editorial-export` Isla — Markdown / HTML
- edge to existing `mkt-post` (You post; never auto-post)

`factoryGraph.test.ts` asserts the new nodes and Casey → Isla → approve → compliance → export → post.

Delegation matrix rows:

- `editorial_topic_scan` → MKT-3, Shaun no
- `editorial_draft` → MKT-2, Shaun no
- `editorial_export` → MKT-2, Shaun yes (approve + compliance first)
- `editorial_publish` → MKT-2, Shaun yes (off-platform; never auto-post)

## Errors

| Case | Result |
|---|---|
| Create missing type/title/topic | 400 zod |
| Scan Firecrawl throw | 502, notes unchanged |
| Scan empty in-scope | 200, `notes: []`, warning |
| Generate with no notes | 400 |
| Both LLMs down | 500, existing Casey key message |
| Compliance cleared while not approved or review fails | 400 with review message |
| Export without gates | 400 |
| PATCH after sign-off | Saved, but status draft + compliance pending |

## Testing

Vitest, same style as `server/__tests__/shared/craftQueue.test.ts` and `caseyScout.test.ts`.

- `reviewEditorialCopy` blocks banned terms, rate claims, missing packager line, `autoPublish: true`; passes a clean packager blog.
- `canExportPiece` false until approved + cleared + review ok.
- `signOffEditorialCompliance` throws if not approved.
- PATCH-reset helper: editing body after cleared returns draft/pending.
- `editorialMarkdownToHtml` renders a heading, a link, and a list.
- Topic scan: off-host Firecrawl hits dropped; out-of-scope notes dropped; empty crawl does not inject the Craft seed library.
- Generate prompt fixture: contains notes and the words `missing` / packager instruction; blog vs press-release shapes differ (`FOR IMMEDIATE RELEASE` only on PR).
- Route tests with mocked `houseAsk` / crawl: 400 generate without notes; export 400 then 200 after approve+clear; `autoPublish` cannot be set true.

Do not call live Anthropic, xAI, or Firecrawl in CI.

## Success

- Marketing sidebar has Editorial. Shaun can create a blog and a press release, run a topic scan, generate copy, edit Markdown, pass both gates, and download `.md` and `.html`.
- Generate will not run without notes. Scan never invents sources. Export never runs without approve + compliance + copy review.
- `autoPublish` is always false. There is no publish control.
- Craft week, email campaigns, and Media Gallery are unchanged.

## Files

Create: `shared/editorial.ts`, `server/routes/editorial.ts`, `client/src/pages/Editorial.tsx`, `server/__tests__/shared/editorial.test.ts`, plus route/storage tests beside existing campaign tests.

Modify: `shared/schema.ts`, `server/storage.ts`, `server/sqliteStorage.ts`, `server/routes.ts`, `server/services/caseyScout.ts`, `shared/craftScout.ts` (only if query helper is extracted), `shared/factoryGraph.ts`, `server/__tests__/shared/factoryGraph.test.ts`, `client/src/App.tsx`, `client/src/components/Sidebar.tsx`, agentic-org docs listed above, and a short pointer in `docs/CRAFT.md` that Editorial is a separate long-form desk (not a Craft compositor mode).
