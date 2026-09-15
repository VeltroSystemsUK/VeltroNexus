# Mirror/portal briefing content track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Direct Outreach generate fills a frozen six-slide `mirror_portal` script from proven bind facts, Craft loads those six pages, Convert snapshots stills with HTML portal/CTA links, and Shaun can still preview/send as today.

**Architecture:** Pure fill/guard/industry in `shared/briefingTracks/mirrorPortal.ts` plus bind/merge/pack helpers. `createDraftBriefing` persists `trackId` + `filledSlides`. Craft `briefingDocumentFromBind` reads filled slides (or fills from bind). `packHtmlFromPageImages` adds `#slide-5` / `#slide-6` links. Cover email, PECR, send-preview, and the dwell gate stay as they are.

**Tech Stack:** TypeScript, Vitest, Express, React. No new npm packages. No new SQLite tables.

**Spec:** `docs/superpowers/specs/2026-09-15-briefing-content-track-design.md`

## Global Constraints

- Track id is exactly `mirror_portal`
- Dwell is on stratafinance.co.uk — generated copy must not say prospects dwell on *their* website
- Do not claim AI built the pack instantly
- Strata is a packager, not a lender; no “inject immediate” / “unlock trapped capital”
- Cover email: Shaun Tuhey (`director`) via `enquiries@`; no Veltro in the subject
- Finance CTA: `https://www.stratafinance.co.uk/#contact`
- Sales CTA: `/veltro?b={token}` when live
- Public pack is stills + HTML links, not live widgets
- Copy guard runs on cover + filled slide bodies, not raster `packHtml`
- Generate must not wipe an existing draft’s `filledSlides` / `packHtml` (return current draft)
- No live SMTP or Companies House in CI
- Windows PowerShell: `git commit -m "message"` (no bash heredocs)

## File map

- Create: `shared/briefingTracks/mirrorPortal.ts`
- Create: `server/__tests__/shared/mirrorPortal.test.ts`
- Modify: `shared/briefingHypothesis.ts` — extra banned copy
- Modify: `shared/briefingRender.ts` — `BriefingBind.industry`, `BriefingRecord.trackId` / `filledSlides` / `generatedAt`, `FilledSlide`, `packHtmlFromPageImages` section ids + links
- Modify: `shared/briefingCraft.ts` — merge `industry`
- Modify: `server/services/briefings.ts` — persist filled track on generate; copy guard blob includes filled slides
- Modify: `server/__tests__/services/briefings.test.ts`
- Modify: `client/src/components/craft/lib/briefingBoard.ts` — six themed pages
- Modify: `server/__tests__/shared/craftBriefingBoard.test.ts`
- Modify: `client/src/pages/CraftBriefing.tsx` — pass filled slides into pack HTML
- Modify: `server/__tests__/shared/briefingCraft.test.ts`
- Modify: `server/__tests__/shared/briefingHypothesis.test.ts`
- Do not rewrite: `docs/superpowers/specs/2026-09-15-briefing-content-track-design.md`

---

### Task 1: House script, industry, copy guard

**Files:**
- Create: `shared/briefingTracks/mirrorPortal.ts`
- Create: `server/__tests__/shared/mirrorPortal.test.ts`
- Modify: `shared/briefingHypothesis.ts`
- Test: `server/__tests__/shared/briefingHypothesis.test.ts`

**Interfaces:**
- Consumes: `BriefingBind`, `BriefingHypothesis`, `fillMergeTags`, `BRIEFING_ENQUIRY_URL`, `briefingCopyOk`
- Produces:
  - `MIRROR_PORTAL_TRACK_ID = "mirror_portal"`
  - `FilledSlide = { slideId: string; theme: string; title: string; body: string; visualNote: string; links?: { label: string; href: string }[] }`
  - `industryFromSic(sicCodes: string[]): string`
  - `fillMirrorPortal(bind: BriefingBind & { industry: string }): FilledSlide[]`
  - `slidesFromFilled(filled: FilledSlide[]): BriefingSlide[]`

- [ ] **Step 1: Write the failing tests**

`server/__tests__/shared/mirrorPortal.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickBriefingHypothesis } from "@shared/briefingHypothesis";
import {
  MIRROR_PORTAL_TRACK_ID,
  fillMirrorPortal,
  industryFromSic,
} from "@shared/briefingTracks/mirrorPortal";
import { briefingCopyOk } from "@shared/briefingHypothesis";

const bind = {
  companyName: "North Peak Ltd",
  industry: "construction",
  dwellLine: "You've been back on the site several times.",
  filingsLine: "8 years trading · SIC 43210",
  hypothesis: pickBriefingHypothesis({ nonBankChargeCount: 2, sicCodes: ["43210"], dwellCount: 6 }),
  enquiryUrl: "https://www.stratafinance.co.uk/#contact",
  veltroUrl: "/veltro?b=tok",
};

describe("industryFromSic", () => {
  it("maps construction prefixes and falls back", () => {
    expect(industryFromSic(["43210"])).toBe("construction");
    expect(industryFromSic(["62012"])).toBe("software");
    expect(industryFromSic([])).toBe("your trade");
  });
});

describe("fillMirrorPortal", () => {
  it("fills six slides from bind and stays packager-true", () => {
    const slides = fillMirrorPortal(bind);
    expect(MIRROR_PORTAL_TRACK_ID).toBe("mirror_portal");
    expect(slides.map((s) => s.slideId)).toEqual([
      "slide_1", "slide_2", "slide_3", "slide_4", "slide_5", "slide_6",
    ]);
    const blob = slides.map((s) => s.body).join("\n");
    expect(blob).toMatch(/North Peak Ltd/);
    expect(blob).toMatch(/construction/);
    expect(blob.toLowerCase()).toMatch(/packag/);
    expect(blob.toLowerCase()).not.toMatch(/dwell on your site/);
    expect(blob.toLowerCase()).not.toMatch(/ai tracked/);
    expect(blob.toLowerCase()).not.toMatch(/inject immediate/);
    expect(blob.toLowerCase()).not.toMatch(/built this bespoke playbook instantly/);
    expect(briefingCopyOk(blob).ok).toBe(true);
    expect(slides[3]!.links?.some((l) => l.href === "#slide-5")).toBe(true);
    expect(slides[3]!.links?.some((l) => l.href === "#slide-6")).toBe(true);
    expect(slides[4]!.links?.[0]?.href).toMatch(/#contact/);
    expect(slides[5]!.links?.[0]?.href).toMatch(/\/veltro/);
  });
});
```

Add to `briefingHypothesis.test.ts` copy guard:

```ts
expect(briefingCopyOk("High-value prospects dwell on your site and leave in silence.").ok).toBe(false);
expect(briefingCopyOk("Our AI tracked your dwell time and built this bespoke playbook instantly").ok).toBe(false);
expect(briefingCopyOk("we inject immediate cashflow runway").ok).toBe(false);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/shared/mirrorPortal.test.ts server/__tests__/shared/briefingHypothesis.test.ts`

Expected: FAIL — module `@shared/briefingTracks/mirrorPortal` not found; extra guard cases still pass the old regex.

- [ ] **Step 3: Write minimal implementation**

In `shared/briefingHypothesis.ts` extend `BANNED_COPY_RE`:

```ts
const BANNED_COPY_RE = [
  /we lend/i,
  /you have late payers/i,
  /\d+(\.\d+)?%/,
  /learn\.stratanexus/i,
  /dwell on your site/i,
  /AI tracked your dwell/i,
  /built this bespoke playbook instantly/i,
  /inject immediate/i,
] as const;
```

Create `shared/briefingTracks/mirrorPortal.ts` with `industryFromSic` (41–43 construction, 62 software, 10–33 manufacturing, else `"your trade"`), house templates from the spec bodies, `fillMirrorPortal` using `fillMergeTags` from `briefingCraft`, and `slidesFromFilled` mapping title/body plus enquiry/veltro on slides 5 and 6.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/mirrorPortal.test.ts server/__tests__/shared/briefingHypothesis.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add shared/briefingTracks/mirrorPortal.ts shared/briefingHypothesis.ts server/__tests__/shared/mirrorPortal.test.ts server/__tests__/shared/briefingHypothesis.test.ts
git commit -m "feat: freeze mirror/portal briefing house script"
```

---

### Task 2: Persist filledSlides on generate

**Files:**
- Modify: `shared/briefingRender.ts`
- Modify: `shared/briefingCraft.ts`
- Modify: `server/services/briefings.ts`
- Test: `server/__tests__/services/briefings.test.ts`

**Interfaces:**
- Consumes: `fillMirrorPortal`, `slidesFromFilled`, `industryFromSic`, `MIRROR_PORTAL_TRACK_ID`
- Produces: `BriefingRecord.trackId`, `filledSlides`, `generatedAt`; `BriefingBind.industry`; `mergeFieldsFromBind` includes `industry`

- [ ] **Step 1: Write the failing test**

In `server/__tests__/services/briefings.test.ts`:

```ts
it("generate freezes six filled mirror_portal slides", async () => {
  writeOpeners([hotOpener()]);
  const draft = await generateOpenerBriefing("hot-id");
  expect(draft.trackId).toBe("mirror_portal");
  expect(draft.filledSlides?.map((s) => s.slideId)).toEqual([
    "slide_1", "slide_2", "slide_3", "slide_4", "slide_5", "slide_6",
  ]);
  expect(draft.slides).toHaveLength(6);
  const blob = (draft.filledSlides || []).map((s) => s.body).join("\n");
  expect(blob).toMatch(/North Peak Ltd/);
  expect(blob.toLowerCase()).not.toMatch(/dwell on your site/);
  expect(draft.generatedAt).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/briefings.test.ts -t "freezes six filled"`

Expected: FAIL — `trackId` undefined.

- [ ] **Step 3: Write minimal implementation**

Add types to `shared/briefingRender.ts`. Extend `normalizeBriefing` in `server/services/briefings.ts` to keep `trackId` / `filledSlides` / `generatedAt`. `createDraftBriefing` sets `industry: industryFromSic(opener.sicCodes)`, `filled = fillMirrorPortal(bind)`, `slides: slidesFromFilled(filled)`, `trackId`, `generatedAt`. `copyBlob` concatenates filled slide bodies (not `packHtml`). `openerBriefingBind` returns `industry`. `mergeFieldsFromBind` adds `industry`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/services/briefings.test.ts`

Expected: PASS (including existing send-preview / 100% CSS save).

- [ ] **Step 5: Commit**

```
git add shared/briefingRender.ts shared/briefingCraft.ts server/services/briefings.ts server/__tests__/services/briefings.test.ts
git commit -m "feat: persist filled mirror/portal slides on generate"
```

---

### Task 3: Craft board is six themed pages

**Files:**
- Modify: `client/src/components/craft/lib/briefingBoard.ts`
- Test: `server/__tests__/shared/craftBriefingBoard.test.ts`

**Interfaces:**
- Consumes: `fillMirrorPortal` (or `filledSlides` if passed), `BriefingBind.industry`
- Produces: `briefingDocumentFromBind(bind)` → pages named Mirror, Agitation, Shift, Portal, Cashflow, Outreach

- [ ] **Step 1: Write the failing test**

Replace the five-name assertion in `craftBriefingBoard.test.ts`:

```ts
it("builds six themed pages with this company's copy", () => {
  const doc = briefingDocumentFromBind({
    ...bind,
    industry: "construction",
  });
  expect(doc.pages.map((page) => page.name)).toEqual([
    "Mirror", "Agitation", "Shift", "Portal", "Cashflow", "Outreach",
  ]);
  const cover = doc.pages[0]!.nodes.find((node) => node.type === "text" && node.name === "Body");
  expect(cover && "text" in cover && cover.text).toMatch(/North Peak Ltd/);
  expect(doc.pages.every((page) => page.nodes.every((node) => !node.locked))).toBe(true);
});
```

Keep the merge-tag and gallery-image tests; point merge-tag fill at page 0 Body still.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/craftBriefingBoard.test.ts`

Expected: FAIL — pages still Cover / What we can see / …

- [ ] **Step 3: Write minimal implementation**

`briefingDocumentFromBind` calls `fillMirrorPortal({ ...bound, industry: bound.industry || "your trade" })`, uses each slide’s `theme` as eyebrow, `title` as Hook 1, `body` as Body. Page `name` is the title from the spec table (Mirror … Outreach).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/craftBriefingBoard.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add client/src/components/craft/lib/briefingBoard.ts server/__tests__/shared/craftBriefingBoard.test.ts
git commit -m "feat: Craft briefing board loads six mirror/portal pages"
```

---

### Task 4: Pack HTML section ids and CTA links

**Files:**
- Modify: `shared/briefingRender.ts` (`packHtmlFromPageImages`)
- Test: `server/__tests__/shared/briefingCraft.test.ts`

**Interfaces:**
- Consumes: `images: string[]`, optional `slides: FilledSlide[]`, `enquiryUrl`, `veltroUrl`
- Produces: HTML with `id="slide-1"` … `id="slide-6"`, portal hrefs `#slide-5` and `#slide-6`, enquire and Veltro anchors on 5 and 6

- [ ] **Step 1: Write the failing test**

```ts
it("wraps stills with portal and CTA hrefs", () => {
  const html = packHtmlFromPageImages({
    companyName: "North Peak Ltd",
    images: ["data:image/jpeg;base64,aaa", "b", "c", "d", "e", "f"],
    enquiryUrl: "https://www.stratafinance.co.uk/#contact",
    veltroUrl: "/veltro?b=tok",
    slides: fillMirrorPortal({ /* same bind as task 1 */ }),
  });
  expect(html).toMatch(/id="slide-5"/);
  expect(html).toMatch(/id="slide-6"/);
  expect(html).toMatch(/href="#slide-5"/);
  expect(html).toMatch(/href="#slide-6"/);
  expect(html).toMatch(/stratafinance\.co\.uk\/#contact/);
  expect(html).toMatch(/\/veltro\?b=tok/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/briefingCraft.test.ts`

Expected: FAIL — no `id="slide-5"`.

- [ ] **Step 3: Write minimal implementation**

For each image index `i`, emit `<section id="slide-${i+1}" data-testid="briefing-slide-${i+1}">`. After the img, if `slides[i]?.links`, emit the `.ctas` anchors. Keep chrome and stop line. Existing two-image test still matches `briefing-pack` / enquire.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/briefingCraft.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add shared/briefingRender.ts server/__tests__/shared/briefingCraft.test.ts
git commit -m "feat: briefing pack HTML links portal and CTAs"
```

---

### Task 5: Convert uses filled slides; UI still sends via preview

**Files:**
- Modify: `client/src/pages/CraftBriefing.tsx`
- Modify: `server/__tests__/routes/openersUi.test.ts`

**Interfaces:**
- Consumes: `craftQuery.data.briefing.filledSlides`, `packHtmlFromPageImages`
- Produces: Convert POST html includes `#slide-5` when six pages exist

- [ ] **Step 1: Write the failing test**

In `openersUi.test.ts` craft block:

```ts
expect(craft).toMatch(/filledSlides/);
expect(craft).toMatch(/packHtmlFromPageImages\(/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/routes/openersUi.test.ts`

Expected: FAIL — no `filledSlides` in CraftBriefing.tsx.

- [ ] **Step 3: Write minimal implementation**

Extend `CraftPayload.briefing` with `filledSlides`. Convert:

```ts
const html = packHtmlFromPageImages({
  companyName: bind.companyName,
  images,
  enquiryUrl: bind.enquiryUrl,
  veltroUrl: bind.veltroUrl,
  slides: craftQuery.data.briefing?.filledSlides,
});
```

GET `/briefing/craft` already returns `briefing`. Merge tags on the Craft toolbar may include `industry`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/routes/openersUi.test.ts server/__tests__/services/briefings.test.ts server/__tests__/shared/mirrorPortal.test.ts server/__tests__/shared/craftBriefingBoard.test.ts server/__tests__/shared/briefingCraft.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add client/src/pages/CraftBriefing.tsx server/__tests__/routes/openersUi.test.ts
git commit -m "feat: convert briefing pack from filled mirror/portal slides"
```

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| `mirror_portal` house script + frozen `filledSlides` | 1, 2 |
| Honest dwell / packager / no instant-AI copy | 1 |
| `industry` from SIC with fallback | 1, 2 |
| Six Craft pages | 3 |
| Pack HTML `#slide-5` / `#slide-6` + enquire + Veltro | 4, 5 |
| Cover email / send-preview / PECR unchanged | 2 (existing tests stay green) |
| Copy guard on filled bodies not pack CSS | 1, 2 |
| Gallery / Fetch site / signature / Final draft | already shipped; not reopened |

## Execution

After this plan is saved: pick subagent-driven (fresh agent per task) or inline execution in this session.
