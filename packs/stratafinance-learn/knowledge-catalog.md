# Strata Learn — knowledge catalog

Companion inventory for the stratafinance.co.uk Learn pack. Human-readable map of every page, with house rules. Machine copy: `knowledge-catalog.json`. Agent map: `llms.txt` (site root) and `learn/llms.txt`. Full handbook text: `llms-full.txt`.

## Identity

Strata Finance packages distress-refinance files for UK SMEs. It does **not** lend, does **not** take insolvency appointments, and is **not** FCA-authorised. Learn is training. It is not a quote, not eligibility, and not advice on a named company.

### House rules (copy and bots)

1. Say plainly that Strata packages and does not lend.
2. No rates, APR, “guaranteed”, “instant approval”, “we will lend”, or consumer-credit claims.
3. Do not tell a visitor they are eligible.
4. Time to Pay is an instalment arrangement for tax already owed — not a loan, not a right, not a place to hide.
5. Do not name lenders as villains. Teach structures.
6. The sales TTP page (`/hmrc-time-to-pay.html`) and the Learn TTP article (`/learn/read/hmrc-time-to-pay.html`) stay separate.

## What this pack is

Static HTML that reuses the live site’s header, footer, fonts (Unbounded, Plus Jakarta Sans, Space Mono), and CSS tokens (logo blue / gold / green / red). Drop the `learn/` folder onto the site root. Add **Learn** to the main nav. Do not replace existing pages.

## Out of this pack

News, the Ask librarian, “This helped” counts, and “email me this” stay on `learn.stratanexus.co.uk` — they need a backend.

## Nav patch

Current header: The Problem · How It Works · Solutions · Free Tools

Add **Learn** after Solutions:

```html
<a href="learn/index.html">Learn</a>
```

Header CTAs stay **Enquire** and **Check Eligibility**, both to `index.html#tools`. Footer first column gets the same Learn link.

## Sitemap

### Hub and tools

| Page | File |
|------|------|
| Learn home | `learn/index.html` |
| Tools index | `learn/tools.html` |
| Debt Stress Check | `learn/tools/debt-stress-check.html` |
| Time to Pay Calculator | `learn/tools/time-to-pay-calculator.html` |
| Stacked-debt film | `learn/film.html` |
| Thursday Pack | `learn/thursday-pack/` |

### Start here

| # | Title | Slug | Length | Kind |
|---|-------|------|--------|------|
| 01 | [What a commercial payday lender actually is](learn/watch/payday-lenders.html) | `payday-lenders` | 1 min | video |
| 02 | [Poor cashflow will kill the business on its own](learn/watch/cashflow.html) | `cashflow` | 1 min | video |
| 03 | [Time to Pay is not time to hide](learn/watch/time-to-pay.html) | `time-to-pay` | 1 min | video |
| 04 | [How to avoid a warehouse broker](learn/watch/bad-brokers.html) | `bad-brokers` | 55 sec | video |

### Director's handbook

| # | Title | Slug | Length | Quizzes | Words |
|---|-------|------|--------|---------|-------|
| 01 | [If the business is in trouble, start here](learn/read/if-the-business-is-in-trouble.html) | `if-the-business-is-in-trouble` | 12 min | 6 | 1017 |
| 02 | [Warehouse brokers](learn/read/warehouse-brokers.html) | `warehouse-brokers` | 16 min | 7 | 1451 |
| 03 | [Hidden commissions](learn/read/hidden-commissions.html) | `hidden-commissions` | 18 min | 6 | 1515 |
| 04 | [HMRC Time to Pay](learn/read/hmrc-time-to-pay.html) | `hmrc-time-to-pay` | 16 min | 6 | 1335 |
| 05 | [Terms that should stop the pen](learn/read/terms-that-should-stop-the-pen.html) | `terms-that-should-stop-the-pen` | 18 min | 7 | 1352 |
| 06 | [Products that finish companies](learn/read/products-that-finish-companies.html) | `products-that-finish-companies` | 17 min | 6 | 1201 |
| 07 | [Directors in the danger zone](learn/read/directors-in-the-danger-zone.html) | `directors-in-the-danger-zone` | 20 min | 6 | 1115 |
| 08 | [Help that is actually there](learn/read/help-that-is-actually-there.html) | `help-that-is-actually-there` | 16 min | 6 | 1153 |
| 09 | [Stacked debt](learn/read/stacked-debt.html) | `stacked-debt` | 15 min | 6 | 991 |

## Lesson notes

### 01 — If the business is in trouble, start here

- **URL:** `/learn/read/if-the-business-is-in-trouble.html`
- **Excerpt:** A director's map for the first 48 hours — what to stop doing, what to read, and which help is real.
- **Duration:** 12 min
- **Quizzes:** 6 (answer key in `knowledge-catalog.json`)
- **Related:** `warehouse-brokers`, `hidden-commissions`, `hmrc-time-to-pay`, `terms-that-should-stop-the-pen`, `products-that-finish-companies`, `directors-in-the-danger-zone`, `help-that-is-actually-there`, `stacked-debt`

### 02 — Warehouse brokers

- **URL:** `/learn/read/warehouse-brokers.html`
- **Excerpt:** How a call-centre broker actually gets paid, why they will not name the lender, and the questions that end the pitch.
- **Duration:** 16 min
- **Quizzes:** 7 (answer key in `knowledge-catalog.json`)
- **Related:** `hidden-commissions`, `stacked-debt`, `hmrc-time-to-pay`, `products-that-finish-companies`, `terms-that-should-stop-the-pen`

### 03 — Hidden commissions

- **URL:** `/learn/read/hidden-commissions.html`
- **Excerpt:** Secret fees, half-secret small print, Wood, Hopcraft, and why a 2025 Supreme Court case is not a magic claim for every commercial director.
- **Duration:** 18 min
- **Quizzes:** 6 (answer key in `knowledge-catalog.json`)
- **Related:** `help-that-is-actually-there`

### 04 — HMRC Time to Pay

- **URL:** `/learn/read/hmrc-time-to-pay.html`
- **Excerpt:** An instalment arrangement, not a loan, not a right, and not a place to hide. What HMRC actually looks at, and what happens if you break it.
- **Duration:** 16 min
- **Quizzes:** 6 (answer key in `knowledge-catalog.json`)
- **Related:** `stacked-debt`, `help-that-is-actually-there`, `directors-in-the-danger-zone`

### 05 — Terms that should stop the pen

- **URL:** `/learn/read/terms-that-should-stop-the-pen.html`
- **Excerpt:** All-monies, additional security on demand, a personal guarantee that never dies, and the boxes you ticked without a solicitor in the room.
- **Duration:** 18 min
- **Quizzes:** 7 (answer key in `knowledge-catalog.json`)
- **Related:** `stacked-debt`, `products-that-finish-companies`

### 06 — Products that finish companies

- **URL:** `/learn/read/products-that-finish-companies.html`
- **Excerpt:** Daily sweeps, stacked short-term credit, bridging used as working capital, and "renewals" that are just a new fee. Structures, not brand names.
- **Duration:** 17 min
- **Quizzes:** 6 (answer key in `knowledge-catalog.json`)
- **Related:** `stacked-debt`, `warehouse-brokers`, `directors-in-the-danger-zone`

### 07 — Directors in the danger zone

- **URL:** `/learn/read/directors-in-the-danger-zone.html`
- **Excerpt:** Sequana, wrongful trading, preferences, overdrawn loan accounts, and the minutes a court will actually want to see.
- **Duration:** 20 min
- **Quizzes:** 6 (answer key in `knowledge-catalog.json`)
- **Related:** `warehouse-brokers`, `help-that-is-actually-there`, `hmrc-time-to-pay`

### 08 — Help that is actually there

- **URL:** `/learn/read/help-that-is-actually-there.html`
- **Excerpt:** Business Debtline, licensed insolvency practitioners, HMRC, the Ombudsman, the company moratorium — and the firms that ring you first.
- **Duration:** 16 min
- **Quizzes:** 6 (answer key in `knowledge-catalog.json`)
- **Related:** `hmrc-time-to-pay`

### 09 — Stacked debt

- **URL:** `/learn/read/stacked-debt.html`
- **Excerpt:** How the same cash gets pledged three times, why "one more facility" is the hole, and the sequence that actually stops the digging.
- **Duration:** 15 min
- **Quizzes:** 6 (answer key in `knowledge-catalog.json`)
- **Related:** `warehouse-brokers`, `products-that-finish-companies`, `terms-that-should-stop-the-pen`, `help-that-is-actually-there`, `directors-in-the-danger-zone`


## Film beats

The film pauses at 28s, 58s, 100s, and 148s. Each pause is a three-choice check except the close (171.6s). Correct line in every case: stop stacking; map the file; Strata packages, it does not lend.

## Thursday Pack

Self-contained scenario (own stage UI). Teaches: not every broker is the same; map the stack; Time to Pay; one structure. End screen currently points at Learn tool URLs — after install, those should be `/learn/tools/debt-stress-check.html` and `/learn/tools/time-to-pay-calculator.html`.

## Existing site collisions

| Live URL | Role | Pack URL |
|----------|------|----------|
| `/hmrc-time-to-pay.html` | Sales / TTP as first layer of a refinance | `/learn/read/hmrc-time-to-pay.html` training article |
| `index.html#tools` TTP calculator | Homepage tool | `/learn/tools/time-to-pay-calculator.html` Learn copy (60-month cap under £250k) |
| Free Tools nav | Eligibility, refinance, TTP | Unchanged. Learn is extra. |

## Voice

Unbounded headings, Plus Jakarta body, Space Mono eyebrows. Short sentences. Specific nouns (sweep, Time to Pay, personal guarantee, warehouse). No “unlock your potential”. Packager line on every page.

## Files for agents

| File | Who | What |
|------|-----|------|
| `llms.txt` | Site root | Curated map of marketing pages + Learn |
| `learn/llms.txt` | `/learn/` | Learn-only map |
| `llms-full.txt` | Site root | Full handbook bodies, no quiz keys |
| `knowledge-catalog.json` | Developers / internal agents | Slugs, relations, quiz keys |
