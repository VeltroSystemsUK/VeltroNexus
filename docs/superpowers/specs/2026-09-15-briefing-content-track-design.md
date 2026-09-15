# Direct Outreach — mirror/portal content track

Date: 2026-09-15  
Status: approved to build  
Owner: Shaun Tuhey  
Source script: `C:\Users\Shaun\Downloads\gemini-code-1789451271482.json`  
Related: `docs/superpowers/specs/2026-09-14-direct-outreach-design.md`, `docs/superpowers/specs/2026-09-14-direct-outreach-craft-session-design.md`

## Goal

Generated briefing copy follows one named house script. Bind proven facts, freeze the filled slides, art-direct in Craft, snapshot to HTML. Shaun can always see what was generated versus what was sent. The pack is six themed stills with real HTML links on the portal and the two CTAs.

This **replaces** the five-page Cover / What we can see / Hypothesis / Mechanism / Next step Craft board for Direct Outreach. Board gate, cover email, PECR, send-preview, and Promote rules do not change.

## Locked decisions

- **Track id:** `mirror_portal`.
- **Dwell is ours.** They sat on stratafinance.co.uk. Copy must not say high-value prospects dwell on *their* website.
- **5b is the sales proof:** they are reading a briefing we made because they spent time on the site. Veltro is how they do that for their own traffic. Do not claim an AI built the pack instantly.
- **Finance claims stay packager-true.** Strata is a packager, not a lender. No “we inject runway”, “unlock trapped capital”, or Time-To-Pay as a done deal unless the named hypothesis is actually cash-timing / tools.
- **Cover email unchanged:** short private note from Shaun (`director` / `enquiries@`) plus his signature. Subject does not mention Veltro. No calendar booking URL.
- **CTAs:** finance → `https://www.stratafinance.co.uk/#contact`. Sales → `/veltro?b={token}` (same as today). No `/book-finance-consultation` or `/book-sales-booster-demo`.
- **Public player is stills.** `visual_vibe` is a Craft art note, not a live widget runtime. Portal branching is HTML links to later sections of the same pack.
- **Clear track:** bind → house script → `filledSlides` (frozen at generate) → Craft board (edits) → `packHtml` (convert) → send.
- **Copy guard** still bans `we lend`, `you have late payers`, rates (`\d+%`), `learn.stratanexus`. Also ban: `built this bespoke playbook instantly`, `AI tracked your dwell`, `inject immediate`, and “dwell on your site” meaning *their* site.

## Non-goals

- Live motion / gauges / glowing widgets in the public pack.
- A second SMTP stack or Shaun’s personal mailbox.
- Completing Fez / Veltro trial logins.
- Calendar booking routes.
- Inventing industry, invoices, or cashflow figures.
- Changing the Direct Outreach dwell gate (still 5+ on-site dwells).
- New SQLite tables.

## Content track

```
opener (CH + dwell)
  → BriefingBind (+ industry from SIC)
  → fill mirror_portal house script
  → persist filledSlides + slides[] (derived) + cover
  → Craft six pages from filledSlides
  → Convert: JPEG stills + HTML links → packHtml
  → Final draft preview (cover + pack) → Send
```

| Layer | Mutates? | Home |
|---|---|---|
| Bind | No (facts) | derived on generate from opener |
| House script | Repo only | `shared/briefingTracks/mirrorPortal.ts` |
| `filledSlides` | Frozen at generate | `uploads/briefings.json` |
| Craft board | Shaun | IDB `briefing:{openerId}` |
| `packHtml` | Convert | `uploads/briefings.json` |
| Cover email | Generate; send stamps live URL + signature | `cover` + `signatureHtml(director)` |

Generate must not overwrite `filledSlides` or `packHtml` if the briefing already exists and is not revoked. Re-generate is a new briefing id (existing behaviour: return the current draft).

## Bind

Extend `BriefingBind`:

```
companyName: string
industry: string          // short trade label from first SIC, else "your trade"
dwellLine: string         // existing dwellLine()
filingsLine: string       // existing filingsLine()
hypothesis: BriefingHypothesis
enquiryUrl: string
veltroUrl?: string        // filled live as /veltro?b={token}
pageUrl?: string          // optional site they typed in Craft Fetch site
```

`industry` is a small SIC-prefix map (construction, IT, manufacturing, …) plus fallback `"your trade"`. Do not scrape a marketing slogan as industry.

Merge tags (same filler as Craft): `companyName`, `industry`, `dwellLine`, `filings`, `hypothesis`, `mechanism`, `enquiryUrl`, `veltroUrl`.

## Six slides (house copy)

Ids, titles (Craft page names / eyebrow themes), and **locked generated body**. Shaun may edit on the board; `filledSlides` keeps the generated text.

### slide_1 — Mirror

Visual note: company name, industry, room for logo or site screenshot from Gallery.

Body:

```
{{companyName}}
{{industry}}

{{dwellLine}}

We can see the company on the register, and that you came back to the site. That is what this note is built from.
```

### slide_2 — Agitation

Visual note: two weights — capital (filings) and this visit (dwell). Not a leaky funnel on *their* site.

Body:

```
Two weights, from what we can actually see.

{{filings}}

{{hypothesis}}

And you spent time on this site. That is why this note exists — not a claim about traffic on your own website.
```

### slide_3 — Shift

Visual note: two engines, still, not a live machine.

Body:

```
It does not have to stay a grind on both sides.

{{mechanism}}

The other door is a briefing like this one, made for a director who actually sat on a site. You are reading that proof.
```

(`mechanism` already contains “Strata is a packager, not a lender.”)

### slide_4 — Portal

Visual note: two labelled paths. Links are HTML under the still, not widgets.

Body:

```
From what we can see for {{companyName}}, which friction is heavier right now?
```

Links:

- `Cashflow and the file` → `#slide-5` (finance still)
- `This briefing, for my own traffic` → `#slide-6` (sales still)

### slide_5 — Cashflow

Visual note: calm, professional.

Body:

```
{{mechanism}}

If this is in the right area, reply and I'll put a file together.
```

Link: `Enquire or apply` → `enquiryUrl`.

### slide_6 — Outreach

Visual note: the pack itself is the artefact.

Body:

```
You are reading a private briefing because you spent time on the site. We made this pack. Veltro is how you do this for directors who sit on your pages — not a claim that software built it while you waited.
```

Link: `Veltro` → `veltroUrl` (live `/veltro?b={token}`).

## Record shape

Add to `BriefingRecord` (existing fields stay):

```
trackId?: "mirror_portal"
filledSlides?: FilledSlide[]
generatedAt?: string
```

```
FilledSlide = {
  slideId: string
  theme: string
  title: string
  body: string
  visualNote: string
  links?: { label: string; href: string }[]
}
```

`slides[]` remains for fallback HTML when `packHtml` is missing: title + body from `filledSlides`, enquiry/veltro on 5 and 6.

Copy guard runs on cover + filled slide bodies + link labels, **not** on `packHtml` (raster CSS).

## Craft

`briefingDocumentFromBind` builds **six** pages: Mirror, Agitation, Shift, Portal, Cashflow, Outreach. Each page: eyebrow = theme, heading = title, body = filled body. Portal/Cashflow/Outreach may also show the link labels as text nodes (the real hrefs are in pack HTML).

Gallery / Fetch site unchanged. Screenshot is optional art on Mirror, not a bind requirement.

Convert: JPEG each page in order; `packHtmlFromPageImages` wraps stills in `<section id="slide-N">` and injects the HTML links for slides 4–6. Stop line stays.

## Preview and send

Unchanged loop: Send opens Final draft (cover with signature + pack). Preview does not activate the token. Send activates, stamps the live briefing URL into the cover, appends Shaun’s director signature.

## Tests (acceptance)

- Filling the house script for a stacked-debt opener includes packager language and does **not** include “dwell on your site”, “AI tracked”, or “inject immediate”.
- `filledSlides` has six ids in order `slide_1` … `slide_6`.
- Industry fallback is `"your trade"` when SIC is empty.
- Craft document from bind has six named pages.
- Pack HTML contains `#slide-5`, `#slide-6`, enquire href, and Veltro href.
- Existing send-preview still includes Shaun Tuhey / `07898 789 313` and does not activate.
- Copy guard rejects the Gemini original slide_2 “leaky bucket” line.

## Out of this spec

Old five-page boards already in IDB can stay until Shaun regenerates or starts a new design; new generates use six pages. Do not migrate historical `packHtml`.
