# SME Lead Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep ~250 sendable SME directors in a ranked hopper (P0 buying signal + Sales OS gates + named director corporate mailbox) and drain 50/day through existing Approve & send, without mixing inbound landing-page files into the hunt.

**Architecture:** Pure classifiers and hopper ranking in `shared/`. Hunt/refill orchestration in `server/services/smeLeadHopper.ts` with injectable Places/Firecrawl/MX so CI never hits live APIs. `agenticWorkflow` calls that module from the existing 08:30 interval and from `startSmeOutreachBatch`. Same `agentic_deals` collection; additive fields only.

**Tech Stack:** TypeScript, Vitest, existing CH client, Google Places (`searchPlaces`), Firecrawl, `pecrSend`, Express/React Deal files panel. No new npm packages.

**Spec:** `docs/superpowers/specs/2026-09-01-sme-lead-machine-design.md`

## Global Constraints

- P0 only: HMRC petition **or** ≥1 live non-bank CH charge; bank/building-society chargees are a deny list
- Trading age **12 months** via `MIN_TRADING_MONTHS` in `shared/salesOs.ts` — do not fork a second constant
- Sendable = current director/PSC name + company-domain email, not personal, not role local; MX required
- Hopper cap 250 sendable; Attach runs only for the shortfall
- Rank: petition+hearing → petition → more non-bank charges → newer signal → older company
- Inbound (`source: strata_inbound`) never gets `hopper`, never enters hunt/Attach/50-cap
- 50/London-day `sme_1` still requires Shaun approval; no auto-send
- Introducer hunt stays paused
- Nightly caps: CH 400 companies, Places 100, Firecrawl 50, SMTP 50
- Attach max 5 attempts then park
- Do not call live CH, Places, Firecrawl, or SMTP in CI — inject fakes
- No second database, no CH charges bulk file
- Windows PowerShell: `git commit -m "message"` (no bash heredocs)
- Do not change inbound cadence, Craft, or Editorial

## File map

- Create: `shared/chargeClassifier.ts`
- Create: `server/__tests__/shared/chargeClassifier.test.ts`
- Create: `shared/smeHopper.ts`
- Create: `server/__tests__/shared/smeHopper.test.ts`
- Create: `server/services/smeLeadHopper.ts`
- Create: `server/__tests__/services/smeLeadHopper.test.ts`
- Modify: `shared/salesOs.ts` — `MIN_TRADING_MONTHS = 12`; SIG-01 description; `scoreSignals` fires SIG-01 P0 at `outstandingHighCostChargeCount >= 1`
- Modify: `server/__tests__/services/salesOs.test.ts` — SIG-01 single-charge P0
- Modify: `shared/agenticWorkflow.ts` — hopper fields on `AgenticDealFile`
- Modify: `shared/smeOutreach.ts` — `startSmeOutreachBatch` candidate filter uses sendable hopper
- Modify: `server/services/agenticWorkflow.ts` — hunt + refill hooks; batch picks `hopper === "sendable"`
- Modify: `server/__tests__/shared/smeOutreach.test.ts` — batch ignores inbound / parked
- Modify: `client/src/components/agentic/DealFilesPanel.tsx` — hopper counts
- Modify: `docs/agentic-org/CLAUDE.md` — trading ≥ 12 months
- Modify: `server/services/agentService.ts` — prompt 18 → 12 months

---

### Task 1: Trading age 12 months and SIG-01 P0 on one charge

**Files:**
- Modify: `shared/salesOs.ts`
- Modify: `server/__tests__/services/salesOs.test.ts`
- Modify: `docs/agentic-org/CLAUDE.md` (line with `trading ≥ 18 months`)
- Modify: `server/services/agentService.ts` (string `at least 18 months old`)

**Interfaces:**
- Consumes: existing `scoreSignals`, `MIN_TRADING_MONTHS` re-export in `server/services/strataFit.ts`
- Produces: `MIN_TRADING_MONTHS === 12`; SIG-01 description “One live non-bank charge (HP, lease, invoice finance, MCA, specialist)”; `scoreSignals` treats `outstandingHighCostChargeCount >= 1` as SIG-01 P0 weight 40

- [ ] **Step 1: Write the failing test**

In `server/__tests__/services/salesOs.test.ts` add:

```ts
it("treats a single live non-bank charge as SIG-01 P0", () => {
  const result = scoreSignals({
    companyName: "Acme Joinery Limited",
    outstandingHighCostChargeCount: 1,
  });
  expect(result.disqualified).toBe(false);
  expect(result.priority).toBe("P0");
  expect(result.signals.some((s) => s.code === "SIG-01" && s.weight === 40 && s.priority === "P0")).toBe(true);
});
```

Import `MIN_TRADING_MONTHS` and assert `expect(MIN_TRADING_MONTHS).toBe(12)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/salesOs.test.ts`
Expected: FAIL — single charge still P1 weight 20; constant still 18

- [ ] **Step 3: Write minimal implementation**

In `shared/salesOs.ts`:
- `export const MIN_TRADING_MONTHS = 12;`
- SIG-01 description: `"One live non-bank charge (HP, lease, invoice finance, MCA, or specialist)"`
- In `scoreSignals`, replace the `highCost >= 2` / `highCost === 1` P1 branch with:

```ts
if (highCost >= 1) {
  const sig = SIGNAL_MATRIX["SIG-01"];
  signals.push({
    code: "SIG-01",
    weight: sig.weight,
    priority: sig.priority,
    note: `${highCost} live non-bank charge${highCost === 1 ? "" : "s"}`,
  });
}
```

Update `docs/agentic-org/CLAUDE.md` and `server/services/agentService.ts` 18 → 12 months.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/services/salesOs.test.ts server/__tests__/services/distressSignals.test.ts`
Expected: PASS (`strataFit` reads `MIN_TRADING_MONTHS` from Sales OS)

- [ ] **Step 5: Commit**

```powershell
git add shared/salesOs.ts server/__tests__/services/salesOs.test.ts docs/agentic-org/CLAUDE.md server/services/agentService.ts
git commit -m "feat: 12-month trading gate and SIG-01 on one non-bank charge"
```

---

### Task 2: Non-bank charge classifier

**Files:**
- Create: `shared/chargeClassifier.ts`
- Create: `server/__tests__/shared/chargeClassifier.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `isBankOrBuildingSocietyChargee(name: string): boolean`
  - `isLiveCharge(status?: string | null): boolean`
  - `countLiveNonBankCharges(charges: Array<{ status?: string | null; personsEntitled?: string[] }>): number`
  - `isP0(input: { hasPetition?: boolean; liveNonBankChargeCount: number }): boolean`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/shared/chargeClassifier.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  countLiveNonBankCharges,
  isBankOrBuildingSocietyChargee,
  isLiveCharge,
  isP0,
} from "@shared/chargeClassifier";

describe("charge classifier", () => {
  it("treats clearing banks as deny-list", () => {
    expect(isBankOrBuildingSocietyChargee("HSBC BANK PLC")).toBe(true);
    expect(isBankOrBuildingSocietyChargee("National Westminster Bank Plc")).toBe(true);
    expect(isBankOrBuildingSocietyChargee("Lloyds Bank PLC")).toBe(true);
    expect(isBankOrBuildingSocietyChargee("BARCLAYS BANK PLC")).toBe(true);
    expect(isBankOrBuildingSocietyChargee("Nationwide Building Society")).toBe(true);
    expect(isBankOrBuildingSocietyChargee("Santander UK PLC")).toBe(true);
  });

  it("treats MCA, HP, invoice finance as non-bank", () => {
    expect(isBankOrBuildingSocietyChargee("IWOCA LIMITED")).toBe(false);
    expect(isBankOrBuildingSocietyChargee("CLOSE BROTHERS LIMITED")).toBe(false);
    expect(isBankOrBuildingSocietyChargee("SIEMENS FINANCIAL SERVICES LIMITED")).toBe(false);
    expect(isBankOrBuildingSocietyChargee("BIBBY FACTORS LIMITED")).toBe(false);
  });

  it("ignores satisfied charges and bank-only books", () => {
    expect(isLiveCharge("satisfied")).toBe(false);
    expect(isLiveCharge("fully-satisfied")).toBe(false);
    expect(isLiveCharge("outstanding")).toBe(true);
    expect(
      countLiveNonBankCharges([
        { status: "outstanding", personsEntitled: ["HSBC BANK PLC"] },
        { status: "outstanding", personsEntitled: ["IWOCA LIMITED"] },
        { status: "satisfied", personsEntitled: ["YOULEND LIMITED"] },
      ])
    ).toBe(1);
  });

  it("is P0 on one live non-bank charge or a petition", () => {
    expect(isP0({ liveNonBankChargeCount: 1 })).toBe(true);
    expect(isP0({ liveNonBankChargeCount: 0, hasPetition: true })).toBe(true);
    expect(isP0({ liveNonBankChargeCount: 0 })).toBe(false);
    expect(isP0({ liveNonBankChargeCount: 0, hasPetition: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/chargeClassifier.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `shared/chargeClassifier.ts`:

```ts
const BANK_NEEDLES = [
  "HSBC",
  "NATWEST",
  "NATIONAL WESTMINSTER",
  "ROYAL BANK OF SCOTLAND",
  "RBS ",
  "LLOYDS",
  "BANK OF SCOTLAND",
  "HALIFAX",
  "BARCLAYS",
  "SANTANDER",
  "NATIONWIDE",
  "TSB BANK",
  "TSB ",
  "HANDELSBANKEN",
  "CLYDESDALE",
  "YORKSHIRE BANK",
  "METRO BANK",
  "VIRGIN MONEY",
  "BANK OF IRELAND",
  "ALLIED IRISH",
  "DANSKE",
  "ULSTER BANK",
  "CO-OPERATIVE BANK",
  "COOPERATIVE BANK",
];

function norm(name: string): string {
  return String(name || "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function isBankOrBuildingSocietyChargee(name: string): boolean {
  const n = norm(name);
  if (!n) return false;
  return BANK_NEEDLES.some((needle) => n.includes(needle.trim()));
}

export function isLiveCharge(status?: string | null): boolean {
  const s = String(status || "").toLowerCase();
  if (!s) return true;
  return !s.includes("satisfied") && !s.includes("released") && s !== "fully-satisfied";
}

export function countLiveNonBankCharges(
  charges: Array<{ status?: string | null; personsEntitled?: string[] }>
): number {
  let count = 0;
  for (const charge of charges) {
    if (!isLiveCharge(charge.status)) continue;
    const names = charge.personsEntitled || [];
    if (names.length === 0) continue;
    if (names.some((person) => !isBankOrBuildingSocietyChargee(person))) count += 1;
  }
  return count;
}

export function isP0(input: { hasPetition?: boolean; liveNonBankChargeCount: number }): boolean {
  if (input.hasPetition) return true;
  return (input.liveNonBankChargeCount || 0) >= 1;
}
```

A charge whose **only** entitled persons are deny-list banks does not count. Mixed HSBC + Iwoca on the same charge counts as one non-bank hit.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/__tests__/shared/chargeClassifier.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/chargeClassifier.ts server/__tests__/shared/chargeClassifier.test.ts
git commit -m "feat: classify live non-bank Companies House charges"
```

---

### Task 3: Sendable contact and hopper ranking

**Files:**
- Create: `shared/smeHopper.ts`
- Create: `server/__tests__/shared/smeHopper.test.ts`

**Interfaces:**
- Consumes: `isPersonalMailbox` from `@shared/pecrSend`; `AgenticDealFile` type (optional fields)
- Produces:
  - `SME_HOPPER_TARGET = 250`
  - `SME_ATTACH_ATTEMPT_CAP = 5`
  - `ROLE_LOCALS: Set<string>`
  - `isRoleMailbox(email?: string | null): boolean`
  - `isSendableContact(input: { email?: string | null; contactName?: string | null; directorNames?: string[] }): boolean`
  - `HopperDeal` type used by rank/count
  - `compareSendable(a, b): number`
  - `rankSendable(deals): deals`
  - `hopperCounts(deals): { sendable, huntContact, parked, gated }`
  - `sendableShortfall(deals, target?: number): number`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/shared/smeHopper.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  compareSendable,
  hopperCounts,
  isRoleMailbox,
  isSendableContact,
  rankSendable,
  sendableShortfall,
  SME_HOPPER_TARGET,
} from "@shared/smeHopper";

describe("sendable contact", () => {
  it("requires named director and corporate mailbox", () => {
    expect(isSendableContact({ email: "adam@petshop.co.uk", contactName: "Adam Taylor", directorNames: ["Adam Taylor"] })).toBe(true);
    expect(isSendableContact({ email: "info@petshop.co.uk", contactName: "Adam Taylor", directorNames: ["Adam Taylor"] })).toBe(false);
    expect(isSendableContact({ email: "adam@gmail.com", contactName: "Adam Taylor", directorNames: ["Adam Taylor"] })).toBe(false);
    expect(isSendableContact({ email: "ops@petshop.co.uk", contactName: "Sam", directorNames: ["Adam Taylor"] })).toBe(false);
    expect(isRoleMailbox("enquiries@joinery.co.uk")).toBe(true);
  });
});

describe("hopper rank", () => {
  it("orders hearing, petition, charge count, recency, then older company", () => {
    const ranked = rankSendable([
      { id: 1, hopper: "sendable", nonBankChargeCount: 1, lastSignalAt: "2026-08-01", incorporatedAt: "2018-01-01" },
      { id: 2, hopper: "sendable", nonBankChargeCount: 3, lastSignalAt: "2026-07-01", incorporatedAt: "2015-01-01" },
      { id: 3, hopper: "sendable", hasPetition: true, lastSignalAt: "2026-06-01", incorporatedAt: "2010-01-01" },
      { id: 4, hopper: "sendable", hasPetition: true, hearingAt: "2026-10-01", lastSignalAt: "2026-05-01", incorporatedAt: "2012-01-01" },
    ]);
    expect(ranked.map((d) => d.id)).toEqual([4, 3, 2, 1]);
  });

  it("counts states and shortfall against 250", () => {
    expect(SME_HOPPER_TARGET).toBe(250);
    const deals = [
      { hopper: "sendable" as const },
      { hopper: "sendable" as const },
      { hopper: "hunt_contact" as const },
      { hopper: "parked" as const },
      { hopper: "gated" as const },
      { source: "strata_inbound" as const },
    ];
    expect(hopperCounts(deals)).toEqual({ sendable: 2, huntContact: 1, parked: 1, gated: 1 });
    expect(sendableShortfall(deals)).toBe(248);
  });
});
```

Director match: first token of `contactName` case-insensitive must appear in at least one `directorNames` entry (or equal the full first token of a director). If `directorNames` is omitted, require `contactName` length > 1 and not a role word (`hi|there|sir|team|director`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/smeHopper.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `shared/smeHopper.ts` implementing the exports above. `compareSendable` returns negative when `a` should sort before `b` (better first):

```ts
function rankTuple(d: HopperDeal): [number, number, number, number, number] {
  const hearing = d.hearingAt ? 1 : 0;
  const petition = d.hasPetition ? 1 : 0;
  const charges = d.nonBankChargeCount || 0;
  const signal = d.lastSignalAt ? Date.parse(d.lastSignalAt) : 0;
  const incorporated = d.incorporatedAt ? Date.parse(d.incorporatedAt) : Number.MAX_SAFE_INTEGER;
  return [hearing, petition, charges, signal, -incorporated];
}
```

Compare element-wise descending (except incorporated already negated so older wins). Ignore deals without `hopper` and ignore `source === "strata_inbound"` in counts.

Role locals: `info sales enquiry enquiries admin hello office accounts contact team mail reception bookings support marketing webmaster`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/__tests__/shared/smeHopper.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/smeHopper.ts server/__tests__/shared/smeHopper.test.ts
git commit -m "feat: sendable contact gate and 250 hopper ranking"
```

---

### Task 4: Hopper fields on the deal file

**Files:**
- Modify: `shared/agenticWorkflow.ts` (`AgenticDealFile` around the `petition` field)

**Interfaces:**
- Consumes: Task 3 `HopperDeal` conceptually
- Produces: on `AgenticDealFile`:
  - `hopper?: "gated" | "hunt_contact" | "sendable" | "parked" | "queued"`
  - `attachAttempts?: number`
  - `nonBankChargeCount?: number`
  - `lastSignalAt?: string`
  - `contactSource?: "ch" | "places" | "firecrawl"`
  - `directorNames?: string[]`
  - `incorporatedAt?: string`
  - `hearingAt` stays on `petition.hearingAt`

- [ ] **Step 1: Write the failing test**

Add to `server/__tests__/shared/smeHopper.test.ts` (or a tiny new it in an existing agentic type test if none exists):

```ts
it("treats missing hopper as not sendable", () => {
  expect(hopperCounts([{ source: "distress_scan" }])).toEqual({
    sendable: 0,
    huntContact: 0,
    parked: 0,
    gated: 0,
  });
});
```

No runtime change required beyond types; this step is the field addition.

- [ ] **Step 2: Run test**

Run: `npx vitest run server/__tests__/shared/smeHopper.test.ts`
Expected: PASS with counts ignoring undefined hopper

- [ ] **Step 3: Add fields to `AgenticDealFile`**

Insert after `petition?: { ... };` in `shared/agenticWorkflow.ts`:

```ts
  hopper?: "gated" | "hunt_contact" | "sendable" | "parked" | "queued";
  attachAttempts?: number;
  nonBankChargeCount?: number;
  lastSignalAt?: string;
  contactSource?: "ch" | "places" | "firecrawl";
  directorNames?: string[];
  incorporatedAt?: string;
```

Do not add these to inbound creates.

- [ ] **Step 4: Run `npx vitest run server/__tests__/shared/smeHopper.test.ts server/__tests__/shared/smeOutreach.test.ts`**

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/agenticWorkflow.ts server/__tests__/shared/smeHopper.test.ts
git commit -m "feat: hopper state fields on agentic deal files"
```

---

### Task 5: Hunt writes gated P0s (not sendable)

**Files:**
- Create: `server/services/smeLeadHopper.ts` (hunt helpers only in this task)
- Create: `server/__tests__/services/smeLeadHopper.test.ts`
- Modify: `server/services/agenticWorkflow.ts` `startFromDistressScan` SME charge/petition branch to set hopper fields

**Interfaces:**
- Consumes: `rejectBeforeCharges` from `./strataFit`; `countLiveNonBankCharges`, `isP0` from `@shared/chargeClassifier`; `dealStream`
- Produces:
  - `type ChargeLike = { status?: string | null; personsEntitled?: string[]; createdOn?: string }`
  - `shouldEnterSmeHunt(input): { ok: true; liveNonBankChargeCount: number } | { ok: false; reason: string }`
  - `isExcludedFromSmeHunt(deal: { source?: string; companyNumber?: string; email?: string }, bookedNumbers: Set<string>, inboundNumbers: Set<string>, inboundEmails: Set<string>): boolean`

`shouldEnterSmeHunt` input: `{ companyName, companyNumber, companyStatus, companyStatusDetail, dateOfCreation, sicCodes, alreadyOnBook, charges, hasPetition }`.

Logic: if `isExcludedFromSmeHunt` would be true, caller skips before this. Then `rejectBeforeCharges` (no charges). Then `live = countLiveNonBankCharges(charges)`; if `!isP0({ hasPetition, liveNonBankChargeCount: live })` reason `"no P0 buying signal"`. Else ok.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { shouldEnterSmeHunt, isExcludedFromSmeHunt } from "../../services/smeLeadHopper";

describe("SME hunt gate", () => {
  it("accepts a 13-month-old ltd with one live Iwoca charge", () => {
    const created = new Date();
    created.setMonth(created.getMonth() - 13);
    const result = shouldEnterSmeHunt({
      companyName: "Acme Joinery Limited",
      companyNumber: "01234567",
      companyStatus: "active",
      dateOfCreation: created.toISOString().slice(0, 10),
      sicCodes: ["16230"],
      charges: [{ status: "outstanding", personsEntitled: ["IWOCA LIMITED"] }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.liveNonBankChargeCount).toBe(1);
  });

  it("rejects a high-street-bank-only charge book", () => {
    const result = shouldEnterSmeHunt({
      companyName: "Acme Joinery Limited",
      companyNumber: "01234567",
      companyStatus: "active",
      dateOfCreation: "2018-01-01",
      sicCodes: ["16230"],
      charges: [{ status: "outstanding", personsEntitled: ["HSBC BANK PLC"] }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects companies younger than 12 months even with a petition", () => {
    const created = new Date();
    created.setMonth(created.getMonth() - 6);
    const result = shouldEnterSmeHunt({
      companyName: "Newco Limited",
      companyNumber: "09999999",
      companyStatus: "active",
      dateOfCreation: created.toISOString().slice(0, 10),
      sicCodes: ["16230"],
      hasPetition: true,
      charges: [],
    });
    expect(result.ok).toBe(false);
  });

  it("excludes inbound company numbers and emails", () => {
    expect(
      isExcludedFromSmeHunt(
        { source: "distress_scan", companyNumber: "01234567", email: "a@b.co.uk" },
        new Set(),
        new Set(["01234567"]),
        new Set()
      )
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/smeLeadHopper.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write `shouldEnterSmeHunt` / `isExcludedFromSmeHunt`**

In `server/services/smeLeadHopper.ts` implement those two functions only. Map CH charge `persons_entitled[].name` into `personsEntitled` at the call site later.

Wire `startFromDistressScan` so that when a petition or charge row passes `shouldEnterSmeHunt`, `createAgenticDeal` includes:

```ts
stream: "sme",
source: "distress_scan",
hopper: "gated",
nonBankChargeCount: result.liveNonBankChargeCount,
lastSignalAt: /* petition publishedAt or newest live charge createdOn */,
incorporatedAt: profile.date_of_creation,
```

Do not set `hopper` on inbound. Skip create if `isExcludedFromSmeHunt`. If the existing `assessStrataFit` would fail a one-charge HP but `shouldEnterSmeHunt` passes, **prefer `shouldEnterSmeHunt` for SME stream** so the spec wins. Keep `assessStrataFit` for copy/score when it also passes; if it fails but hunt gate passes, still open the file as gated P0 with `fitSummary` from the hunt reason.

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/__tests__/services/smeLeadHopper.test.ts server/__tests__/services/distressSignals.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add server/services/smeLeadHopper.ts server/__tests__/services/smeLeadHopper.test.ts server/services/agenticWorkflow.ts
git commit -m "feat: SME hunt admits one live non-bank charge into gated hopper"
```

---

### Task 6: Attach waterfall, budgets, refill

**Files:**
- Modify: `server/services/smeLeadHopper.ts`
- Modify: `server/__tests__/services/smeLeadHopper.test.ts`

**Interfaces:**
- Consumes: Task 3 sendable helpers; Task 4 fields
- Produces:
  - `export type AttachBudget = { ch: number; places: number; firecrawl: number; smtp: number }`
  - `export const DEFAULT_ATTACH_BUDGET: AttachBudget = { ch: 400, places: 100, firecrawl: 50, smtp: 50 }`
  - `export type AttachDeps = { officers(companyNumber: string): Promise<string[]>; places(...): Promise<{ website?: string; email?: string; phone?: string } | null>; firecrawl(website: string): Promise<string[]>; mxValid(email: string): Promise<boolean>; smtpValid?(email: string): Promise<boolean> }`
  - `attachOne(deal, deps, budget): Promise<{ dealPatch: Partial<AgenticDealFile>; budget }>`
  - `refillSendableHopper(opts: { deals: AgenticDealFile[]; deps: AttachDeps; budget?: AttachBudget; target?: number; now?: Date }): Promise<{ patches: Array<{ id: number; patch: Partial<AgenticDealFile> }>; budget }>`

`attachOne` order: officers (consume 1 CH) → if email missing, places (1) → firecrawl emails on website (1) → MX → optional SMTP. Apply `isSendableContact` with `directorNames` from officers. Success: `hopper: "sendable"`, `contactSource`, `contactName`, `email`. Fail: `attachAttempts+1`; if >= 5 then `hopper: "parked"` else `hopper: "hunt_contact"` and `waitUntil` +1 day.

`refillSendableHopper`: if `sendableShortfall` is 0, return empty patches and do not call deps. Else take gated + hunt_contact deals (not inbound, not parked, not queued), sort by `compareSendable` using charge/petition fields, attach until shortfall filled or budget hits 0 on the next required tool.

- [ ] **Step 1: Write the failing tests** (same file)

```ts
it("does not call Places when hopper is already at 250 sendable", async () => {
  const places = vi.fn();
  const deals = Array.from({ length: 250 }, (_, i) => ({
    id: i + 1,
    source: "distress_scan" as const,
    stream: "sme" as const,
    hopper: "sendable" as const,
    companyName: `Co ${i}`,
    ownerUserId: "u",
    stage: "outreach" as const,
    status: "waiting_timer" as const,
    events: [],
    createdAt: "",
    updatedAt: "",
  }));
  const { patches } = await refillSendableHopper({
    deals: deals as any,
    deps: { officers: async () => [], places, firecrawl: async () => [], mxValid: async () => false },
  });
  expect(patches).toEqual([]);
  expect(places).not.toHaveBeenCalled();
});

it("parks on the 5th failed attach", async () => {
  const { dealPatch } = await attachOne(
    { attachAttempts: 4, hopper: "hunt_contact", companyName: "X Ltd", companyNumber: "1" } as any,
    { officers: async () => ["Ada Lovelace"], places: async () => null, firecrawl: async () => [], mxValid: async () => false },
    { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
  );
  expect(dealPatch.hopper).toBe("parked");
  expect(dealPatch.attachAttempts).toBe(5);
});

it("marks sendable when director mailbox passes MX", async () => {
  const { dealPatch } = await attachOne(
    { attachAttempts: 0, hopper: "gated", companyName: "X Ltd", companyNumber: "1" } as any,
    {
      officers: async () => ["Adam Taylor"],
      places: async () => ({ email: "adam@petshop.co.uk" }),
      firecrawl: async () => [],
      mxValid: async () => true,
    },
    { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
  );
  expect(dealPatch.hopper).toBe("sendable");
  expect(dealPatch.email).toBe("adam@petshop.co.uk");
  expect(dealPatch.contactSource).toBe("places");
});
```

- [ ] **Step 2: Run tests — expect FAIL** (`attachOne` not exported)

- [ ] **Step 3: Implement `attachOne` and `refillSendableHopper`**

Real Places/Firecrawl adapters live as default deps in this file, wrapping existing `searchPlaces` and `findEmail` / Firecrawl scrape. Tests pass fake `deps`. Never import live clients inside the pure refill loop without going through `deps`.

- [ ] **Step 4: Run `npx vitest run server/__tests__/services/smeLeadHopper.test.ts`**

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add server/services/smeLeadHopper.ts server/__tests__/services/smeLeadHopper.test.ts
git commit -m "feat: attach waterfall and 250 hopper refill with budgets"
```

---

### Task 7: Wire hunt interval, batch drain, inbound exclusion

**Files:**
- Modify: `server/services/agenticWorkflow.ts` — after hunt creates gated files, call `refillSendableHopper` and `storage.updateAgenticDeal` for each patch; `startSmeOutreachBatch` only picks deals with `hopper === "sendable"` (and inbound never)
- Modify: `server/index.ts` only if the daily interval should also call refill; prefer calling refill at the end of `startFromDistressScan` and from the existing 60s tick when `hopper` hunt_contact `waitUntil` is due via `completeContact` replacement for SME hopper files
- Modify: `server/__tests__/shared/smeOutreach.test.ts`

**Interfaces:**
- Consumes: `refillSendableHopper`, `rankSendable`, `isSendableContact`
- Produces: `startSmeOutreachBatch` opens at most `remainingSmeFirstTouchSlots`, sets `hopper: "queued"` on those deals, then `sendOutreach` as today

- [ ] **Step 1: Failing test in smeOutreach.test.ts**

```ts
it("Queue SME emails only drains sendable hopper files", () => {
  const picked = pickSmeOutreachBatch({
    candidates: [
      { companyName: "Inbound Ltd", companyNumber: "1", email: "a@in.co.uk", sicCodes: ["16230"] },
    ],
    limit: 50,
  });
  // Keep existing pick tests. Add a helper used by the service:
});
```

Better: export `isSmeHopperSendable(deal)` from `smeHopper.ts`:

```ts
export function isSmeHopperSendable(deal: {
  hopper?: string;
  source?: string;
  stream?: string;
  email?: string | null;
}): boolean {
  if (deal.source === "strata_inbound") return false;
  return deal.hopper === "sendable";
}
```

Test that inbound and `hunt_contact` are false, `sendable` true.

Add that function in this task if not already in Task 3 — if Task 3 omitted it, add it here with tests.

In `startSmeOutreachBatch`, build candidates from `existing.filter(isSmeHopperSendable)` **first**, then local/finder only if shortfall remains **and** those rows also pass `isSendableContact` and `shouldEnterSmeHunt` is not required for already-sendable hopper files.

Spec: drain the hopper. Finder/local are legacy fill. Prefer hopper-only for the 50 if any sendable exist:

```ts
const hopper = rankSendable(existing.filter((d) => d.hopper === "sendable" && d.source !== "strata_inbound"));
```

Map each to `SmeOutreachCandidate` and `pickSmeOutreachBatch`. Do not mix finder rows until hopper sendable is empty.

- [ ] **Step 2: Run tests — fail until wired**

- [ ] **Step 3: Wire `startSmeOutreachBatch` and post-hunt `refillSendableHopper`**

After creating gated deals in `startFromDistressScan`, `const latest = await storage.listAgenticDeals(); const { patches } = await refillSendableHopper({ deals: latest, deps: liveAttachDeps() });` then apply patches. Live deps must no-op Places/Firecrawl when env keys missing (return null / []) so local dev without keys still hunts to `gated`.

Replace SME `completeContact` path for `hopper === "hunt_contact"` with `attachOne` so `tick()` retries.

- [ ] **Step 4: Run `npx vitest run server/__tests__/shared/smeOutreach.test.ts server/__tests__/services/smeLeadHopper.test.ts`**

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/smeHopper.ts server/__tests__/shared/smeOutreach.test.ts server/services/agenticWorkflow.ts
git commit -m "feat: drain sendable hopper into SME first-touch queue"
```

---

### Task 8: Workforce hopper counts

**Files:**
- Modify: `client/src/components/agentic/DealFilesPanel.tsx`

**Interfaces:**
- Consumes: `hopperCounts` from `@shared/smeHopper`
- Produces: a one-line status under the existing cap line: `Hopper 12/250 sendable · 4 hunt-contact · 1 parked` (inbound not included)

- [ ] **Step 1: Write a failing test if a DealFilesPanel test exists; otherwise add a pure render of the string in smeHopper:**

```ts
export function hopperStatusLine(deals: Parameters<typeof hopperCounts>[0]): string {
  const c = hopperCounts(deals);
  return `Hopper ${c.sendable}/${SME_HOPPER_TARGET} sendable · ${c.huntContact} hunt-contact · ${c.parked} parked`;
}
```

Test: `expect(hopperStatusLine([{ hopper: "sendable" }, { hopper: "hunt_contact" }])).toBe("Hopper 1/250 sendable · 1 hunt-contact · 0 parked")`

- [ ] **Step 2: Run `npx vitest run server/__tests__/shared/smeHopper.test.ts` — FAIL until function exists**

- [ ] **Step 3: Implement `hopperStatusLine` and show it in DealFilesPanel next to the SME cap sentence**

Use `hopperStatusLine(deals)` so the panel stays dumb.

- [ ] **Step 4: Run smeHopper tests PASS**

- [ ] **Step 5: Commit**

```powershell
git add shared/smeHopper.ts server/__tests__/shared/smeHopper.test.ts client/src/components/agentic/DealFilesPanel.tsx
git commit -m "feat: show SME hopper counts on Deal files"
```

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| 12-month trading gate | 1 |
| SIG-01 one non-bank charge P0 | 1, 2 |
| Bank deny list | 2 |
| Named director + corporate mailbox | 3, 6 |
| Rank order | 3 |
| 250 cap, Attach only on shortfall | 3, 6 |
| Hunt gated P0s | 5 |
| Inbound excluded | 5, 7 |
| Attach waterfall + budgets + 5-attempt park | 6 |
| 50/day drain + approval | 7 |
| Workforce counts | 8 |
| No second DB, no auto-send, no bulk CH | all (non-goals) |

## Execution notes

Default Attach deps: if `GOOGLE_PLACES_API` / `FIRECRAWL_API_KEY` missing, skip that step. CH already has cooldown helpers in `agenticWorkflow.ts` — reuse them inside live `officers` dep; on 429 stop the night (return remaining patches, do not throw).
