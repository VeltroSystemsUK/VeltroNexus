# Funding Proposal Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Generate Report refuse a conflicted file and, when facts agree, print one loan amount, two rules-based grades (now / after), bullets not essays, each table once, and real page numbers.

**Architecture:** A shared `buildProposal` kernel reconciles live sources into facts, derives DSCR/monthly/grades, validates slots, and lists conflicts. The HTML renderer reads only that object. The same `ready` flag disables Generate Report, returns 409 from `/api/prospects/:id/report`, and blocks the Sterling zip. Auto Write writes slot arrays, never pounds or grades.

**Tech Stack:** TypeScript, Vitest, Express, React. Existing `calculateLoan` in `client/src/lib/calculators.ts`. Existing Chrome HTML-to-PDF. No new npm packages.

**Spec:** `docs/superpowers/specs/2026-09-08-funding-proposal-quality-design.md`

## Global Constraints

- One PDF for internal work and Sterling. No draft banner. No second artefact.
- Conflicts (`conflicts.length > 0`) → no PDF bytes (UI disabled, report 409, Sterling zip 400). Missing → empty state, generate still allowed.
- Creditsafe is a guide line on the company profile. Never the cover grade. Never a grade input.
- Grades A–E from the DSCR table in the spec (A ≥ 1.50, B ≥ 1.25, C ≥ 1.00, D ≥ 0.75, E < 0.75), one adverse-conduct notch, optional labelled override.
- Narrative is bullets with the spec caps. Tables/stat tiles for figures. No paragraphs.
- Units are declared: `prospect.loanAmount` is pence; requirement / `loanDetails` / calculator amounts are pounds. Never “if it looks big, divide by 100”.
- Persist only `dueDiligence.data.proposal.slots` and `proposal.overrides`. Recompute facts, derived, conflicts, missing on every `buildProposal` call.
- Zeus `calculateRiskGrade` is not used. Forecast modeller is not built. Nine section headings stay.
- Windows PowerShell: `git commit -m "message"` (no bash heredocs).
- Tests: `npx vitest run <file>`.

## File map

- Create: `shared/proposalFacts.ts` — source DTO, reconcile, derive, grade, slots, `buildProposal`, `assertProposalReady`
- Create: `server/__tests__/shared/proposalFacts.test.ts`
- Modify: `shared/schema.ts` — `dueDiligenceDataSchema.proposal` (slots + overrides only)
- Modify: `server/utils/fundingProposal.ts` — model from `buildProposal`; flowing HTML; page map; attachments from documents
- Modify: `server/__tests__/utils/fundingProposal.test.ts` — one amount, no dupes, no banned phrases, grades now/after
- Modify: `server/utils/prospectReport.ts` — 409 before Chrome
- Modify: `server/routes/submissions.ts` — JSON 409 body
- Modify: `server/services/sterlingPack.ts` — sibling 400 gate
- Modify: `server/utils/geminiClient.ts` — CAMPARI/SWOT prompts forbid amounts/grades/working-notes
- Modify: `server/routes/prospects.ts` — Auto Write saves `proposal.slots`; stub check is empty bullets not `< 80` chars
- Modify: `client/src/pages/ProspectDetail.tsx` — panel + disable Generate Report
- Modify: `client/src/pages/underwriting/SummaryPage.tsx` — accept bullets payload
- Tests: `server/__tests__/services/sterlingPack.test.ts` (new, source + helper), `server/__tests__/utils/prospectReport.test.ts` (new, 409 helper)

---

### Task 1: Reconcile live sources into facts and conflicts

**Files:**
- Create: `shared/proposalFacts.ts`
- Create: `server/__tests__/shared/proposalFacts.test.ts`

**Interfaces:**
- Consumes: nothing from later tasks. `calculateLoan` is Task 2.
- Produces:

```ts
export type Grade = "A" | "B" | "C" | "D" | "E";

export type ProposalConflict = {
  field: string;
  values: Array<{ origin: string; value: string }>;
};

export type ProposalMissing = { field: string; emptyState: string };

export type UseOfFundsLine = { label: string; amountPounds: number };

export type ProposalFacts = {
  loanAmountPounds: number | null;
  termMonths: number | null;
  interestRatePct: number | null;
  stackedMonthly: number | null;
  avgCredits: number | null;
  avgDebits: number | null;
  cashForDebt: number | null;
  purposeShort: string | null;
  useOfFunds: UseOfFundsLine[];
  creditsafeScore: string | null;
  creditsafeLimitPounds: number | null;
};

export type ProposalSourceFile = {
  loanAmountPence?: number | null;
  termMonths?: number | null;
  interestRatePct?: number | string | null;
  requirement?: {
    loanAmountPounds?: number | null;
    termMonths?: number | null;
    totalRequestPounds?: number | null;
    useOfFunds?: UseOfFundsLine[];
    purpose?: string | null;
  };
  loanDetails?: {
    amountPounds?: number | null;
    termMonths?: number | null;
    interestRatePct?: number | null;
  };
  calculator?: {
    loanAmountPounds?: number | null;
    termMonths?: number | null;
    interestRatePct?: number | null;
  };
  sweep?: {
    financeMonthly?: number | null;
    avgCredits?: number | null;
    avgDebits?: number | null;
    cashForDebt?: number | null;
  };
  allocation?: UseOfFundsLine[];
  creditsafe?: { score?: string | null; limitPounds?: number | null };
};

export function reconcileFacts(source: ProposalSourceFile): {
  facts: ProposalFacts;
  conflicts: ProposalConflict[];
  missing: ProposalMissing[];
};
```

Money agreement is `Math.round(pounds)`. Rate agreement is `Math.round(pct * 100) / 100`. Term is exact integer. `loanAmountPence` converts with `/ 100` only. Sweep fields have a single source so they cannot conflict; empty sweep → missing, not 0.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { reconcileFacts } from "@shared/proposalFacts";

describe("reconcileFacts", () => {
  it("collapses declared pence and pounds to one amount", () => {
    const result = reconcileFacts({
      loanAmountPence: 12_000_000,
      requirement: { loanAmountPounds: 120_000 },
      loanDetails: { amountPounds: 120_000 },
      calculator: { loanAmountPounds: 120_000 },
    });
    expect(result.facts.loanAmountPounds).toBe(120000);
    expect(result.conflicts).toEqual([]);
    expect(result.missing.find((row) => row.field === "loanAmountPounds")).toBeUndefined();
  });

  it("conflicts when requirement and loanDetails disagree", () => {
    const result = reconcileFacts({
      requirement: { loanAmountPounds: 120_000 },
      loanDetails: { amountPounds: 85_000 },
    });
    expect(result.facts.loanAmountPounds).toBeNull();
    expect(result.conflicts).toEqual([
      {
        field: "loanAmountPounds",
        values: [
          { origin: "requirement.loan_amount", value: "120000" },
          { origin: "loanDetails.amount", value: "85000" },
        ],
      },
    ]);
  });

  it("does not treat 120000 pence as pounds when prospect.loanAmount is the pence field", () => {
    const result = reconcileFacts({
      loanAmountPence: 120_000,
      requirement: { loanAmountPounds: 120_000 },
    });
    expect(result.conflicts.some((row) => row.field === "loanAmountPounds")).toBe(true);
  });

  it("treats empty sources as missing, not a conflict, and not zero", () => {
    const result = reconcileFacts({});
    expect(result.facts.loanAmountPounds).toBeNull();
    expect(result.conflicts).toEqual([]);
    expect(result.missing.map((row) => row.field)).toContain("loanAmountPounds");
    expect(result.facts.stackedMonthly).toBeNull();
    expect(result.facts.cashForDebt).toBeNull();
  });

  it("uses one use-of-funds list when they match, and conflicts when they differ", () => {
    const lines = [{ label: "Iwoca", amountPounds: 21823 }];
    const ok = reconcileFacts({
      allocation: lines,
      requirement: { useOfFunds: lines },
    });
    expect(ok.facts.useOfFunds).toEqual(lines);
    expect(ok.conflicts.find((row) => row.field === "useOfFunds")).toBeUndefined();

    const bad = reconcileFacts({
      allocation: lines,
      requirement: { useOfFunds: [{ label: "Iwoca", amountPounds: 1 }] },
    });
    expect(bad.conflicts.some((row) => row.field === "useOfFunds")).toBe(true);
    expect(bad.facts.useOfFunds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/proposalFacts.test.ts`

Expected: FAIL — `Cannot find module '@shared/proposalFacts'` (or `reconcileFacts` is not exported).

- [ ] **Step 3: Write minimal implementation**

In `shared/proposalFacts.ts` implement `reconcileFacts` only. Collect candidates per field with origin labels exactly as the test: `requirement.loan_amount`, `loanDetails.amount`, `calculator.loanAmount`, `prospect.loanAmount`. Skip null/undefined/empty. If 0 candidates → missing with `emptyState: "—"`. If all `Math.round` values equal → that value. Else conflict and `facts.loanAmountPounds = null`. Same pattern for `termMonths` (`requirement.term_months`, `loanDetails.termMonths`, `calculator.termMonths`, `prospect.term`) and `interestRatePct`. Sweep copies through. Creditsafe copies as guide. Purpose is `requirement.purpose` trimmed to one line (first sentence or 12 words), not a conflict field.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/proposalFacts.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/proposalFacts.ts server/__tests__/shared/proposalFacts.test.ts
git commit -m "feat: reconcile funding-proposal facts and conflicts"
```

---

### Task 2: Derive monthly, DSCR, headroom, and the two grades

**Files:**
- Modify: `shared/proposalFacts.ts`
- Modify: `server/__tests__/shared/proposalFacts.test.ts`

**Interfaces:**
- Consumes: `reconcileFacts`, `ProposalSourceFile`, `ProposalFacts` from Task 1. `calculateLoan(amount, rate, termMonths)` from `client/src/lib/calculators.ts` (same import `fundingProposal.ts` already uses).
- Produces:

```ts
export type ProposalOverrides = {
  gradeNow: Grade | null;
  gradeAfter: Grade | null;
  by: string | null;
  at: string | null;
};

export type ProposalDerived = {
  monthlyRepayment: number | null;
  monthlySaving: number | null;
  dscrNow: number | null;
  dscrAfter: number | null;
  headroomNow: number | null;
  headroomAfter: number | null;
  gradeNow: Grade | null;
  gradeAfter: Grade | null;
  gradeNowComputed: Grade | null;
  gradeAfterComputed: Grade | null;
  adverseConduct: boolean;
};

export const GRADE_DSCR = [
  { min: 1.5, grade: "A" },
  { min: 1.25, grade: "B" },
  { min: 1.0, grade: "C" },
  { min: 0.75, grade: "D" },
  { min: 0, grade: "E" },
] as const;

export function gradeFromDscr(dscr: number | null, adverseConduct: boolean): Grade | null;
export function deriveProposal(
  facts: ProposalFacts,
  source: Pick<ProposalSourceFile, "findings" | "redFlags"> & { overrides?: ProposalOverrides }
): ProposalDerived;
```

Extend `ProposalSourceFile` with:

```ts
findings?: { bounced?: boolean; gambling?: boolean; unarrangedOd?: boolean };
redFlags?: string[];
overrides?: ProposalOverrides;
```

`adverseConduct` is true if any finding flag is true, or a red flag matches `/bounce|unpaid|unarranged|overdraft charge|gambling/i`.

Missing DSCR is `null`, never `0`. Override without `by` is ignored (computed grade wins). Override with `by` sets `gradeNow`/`gradeAfter` to the override; `gradeNowComputed` stays the rules result.

- [ ] **Step 1: Write the failing tests**

Append:

```ts
import { calculateLoan } from "../../client/src/lib/calculators";
import { deriveProposal, gradeFromDscr } from "@shared/proposalFacts";

describe("gradeFromDscr", () => {
  it("maps the spec table", () => {
    expect(gradeFromDscr(1.62, false)).toBe("A");
    expect(gradeFromDscr(1.25, false)).toBe("B");
    expect(gradeFromDscr(1.0, false)).toBe("C");
    expect(gradeFromDscr(0.87, false)).toBe("D");
    expect(gradeFromDscr(0.5, false)).toBe("E");
    expect(gradeFromDscr(null, false)).toBeNull();
  });

  it("notches both sides one grade for adverse conduct, floor E", () => {
    expect(gradeFromDscr(1.62, true)).toBe("B");
    expect(gradeFromDscr(0.87, true)).toBe("E");
    expect(gradeFromDscr(0.5, true)).toBe("E");
  });
});

describe("deriveProposal Home Crafters numbers", () => {
  const facts = reconcileFacts({
    requirement: { loanAmountPounds: 120_000, termMonths: 60 },
    loanDetails: { amountPounds: 120_000, termMonths: 60, interestRatePct: 18 },
    calculator: { loanAmountPounds: 120_000, termMonths: 60, interestRatePct: 18 },
    sweep: { financeMonthly: 5702.7, avgCredits: 20200.98, avgDebits: 20952.73, cashForDebt: 4950.95 },
  }).facts;

  it("uses calculateLoan monthly, not a stored LLM repayment", () => {
    const derived = deriveProposal(facts, {});
    const monthly = calculateLoan(120000, 18, 60).monthlyPayment;
    expect(derived.monthlyRepayment).toBeCloseTo(monthly, 2);
    expect(derived.dscrNow).toBeCloseTo(4950.95 / 5702.7, 2);
    expect(derived.dscrAfter).toBeCloseTo(4950.95 / monthly, 2);
    expect(derived.gradeNow).toBe("D");
    expect(derived.gradeAfter).toBe("A");
    expect(derived.headroomNow).toBeCloseTo(20200.98 - 20952.73, 2);
    expect(derived.headroomAfter).toBeCloseTo(derived.headroomNow! + derived.monthlySaving!, 2);
  });

  it("does not invent grade E when statements are missing", () => {
    const empty = reconcileFacts({
      requirement: { loanAmountPounds: 120_000, termMonths: 60 },
      loanDetails: { interestRatePct: 18 },
    }).facts;
    const derived = deriveProposal(empty, {});
    expect(derived.dscrNow).toBeNull();
    expect(derived.gradeNow).toBeNull();
    expect(derived.gradeAfter).toBeNull();
  });

  it("prints override as override and keeps the computed pair", () => {
    const derived = deriveProposal(facts, {
      overrides: { gradeNow: "B", gradeAfter: "A", by: "David", at: "2026-09-08" },
    });
    expect(derived.gradeNowComputed).toBe("D");
    expect(derived.gradeNow).toBe("B");
    expect(derived.gradeAfter).toBe("A");
  });

  it("ignores override when by is missing", () => {
    const derived = deriveProposal(facts, {
      overrides: { gradeNow: "A", gradeAfter: "A", by: null, at: null },
    });
    expect(derived.gradeNow).toBe("D");
  });
});
```

The `calculateLoan` import path from `server/__tests__/shared/` is `../../../client/src/lib/calculators` if the `@shared` alias is the only path rewrite — use the same relative style as `server/utils/fundingProposal.ts`: `../../client/src/lib/calculators` from `server/utils`, so from the test file use `../../../client/src/lib/calculators`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/proposalFacts.test.ts`

Expected: FAIL — `gradeFromDscr` / `deriveProposal` not exported.

- [ ] **Step 3: Write minimal implementation**

`gradeFromDscr`: if `dscr == null` or not finite, return null. Walk `GRADE_DSCR`. If `adverseConduct`, map A→B, B→C, C→D, D→E, E→E.

`deriveProposal`: if amount, rate, term all present and term > 0, `monthlyRepayment = calculateLoan(...).monthlyPayment`. `dscrNow = cashForDebt / stackedMonthly` when both > 0. `dscrAfter = cashForDebt / monthlyRepayment` when both > 0. `headroomNow = avgCredits - avgDebits` when both present. `monthlySaving = stackedMonthly - monthlyRepayment` when both present. `headroomAfter = headroomNow + monthlySaving` when both present. Creditsafe is not read here.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/proposalFacts.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/proposalFacts.ts server/__tests__/shared/proposalFacts.test.ts
git commit -m "feat: derive proposal DSCR pair and now/after grades"
```

---

### Task 3: Slot caps, banned phrases, and markdown hydrate

**Files:**
- Modify: `shared/proposalFacts.ts`
- Modify: `server/__tests__/shared/proposalFacts.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:

```ts
export const SLOT_CAPS = {
  background: { cap: 5, maxWords: 25 },
  theBusiness: { cap: 6, maxWords: 25 },
  campari: { cap: 6, maxWords: 20 },
  swot: { cap: 5, maxWords: 20 },
  bankFindings: { cap: 8, maxWords: 20 },
  recommendation: { cap: 5, maxWords: 25 },
} as const;

export const BANNED_PHRASES = [
  "the document provided",
  "note on scope",
  "cannot currently be assessed",
  "this is not stated",
  "the evaluation below",
  "cannot currently be credit-assessed",
] as const;

export type SlotValidation =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export function validateBullet(text: string, maxWords: number): SlotValidation;
export function validateSlot(items: string[], cap: number, maxWords: number): string[];
export function hydrateBulletsFromMarkdown(raw: string, cap: number, maxWords: number): string[];
```

Reject (case-insensitive) if the bullet contains: `£`; `/\bDSCR\b/`; `/\b\d+\.\d+x\b/`; `/\b(risk\s+)?(grade|score)\s*[A-E]\b/`; `/\b[A-E]\s*\((very\s+)?(low|medium|high)\s+risk\)/`; `/\b(loan|facility|term)\b[^.]{0,40}\b\d+\s*(months?|years?)\b/`; any `BANNED_PHRASES` entry. Word count is whitespace split. Over-cap items are dropped (not an error) in `validateSlot`. `validateBullet` is the save-time rejector.

Hydrate: split on `\n`, strip `#` / `*` / leading `- `, run `validateBullet`, drop failures, apply cap. Do not keep paragraphs as a single bullet.

- [ ] **Step 1: Write the failing tests**

```ts
import { hydrateBulletsFromMarkdown, validateBullet, validateSlot, SLOT_CAPS } from "@shared/proposalFacts";

describe("validateBullet", () => {
  it("accepts a short fact with no numbers", () => {
    expect(validateBullet("Omnichannel craft retailer in Yate and online.", 25).ok).toBe(true);
  });

  it("rejects pounds, DSCR, grades, terms, and working-notes", () => {
    expect(validateBullet("Facility of £120,000 to refinance.", 25).ok).toBe(false);
    expect(validateBullet("DSCR lifts from 0.87x to 1.62x.", 25).ok).toBe(false);
    expect(validateBullet("Risk score of E on file.", 25).ok).toBe(false);
    expect(validateBullet("A (Very Low Risk) borrower.", 25).ok).toBe(false);
    expect(validateBullet("Loan over 60 months at a fixed rate.", 25).ok).toBe(false);
    expect(validateBullet("Note on scope: the document provided is a schedule.", 25).ok).toBe(false);
  });
});

describe("validateSlot", () => {
  it("drops bullets past the cap", () => {
    const items = Array.from({ length: 8 }, (_, i) => `Established trading point ${i}`);
    expect(validateSlot(items, SLOT_CAPS.background.cap, SLOT_CAPS.background.maxWords)).toHaveLength(5);
  });
});

describe("hydrateBulletsFromMarkdown", () => {
  it("takes bullets from an essay and strips forbidden ones", () => {
    const raw = `# CAMPARI Analysis: Character\n\n**Directors**\nSole director Kirsty Bevan.\nThe proposed £85,000 facility is for refinance.\nNote on scope: the document provided is incomplete.`;
    const out = hydrateBulletsFromMarkdown(raw, 6, 20);
    expect(out).toContain("Sole director Kirsty Bevan.");
    expect(out.join(" ")).not.toMatch(/85,000/);
    expect(out.join(" ").toLowerCase()).not.toContain("note on scope");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/proposalFacts.test.ts`

Expected: FAIL — `validateBullet` not exported.

- [ ] **Step 3: Write minimal implementation**

Implement the three functions and the two constant lists in `shared/proposalFacts.ts`. `validateSlot` maps `validateBullet` and keeps only `ok: true`, then `.slice(0, cap)`.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/proposalFacts.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/proposalFacts.ts server/__tests__/shared/proposalFacts.test.ts
git commit -m "feat: validate proposal bullets and strip working-notes"
```

---

### Task 4: `buildProposal` + persist slots/overrides on diligence

**Files:**
- Modify: `shared/proposalFacts.ts`
- Modify: `shared/schema.ts` (`dueDiligenceDataSchema`, after `strataPackaging`)
- Modify: `server/__tests__/shared/proposalFacts.test.ts`

**Interfaces:**
- Consumes: Task 1–3.
- Produces:

```ts
export type ProposalSlots = {
  background: string[];
  theBusiness: string[];
  campari: Record<"character" | "ability" | "means" | "purpose" | "amount" | "repayment" | "insurance", string[]>;
  swot: Record<"strengths" | "weaknesses" | "opportunities" | "threats", string[]>;
  bankFindings: string[];
  recommendation: string[];
};

export type BuiltProposal = {
  facts: ProposalFacts;
  derived: ProposalDerived;
  slots: ProposalSlots;
  overrides: ProposalOverrides;
  conflicts: ProposalConflict[];
  missing: ProposalMissing[];
  ready: boolean;
};

export function emptySlots(): ProposalSlots;

export function buildProposal(source: ProposalSourceFile & {
  slots?: Partial<ProposalSlots> | ProposalSlots;
  legacy?: {
    background?: string;
    theBusiness?: string;
    campari?: Partial<ProposalSlots["campari"]>;
    swot?: Partial<ProposalSlots["swot"]>;
    recommendation?: string;
  };
}): BuiltProposal;

export function proposalSourceFromFile(input: {
  prospect: {
    loanAmount?: number | null;
    term?: number | null;
    interestRate?: string | number | null;
    loanRequirementNotes?: string | null;
    loanRequirementData?: unknown;
    loanAllocation?: unknown;
    background?: string | null;
    notes?: string | null;
    company?: {
      creditsafeScore?: string | number | null;
      creditsafeRatingDescription?: string | null;
      creditsafeCreditLimit?: number | null;
    };
  };
  dueDiligence?: { data?: any } | null;
}): ProposalSourceFile;
```

`ready === conflicts.length === 0`.

Hydrate only when a slot array is empty: `legacy.background` / `legacy.theBusiness` / `legacy.campari[key]` / `legacy.swot[key]` / `legacy.recommendation`. Never hydrate from `financialAnalysis.summary`, `accounts.summary`, or `prospect.notes`.

Zod (slots + overrides only):

```ts
export const proposalGradeSchema = z.enum(["A", "B", "C", "D", "E"]);
export const proposalOverridesSchema = z.object({
  gradeNow: proposalGradeSchema.nullable().optional(),
  gradeAfter: proposalGradeSchema.nullable().optional(),
  by: z.string().nullable().optional(),
  at: z.string().optional().nullable(),
});
export const proposalSlotsSchema = z.object({
  background: z.array(z.string()).optional(),
  theBusiness: z.array(z.string()).optional(),
  campari: z.record(z.string(), z.array(z.string())).optional(),
  swot: z.object({
    strengths: z.array(z.string()).optional(),
    weaknesses: z.array(z.string()).optional(),
    opportunities: z.array(z.string()).optional(),
    threats: z.array(z.string()).optional(),
  }).optional(),
  bankFindings: z.array(z.string()).optional(),
  recommendation: z.array(z.string()).optional(),
});
```

Add to `dueDiligenceDataSchema`: `proposal: z.object({ overrides: proposalOverridesSchema.optional(), slots: proposalSlotsSchema.optional() }).optional()`.

`proposalSourceFromFile` mapping:

- `loanAmountPence` ← `prospect.loanAmount`
- requirement amounts from `loanRequirementData.product_details.loan_amount`, `use_of_funds.total_request_amount`, `use_of_funds.breakdown`
- `loanDetails` from `data.underwriting.loanDetails` (pounds)
- calculator from `data.loanCalculator`
- sweep from `data.underwriting.affordabilitySweep`
- allocation from `prospect.loanAllocation`
- findings from `preliminaryFindings` arrays (length > 0) and `redFlags`
- creditsafe from company (`creditsafeCreditLimit` is already pence in fundingProposal `gbp(..., true)` — convert `/ 100` here and name the origin `company.creditsafeCreditLimit`)
- slots/overrides from `data.proposal`
- legacy campari from `adviserSummary.sections`, swot from `underwriting.swotAnalysis` arrays, background from `prospect.background` only, theBusiness from `adviserSummary.sections.overview` or `.background`, recommendation from `adviserSummary.sections.recommendation`

- [ ] **Step 1: Write the failing tests**

```ts
import { buildProposal, proposalSourceFromFile } from "@shared/proposalFacts";

it("ready is false only when conflicts exist", () => {
  expect(buildProposal({ requirement: { loanAmountPounds: 120000 }, loanDetails: { amountPounds: 85000 } }).ready).toBe(false);
  expect(buildProposal({}).ready).toBe(true);
});

it("hydrates CAMPARI from old markdown but never from bank.summary", () => {
  const built = buildProposal({
    legacy: {
      campari: { character: ["# Character\nSole director on file."] },
    },
  });
  expect(built.slots.campari.character.some((line) => /Sole director/.test(line))).toBe(true);
});

it("proposalSourceFromFile uses pence only on prospect.loanAmount", () => {
  const source = proposalSourceFromFile({
    prospect: {
      loanAmount: 12_000_000,
      term: 60,
      interestRate: "18",
      loanRequirementData: { product_details: { loan_amount: 120000, term_months: 60 } },
      company: { creditsafeScore: "A", creditsafeCreditLimit: 1_000_000 },
    },
    dueDiligence: {
      data: {
        underwriting: { loanDetails: { amount: 120000, termMonths: 60, interestRate: 18 } },
      },
    },
  });
  const built = buildProposal(source);
  expect(built.facts.loanAmountPounds).toBe(120000);
  expect(built.facts.creditsafeScore).toBe("A");
  expect(built.ready).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/proposalFacts.test.ts`

Expected: FAIL — `buildProposal` not exported.

- [ ] **Step 3: Write minimal implementation**

Implement `emptySlots`, `buildProposal`, `proposalSourceFromFile`, and the zod fields. `buildProposal` = reconcile + derive + validate/hydrate each slot + `ready`.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/proposalFacts.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/proposalFacts.ts shared/schema.ts server/__tests__/shared/proposalFacts.test.ts
git commit -m "feat: buildProposal kernel and diligence proposal slots"
```

---

### Task 5: Renderer reads the ledger — one slot per fact, flowing pages, attachments from documents

**Files:**
- Modify: `server/utils/fundingProposal.ts`
- Modify: `server/__tests__/utils/fundingProposal.test.ts`

**Interfaces:**
- Consumes: `buildProposal`, `proposalSourceFromFile`, `SLOT_CAPS` from `@shared/proposalFacts`. `attachmentsFromDocuments` from `@shared/sterlingPortal`. `calculateLoan` already imported.
- Produces: same exports (`buildFundingProposal`, `renderFundingProposalHtmlFromData`, `renderFundingProposalHtml`, `renderFundingProposalPdf`). Model gains `gradeNow`, `gradeAfter`, `gradeNowComputed`, `gradeAfterComputed`, `gradeOverrideBy`, `creditsafeGuide`, `proposalReady`, `proposalConflicts`. Drops using `riskGrade || creditsafeGrade` as the cover grade. Drops rendering `backgroundNotes` in section 2, `businessFacts` run-on, `allocations`, `sourcesUses`, `bank.summary`, `accounts.summary`. Attachments = `attachmentsFromDocuments(data.documents || [])`.

HTML rules for this task:

- One `.doc` flow. Delete `.paper { break-after: page; min-height: 255mm }` and the `paper()` wrapper that stamps `n / 9`. Running header/footer via `@page` / a single header on `.doc`, or CSS `position: running()` if already unsupported — simplest working approach: **do not** fake page numbers. Footer text stays `CONFIDENTIAL - Written by David Griffiths from Sterling Commercial Finance Limited` without `1 / 9`. Remove `overflow-wrap: anywhere` and `letter-spacing` on body/title/name (keep at most 0.02em on the navy band if the visual match needs it; never on kv/fact cells).
- Cover: fact table (amount, purpose, prepared for, date, term, repayment type) — **no Risk grade row**. Then a `stat-row` of Grade now / Grade after. Profile kv. Creditsafe guide line on the profile (`A · £10,000 limit`) if present. `background` bullets only here (`ul`).
- Section 1: purpose bullets; **one** use-of-funds `fin` table; loan calc kv from ledger (amount, rate, term, monthly, facility fee via existing `loanCalcRows` but monthly must match `derived.monthlyRepayment`).
- Section 2: `theBusiness` bullets; group; ownership; CH kv; charges; risk indicators. No Background & Notes. No `businessFacts` group-box.
- Section 3: Grade now/after + DSCR now/after tiles; CAMPARI with a facts line on Amount (`£X · N months · R% · £M/mo`), Repayment (`DSCR a → b · stacked £S → £M`), Means (avg credits/debits, cash for debt); then `ul.campari-points`. SWOT grid from slot arrays. If override, print `B (overridden from D)`.
- Section 4: DSCR hero from derived; cashflow kv once; monthly table; stacked table; `bankFindings` bullets; findings tables. Do not call `markdownToProposalHtml(model.bankCommentary)`.
- Section 5: P&L/chart only if a cell is a non-zero extractable number; else empty state. Do not print `historicNote` if it matches a banned phrase or contains `8,500,000`.
- Section 6: security kv; research hub. No use of funds, no allocations, no sources/uses, no second loan calc.
- Section 7: empty state only (no DSCR/Creditsafe tiles).
- Section 8: recommendation bullets + sign-off.
- Section 9: attachments from documents.

Update existing tests that asserted `Risk grade: B`, `1.50x` as sweep text, `Allocations`, `1 / 9`, `9 / 9`, `class="running-name"` inside each paper — those behaviours are specified gone. Keep section heading assertions (`1.&nbsp;&nbsp;Loan amount and purpose` … `9.&nbsp;&nbsp;Attachments checklist`). Keep XSS escape test. Keep CAMPARI-not-in-other-sections test.

Home Crafters-shaped HTML test (reconciled):

```ts
it("prints one amount, D then A, and no working-notes", () => {
  const html = renderFundingProposalHtmlFromData({
    prospect: prospect({
      loanAmount: 12_000_000,
      term: 60,
      interestRate: "18",
      loanRequirementData: {
        product_type: "BUSINESS_LOAN",
        product_details: { loan_amount: 120000, term_months: 60 },
        use_of_funds: { total_request_amount: 120000, breakdown: [{ description: "Iwoca", amount: 21823 }] },
        notes: "Refinance of expensive short-term debt",
      },
      loanAllocation: [{ description: "Iwoca", amount: 21823 }],
      background: "Omnichannel craft retailer in Yate and online.",
      notes: "Note on scope: the document provided is a schedule.",
    }),
    contacts,
    activities: [],
    dueDiligence: dueDiligence({
      riskGrade: "A",
      financialAnalysis: {
        summary: "Note on scope: the document provided is a single-page schedule. Proposed £110,000. £8,500,000 inconsistency.",
        dscr: 0,
        riskScore: "E",
        averageMonthlyRevenue: 0,
        netDisposableIncome: 0,
      },
      accountsAnalysis: {
        summary: "The loan request is for £8,500,000 with a £0 stated monthly repayment.",
        years: [{ year: "FY26", turnover: 0, grossProfit: 0, ebitda: 0, netProfit: 0 }],
      },
      adviserSummary: {
        sections: {
          amount: "The £85,000 refinance is intended to consolidate.",
          character: "Sole director on file: Kirsty Bevan.",
        },
      },
      affordabilitySweep: {
        totals: { avgIn: 20200.98, avgOut: 20952.73, avgNet: -751.75, months: 6 },
        financeMonthly: 5702.7,
        cashForDebt: 4950.95,
        proposedMonthly: 3050,
        dscrCurrent: 0.87,
        dscrRefinance: 1.62,
        monthlySaving: 2652.7,
        lenders: [{ name: "YouLend", kind: "mca", moneyOut: 250, count: 166, monthly: 2179.72 }],
        months: [{ label: "March 2026", moneyIn: 21489.34, moneyOut: 26289.12, net: -4799.78, closing: -8833.09 }],
      },
    }),
    documents: [{ id: 1, fileName: "statements-mar-aug.pdf", category: "bank-statements" } as any],
  });
  expect(html.match(/£120,000/g)?.length).toBeGreaterThan(0);
  expect(html).not.toContain("£85,000");
  expect(html).not.toContain("£110,000");
  expect(html).not.toContain("£8,500,000");
  expect(html).not.toMatch(/note on scope/i);
  expect(html).not.toContain("the document provided");
  expect(html).not.toContain(">Allocations<");
  expect(html).not.toContain("Application of Funds");
  expect(html).not.toContain("1 / 9");
  expect(html).not.toContain("overflow-wrap: anywhere");
  expect(html).toMatch(/Grade now/);
  expect(html).toMatch(/Grade after/);
  expect(html).toContain(">D<");
  expect(html).toContain(">A<");
  expect((html.split("Background").length - 1)).toBeLessThanOrEqual(2);
  expect(html).toContain("Last 6 months business bank statements");
  expect(html).toMatch(/Attached/i);
});
```

Conflicted file is Task 6 (no HTML). This test uses agreeing amounts.

Also add:

```ts
it("does not use Creditsafe as the cover grade", () => {
  const html = renderFundingProposalHtmlFromData({
    prospect: prospect({ company: { ...prospect().company, creditsafeScore: "A", creditsafeRatingDescription: "Very Low Risk" } }),
    contacts,
    activities: [],
    dueDiligence: dueDiligence({ riskGrade: undefined, affordabilitySweep: { ...dueDiligence().data.underwriting.affordabilitySweep, financeMonthly: 5702.7, cashForDebt: 4950.95 } }),
  });
  expect(html).not.toMatch(/Risk grade:\s*Very Low Risk/);
  expect(html).toMatch(/Creditsafe/);
});
```

- [ ] **Step 1: Write the failing tests** (Home Crafters HTML + the Creditsafe cover test). Keep old tests that still match; change the ones the spec kills (`1 / 9`, Allocations required, Risk grade B as cover).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/utils/fundingProposal.test.ts`

Expected: FAIL on `£85,000` still present and/or `1 / 9` still present.

- [ ] **Step 3: Write minimal implementation**

At the top of `buildFundingProposal`, `const proposal = buildProposal(proposalSourceFromFile({ prospect, dueDiligence: data.dueDiligence }))`. Drive `facts`, `riskGrade` (display `derived.gradeNow` for any leftover field, but cover uses two tiles), `backgroundNotes` as bullets joined only for the cover slot (prefer rendering `proposal.slots.background` directly as `<ul>`), `theBusiness` from slots, `useOfFunds` from `facts.useOfFunds`, `allocations = null`, `sourcesUses = null`, `bankCommentary = ""`, CAMPARI from `proposal.slots.campari`, SWOT from `proposal.slots.swot`. `attachments: attachmentsFromDocuments((data.documents || []).map(d => ({ id: d.id, fileName: d.fileName, category: d.category })))`.

Rewrite `renderFundingProposalHtml` pages as a single flowing `<div class="doc">` with navy bands, not nine `.paper` min-heights. Remove `overflow-wrap: anywhere`.

Historic: if every P&L value is 0 or `—`, treat as empty (no chart of zeros, no `historicNote` essay).

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/utils/fundingProposal.test.ts`

Expected: PASS. Then `npx vitest run server/__tests__/shared/proposalFacts.test.ts` still PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/utils/fundingProposal.ts server/__tests__/utils/fundingProposal.test.ts
git commit -m "feat: print the proposal from the facts ledger"
```

---

### Task 6: Generate gate — 409 on the report, 400 on the Sterling zip

**Files:**
- Modify: `shared/proposalFacts.ts`
- Modify: `server/utils/prospectReport.ts`
- Modify: `server/routes/submissions.ts` (the `/api/prospects/:prospectId/report` handler)
- Modify: `server/services/sterlingPack.ts`
- Create: `server/__tests__/utils/prospectReport.test.ts`
- Create: `server/__tests__/services/sterlingPackProposal.test.ts`

**Interfaces:**
- Consumes: `buildProposal`, `proposalSourceFromFile`, `BuiltProposal`.
- Produces:

```ts
export class ProposalNotReadyError extends Error {
  status: 409;
  conflicts: ProposalConflict[];
  missing: ProposalMissing[];
  constructor(built: BuiltProposal);
}

export function assertProposalReady(built: BuiltProposal): void;
```

`assertProposalReady` throws `ProposalNotReadyError` when `!built.ready`. Message: `Proposal facts conflict: loanAmountPounds (120000 vs 85000)` (join fields).

`streamProspectReport` / `renderProspectReportToBuffer` call `assertProposalReady(buildProposal(proposalSourceFromFile({ prospect: data.prospect, dueDiligence: data.dueDiligence })))` **before** `renderFundingProposalPdf`.

Report route: if `error instanceof ProposalNotReadyError`, `return res.status(409).json({ message: error.message, conflicts: error.conflicts, missing: error.missing })`. Do not send `application/pdf`.

Sterling pack: after completeness, same `assertProposalReady`. On `ProposalNotReadyError`, `throw Object.assign(new Error(error.message), { status: 400 })`. Do not call `renderFundingProposalPdf`. Do not build the zip.

Also export a tiny helper used by tests:

```ts
export function proposalPackStatus(built: BuiltProposal): { ok: true } | { ok: false; status: 400; message: string };
```

- [ ] **Step 1: Write the failing tests**

`server/__tests__/shared/proposalFacts.test.ts` (append):

```ts
import { ProposalNotReadyError, assertProposalReady, proposalPackStatus } from "@shared/proposalFacts";

it("assertProposalReady throws 409 on conflict and passes when only gaps", () => {
  expect(() => assertProposalReady(buildProposal({}))).not.toThrow();
  try {
    assertProposalReady(buildProposal({
      requirement: { loanAmountPounds: 120000 },
      loanDetails: { amountPounds: 85000 },
    }));
    throw new Error("expected throw");
  } catch (error) {
    expect(error).toBeInstanceOf(ProposalNotReadyError);
    expect((error as ProposalNotReadyError).status).toBe(409);
    expect((error as ProposalNotReadyError).conflicts[0].field).toBe("loanAmountPounds");
  }
});

it("pack maps the same failure to status 400", () => {
  const status = proposalPackStatus(buildProposal({
    requirement: { loanAmountPounds: 120000 },
    loanDetails: { amountPounds: 85000 },
  }));
  expect(status.ok).toBe(false);
  if (!status.ok) expect(status.status).toBe(400);
});
```

`server/__tests__/utils/prospectReport.test.ts`:

```ts
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("funding proposal report gate", () => {
  it("streamProspectReport asserts proposal ready before Chrome", () => {
    const src = fs.readFileSync(path.resolve("server/utils/prospectReport.ts"), "utf8");
    expect(src).toMatch(/assertProposalReady/);
    expect(src).toMatch(/ProposalNotReadyError/);
  });

  it("report route returns JSON 409", () => {
    const src = fs.readFileSync(path.resolve("server/routes/submissions.ts"), "utf8");
    expect(src).toMatch(/ProposalNotReadyError/);
    expect(src).toMatch(/status\(409\)/);
  });
});
```

`server/__tests__/services/sterlingPackProposal.test.ts`:

```ts
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("sterling pack proposal gate", () => {
  it("refuses a conflicted proposal before zip", () => {
    const src = fs.readFileSync(path.resolve("server/services/sterlingPack.ts"), "utf8");
    expect(src).toMatch(/assertProposalReady/);
    expect(src).toMatch(/status: 400/);
    const pdfIdx = src.indexOf("renderFundingProposalPdf");
    const gateIdx = src.indexOf("assertProposalReady");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(pdfIdx);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/proposalFacts.test.ts server/__tests__/utils/prospectReport.test.ts server/__tests__/services/sterlingPackProposal.test.ts`

Expected: FAIL — `assertProposalReady` not exported / source does not match.

- [ ] **Step 3: Write minimal implementation**

Add the error class and helpers. Wire the three call sites. Do not generate HTML when not ready.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/proposalFacts.test.ts server/__tests__/utils/prospectReport.test.ts server/__tests__/services/sterlingPackProposal.test.ts server/__tests__/utils/fundingProposal.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/proposalFacts.ts server/utils/prospectReport.ts server/routes/submissions.ts server/services/sterlingPack.ts server/__tests__/utils/prospectReport.test.ts server/__tests__/services/sterlingPackProposal.test.ts server/__tests__/shared/proposalFacts.test.ts
git commit -m "feat: block conflicted funding proposals at report and pack"
```

---

### Task 7: Auto Write fills slots, not essays

**Files:**
- Modify: `server/utils/geminiClient.ts` (`SECTION_GUIDANCE` shape, `generateCampariSection`, `generateSwotAnalysis`)
- Modify: `server/routes/prospects.ts` (campari-section save; swot-analysis save)
- Modify: `client/src/pages/underwriting/SummaryPage.tsx` (payload `< 80` check)
- Modify: `server/__tests__/utils/geminiClientCampari.test.ts` (create if no existing test — source assertions are enough)

**Interfaces:**
- Consumes: `hydrateBulletsFromMarkdown`, `validateSlot`, `SLOT_CAPS`, `emptySlots` from `@shared/proposalFacts`.
- Produces: CAMPARI route still returns `{ sectionKey, content }` where `content` is bullets joined by `\n`. It also writes `data.proposal.slots.campari[sectionKey]` (and `theBusiness` when `sectionKey === "overview"`, `background` when `sectionKey === "background"`, `bankFindings` when `sectionKey === "bank"`, `recommendation` when `sectionKey === "recommendation"`). SWOT route writes `data.proposal.slots.swot` (arrays run through `validateSlot` with SWOT caps) and **does not** persist `summary` onto the PDF path (existing `swotAnalysis.summary` may still save on the analysis object for the Studio screen; the renderer ignores it).

Prompt additions (verbatim intent, put in the shape string):

```
Do not write pound amounts, DSCR ratios, risk grades, or facility term in months or years. Those are injected from the file ledger. Do not write "note on scope", "the document provided", "cannot currently be assessed", or any commentary about missing documents. Maximum 6 bullets, 20 words each for CAMPARI; 5 bullets, 20 words for SWOT.
```

After `generateCampariSection` returns, `const bullets = hydrateBulletsFromMarkdown(content, cap, maxWords)`. If `bullets.length === 0`, throw `Auto Write returned no usable content`. Do **not** use `isStubAiSection` length < 80 on slot output (short valid bullets would fail). Cap for overview/background/recommendation uses `SLOT_CAPS` matching those keys (`theBusiness` / `background` / `recommendation` / `bankFindings` / `campari`).

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/utils/geminiClientCampari.test.ts`:

```ts
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Auto Write slot constraints", () => {
  it("forbids amounts and working-notes in the CAMPARI prompt", () => {
    const src = fs.readFileSync(path.resolve("server/utils/geminiClient.ts"), "utf8");
    expect(src).toMatch(/Do not write pound amounts/);
    expect(src).toMatch(/note on scope/);
  });

  it("campari-section persists proposal.slots", () => {
    const src = fs.readFileSync(path.resolve("server/routes/prospects.ts"), "utf8");
    expect(src).toMatch(/proposal\.slots/);
    expect(src).toMatch(/hydrateBulletsFromMarkdown/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/utils/geminiClientCampari.test.ts`

Expected: FAIL — prompt/source missing.

- [ ] **Step 3: Write minimal implementation**

Edit the prompt strings. In the campari-section handler, after `result.result` is a string, hydrate, merge into `existingData.proposal.slots`, keep writing `adviserSummary.sections[sectionKey]` as the joined bullets so the textarea still works. SWOT handler: `validateSlot` each quadrant, write `proposal.slots.swot`. SummaryPage: treat `payload.bullets?.length >= 1` OR content as success; drop the `< 80` hard fail (or lower it). Return `{ sectionKey, content: bullets.join("\n"), bullets }` from the route.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/utils/geminiClientCampari.test.ts server/__tests__/shared/proposalFacts.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add server/utils/geminiClient.ts server/routes/prospects.ts client/src/pages/underwriting/SummaryPage.tsx server/__tests__/utils/geminiClientCampari.test.ts
git commit -m "feat: Auto Write proposal slots without amounts"
```

---

### Task 8: Generate Report panel on the prospect file

**Files:**
- Modify: `client/src/pages/ProspectDetail.tsx` (`handleGenerateReport`, desktop + mobile Generate Report buttons ~720 and ~775)
- Test: source assertion in `server/__tests__/routes/prospectReportUi.test.ts` (create)

**Interfaces:**
- Consumes: `buildProposal`, `proposalSourceFromFile` from `@shared/proposalFacts`. `ProspectDetail` already has `prospect` and `dueDiligenceData` from `useQuery` key `/api/prospects/${prospectId}/due-diligence` (around line 468). Pass `dueDiligence: { data: dueDiligenceData }` into `proposalSourceFromFile`. Do not add a new REST resource.
- Produces: `const proposal = buildProposal(proposalSourceFromFile({ prospect, dueDiligence }))`. `Generate Report` `disabled={!proposal.ready}` and `data-testid="button-generate-report"`. When `!proposal.ready`, a list `data-testid="proposal-conflicts"` of `{field}: {value} ({origin}) vs {value} ({origin})`. When `proposal.missing.length`, a quieter list `data-testid="proposal-gaps"` that does **not** disable the button. `handleGenerateReport`: if 409, toast the first conflict; do not download a blob.

- [ ] **Step 1: Write the failing test**

```ts
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Generate Report UI gate", () => {
  it("disables download while proposal conflicts exist", () => {
    const src = fs.readFileSync(path.resolve("client/src/pages/ProspectDetail.tsx"), "utf8");
    expect(src).toMatch(/buildProposal/);
    expect(src).toMatch(/proposal-conflicts/);
    expect(src).toMatch(/disabled=\{!proposal\.ready\}/);
    expect(src).toMatch(/status === 409/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/routes/prospectReportUi.test.ts`

Expected: FAIL — strings not in ProspectDetail.

- [ ] **Step 3: Write minimal implementation**

Import the kernel. Compute `proposal` once per render from prospect + diligence. Disable both Generate Report buttons (desktop and the mobile menu item — mobile `DropdownMenuItem` should no-op / show disabled styling when `!proposal.ready`). Render the conflicts/gaps panel above the header actions on desktop (compact: a red count + expandable list is enough; do not build a new page). On 409, `const body = await res.json(); throw new Error(body.message || "Proposal facts conflict")`.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/routes/prospectReportUi.test.ts server/__tests__/utils/fundingProposal.test.ts`

Expected: PASS

Verify in the browser (required for this UI task): open a prospect, confirm Generate Report is clickable when the file is consistent; if you can temporarily mismatch amount in the calculator vs requirement, confirm the button disables and the conflict list names both values; click Generate Report on a consistent file and confirm a PDF downloads; trigger 409 (if you can) and confirm no file lands and a toast shows. Desktop and a narrow viewport for the mobile menu.

- [ ] **Step 5: Commit**

```powershell
git add client/src/pages/ProspectDetail.tsx server/__tests__/routes/prospectReportUi.test.ts
git commit -m "feat: disable Generate Report until proposal facts agree"
```

---

## Self-review (spec coverage)

| Spec section | Task |
|---|---|
| Why duplication happens / one slot per fact | 5 |
| Facts ledger, declared units, use-of-funds one list | 1, 4 |
| Derived monthly/DSCR/headroom; missing ≠ 0 | 2 |
| Grade table, one notch, override, Creditsafe guide | 2, 5 |
| Bullets, caps, banned phrases, facts lines | 3, 5, 7 |
| Persist slots/overrides only | 4, 7 |
| Hydrate old CAMPARI/SWOT/background, never bank.summary | 4, 5 |
| Generate gate UI / 409 / Sterling 400 | 6, 8 |
| Page map, flowing pages, no `1 / 9`, no `overflow-wrap: anywhere` | 5 |
| Attachments from documents | 5 |
| Auto Write slots | 7 |
| Tests that catch Home Crafters | 1–6 |
| Non-goals (Zeus, forecasts, Word merge) | not tasked |
