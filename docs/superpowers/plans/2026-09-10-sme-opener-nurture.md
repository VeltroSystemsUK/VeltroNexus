# SME opener convert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrol silent dual-open SME files onto a convert playbook that auto-sends three site-led James emails, queues one Openers closer for Shaun, auto-Promotes on enquiry, and diaries a 90-day wake.

**Architecture:** Pure enrol/clock/branch/wake logic in `shared/smeConvert.ts`. Executable cadence in `shared/salesOs.ts` plus named playbook `shared/playbooks/sme_nurture.yaml`. Copy in `shared/strataOutreach.ts`. Openers JSON holds stream, closer, and wake mirrors. ORC-1 tick sends N1–N3 the same way as hunt. Agent Mail open/click is the enrol trigger.

**Tech Stack:** TypeScript, Vitest, Express, React. No new npm packages. No new SQLite tables.

**Spec:** `docs/superpowers/specs/2026-09-10-sme-opener-nurture-design.md`

## Global Constraints

- Dual-open enrol: sent `sme_1` with an open AND sent `sme_2` with an open or click, still silent, `dealId` present
- Cancel hunt `sme_close` and hunt `queueCall`; do not restart `sme_1` / `sme_2` on wake
- N1 is not the same Europe/London calendar day as the `sme_2` send
- CTA origin `https://www.stratafinance.co.uk/` only; one link; stop line `If this isn't useful, reply stop and we won't email again.`
- No Learn, no Explore, no call or slot ask in convert mail
- Greeting without a real first name is `Hi,` not `Hi there,`
- Clicks heat and rank; they do not Promote
- `shouldAutoPromoteOpener` is false when `nurture.stream === "convert"` even at 8 outbound mails
- Enquiry / Apply / inbound reply auto-Promotes; STOP never gets a breakup mail
- Silent C1 complete keeps records, Non Responsive, `wakeAt` +90 London days
- Convert and Openers 3-touch never run on the same company
- No live SMTP, Companies House, or WhatsApp in CI
- Windows PowerShell: `git commit -m "message"` (no bash heredocs)

## File map

- Create: `shared/smeConvert.ts` — enrol gate, same-day N1 hold, click-branch, tick planner, wakeAt, copy guard, C1 script
- Create: `server/__tests__/shared/smeConvert.test.ts`
- Create: `shared/playbooks/sme_nurture.yaml` — named clock (same role as `sme_14d.yaml`; executable table is salesOs)
- Modify: `shared/salesOs.ts` — `sme_n1|sme_n2|sme_n3|sme_c1`, `SME_NURTURE_CADENCE`, `cadenceForDeal` / `nextCadenceStepForDeal`
- Modify: `shared/agenticWorkflow.ts` — convert fields on `AgenticDealFile`
- Modify: `shared/strataOutreach.ts` — convert templates, `OutreachTouchId`, copy guard at render
- Modify: `server/__tests__/services/strataOutreach.test.ts`
- Modify: `shared/openers.ts` — `nurture.stream`, closer, wake, block 3-touch, disable sixth-email promote
- Modify: `server/__tests__/shared/openers.test.ts`
- Modify: `server/services/openers.ts` — enrol convert card, C1 actions, auto-Promote hook, refuse 3-touch start
- Modify: `server/routes/openers.ts` — closer skip action
- Modify: `server/services/agentMailLog.ts` — enrol after `recordOpen` / `recordClick`
- Modify: `server/services/agenticWorkflow.ts` — hunt cancel, convert tick, wake
- Modify: `server/routes/inbound.ts` — refinance POST stops convert and auto-Promotes
- Modify: `client/src/pages/Openers.tsx` — convert badges, hide Start/Approve, C1 script
- Modify: `server/__tests__/routes/openersUi.test.ts`
- Modify: `docs/agentic-org/corporate_structure.md` — one SAL-2 line
- Already written (do not rewrite): `docs/superpowers/specs/2026-09-10-sme-opener-nurture-design.md`, `docs/agentic-org/agents/SAL-2-convert.md`, SAL-2.md pointer

---

### Task 1: Convert kernel

**Files:**
- Create: `shared/smeConvert.ts`
- Create: `server/__tests__/shared/smeConvert.test.ts`

**Interfaces:**
- Consumes: `hasExploreEnquiry` from `shared/smeOpenFollowUp.ts`; `normalizeEmail` / `normalizeCompanyNumber` from `shared/openers.ts`
- Produces:
  - `CONVERT_SITE_ORIGIN = "https://www.stratafinance.co.uk"`
  - `CONVERT_STOP_LINE = "If this isn't useful, reply stop and we won't email again."`
  - `CONVERT_WAKE_DAYS = 90`
  - `ConvertMail`, `ConvertDeal`, `ConvertOpener`, `ConvertTick`
  - `isSme1Touch(touchId?: string): boolean` — `sme_1` or `cold_1`
  - `isSme2Touch(touchId?: string): boolean` — `sme_2` or `cold_2`
  - `isDualOpenConvertEligible(opts): boolean`
  - `londonDateKey(iso: string, nowTimeZone?: string): string` — `Europe/London` `en-CA` YYYY-MM-DD
  - `shouldHoldN1ForSme2SameDay(opts: { sme2SentAt?: string; now?: Date }): boolean`
  - `nextConvertSendWindow(now?: Date): Date` — next 08:30 Europe/London on Mon–Fri; if now is inside a window, still return now unless same-day hold applies (hold is a separate check)
  - `convertWakeAt(completedAt: Date): string` — London calendar date + 90 days, `T08:30:00.000Z` is wrong; store ISO of that London 08:30 (`Date.UTC` via `Europe/London` formatter). Implement with: take London YYYY-MM-DD of completedAt, add 90 calendar days, then `08:30` London as ISO.
  - `shouldWakeConvert(opts: { wakeAt?: string; now?: Date }): boolean` — `now >= wakeAt`
  - `isStrataSiteUrl(url?: string): boolean` — host `stratafinance.co.uk` or `www.stratafinance.co.uk`
  - `lastStrataSiteClick(clicks: Array<{ at?: string; url?: string }>): { at: string; url: string } | null`
  - `siteClickKind(url?: string): "tools" | "process" | "contact" | "other" | null`
  - `pickConvertTouchId(opts: { stepTouchId: "sme_n1" | "sme_n2" | "sme_n3"; hasHmrcPetition: boolean; lastSiteClickUrl?: string | null }): "sme_n1" | "sme_n2" | "sme_n2_hmrc" | "sme_n2_clicked" | "sme_n3" | "sme_n3_form"`
  - `shouldSkipN2ForContactClick(lastSiteClickUrl?: string | null): boolean`
  - `planConvertTick(input): ConvertTick`
  - `convertCopyOk(rendered: { subject: string; html?: string; text: string }): { ok: true } | { ok: false; reason: string }`
  - `convertGreetingName(contactName?: string | null): string` — real first token, else `""`
  - `buildCloserScript(opts: { company: string; name: string; lastSiteClickUrl?: string | null }): string`
  - `enrolConvertDealPatch(deal: ConvertDeal, opts: { now?: Date; sme2SentAt?: string }): ConvertEnrolPatch`

`ConvertTick`:
```ts
export type ConvertTick =
  | { action: "hold"; reason: "same_day_sme_2" }
  | { action: "send"; cadenceTouchId: "sme_n1" | "sme_n2" | "sme_n3"; renderTouchId: "sme_n1" | "sme_n2" | "sme_n2_hmrc" | "sme_n2_clicked" | "sme_n3" | "sme_n3_form" }
  | { action: "queue_closer" }
  | { action: "noop" }
  | { action: "wake_reenrol" }
  | { action: "stay_parked"; reason: "opt_out" | "promoted" | "failed" | "dissolved" | "bounce_no_phone" | "smtp" };
```

`ConvertEnrolPatch`:
```ts
export type ConvertEnrolPatch = {
  convertPlaybook: "sme_nurture";
  convertEnrolledAt: string;
  convertCycle: number;
  convertWakeAt: undefined;
  convertStopReason: undefined;
  outreachTouch: 0;
  outreachTouchId: undefined;
  waitUntil: string;
  callPlaybook: undefined;
};
```

`isDualOpenConvertEligible` is false when: no deal / no deal.id; deal failed; convertPlaybook already `sme_nurture` this cycle (second pixel); opener promoted; opener `not_now` + opt_out; STOP blockedReason; inbound reply in deal.events (`/inbound (reply|opt-out)|sequence stopped/i` same as `smeOpenFollowUp`); `hasExploreEnquiry`; any inboundDeals `source === "strata_inbound"` matching email or company number; CH snapshot present and companyStatus not active; missing sme_1 open; missing sme_2 open-or-click.

`planConvertTick`: if `convertWakeAt` set and `convertPlaybook` empty and status parked → wake or stay_parked. If convertPlaybook is sme_nurture: outreachTouch 0 → send n1 or hold same day; 1 → if skip N2 then send n3 form else send n2 variant; 2 → send n3; 3 → queue_closer; else noop.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/shared/smeConvert.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CONVERT_SITE_ORIGIN,
  CONVERT_STOP_LINE,
  CONVERT_WAKE_DAYS,
  buildCloserScript,
  convertCopyOk,
  convertGreetingName,
  convertWakeAt,
  isDualOpenConvertEligible,
  isStrataSiteUrl,
  lastStrataSiteClick,
  pickConvertTouchId,
  planConvertTick,
  shouldHoldN1ForSme2SameDay,
  shouldSkipN2ForContactClick,
  shouldWakeConvert,
  siteClickKind,
} from "@shared/smeConvert";

const sme1 = {
  touchId: "sme_1",
  direction: "outbound",
  status: "sent",
  opens: ["2026-09-01T10:00:00.000Z"],
  dealId: 9,
};
const sme2 = {
  touchId: "sme_2",
  direction: "outbound",
  status: "sent",
  opens: ["2026-09-08T10:00:00.000Z"],
  dealId: 9,
  createdAt: "2026-09-08T09:00:00.000Z",
};
const deal = { id: 9, email: "ops@acme.test", companyName: "Acme Ltd", status: "outreach", stage: "outreach" };

describe("dual-open enrol gate", () => {
  it("enrols only when sme_1 opened and sme_2 opened or clicked, silent, with a deal", () => {
    expect(isDualOpenConvertEligible({ mail: [sme1, sme2], deal })).toBe(true);
    expect(isDualOpenConvertEligible({ mail: [sme1], deal })).toBe(false);
    expect(
      isDualOpenConvertEligible({
        mail: [sme1, { ...sme2, opens: [], clicks: [{ url: `${CONVERT_SITE_ORIGIN}/cdfi-funding.html` }] }],
        deal,
      })
    ).toBe(true);
    expect(isDualOpenConvertEligible({ mail: [sme1, sme2], deal: null })).toBe(false);
    expect(isDualOpenConvertEligible({ mail: [sme1, sme2], deal: { ...deal, status: "failed" } })).toBe(false);
    expect(
      isDualOpenConvertEligible({
        mail: [sme1, sme2],
        deal: { ...deal, convertPlaybook: "sme_nurture" },
      })
    ).toBe(false);
    expect(
      isDualOpenConvertEligible({
        mail: [sme1, sme2],
        deal,
        inboundDeals: [{ source: "strata_inbound", email: "ops@acme.test" }],
      })
    ).toBe(false);
  });
});

describe("same-day N1 hold", () => {
  it("holds N1 on the London calendar day sme_2 was sent", () => {
    expect(
      shouldHoldN1ForSme2SameDay({
        sme2SentAt: "2026-09-08T09:00:00.000Z",
        now: new Date("2026-09-08T15:00:00.000Z"),
      })
    ).toBe(true);
    expect(
      shouldHoldN1ForSme2SameDay({
        sme2SentAt: "2026-09-08T09:00:00.000Z",
        now: new Date("2026-09-09T08:00:00.000Z"),
      })
    ).toBe(false);
  });
});

describe("click branch", () => {
  it("picks N2/N3 variants and skips N2 after a contact click", () => {
    expect(
      pickConvertTouchId({
        stepTouchId: "sme_n2",
        hasHmrcPetition: true,
        lastSiteClickUrl: `${CONVERT_SITE_ORIGIN}/?sf=n1#tools`,
      })
    ).toBe("sme_n2_hmrc");
    expect(
      pickConvertTouchId({
        stepTouchId: "sme_n2",
        hasHmrcPetition: false,
        lastSiteClickUrl: `${CONVERT_SITE_ORIGIN}/?sf=n1#tools`,
      })
    ).toBe("sme_n2_clicked");
    expect(
      pickConvertTouchId({
        stepTouchId: "sme_n3",
        hasHmrcPetition: false,
        lastSiteClickUrl: `${CONVERT_SITE_ORIGIN}/?sf=n2#contact`,
      })
    ).toBe("sme_n3_form");
    expect(shouldSkipN2ForContactClick(`${CONVERT_SITE_ORIGIN}/?sf=n1#contact`)).toBe(true);
    expect(siteClickKind(`${CONVERT_SITE_ORIGIN}/?sf=n1#tools`)).toBe("tools");
    expect(isStrataSiteUrl("https://learn.stratanexus.co.uk")).toBe(false);
  });
});

describe("tick planner", () => {
  it("sends N1 unless same-day hold, then N2/N3/closer", () => {
    const enrolled = { ...deal, convertPlaybook: "sme_nurture" as const, outreachTouch: 0 };
    expect(
      planConvertTick({
        deal: enrolled,
        sme2SentAt: "2026-09-08T09:00:00.000Z",
        now: new Date("2026-09-08T15:00:00.000Z"),
      })
    ).toEqual({ action: "hold", reason: "same_day_sme_2" });
    expect(
      planConvertTick({
        deal: enrolled,
        sme2SentAt: "2026-09-08T09:00:00.000Z",
        now: new Date("2026-09-09T09:00:00.000Z"),
      })
    ).toMatchObject({ action: "send", cadenceTouchId: "sme_n1", renderTouchId: "sme_n1" });
    expect(
      planConvertTick({
        deal: { ...enrolled, outreachTouch: 1 },
        lastSiteClickUrl: `${CONVERT_SITE_ORIGIN}/?sf=n1#contact`,
      })
    ).toMatchObject({ action: "send", cadenceTouchId: "sme_n3", renderTouchId: "sme_n3_form" });
    expect(planConvertTick({ deal: { ...enrolled, outreachTouch: 3 } })).toEqual({
      action: "queue_closer",
    });
  });
});

describe("wake and copy", () => {
  it("diaries 90 London days and guards copy", () => {
    expect(CONVERT_WAKE_DAYS).toBe(90);
    const wake = convertWakeAt(new Date("2026-09-20T12:00:00.000Z"));
    expect(shouldWakeConvert({ wakeAt: wake, now: new Date("2026-12-20T08:30:00.000Z") })).toBe(true);
    expect(shouldWakeConvert({ wakeAt: wake, now: new Date("2026-09-21T08:30:00.000Z") })).toBe(false);
    expect(convertGreetingName("David Cole")).toBe("David");
    expect(convertGreetingName("")).toBe("");
    expect(convertCopyOk({ subject: "Last note from me", text: `Hi,\n${CONVERT_SITE_ORIGIN}/?sf=n3#contact\nWe do not lend.\n${CONVERT_STOP_LINE}` }).ok).toBe(true);
    expect(convertCopyOk({ subject: "Call?", text: "got 10 minutes Thursday? https://learn.stratanexus.co.uk" }).ok).toBe(false);
    expect(buildCloserScript({ company: "Acme Ltd", name: "David", lastSiteClickUrl: null })).toMatch(/No site click/);
    expect(buildCloserScript({ company: "Acme Ltd", name: "David", lastSiteClickUrl: `${CONVERT_SITE_ORIGIN}/?sf=n2#tools` })).toMatch(/Last site click/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/smeConvert.test.ts`
Expected: FAIL, cannot find module `@shared/smeConvert`

- [ ] **Step 3: Write minimal implementation**

Implement `shared/smeConvert.ts` so every assertion above passes. Reuse `hasExploreEnquiry` for Explore. Dual-open mail matching is by `dealId` first, else skip (gate requires deal.id). `convertCopyOk` fails if text/html/subject matches `/learn\.stratanexus|explore\.stratanexus|10-minute|thursday|got 5 minutes|brief call/i`, or lacks `www.stratafinance.co.uk`, or lacks `do not lend` / `does not lend` / `packager`, or lacks the stop line. `convertGreetingName` copies hunt `firstName` rules except the `"there"` fallback returns `""`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/smeConvert.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/smeConvert.ts server/__tests__/shared/smeConvert.test.ts
git commit -m "feat: add SME convert enrol and tick kernel"
```

---

### Task 2: Sales OS convert cadence

**Files:**
- Create: `shared/playbooks/sme_nurture.yaml`
- Modify: `shared/salesOs.ts`
- Modify: `shared/agenticWorkflow.ts` (`AgenticDealFile`)
- Test: `server/__tests__/shared/smeConvert.test.ts` (append cadence tests) and `server/__tests__/shared/salesOs` if a cadence test file exists; otherwise append to `smeConvert.test.ts`

**Interfaces:**
- Consumes: Task 1 `ConvertEnrolPatch.convertPlaybook`
- Produces:
  - `CadenceTouchId` includes `"sme_n1" | "sme_n2" | "sme_n3" | "sme_c1"`
  - `CadenceChannel` includes `"closer"`
  - `SME_NURTURE_CADENCE: CadenceStep[]`
  - `cadenceForDeal(deal: { source?: string; stream?: SalesStream | string | null; convertPlaybook?: string }): CadenceStep[]`
  - `nextCadenceStepForDeal(deal, completedTouches: number): CadenceStep | null`
  - `AgenticDealFile.convertPlaybook?: "sme_nurture"`
  - `AgenticDealFile.convertEnrolledAt?: string`
  - `AgenticDealFile.convertCycle?: number`
  - `AgenticDealFile.convertWakeAt?: string`
  - `AgenticDealFile.convertStopReason?: "completed" | "reply" | "opt_out" | "promoted" | "manual" | "blocked" | "dead"`

`SME_NURTURE_CADENCE` (copy these rows exactly):

```ts
export const SME_NURTURE_CADENCE: CadenceStep[] = [
  { index: 1, day: 0, delayDaysFromPrevious: 0, touchId: "sme_n1", channel: "email", autoSend: true, queueCall: false, job: "Dual-open diagnostic — eligibility tools" },
  { index: 2, day: 4, delayDaysFromPrevious: 4, touchId: "sme_n2", channel: "email", autoSend: true, queueCall: false, job: "Refinance or HMRC calculator" },
  { index: 3, day: 9, delayDaysFromPrevious: 5, touchId: "sme_n3", channel: "email", autoSend: true, queueCall: false, job: "Enquiry form — last email" },
  { index: 4, day: 12, delayDaysFromPrevious: 3, touchId: "sme_c1", channel: "closer", autoSend: false, queueCall: false, job: "Openers WhatsApp or call closer" },
];
```

`cadenceForDeal`: if `deal.convertPlaybook === "sme_nurture"` return `SME_NURTURE_CADENCE`; else existing `cadenceFor(dealStream(...))`. Leave `nextCadenceStep(stream, n)` unchanged for hunt/introducer/inbound.

YAML file body is the spec playbook block (playbook_id `sme_nurture`, stop_line verbatim, four steps). Executable clock is `SME_NURTURE_CADENCE`; YAML is the named playbook the SAL-2 spec points at, same as `sme_14d.yaml` today (not parsed at runtime).

- [ ] **Step 1: Write the failing test**

Append to `server/__tests__/shared/smeConvert.test.ts`:

```ts
import { nextCadenceStep, nextCadenceStepForDeal, SME_NURTURE_CADENCE } from "@shared/salesOs";
import fs from "fs";
import path from "path";

describe("convert cadence", () => {
  it("does not change hunt next step, and convert deals read SME_NURTURE_CADENCE", () => {
    expect(nextCadenceStep("sme", 3)?.touchId).toBe("sme_close");
    expect(SME_NURTURE_CADENCE.map((s) => s.touchId)).toEqual(["sme_n1", "sme_n2", "sme_n3", "sme_c1"]);
    expect(SME_NURTURE_CADENCE[3].autoSend).toBe(false);
    expect(SME_NURTURE_CADENCE[3].queueCall).toBe(false);
    expect(nextCadenceStepForDeal({ convertPlaybook: "sme_nurture" }, 0)?.touchId).toBe("sme_n1");
    expect(nextCadenceStepForDeal({ convertPlaybook: "sme_nurture" }, 3)?.touchId).toBe("sme_c1");
    const yaml = fs.readFileSync(path.resolve("shared/playbooks/sme_nurture.yaml"), "utf8");
    expect(yaml).toMatch(/playbook_id: sme_nurture/);
    expect(yaml).toMatch(/os_touch: sme_c1/);
    expect(yaml).toMatch(/If this isn't useful, reply stop and we won't email again/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/smeConvert.test.ts`
Expected: FAIL (`nextCadenceStepForDeal` / yaml missing)

- [ ] **Step 3: Write minimal implementation**

Add yaml, cadence table, deal fields, `cadenceForDeal` / `nextCadenceStepForDeal`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/smeConvert.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/playbooks/sme_nurture.yaml shared/salesOs.ts shared/agenticWorkflow.ts server/__tests__/shared/smeConvert.test.ts
git commit -m "feat: add sme_nurture Sales OS cadence"
```

---

### Task 3: Convert email copy

**Files:**
- Modify: `shared/strataOutreach.ts`
- Modify: `server/__tests__/services/strataOutreach.test.ts`

**Interfaces:**
- Consumes: Task 2 touch ids; Task 1 `convertGreetingName`, `CONVERT_SITE_ORIGIN`, `CONVERT_STOP_LINE`, `convertCopyOk`
- Produces: `OutreachTouchId` includes `"sme_n1" | "sme_n2" | "sme_n2_hmrc" | "sme_n2_clicked" | "sme_n3" | "sme_n3_form"`
- `renderOutreachEmail(..., "sme_n1" | ...)` returns spec copy
- `canonicalTouchId` maps those ids to themselves (do not collapse onto hunt ids)

Copy bodies and subjects are the spec section **Copy**. Greeting: `const name = convertGreetingName(deal.contactName);` then `Hi ${name ? `${name},` : ","}` wait — use `name ? `Hi ${name},` : `Hi,``. Link exactly:
- N1 `https://www.stratafinance.co.uk/?sf=n1#tools`
- N2 variants `...?sf=n2#tools`
- N3 variants `...?sf=n3#contact`

After building a convert template, if `convertCopyOk` fails, return `{ html: "", text: "", purpose: "playbook_gap:convert_copy", subject: company }` same as other playbook_gap rows (workflow already holds on empty body).

Do not add convert ids to `EDITABLE_OUTREACH_TOUCHES` (OS templates, not Craft).

- [ ] **Step 1: Write the failing test**

Append to `server/__tests__/services/strataOutreach.test.ts`:

```ts
describe("convert templates", () => {
  const deal = { ...huntDeal, contactName: "David Cole" };
  const unnamed = { ...huntDeal, contactName: "" };

  it("N1–N3 point at www.stratafinance.co.uk, stop line, packager identity, no Learn/call ask", () => {
    for (const id of ["sme_n1", "sme_n2", "sme_n2_hmrc", "sme_n2_clicked", "sme_n3", "sme_n3_form"] as const) {
      const email = renderOutreachEmail(deal, id, "outreach-sales");
      expect(email.subject.length).toBeLessThanOrEqual(45);
      expect(email.text).toContain("https://www.stratafinance.co.uk/");
      expect(email.text).toContain("If this isn't useful, reply stop and we won't email again.");
      expect(email.text).toMatch(/do not lend/i);
      expect(email.text).not.toMatch(/learn\.stratanexus|explore\.stratanexus/i);
      expect(email.text).not.toMatch(/10-minute|Thursday|brief call/i);
      expect(email.html).toContain("sf=");
    }
    expect(renderOutreachEmail(deal, "sme_n1", "outreach-sales").subject).toBe("30 seconds on eligibility");
    expect(renderOutreachEmail(deal, "sme_n3", "outreach-sales").text).toContain("?sf=n3#contact");
    expect(renderOutreachEmail(unnamed, "sme_n1", "outreach-sales").text).toMatch(/^Hi,/);
    expect(renderOutreachEmail(unnamed, "sme_n1", "outreach-sales").text).not.toMatch(/Hi there,/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/strataOutreach.test.ts`
Expected: FAIL (unknown touch or missing copy)

- [ ] **Step 3: Write minimal implementation**

Add the six `if (id === ...)` branches in `renderOutreachEmail` using `withSignature(lines, mailbox, [STOP_LINE])`. Use `convertGreetingName`. Do not use hunt `firstName()` for these branches.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run server/__tests__/services/strataOutreach.test.ts server/__tests__/shared/smeConvert.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/strataOutreach.ts server/__tests__/services/strataOutreach.test.ts
git commit -m "feat: add convert outreach templates to stratafinance.co.uk"
```

---

### Task 4: Openers convert stream and closer

**Files:**
- Modify: `shared/openers.ts`
- Modify: `server/__tests__/shared/openers.test.ts`

**Interfaces:**
- Consumes: Task 1 `buildCloserScript`, `convertWakeAt`
- Produces:
  - `OPENER_CONVERT_CLOSER_DELAY_MS = 3 * 24 * 60 * 60 * 1000`
  - `OpenerNurture.stream?: "convert" | "opener_3touch"`
  - fields on `OpenerNurture`: `convertCycle?: number`, `wakeAt?: string`, `n1MailId?`, `n2MailId?`, `n3MailId?`, `n1At?`, `n2At?`, `n3At?`, `closerStatus?: "idle" | "due" | "done" | "skipped"`, `closerChannel?: "whatsapp" | "call"`, `closerAt?`, `closerScript?: string`, `promoteBlocked?: boolean`
  - `emptyNurture()` sets `stream: "opener_3touch"`, `closerStatus: "idle"`
  - `isConvertOpener(opener): boolean` — `nurture.stream === "convert"`
  - `enrolConvertOpener(opener, now?: Date): OpenerRecord` — status `nurturing`, stream `convert`, increment `convertCycle` (0 → 1), clear `wakeAt`, 3-touch `touch1Status` back to `idle` and drop `touch1Draft` (do not set stopReason `manual`)
  - `startNurture` no-ops (returns opener unchanged) when `isConvertOpener`
  - `recordConvertSend(opener, cadenceTouchId: "sme_n1"|"sme_n2"|"sme_n3", mailId: string, now?: Date): OpenerRecord` — sets the matching `n*MailId`/`n*At`, `lastTouchAt`, status nurturing
  - `writeCloserScript(opener, script: string, now?: Date): OpenerRecord`
  - `isConvertCloserDue(opener, now?: Date): boolean` — n3At set, closer not done/skipped, now >= n3At + delay
  - `withDerivedNurture` also sets `closerStatus` view `"due"` when `isConvertCloserDue` (do not persist `"due"`)
  - `completeConvertCloser(opener, channel: "whatsapp" | "call" | "skipped", now?: Date): OpenerRecord` — status `non_responsive`, stopReason `completed`, closer done/skipped, `wakeAt = convertWakeAt(now)`
  - `canDragOpenerTo`: convert cards may drop on `nurturing` even when 3-touch `step === 0`
  - `shouldAutoPromoteOpener`: if `isConvertOpener(opener)` return **false** (before the sixth-email count)

- [ ] **Step 1: Write the failing test**

Append to `server/__tests__/shared/openers.test.ts`:

```ts
import {
  completeConvertCloser,
  enrolConvertOpener,
  isConvertCloserDue,
  isConvertOpener,
  OPENER_CONVERT_CLOSER_DELAY_MS,
  recordConvertSend,
  startNurture,
  shouldAutoPromoteOpener,
} from "@shared/openers";

describe("convert stream", () => {
  it("blocks 3-touch and sixth-email promote, and parks after closer", () => {
    const now = new Date("2026-09-20T10:00:00.000Z");
    let row = enrolConvertOpener(opener({ companyNumber: "08765432", status: "new" }), now);
    expect(isConvertOpener(row)).toBe(true);
    expect(row.status).toBe("nurturing");
    expect(row.nurture.convertCycle).toBe(1);
    expect(startNurture(row, { subject: "x", html: "y" }, now)).toEqual(row);
    expect(shouldAutoPromoteOpener(row, Array.from({ length: 8 }, (_, i) => ({
      id: `m${i}`,
      to: "ops@northpeak.co.uk",
      direction: "outbound",
      status: "sent",
    })))).toBe(false);
    expect(canDragOpenerTo(row, "nurturing")).toBe(true);
    row = recordConvertSend(row, "sme_n3", "mail-n3", now);
    expect(isConvertCloserDue(row, new Date(now.getTime() + OPENER_CONVERT_CLOSER_DELAY_MS))).toBe(true);
    const done = completeConvertCloser(row, "call", new Date(now.getTime() + OPENER_CONVERT_CLOSER_DELAY_MS));
    expect(done.status).toBe("non_responsive");
    expect(done.nurture.stopReason).toBe("completed");
    expect(done.nurture.wakeAt).toBeTruthy();
  });
});
```

Existing sixth-email tests must keep passing for `opener_3touch` default stream.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/openers.test.ts`
Expected: FAIL (missing exports)

- [ ] **Step 3: Write minimal implementation**

Extend `OpenerNurture` and the functions above. `normalizeOpener` defaults `nurture.stream` to `"opener_3touch"`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/openers.test.ts`
Expected: PASS (including existing sixth-email cases)

- [ ] **Step 5: Commit**

```powershell
git add shared/openers.ts server/__tests__/shared/openers.test.ts
git commit -m "feat: Openers convert stream, closer, and wake fields"
```

---

### Task 5: Enrol from Agent Mail

**Files:**
- Modify: `server/services/openers.ts`
- Modify: `server/services/agentMailLog.ts`
- Modify: `server/services/agenticWorkflow.ts` (deal patch helper used here)
- Test: `server/__tests__/services/openers.test.ts` and/or `server/__tests__/services/agentMailLog.store.test.ts`

**Interfaces:**
- Consumes: `isDualOpenConvertEligible`, `enrolConvertDealPatch`, `enrolConvertOpener`
- Produces: `enrolConvertFromMail(item: AgentMailItem): void` — load mail for the deal, load deal, if eligible: `storage.updateAgenticDeal` with `enrolConvertDealPatch` (reset `outreachTouch` to 0, clear `callPlaybook`, set `waitUntil` to next window not same London day as sme_2), `saveOpener(enrolConvertOpener(opener))`. Second call is a no-op because deal already has `convertPlaybook`.
- Call it from `recordOpen` and `recordClick` after the existing opener upsert, inside the existing try/catch.

`waitUntil` for enrol: if `shouldHoldN1ForSme2SameDay`, set to next London send window after that day (09:00 UTC is not good enough — use `nextConvertSendWindow` from Task 1 on the morning after sme_2).

If 3-touch is in flight, `enrolConvertOpener` already drops the draft.

- [ ] **Step 1: Write the failing test**

Add to `shared/smeConvert.ts` (implement in Step 3):

```ts
export function buildConvertEnrolment(
  mail: ConvertMail[],
  deal: ConvertDeal,
  opener: { id: string; status?: string; nurture?: { stopReason?: string; stream?: string } },
  now?: Date
): { dealPatch: ConvertEnrolPatch; openerId: string } | null
```

Returns null if `isDualOpenConvertEligible` is false. Otherwise `{ dealPatch: enrolConvertDealPatch(deal, { now, sme2SentAt: sme2.createdAt }), openerId: opener.id }`.

Append to `server/__tests__/shared/smeConvert.test.ts`:

```ts
it("buildConvertEnrolment resets hunt index and stamps sme_nurture", () => {
  const built = buildConvertEnrolment(
    [sme1, sme2],
    { ...deal, outreachTouch: 3, callPlaybook: { title: "hunt" } as never },
    { id: "op-1", status: "new" },
    new Date("2026-09-09T09:00:00.000Z")
  );
  expect(built?.dealPatch.convertPlaybook).toBe("sme_nurture");
  expect(built?.dealPatch.outreachTouch).toBe(0);
  expect(built?.dealPatch.callPlaybook).toBeUndefined();
  expect(built?.openerId).toBe("op-1");
  expect(
    buildConvertEnrolment([sme1], deal, { id: "op-1" }, new Date("2026-09-09T09:00:00.000Z"))
  ).toBeNull();
});
```

Create `server/__tests__/services/smeConvertEnrol.test.ts` that mocks storage (no live SMTP):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getAgenticDeal: vi.fn(),
    updateAgenticDeal: vi.fn(async (_id: number, patch: object) => ({ id: 9, ...patch })),
  },
}));

describe("enrolConvertFromMail", () => {
  beforeEach(() => vi.resetModules());
  it("applies the convert patch when dual-open is eligible", async () => {
    const { storage } = await import("../../storage");
    vi.mocked(storage.getAgenticDeal).mockResolvedValue({
      id: 9,
      email: "ops@acme.test",
      companyName: "Acme Ltd",
      status: "outreach",
      stage: "outreach",
      outreachTouch: 3,
      events: [],
    } as never);
    const { enrolConvertFromMail } = await import("../../services/openers");
    await enrolConvertFromMail({
      id: "mail-sme2",
      touchId: "sme_2",
      direction: "outbound",
      status: "sent",
      dealId: 9,
      to: "ops@acme.test",
      opens: ["2026-09-08T10:00:00.000Z"],
      createdAt: "2026-09-08T09:00:00.000Z",
    } as never);
    expect(storage.updateAgenticDeal).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ convertPlaybook: "sme_nurture", outreachTouch: 0 })
    );
  });
});
```

Adjust the mock import path to match how other service tests import `storage`. If `listAgentMail` is required inside `enrolConvertFromMail`, mock `../agentMailLog` `listAgentMail` to return sme_1 (opened) + the sme_2 item. Do not call live SMTP.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/smeConvert.test.ts server/__tests__/services/smeConvertEnrol.test.ts`
Expected: FAIL until wiring exists

- [ ] **Step 3: Write minimal implementation**

`buildConvertEnrolment` + `enrolConvertFromMail` in `server/services/openers.ts`. Hook from `recordOpen` / `recordClick`. Need `listAgentMail` filtered by dealId, `storage.getAgenticDeal`, opener by email.

If sme_close was already sent (`outreachTouchId === "sme_close"` or mail exists), still enrol; patch still resets outreachTouch to 0 for the **convert** cadence. Do not send sme_close again because convertPlaybook now owns nextCadenceStepForDeal.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/smeConvert.test.ts server/__tests__/services/smeConvertEnrol.test.ts server/__tests__/services/agentMailLog.store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/smeConvert.ts server/services/openers.ts server/services/agentMailLog.ts server/__tests__/shared/smeConvert.test.ts server/__tests__/services/smeConvertEnrol.test.ts
git commit -m "feat: enrol convert playbook on sme_2 open or click"
```

---

### Task 6: ORC-1 convert tick (N1–N3 + C1 due)

**Files:**
- Modify: `server/services/agenticWorkflow.ts` (`sendOutreach` / outreach retry)
- Test: `server/__tests__/services/smeConvertEnrol.test.ts` or new `server/__tests__/services/smeConvertTick.test.ts`

**Interfaces:**
- Consumes: `planConvertTick`, `nextCadenceStepForDeal`, `renderOutreachEmail`, `convertCopyOk`, `recordConvertSend`, `writeCloserScript`, `buildCloserScript`, `lastStrataSiteClick`
- Produces: when `deal.convertPlaybook === "sme_nurture"`, `sendOutreach` / outreach_retry uses `nextCadenceStepForDeal` and `planConvertTick` instead of hunt `nextCadenceStep`.

Behaviour:
- `hold` + `same_day_sme_2`: set `waitUntil` to next window, stay `waiting_timer`, do not increment `outreachTouch`, do not log a send.
- `send`: render `renderTouchId`; if html/text empty or `convertCopyOk` fails → hold `playbook_gap` (existing hold pattern), do not increment. Else existing SMTP accept-or-hold. On delivered: `outreachTouch += 1` (if we skipped N2, set outreachTouch to 2 so next is N3 already sent... **count the cadence index actually completed**). When skipping N2, set `outreachTouch` to 3 after sending N3 (N1 done, N2 skipped, N3 sent) so next plan is `queue_closer`. Mapping: after N1 send → 1; after N2 send → 2; after N3 send (including skip-N2 path) → 3.
- Mock / undelivered: do not increment, do not set lastTouchAt (existing hold_undelivered).
- `queue_closer`: do **not** set hunt `callPlaybook` / `queueCall`. Write closer script onto opener; `waitUntil` = n3At + 3 days or now if already due; stage `waiting_human` with humanReason `Convert closer due on Openers`. Shaun executing C1 is Task 4/7 Openers actions, not this tick sending mail.
- Convert sends count toward the same mailbox daily cap as hunt (do not add a second cap).

Also: hopper early-return in `sendOutreach` (`deal.hopper && deal.hopper !== "queued"`) must **not** block convert-enrolled deals. If `convertPlaybook === "sme_nurture"`, skip that hopper return.

- [ ] **Step 1: Write the failing test**

Unit-test `planConvertTick` skip path already exists. Add a workflow-level test that stubs sendEmail:

If `agenticWorkflow.ts` is hard to instantiate, extract `applyConvertTickToDeal(deal, tick, now)` in `shared/smeConvert.ts`:

```ts
export function nextOutreachTouchAfterSend(
  cadenceTouchId: "sme_n1" | "sme_n2" | "sme_n3"
): number {
  if (cadenceTouchId === "sme_n1") return 1;
  if (cadenceTouchId === "sme_n2") return 2;
  return 3;
}
```

Test that, then in workflow use it. Workflow test: a convert deal with outreachTouch 0, sme2SentAt yesterday, sendOutreach calls render sme_n1 (spy by asserting deal.outreachTouchId after a mocked send). Follow existing workflow test factory in `server/test/appFactory.ts` if present; otherwise assert the hopper bypass with a small exported helper:

```ts
export function convertOverridesHopperHold(deal: { convertPlaybook?: string; hopper?: string }): boolean {
  return deal.convertPlaybook === "sme_nurture";
}
```

Put that helper in `smeConvert.ts` and test it. Wire `sendOutreach` with `if (convertOverridesHopperHold(deal)) { /* fall through to convert tick */ }`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/smeConvert.test.ts`
Expected: FAIL on new helper if not exported yet; then FAIL workflow if you add a service test

- [ ] **Step 3: Write minimal implementation**

Wire `sendOutreach` convert branch. Use existing `renderOutreachEmail(deal, renderTouchId, mailbox)` + `logAgentMail` + tracking inject. After N3 delivered, `writeCloserScript` using `buildCloserScript` and last site click from Agent Mail timeline for that opener.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/smeConvert.test.ts server/__tests__/services/strataOutreach.test.ts`
Expected: PASS. Also run any new tick test file.

- [ ] **Step 5: Commit**

```powershell
git add shared/smeConvert.ts server/services/agenticWorkflow.ts server/services/openers.ts server/__tests__/shared/smeConvert.test.ts
git commit -m "feat: tick convert N1-N3 auto-send and queue Openers closer"
```

---

### Task 7: Auto-Promote on enquiry / reply / STOP

**Files:**
- Modify: `server/routes/inbound.ts`
- Modify: `server/services/openers.ts`
- Modify: `server/routes/agentMail.ts` (inbound reply already stops 3-touch — extend for convert)
- Test: `server/__tests__/services/openers.test.ts` (or new `server/__tests__/services/smeConvertPromote.test.ts`)

**Interfaces:**
- Consumes: `promoteOpener`, `stopNurture` / convert stop
- Produces:
  - `stopConvertAndPromote(openerIdOrEmail, reason: "promoted" | "reply" | "opt_out"): Promise<void>`
  - On `promoted` / `reply`: set deal `convertPlaybook` undefined or keep but `convertStopReason = promoted|reply`, `convertWakeAt` cleared, opener status promoted via existing `promoteOpener`. If `canPromoteOpener` is false: still stop convert (`convertStopReason = blocked`), `nurture.promoteBlocked = true`, **do not** drop the inbound lead (inbound route still creates the internal lead + pipeline as today).
  - On `opt_out`: opener `not_now`, stopReason `opt_out`, deal convertStopReason `opt_out`, clear wakeAt, no Promote.
  - `POST /api/inbound/refinance` after successful lead create: find opener by email (and deal by email/company); call `stopConvertAndPromote(..., "promoted")`.
  - Inbound Agent Mail reply that is not STOP: `reason = "reply"` then promote. STOP: `opt_out` only.

- [ ] **Step 1: Write the failing test**

```ts
describe("convert auto-promote", () => {
  it("stops convert on inbound refinance even without a company number, and promotes when a number exists", () => {
    const withNumber = enrolConvertOpener(opener({ companyNumber: "08765432", email: "ops@acme.test" }));
    const blocked = enrolConvertOpener(opener({ email: "ops@acme.test", companyNumber: undefined }));
    // after stopConvertAndPromote helpers (pure first):
    // withNumber → status promoted, stopReason promoted, wakeAt empty
    // blocked → promoteBlocked true, status still nurturing or a non-mailable flag, stopReason blocked, not mailed
  });
});
```

Add pure `applyConvertStop(opener, reason)` in `shared/openers.ts`:

```ts
export function applyConvertStop(
  opener: OpenerRecord,
  reason: "promoted" | "reply" | "opt_out" | "blocked",
  now?: Date
): OpenerRecord
```

- promoted/reply: `stopNurture(opener, "promoted"|"reply")` and clear `wakeAt`
- opt_out: status `not_now`, stopReason `opt_out`
- blocked: `promoteBlocked: true`, `stopReason` unchanged on 3-touch fields, convert stop via `nurture` plus status stays nurturing so the card remains visible, but `stream` stays convert so 3-touch cannot start

Service uses this then maybe `promoteOpener`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/openers.test.ts`
Expected: FAIL missing `applyConvertStop`

- [ ] **Step 3: Write minimal implementation**

Pure reducer + inbound.ts hook + existing inbound-mail stop path. Look at current `server/routes/agentMail.ts` inbound handler that already calls `stopNurture` — call `applyConvertStop` when `isConvertOpener`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/openers.test.ts`
Expected: PASS. Add a light inbound route test if `server/__tests__/routes` already covers `/api/inbound/refinance`; otherwise source-assert the inbound file calls `stopConvertAndPromote` / `applyConvertStop`.

- [ ] **Step 5: Commit**

```powershell
git add shared/openers.ts server/services/openers.ts server/routes/inbound.ts server/routes/agentMail.ts server/__tests__/shared/openers.test.ts
git commit -m "feat: auto-promote convert openers on enquiry or reply"
```

---

### Task 8: 90-day wake

**Files:**
- Modify: `server/services/agenticWorkflow.ts` (tick)
- Modify: `shared/smeConvert.ts` (`planConvertTick` stay_parked / wake_reenrol already specified)
- Test: `server/__tests__/shared/smeConvert.test.ts`

**Interfaces:**
- Consumes: `shouldWakeConvert`, `isDualOpenConvertEligible` (re-check silent/not unsubscribed/not promoted), `enrolConvertDealPatch` with `convertCycle: (deal.convertCycle || 1) + 1`
- Produces: on tick of a deal with `convertWakeAt` and `convertStopReason === "completed"` (playbook cleared or parked):
  - STOP/promoted/failed/dissolved/bounce-no-phone → `stay_parked`, do not send, do not change wakeAt
  - smtp unhealthy → stay_parked reason `smtp`, **do not** bump cycle
  - else `wake_reenrol`: apply enrol patch, opener status nurturing, stream convert, N1 on next window (same-day hold vs old sme_2 does **not** apply on wake — sme_2 may be months old; only hold if somehow same London day as a new sme_2, which will not happen). Spec: N1 on the next send window.

Click during wait: `recordOpen`/`recordClick` still heat the opener; they must **not** call `enrolConvertFromMail` while `convertStopReason === "completed"` and `wakeAt` is in the future. Add to `isDualOpenConvertEligible`: false when `deal.convertStopReason === "completed"` and `deal.convertWakeAt` is in the future.

- [ ] **Step 1: Write the failing test**

```ts
it("does not re-enrol while wakeAt is in the future, and wake_reenrol after 90 days", () => {
  const completed = {
    id: 9,
    email: "ops@acme.test",
    convertStopReason: "completed" as const,
    convertWakeAt: convertWakeAt(new Date("2026-09-20T12:00:00.000Z")),
    convertCycle: 1,
  };
  expect(
    isDualOpenConvertEligible({
      mail: [sme1, sme2],
      deal: completed,
      now: new Date("2026-09-21T10:00:00.000Z"),
    })
  ).toBe(false);
  expect(
    planConvertTick({
      deal: completed,
      now: new Date("2026-12-20T09:00:00.000Z"),
    })
  ).toEqual({ action: "wake_reenrol" });
  expect(
    planConvertTick({
      deal: { ...completed, convertStopReason: "opt_out" },
      now: new Date("2026-12-20T09:00:00.000Z"),
    })
  ).toEqual({ action: "stay_parked", reason: "opt_out" });
});
```

Extend `isDualOpenConvertEligible` / `planConvertTick` with `now?: Date`. Wake tick does not require dual-open mail again (they already qualified); `planConvertTick` wake path keys off `convertStopReason === "completed"` + due `wakeAt`, then a **wake gate** function:

```ts
export function convertWakeGate(deal: ConvertDeal): ConvertTick
```
opt_out / promoted / failed / dissolved / bounce_no_phone / smtp as specified; else `wake_reenrol`. Dual-open mail is not re-checked on wake except inbound/STOP/promoted already on the deal.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/smeConvert.test.ts`
Expected: FAIL (completed+future wake still eligible, or tick not wake_reenrol)

- [ ] **Step 3: Write minimal implementation**

Update gate + planner. Workflow: if deal has due wakeAt, apply `convertWakeGate`; on wake_reenrol apply enrol patch with incremented cycle and `enrolConvertOpener`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/smeConvert.test.ts server/__tests__/shared/openers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/smeConvert.ts server/services/agenticWorkflow.ts server/services/openers.ts server/__tests__/shared/smeConvert.test.ts
git commit -m "feat: diary convert openers 90 days and re-enrol"
```

---

### Task 9: Openers UI

**Files:**
- Modify: `client/src/pages/Openers.tsx`
- Modify: `server/routes/openers.ts` — `action: "closer"` with `channel?: "whatsapp" | "call" | "skip"`
- Modify: `server/services/openers.ts` — `runNurtureAction` closer/skip for convert
- Modify: `server/__tests__/routes/openersUi.test.ts`

**Interfaces:**
- Consumes: `isConvertOpener`, derived closer due, `closerScript`
- Produces: convert cards hide Start nurture, Approve, and 3-touch draft preview. Show `data-testid="badge-convert-step"` text `N1 queued` | `N2 in n days` | `N3 in n days` | `C1 due`. Show `data-testid="convert-closer-script"` when script present. Skip closer: `data-testid="button-skip-closer"` enabled when C1 due and no phone. WhatsApp / Log call on convert C1 due still call existing mutations **and** complete convert closer (extend `completeTouch2IfDue` to call `completeConvertCloser` when `isConvertOpener` and closer due). Clicks badge `data-testid="badge-opener-clicks"` unchanged. Rank still `compareOpenersByOpenCount`.

Helper (shared, so tests can lock copy):
```ts
export function convertStepBadge(opener: OpenerRecord, now?: Date): string
```
N1 queued if no n1At; `N2 in n days` from n1At+4d; etc; `C1 due` when closer due.

- [ ] **Step 1: Write the failing test**

Append to `server/__tests__/routes/openersUi.test.ts`:

```ts
it("convert cards hide 3-touch start/approve and show closer script", () => {
  const page = fs.readFileSync(path.resolve("client/src/pages/Openers.tsx"), "utf8");
  expect(page).toMatch(/data-testid="badge-convert-step"/);
  expect(page).toMatch(/data-testid="convert-closer-script"/);
  expect(page).toMatch(/data-testid="button-skip-closer"/);
  expect(page).toMatch(/isConvertOpener/);
  expect(page).toMatch(/data-testid="badge-opener-clicks"/);
  const routes = fs.readFileSync(path.resolve("server/routes/openers.ts"), "utf8");
  expect(routes).toMatch(/closer/);
});
```

Add unit tests for `convertStepBadge` in `openers.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/routes/openersUi.test.ts server/__tests__/shared/openers.test.ts`
Expected: FAIL missing testids

- [ ] **Step 3: Write minimal implementation**

In the nurture `<section>`, if `isConvertOpener(selected)` render convert badge + script + skip closer; else existing Start/Approve. Skip closer mutation `{ action: "closer", channel: "skip" }`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run server/__tests__/routes/openersUi.test.ts server/__tests__/shared/openers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add client/src/pages/Openers.tsx server/routes/openers.ts server/services/openers.ts shared/openers.ts server/__tests__/routes/openersUi.test.ts server/__tests__/shared/openers.test.ts
git commit -m "feat: Openers convert badges and closer desk"
```

---

### Task 10: Governance one-liner

**Files:**
- Modify: `docs/agentic-org/corporate_structure.md`

**Interfaces:**
- Consumes: SAL-2 convert addendum already on disk
- Produces: SAL-2 paragraph mentions convert playbook after dual-open

- [ ] **Step 1: Write the failing test**

Add to `server/__tests__/routes/openersUi.test.ts` or a tiny docs assertion in the same file:

```ts
it("corporate structure mentions convert after dual-open", () => {
  const doc = fs.readFileSync(path.resolve("docs/agentic-org/corporate_structure.md"), "utf8");
  expect(doc).toMatch(/sme_nurture|dual-open|convert playbook/i);
  expect(doc).toMatch(/SAL-2-convert/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/routes/openersUi.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

In the SAL-2 Communications paragraph, after the hunt sentence, add: `After sme_1 and sme_2 have both been opened with no reply, James swaps onto the convert playbook (agents/SAL-2-convert.md) and cancels sme_close.` Add delegation-matrix row: `| Dual-open SME convert (site enquiry) | SAL-2 James | Auto-send N1–N3; Shaun C1; Promote on enquiry |`

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run server/__tests__/routes/openersUi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add docs/agentic-org/corporate_structure.md server/__tests__/routes/openersUi.test.ts
git commit -m "docs: SAL-2 convert playbook in corporate structure"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Dual-open enrol gate | 1, 5 |
| Hunt cancel / outreachTouch reset | 2, 5 |
| Same-day N1 hold | 1, 6 |
| Playbook yaml + salesOs cadence | 2 |
| N1–N3 copy + guards + Hi, | 3 |
| Click branch / skip N2 | 1, 6 |
| C1 script + Openers closer | 4, 6, 9 |
| Sixth-email promote off | 4 |
| 3-touch isolation | 4, 5, 9 |
| Auto-Promote enquiry/reply/STOP | 7 |
| Promote blocked without number | 7 |
| 90-day wake, no hunt restart, click does not pull forward | 8 |
| Hopper must not block convert tick | 6 |
| UI badges, hide Start/Approve, clicks badge | 9 |
| corporate_structure | 10 |
| SAL-2 addendum | already written, not in this plan |
