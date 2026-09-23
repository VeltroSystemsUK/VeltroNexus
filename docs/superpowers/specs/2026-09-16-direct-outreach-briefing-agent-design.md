# Direct Outreach — SAL-3 briefing auto-send

Date: 2026-09-16  
Status: draft for review  
Repo: Nexus  
Owner: Shaun Tuhey  
Agent: SAL-3 Morgan Calder  
Related: `docs/superpowers/specs/2026-09-14-direct-outreach-design.md`, `docs/superpowers/specs/2026-09-14-direct-outreach-craft-session-design.md`, `docs/superpowers/specs/2026-09-15-briefing-content-track-design.md`, `docs/agentic-org/agents/SAL-3.md`

## Goal

When a company is already on Direct Outreach (5+ on-site dwells), SAL-3 generates the house CRAFT/briefing pack and sends **the same Shaun cover email** that Send uses today — in the next Sales OS window — **only if** the pack names their actual trade and every web link in the send will work. If either gate fails, the card stays in Direct Outreach with a **needs you** badge. Shaun types the industry or fixes the pack, then Send still works by hand.

This does **not** change the cover copy, the director mailbox, the dwell gate, Promote, or PECR.

## Locked decisions

- **New roster line:** SAL-3 Morgan Calder. Not a James (SAL-2) mandate. Cover is Shaun’s director voice; James stays hunt/convert.
- **Same email:** `buildCoverEmail` + `mailboxForAgent("director")` + `touchId: "direct_outreach"` + Shaun’s signature. Subject still `A private note for the directors of {company}`. No calendar URL. No Veltro in the subject. Stop line stays.
- **When:** next Sales OS window only — Mon–Fri 08:30–16:30 Europe/London. Same window helper as convert (`nextConvertSendWindow`). Never a midnight send as Shaun.
- **Generate:** auto on that tick if there is no live briefing. House pack is `customer-visual-aids.html` via existing `createDraftBriefing`. Do **not** overwrite a Craft-converted `packHtml` that is not the house pack.
- **Industry:** expand `industryFromSic` to honest UK trade labels that read in “the {industry} space”. Auto-send only when the spoken industry is a real label. `"your trade"`, empty, `{{industry}}`, and `INDUSTRY` are not sendable. Shaun can type `industryOverride` on the card; that wins.
- **Links:** every `<a href>` in the cover and the pack, plus in-pack `data-go` targets, must resolve. Dead, leftover merge tags, localhost, or off-allowlist hosts → hold. Do not invent new CTAs in this spec; verify the hrefs that actually go out.
- **Refer:** hold on the Direct Outreach card (`data-testid="badge-briefing-needs-you"`) with a reason. No new column. No digest email in v1. DNC / STOP still leave the board (Unsubscribed), they are not a “needs you”.
- **Manual Send:** Final draft preview stays required for the button. That is Shaun’s override after he has looked. Auto-send does not open preview and **never** skips a gate. Manual Send still refuses DNC / suppression / copy guard / dead links; it may proceed once `industryOverride` (or a mapped SIC) makes the industry sendable.
- **Send path:** `sendEmail` / `mailIsSuppressed` only. STOP is org-wide. Hard bounce is mailbox-only. Agent Mail log is the contacted record. No second SMTP stack.
- **Promote / privacy:** unchanged. Token live only after a successful send path (activate then send; revoke if send fails — existing). Invalid token stays the private wall.

## Non-goals

- Rewriting the cover or house pack copy.
- A new mailbox, from-name, or James sending this mail.
- Auto Craft art-direction or JPEG snapshots.
- Changing the 5-dwell Direct Outreach gate.
- Changing Promote (briefing dwell / reply / enquiry).
- Calendar booking URLs.
- New SQLite tables.
- A daily digest email of holds.
- Guessing industry from the company website or a marketing slogan.

## Architecture

```
hydrate / recordDwell
  → dwellCount >= 5 → direct_outreach (existing)
  → James already stopped (stopReason: direct_outreach)

ORC-1 tick (60s) + London OS window
  → SAL-3 tickDirectOutreachBriefings()
       for each direct_outreach card without a successful send:
         DNC / suppressed → Unsubscribed (existing), never send
         ensure draft (house pack, or keep Craft pack)
         refill industry into pack if override or mapped label is now known
         run gates
         fail → briefingHold on the opener, badge on the card
         pass → activate → HTTP-check cover URL → sendOpenerBriefing
                 send fail → revoke (existing) + hold smtp
                 send ok  → clear hold, live briefing, Agent Mail outbound
```

Source of truth:

| Concern | Home |
|---|---|
| Board status, dwell, briefingId | `uploads/openers.json` |
| Industry override, hold reason | `OpenerRecord` (same JSON) |
| Pack + cover + token | `uploads/briefings.json` |
| SIC → spoken industry | `shared/briefingTracks/mirrorPortal.ts` |
| Link collect + check | `shared/briefingLinks.ts` (new) |
| Tick | `server/services/briefings.ts` called from `agenticWorkflow.tick` |
| Cover send | existing `sendOpenerBriefing` |
| Suppression | `uploads/mail_suppression.json` (unchanged) |

No new JSON file.

## Agent

**SAL-3 — Morgan Calder** (Direct Outreach briefing). Tier 2, reports to ORC-1. Runtime spec: `docs/agentic-org/agents/SAL-3.md`.

Org files this implementation **must** update (do not ship the tick without them):

- `docs/agentic-org/corporate_structure.md` — roster row, SAL-3 paragraph, delegation row, version bump
- `docs/agentic-org/agents.mmd` — ORC → SAL-3 → SMTP
- `docs/agentic-org/CLAUDE.md` — add SAL-3 to the you-are-one-of list; never-send-without-industry / never-send-dead-link
- `docs/agentic-org/delegation_matrix.csv` — `direct_outreach_briefing_send,SAL-3,no,…` and `direct_outreach_briefing_hold,SAL-3,yes,…`

## Industry gate

Spoken industry is what appears in the pack: *“Making a mark in the **{industry}** space”*.

### Mapping

`industryFromSic(sicCodes): string | null`

Specials **before** the table (existing construction-over-manufacturing rule, plus software over generic IT):

1. Any SIC 2-digit **41–43** → `"construction"`
2. Any SIC 2-digit **62** → `"software"`
3. Else first SIC whose 2-digit prefix hits the table
4. Else `null`

| 2-digit | Label (must read in “the {label} space”) |
|---|---|
| 01–03 | agriculture |
| 05–09 | mining |
| 10–33 | manufacturing |
| 35 | energy |
| 36–39 | water and waste |
| 45 | motor trade |
| 46 | wholesale |
| 47 | retail |
| 49–53 | transport |
| 55–56 | hospitality |
| 58 | publishing |
| 59–60 | media |
| 61 | telecoms |
| 63 | information services |
| 64–66 | financial services |
| 68 | property |
| 69 | legal and accounting |
| 70 | consulting |
| 71 | architecture and engineering |
| 72 | scientific research |
| 73 | advertising |
| 74–75 | professional services |
| 77 | rental |
| 78 | recruitment |
| 79 | travel |
| 80–82 | business support |
| 84 | public sector |
| 85 | education |
| 86–88 | health and care |
| 90–93 | arts and leisure |
| 94 | membership |
| 95 | repair |
| 96 | personal services |

Do not use Companies House `n.e.c.` descriptions as the spoken industry. Put the raw SIC (and description if the opener has it) on the hold **detail** so Shaun can type a short label.

`industryFromSic([])` is `null`, not `"your trade"`.

Craft/preview bind may still display `"your trade"` when `null` and no override — that path is Shaun looking at the board, not a send.

### Sendable industry

```
sendableIndustry(opener): string | null
  override = trim(opener.industryOverride)
  if override and override is not in FORBIDDEN_INDUSTRY → override
  mapped = industryFromSic(opener.sicCodes)
  if mapped → mapped
  return null
```

`FORBIDDEN_INDUSTRY` (case-insensitive): `""`, `"your trade"`, `"{{industry}}"`, `"industry"`, `"INDUSTRY"`.

Before send, the filled pack HTML **must** contain the sendable label in `[data-industry]` (or the house `{{industry}}` slot after fill). If the pack still shows a forbidden value, refill via `fillOutreachPackHtml` with the sendable label. If it still does not contain the label → hold `industry_unknown`.

This spec does **not** add a new ICP/excluded-sector filter. Cards already on Direct Outreach already passed hunt.

## Link gate

### Collect

From cover HTML + pack HTML:

- every `a[href]`
- every `data-go` value (in-pack navigation, not an HTTP URL)

Ignore `javascript:`, `mailto:`, and empty after trim.

### In-pack targets

Each `data-go` value must match a `data-id` on a `.slide` in the same pack (today: `slide_5a_finance`, `slide_5b_sales`). Hash-only hrefs (`#slide-5`) must match an `id` in the pack. Fail → `link_dead` with that target in `detail`.

### HTTP hrefs

Resolve relative hrefs against `helloPublicOrigin()` (cover briefing URL, `/veltro?b=`, `/brand/logo/`).

Host allowlist (after redirect target host must also match, except www-strip):

- `www.stratafinance.co.uk`, `stratafinance.co.uk`
- `hello.stratanexus.co.uk` plus the host of `HELLO_PUBLIC_URL` / `helloPublicOrigin()`
- `veltro.co.uk`, `www.veltro.co.uk`

Anything else (including `localhost`, `127.0.0.1`, `0.0.0.0`, `leads.stratanexus.co.uk` as the **sent** URL) → `link_dead`. Briefing links that land on the leads host must already have been rewritten to hello (existing `helloRedirectUrl`); SAL-3 sends the hello origin, never the leads origin.

Leftover `{{…}}` in an href → `link_dead`.

Check: GET (HEAD then GET if HEAD is 405), timeout 5s, follow redirects, reject link-local / private IPs. Strip the fragment (`#tools`, `#contact`) before the request. Success is HTTP 200–399. Cache by origin+pathname for the duration of **one tick** so fifty cards do not hit stratafinance fifty times.

Cover URL `https://hello.stratanexus.co.uk/briefing/{token}` is checked **after** activate and **before** `sendEmail`. If it is not 200–399, revoke the token (do not leave a live unsent briefing) and hold `link_dead`.

Do not HTTP-check Google Fonts, or `<img>` / `<script>` / CSS `url()` except `/brand/logo/` paths referenced from the pack (check each unique logo path once per tick).

House CTAs in the current pack (`https://www.stratafinance.co.uk/#tools`, `https://veltro.co.uk/#contact`) stay unless they fail this check. This spec does not retarget them to `/veltro?b={token}`. If a CTA is down, hold and refer — do not send a broken button.

## Other gates (every auto send)

Run in this order. First failure wins. DNC is not a hold.

| Order | Gate | Fail behaviour |
|---|---|---|
| 1 | `status === "direct_outreach"` | skip |
| 2 | already `briefing.status === "live"` **and** Agent Mail has outbound `touchId: "direct_outreach"` to that opener email in `sent` or `mock` | skip (idempotent). Live token with no outbound mail is a crashed send — retry `sendEmail`, do not skip |
| 3 | DNC / `mailIsSuppressed` | Unsubscribed / existing STOP path — **not** needs-you |
| 4 | no sendable mailbox | hold `no_mailbox` |
| 5 | SMTP mock / unhealthy | hold `smtp` (do not pretend it sent) |
| 6 | mailbox daily cap (same `enquiries@` cap as hunt) | hold `volume_cap`, retry next window |
| 7 | per-tick cap **10** briefing sends | remaining cards wait; no hold |
| 8 | pack HTML present (`briefing-pack`) | hold `pack_missing` |
| 9 | copy guard (`briefingCopyOk` on cover + filled bodies + link labels, not raster CSS) | hold `copy_guard` |
| 10 | sendable industry + pack contains it | hold `industry_unknown` |
| 11 | in-pack targets + allowlisted hrefs HTTP-ok (except cover URL) | hold `link_dead` |
| 12 | activate + cover URL HTTP-ok | revoke + hold `link_dead` |
| 13 | `sendEmail` success | else revoke if we activated this attempt + hold `smtp` |

Cover HTML on send is still `signedCoverFor` (rebuilds from `buildCoverEmail` with the live hello briefing URL + director signature). Auto-send does not use a stale draft `{{placeholder}}` cover URL.

## Hold on the card

Add to `OpenerRecord` (JSON, no SQLite):

```
industryOverride?: string
briefingHold?: {
  reason: "industry_unknown" | "link_dead" | "copy_guard" | "smtp" | "no_mailbox" | "volume_cap" | "pack_missing"
  at: string
  detail?: string
}
```

`normalizeOpener` copies both. Clear `briefingHold` on successful send.

UI (Direct Outreach column + drawer only):

- Card badge `data-testid="badge-briefing-needs-you"` when `briefingHold` is set and status is `direct_outreach`. DNC still wins over this badge.
- Drawer: one-line reason from a fixed map (below) + `detail` if present.
- Industry field `data-testid="input-briefing-industry"` + save `data-testid="btn-save-briefing-industry"`. Saving sets `industryOverride`, clears a hold whose reason is `industry_unknown`, and does **not** send immediately — next OS-window tick sends if gates pass. Shaun can still press Send (preview) after save.
- Existing Generate / Design / Send stay. Send stays disabled while DNC, while pack is missing, or while `sendableIndustry` is null (the industry field is the unblock).

Reason copy (staff only, never in the customer email):

| reason | Drawer line |
|---|---|
| industry_unknown | No sendable industry — type the trade they are actually in |
| link_dead | A briefing link did not work |
| copy_guard | Copy guard blocked the pack |
| smtp | Mailbox not live — send held |
| no_mailbox | No sendable email |
| volume_cap | Daily mailbox cap — will retry next window |
| pack_missing | Generate the house pack first |

Rank inside Direct Outreach: existing dwell/click rank, then cards with `briefingHold` sort **above** unsent cards with no hold (Shaun sees the queue that needs him). Live-sent cards stay in the column until Promote as today.

## Tick

`tickDirectOutreachBriefings(now = new Date())` from `agenticWorkflow.tick()` after the existing deal due-loop (failures in SAL-3 must not abort hunt/convert).

If `nextConvertSendWindow(now) > now` (outside Mon–Fri 08:30–16:30 London) return 0. Do not generate-outside-window either — generate and send are the same pass so a Friday 17:00 dwell waits until Monday 08:30.

Idempotent: a second tick in the same window does not double-send.

Per card errors are caught, logged, hold `smtp` or `pack_missing` as appropriate, next card continues.

## Data flow (one card)

```
opener (direct_outreach, not DNC)
  → ensureDraftBriefing
       no briefing / revoked → createDraftBriefing
       house pack draft → keep
       Craft packHtml → keep (do not withHousePack)
  → bind industry = sendableIndustry || "your trade"
  → if sendable: refill pack industry slots
  → gates
  → sendOpenerBriefing({ publicBaseUrl: helloPublicOrigin() })
```

`sendOpenerBriefing` stays the only SMTP call. Wrap it with the new gates rather than forking a second sender.

## Error handling

- SMTP mock: hold `smtp`. Never write `sent` / `mock` as a successful Direct Outreach send. (Hunt already treats mock as not sent; this desk follows that.)
- Activate then send fail: existing revoke. Plus `briefingHold.reason = smtp`.
- Link check timeout: treat as dead (fail closed).
- Industry override with a forbidden token: ignore override, hold `industry_unknown`.
- Card dragged back to Nurturing: skip SAL-3 (status gate). Do not send a briefing after James has been restarted.
- STOP inbound after live send: existing revoke + Unsubscribed.

## Tests (acceptance)

Shared:

- `industryFromSic(["43210"])` → `"construction"`; `["62012"]` → `"software"`; `["46900"]` → `"wholesale"`; `["49320"]` → `"transport"`; `[]` and `["99999"]` → `null`.
- Construction 41–43 wins when mixed with manufacturing.
- `sendableIndustry` prefers a clean override; rejects `"your trade"`; uses mapped SIC otherwise.
- Link collect: house pack yields the finance CTA, the sales CTA, and `data-go` targets `slide_5a_finance` / `slide_5b_sales`.
- Leftover `{{veltroUrl}}` href fails closed.
- `localhost` / `leads.stratanexus.co.uk` briefing URL fails closed.
- Allowlisted 200 passes; 404 fails.

Service:

- Outside OS window: tick sends 0 and does not mint a live token.
- Inside window, mapped industry, links stubbed 200: one `sendEmail` as director, `touchId: "direct_outreach"`, cover subject unchanged, stop line present, hello briefing URL in the cover, signature present.
- Same opener second tick: no second send.
- `industryFromSic` null and no override: no send, `briefingHold.reason === "industry_unknown"`, opener status still `direct_outreach`.
- Override `"haulage"` then tick: pack `[data-industry]` is haulage, send happens.
- DNC opener: no send, no needs-you badge path (Unsubscribed).
- Dead CTA: no send, `link_dead`.
- Custom Craft `packHtml` is not replaced by the house pack on tick.
- Tick cap 10: 11th eligible waits with no hold.
- SendEmail failure after activate: briefing not left live.

UI (openers page string tests, same style as `openersUi.test.ts`):

- `data-testid="badge-briefing-needs-you"`
- `data-testid="input-briefing-industry"`
- `data-testid="btn-save-briefing-industry"`
- Existing `btn-send-briefing` / `btn-generate-briefing` still present.

## Out of this spec

Old five-page boards, historical `packHtml`, Veltro trial logins, in-page stratafinance click tracking, and James convert copy. Do not migrate those.

Implementation plan is a later step (`docs/superpowers/plans/`) after this spec is approved.
