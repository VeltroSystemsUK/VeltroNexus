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
- **House copy is the Gemini script.** Generated bodies, themes, visual notes, and button labels come from `gemini-code-1789451271482.json`. Bind still supplies `{{companyName}}` and `{{industry}}`. Filings / hypothesis / dwellLine stay on the bind for Craft leftover tags; they are not interpolated into the six frozen bodies.
- **Cover email unchanged:** short private note from Shaun (`director` / `enquiries@`) plus his signature. Subject does not mention Veltro. No calendar booking URL.
- **CTAs:** finance → `https://www.stratafinance.co.uk/#contact` (label: Unlock Our Cashflow Blueprint). Sales → `/veltro?b={token}` (label: Weaponize My Outreach). No `/book-finance-consultation` or `/book-sales-booster-demo`.
- **Public player is stills.** `visual_vibe` is a Craft art note, not a live widget runtime. Portal branching is HTML links to later sections of the same pack.
- **Clear track:** bind → house script → `filledSlides` (frozen at generate) → Craft board (edits) → `packHtml` (convert) → send.
- **Copy guard** still bans `we lend`, `you have late payers`, rates (`\d+%`), `learn.stratanexus`. Gemini house phrases (`dwell on your site`, `AI tracked your dwell`, `inject immediate`, `built this bespoke playbook instantly`) are allowed.

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

Ids and Craft page **titles** stay Mirror / Agitation / Shift / Portal / Cashflow / Outreach so pack `#slide-N` and Veltro stamping keep working. **Themes** are the Gemini names (Craft eyebrows). Shaun may edit on the board; `filledSlides` keeps the generated text.

### slide_1 — Mirror (theme: The Mirror)

Visual note: Clean, upward-trending motion widgets, display company logo and website screenshot.

Body:

```
Making a mark in the {{industry}} space takes relentless momentum. We see exactly what you are building at {{companyName}}. You have the vision and the traction, but as any founder knows, scaling introduces two massive, invisible weights.
```

### slide_2 — Agitation (theme: The Agitation)

Visual note: Scale balancing two pressures: a ticking pressure gauge (finance) and a leaky funnel (sales).

Body:

```
First, the financial squeeze: Capital gets trapped, supply chains tighten, and navigating HMRC or restructuring debt drains your energy. Second, the leaky bucket: High-value prospects 'dwell' on your site and leave in silence. You are fighting friction on both ends.
```

### slide_3 — Shift (theme: The Paradigm Shift)

Visual note: Tension breaks. Scale transforms into a sleek, synchronized engine with smooth flow animations.

Body:

```
It doesn't have to be a grind. What if you could deploy intelligent systems to solve both? We build bespoke engines that unlock trapped capital to give you breathing room, and AI-driven outreach that turns invisible traffic into jaw-dropping engagement.
```

### slide_4 — Portal (theme: The Portal)

Visual note: Highly interactive. Two distinct, glowing pathways/widgets appear on screen.

Body:

```
We've analyzed {{companyName}}'s profile, and the blueprint is ready. Where is the friction heaviest right now? Choose your playbook to see how we solve it.
```

Links:

- `I Need Financial Breathing Room & Cashflow` → `#slide-5` (finance still)
- `I Need to Weaponize My Sales & Leads` → `#slide-6` (sales still)

### slide_5 — Cashflow (theme: Financial CTA)

Visual note: Calm, steady, professional layout.

Body:

```
By intelligently restructuring debt and implementing a tailored Time-To-Pay strategy, we inject immediate cashflow runway back into the business. You built this company to lead it, not to be a full-time crisis manager. Let's get your capital working as hard as you do.
```

Link: `Unlock Our Cashflow Blueprint` → `enquiryUrl`.

### slide_6 — Outreach (theme: Sales Booster CTA)

Visual note: Sleek, high-authority, urgent.

Body:

```
You are actually experiencing our Sales Engine right now. Our AI tracked your dwell time and built this bespoke playbook instantly just to get your attention. Imagine arming your team with this exact weapon to capture your own site visitors. You just proved it works.
```

Link: `Weaponize My Outreach` → `veltroUrl` (live `/veltro?b={token}`).

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

- Filling the house script includes Gemini copy (`'dwell' on your site`, `AI tracked your dwell`, `inject immediate cashflow`, `built this bespoke playbook instantly`) and company/industry merge fields.
- `filledSlides` has six ids in order `slide_1` … `slide_6`. Titles stay Mirror / Agitation / Shift / Portal / Cashflow / Outreach.
- Portal labels and CTA labels match Gemini; hrefs stay `#slide-5` / `#slide-6` / enquire / Veltro — never the JSON booking paths.
- Industry fallback is `"your trade"` when SIC is empty.
- Craft document from bind has six named pages.
- Pack HTML contains `#slide-5`, `#slide-6`, enquire href, and Veltro href.
- Existing send-preview still includes Shaun Tuhey / `07898 789 313` and does not activate.
- Copy guard still rejects `we lend` / invented late payers / rates / `learn.stratanexus`, and **allows** the Gemini house phrases.

## Out of this spec

Old five-page boards already in IDB can stay until Shaun regenerates or starts a new design; new generates use six pages. Do not migrate historical `packHtml`.
