# Learn hub — training ground for prospective customers

Date: 2026-09-03  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey

## Goal

Stand up **`learn.stratanexus.co.uk`** as Strata’s public training ground: a short Start-here path, then a library of videos and articles, a librarian bot that only answers from what is published, and a quiet door into the existing four-question assessment. James’s outreach uses it to earn buy-in before the ask. Inbound search is a later dividend of the same public URLs.

This is education and training. It is not a forum, not a members’ club, and not a chat room. A trusted community is the *result* of teaching well, not a product surface.

Shaun already has articles and videos. v1 ingests that corpus through the desks. The app does not invent launch copy, case studies, or rates.

## Locked decisions

- **Jobs in order:** (1) trust asset for Stream A outreach, (2) inbound content URLs, (3) nurture later. Chat room / members’ room later and only if asked.
- **Open house.** No login, no email gate. Capture only if they take Explore or ask for a 10-minute review.
- **Social layer:** “This helped” only. No comments, profiles, hearts, live counts, or community tab.
- **Librarian bot:** answers from live published lessons only. Their company, numbers, eligibility, rates, or “can you do my deal?” → stock handoff to Explore / 10-minute review. Not a qualifier. Does not run the quiz.
- **Public host:** `learn.stratanexus.co.uk`. Voice on the page: `learn@stratanexus.co.uk`. No Learn digest mail in v1. Outreach still sends from the shared enquiries mailbox.
- **Publish from Nexus** after the same gates as Editorial: draft → marketing approve → compliance → **Publish to Learn**. Never auto-post. Unpublish is a button.
- **Approach A:** one Express app, two doors (host header). Launch videos are the 1080p MP4s already produced in Shaun’s SuperGrok share. **Copy the files into Nexus** (`uploads/learn/videos/`) and play them in a branded HTML5 player. Do not hot-link `assets.grok.com` (login/expiry). YouTube/Vimeo URLs remain allowed for later pieces. No stream vendor. No 800MB lecture files.
- **Teaching shape:** Start here (up to six ordered lessons) then library (everything else, newest first).
- **Existing corpus first.** Source: [Grok share — Strata Finance Promo Video Creation](https://grok.com/share/bGVnYWN5LWNvcHk_cf6e7efd-e2b3-4ad9-b4df-dc18988d6d19). Empty-state UI exists only as a fallback if nothing is live.

## Non-goals (v1)

- Forum, comments, chat room, members’ area, accounts on Learn.
- Email capture / drip from `learn@`.
- Bot-run diagnostic (Explore stays `explore.stratanexus.co.uk`).
- A stream vendor, YouTube as a launch requirement, or hot-linking SuperGrok CDN URLs.
- A second Learn app, Ghost/WordPress, or SSR site.
- Introducer / Stream B track.
- Changing cadence mails other than `sme_open`.
- Auto-publish, new marketing agent, Gemini.
- Inventing Start-here copy. Shaun maps his existing pieces into slots 1–6.

## Architecture

```
learn.stratanexus.co.uk     public Learn (no auth)
leads.stratanexus.co.uk     Nexus desks (auth)
explore.stratanexus.co.uk   four-question assessment (CTA)

Editorial blog  ──gates──► Publish to Learn ──► learn_pieces (live snapshot)
Learn video desk ──gates──► Publish to Learn ──► learn_pieces (live snapshot)

Public home = Start here (pathPosition 1–6) + library (pathPosition null)
Piece page  = video embed or article + This helped + librarian + CTA
Librarian   = retrieve live pieces → houseAsk → cite or stock handoff
```

Same process as today. `Host: learn.stratanexus.co.uk` selects the public Learn React tree and the public `/api/learn/*` routes. Nexus paths (`/pipeline`, `/editorial`, …) on the Learn host are a Learn 404. Public Learn APIs on the `leads.` host 404.

DNS: `learn` points at the same box as `leads`. Required for launch, not a follow-up.

## Public Learn

Brand: Strata, not Veltro. Graphite world, emerald as the single living accent, liquid chrome only on the word Strata. Unbounded titles, Plus Jakarta Sans body, Space Mono lesson numbers.

**Home `/`**

1. One sentence: training for UK directors dealing with stacked short-term finance and HMRC commitments. Packager line always visible (Strata packages; it does not lend).
2. **Start here** — live pieces with `pathPosition` 1–6, ordered, holes skipped (1,2,4 is fine). Lesson 1 is visually dominant. Number, title, optional `durationLabel` (e.g. `8 min`), watch/read.
3. **Library** — other live pieces, newest first. No filter chips in v1.
4. Footer: packager line, privacy, `learn@stratanexus.co.uk`, Explore.

**Piece** `/watch/:slug` or `/read/:slug`

- Path lessons: “Lesson N of M”, next/previous in path order.
- Video: branded HTML5 player for stored MP4s; YouTube/Vimeo embed if that is the source. If playback fails, show description/transcript and “video unavailable”; CTA remains.
- Article: Markdown, readable width, optional hero still.
- **This helped** (count + one click per browser).
- CTA: 60-second assessment (Explore) and 10-minute review (`mailto` to the shared inbox, subject `Learn review request`).
- Librarian panel, primed with this lesson.

**Library index** `/library` — same library feed as home.

**Empty live set** — packager line plus “No lessons yet.” No fake cards.

**Never on this host:** comments, login, pipeline, agents, “Hi! How can I help you refinance today?”

## Nexus desks

Marketing sidebar: **Learn** next to Editorial. Editorial stays the article writer. Learn is the live library plus the video draft desk.

**Articles.** Existing Editorial flow unchanged until the end. After compliance cleared, **Publish to Learn** (Director): slug (from title, editable until first live publish), excerpt, optional hero still, Start here position `none` or `1`–`6`. Only `type: blog`. Press releases stay export-only.

**Videos.** New `learn_videos` collection, same shell and gates as Editorial. Fields: title, topic, description (compliance text), optional transcript, hero still, excerpt, path position, optional `durationLabel`, and **either** an uploaded MP4 stored under `uploads/learn/videos/` **or** a YouTube/Vimeo URL. Casey topic-scan and Isla generate-description are allowed; hand-written description is allowed. Publish refuses a bare `assets.grok.com` URL — the file must be copied first. Optional `durationLabel` is copied onto the live snapshot for path cards.

**Learn list.** Live and not-live `learn_pieces`: kind, title, path position, live flag, thisHelped, publishedAt. Actions: open source draft, unpublish, change path position. Publish and unpublish are Director actions. Marketing-approve is not go-live.

**Edit breaks the seal.** Changing title/topic/body (article) or title/topic/description/transcript/videoUrl (video) while gates are approved/cleared, or while a matching learn piece is live, resets the draft to `draft` / `pending` and sets `learn_pieces.live = false`. Republish required.

**Path positions.** Unique among live rows. Moving a new piece onto a taken number is refused until the occupant is moved to `none` or another slot.

**Corpus rebuild.** Every successful publish, republish, unpublish, or seal-break rebuilds the librarian source set from `live = true` rows only (title, excerpt, body or description, transcript). Drafts and Casey notes never enter.

## Librarian bot

Label: **Learn librarian**. Subtitle: answers from Strata’s published lessons only. No avatar, no Online badge, no impersonation of Shaun or James.

Flow:

1. Input: question + optional current slug.
2. Retrieve top live pieces.
3. `houseAsk` (Anthropic, then Grok; never Gemini) with a fixed system prompt: packager not lender; cite lessons by title and slug; if it is not in the retrieved text, say so; never invent a rate, term, eligibility, or outcome.
4. Return short prose plus links to cited lessons.

**Stock handoff card** (no model) when the question is about their company, their numbers, eligibility, what they would pay, booking a call, or handing over a file. Same card if the model output matches rate/guarantee/eligibility claims. Card: one refusal line, Explore button, 10-minute review mailto.

**Must not:** remember visitors, take email/documents, run Explore, browse the web, use Casey notes, relationship copy.

**Logs:** `learn_bot_logs` — time, slug, question, handoff boolean, retrieved piece ids. Visible on the Learn desk. Not emailed to the director.

**Down / rate-limited:** “The librarian is unavailable. The lessons on this page still work.” CTA still visible.

## Data

Public site never reads `editorial_pieces` or `learn_videos`. It reads `learn_pieces` where `live = true`.

### `learn_videos` (draft desk)

Same gate shape as Editorial: `status` draft|approved|rejected, `compliance` pending|cleared|blocked, `autoPublish: false` hard-pinned, Casey `notes`, `engine`, title, topic, description as body analogue, `videoUrl`, `transcript`, `heroImageUrl`, `excerpt`, `pathPosition` on the draft (copied at publish).

### `learn_pieces` (public snapshot)

| Field | Notes |
|---|---|
| `id` | Storage-assigned |
| `slug` | Unique among live rows |
| `kind` | `article` \| `video` |
| `title`, `excerpt`, `heroImageUrl` | Public |
| `body` | Article Markdown snapshot; empty on video |
| `videoUrl` | Public path to stored MP4 (`/uploads/learn/videos/…`) or YouTube/Vimeo; empty on article |
| `transcript` | Optional; in corpus and (on video drafts) compliance text |
| `durationLabel` | Optional public length string; empty if unknown |
| `pathPosition` | `1`–`6` or null; unique among live |
| `thisHelped` | Integer |
| `source` | `{ desk: "editorial", id }` or `{ desk: "learn-video", id }` |
| `live` | Public queries only `true` |
| `publishedAt`, `unpublishedAt` | |
| `userId`, `createdAt`, `updatedAt` | |

### `learn_bot_logs`

`id`, `createdAt`, `slug` (nullable), `question`, `handoff` boolean, `retrievedIds` number[].

### This helped

Cookie `learn_helped` = comma-separated piece ids. `POST` increments only if id not in cookie; response sets cookie. No account.

`IStorage` methods (Campaigns/Editorial shape): list/get/create/update/delete for `learn_videos`; listLiveLearnPieces, getLiveLearnPieceBySlug, getLearnPiece, upsertLiveLearnPiece (publish), unpublishLearnPiece, incrementLearnHelped, listLearnBotLogs, insertLearnBotLog.

`autoPublish: true` is refused on video drafts the same way as Editorial.

## Public API

Only when `Host` is the Learn host. Same paths on `leads.` return 404.

- `GET /api/learn/home` — `{ path: LearnPiecePublic[], library: LearnPiecePublic[] }`
- `GET /api/learn/library`
- `GET /api/learn/piece/:kind/:slug` — 404 if not live or kind mismatch
- `POST /api/learn/piece/:id/helped` — cookie-idempotent, rate limited
- `POST /api/learn/ask` — `{ question, slug? }` → `{ kind: "answer", text, citations }` or `{ kind: "handoff" }` or `{ kind: "unavailable" }`. Tight rate limit.

`LearnPiecePublic` omits `source`, drafts, notes, engine, userId.

Authenticated: existing `/api/editorial/*` plus `/api/learn-desk/*` for video CRUD, scan/generate, approve, compliance, publish, unpublish, path position, bot logs.

Publish refuses unless: Director session; source approved + compliance cleared; slug valid; article is `blog` or video is a stored Learn MP4 / YouTube / Vimeo; path position free if set.

## Outreach join

`sme_open` currently links to `https://explore.stratanexus.co.uk`. After launch it links to `https://learn.stratanexus.co.uk` (Start here) and still names the assessment as the next step. Other Sales OS templates unchanged in v1.

## Launch corpus

Source conversation: [Strata Finance Promo Video Creation](https://grok.com/share/bGVnYWN5LWNvcHk_cf6e7efd-e2b3-4ad9-b4df-dc18988d6d19). Download each keep-file from that share into `uploads/learn/videos/`. Do not invent extra films.

**Videos on the share (keep the later cut where two exist)**

| File | Length | Role on Learn (proposal) |
|---|---|---|
| `StrataFinance_Promo.mp4` (male VO, first cut) | 39s | Discard — superseded |
| `StrataFinance_Promo.mp4` (Eve, Unbounded, music) | 40s | **Home hero**, not a numbered lesson |
| `StrataFinance_PaydayLenders.mp4` | 1:03 | Start here **1** — stacked short-term / commercial “payday” |
| `StrataFinance_Cashflow.mp4` | 1:03 | Start here **2** — poor cashflow |
| `StrataFinance_TimeToPay.mp4` | ~1 min | Start here **3** — HMRC Time to Pay |
| `StrataFinance_BadBrokers.mp4` | 55s | Start here **4** — warehouse brokers / packager vs sales shop |

Path is four lessons plus a hero sting. Do not pad with CDFI / “what a file needs” films that are not on the share.

**Articles on the share (paste onto Editorial, then Publish to Learn)**

- Payday-lenders commentary (the 2026-08-31 briefing in the thread) — library, beside lesson 1  
- Bad-brokers commentary — library, beside lesson 4  
- Cashflow commentary — library, beside lesson 2  
- HMRC Time to Pay explainer (the long “not a loan / can’t vs won’t” piece) — library, beside lesson 3  

The diagnostic-quiz / Tally / Pipedrive sketch in that same thread is **not** Learn. Explore stays the assessment.

**Compliance on ingest.** Scripts and article bodies still pass `reviewEditorialCopy` (packager line, no invented rates). The promo’s “check your eligibility” / “affordable structure” line is a Director call at the gate — Learn’s CTA is Explore, not a promise of terms.

**Ingest order**

1. Desks and public host work.  
2. Copy keep-MP4s into Nexus; create video drafts with the share’s descriptions as the starting transcript/description.  
3. Paste the four articles onto Editorial.  
4. Gates, then publish. Apply the path positions above unless Shaun changes them.  
5. DNS for `learn.stratanexus.co.uk`.  
6. Flip `sme_open` to Learn.

## Failure

- Unknown or unpublished slug → public 404 with link home. No corpus leak.
- Bad embed → description/transcript + “video unavailable”; CTA remains.
- Bot down or rate-limited → unavailable line; lessons still work.
- Slug clash on publish → desk error, no overwrite.
- Learn host + Nexus path → Learn 404.

## Tests (must exist)

- Publish refuses without both gates; `autoPublish` cannot be true.
- Public GET returns only live pieces; drafts and press releases never appear.
- Path positions unique among live rows; home path skips holes.
- Edit-after-publish takes the piece off Learn until republish.
- Unpublish → 404 on the slug; bot corpus drops it.
- This helped increments once per cookie, not twice.
- Librarian: grounded answer cites live pieces; eligibility/rate/“my company” returns handoff; downed model returns unavailable.
- Host split: Learn never serves `/pipeline`; `leads.` Learn API 404s.
- Video: reject a raw `assets.grok.com` URL on publish; accept stored Learn MP4 or YouTube/Vimeo.
- `sme_open` body contains `learn.stratanexus.co.uk`.

## Success

- Job 1: open-follow-up clicks land on Learn; some continue to Explore.
- Job 2 later: `/read/:slug` and `/watch/:slug` are public URLs with real titles and meta description. Full SSR is not a v1 gate; set `document.title` and OG tags from the piece.
- Training, not a forum: return visits and “this helped” are the proof of life.

## House policy (unchanged)

Packager, not lender. No invented figures. No rates or guarantees. No consumer-credit claims. Live customer conversation is Shaun’s. Nothing is sent by the bot. PECR and suppression stay on outreach, not on this open page.
