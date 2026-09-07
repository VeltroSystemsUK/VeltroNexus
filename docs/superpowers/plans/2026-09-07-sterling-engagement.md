# Sterling Engagement, Accounts-Prep, and No Office Number Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop printing David’s 0115 office number on agent email, ask who will produce missing cashflow/management accounts, and block the Sterling pack until the customer e-signs a placeholder Engagement Letter — with Learn and James’s answer bank stating that Strata packaging is free and Sterling requires signed terms.

**Architecture:** Shared kernels first (`strataPhone`, `clientChaseGaps`, `engagementLetter`, factory nodes). Native `/sign/:token` reuses the deal `uploadToken` like pack upload. `buildSterlingPackZip` and Deal Files `complete` both refuse an unsigned live letter. James emails (`accounts_prep`, `engagement_sign`) are extra outreach touches, not cadence steps.

**Tech Stack:** TypeScript, Vitest, Express, React, wouter, TanStack Query. No new npm packages. No DocuSign.

**Spec:** `docs/superpowers/specs/2026-09-07-sterling-engagement-design.md`

## Global Constraints

- `0115 984 9800` is never printed on agent outbound email or pack-upload. No fallback to that number.
- Telnyx is an env-var drop-in: `STRATA_PHONE` or `STRATA_CALLBACK_NUMBER`. Read at call time, not as a module const.
- House line (verbatim): `Strata's packaging is free. Sterling taking the case forward requires signed terms. Optional cashflow or management-accounts production is a Sterling charge, quoted on request against the amount of funding sought, and invoiced under the Engagement Letter. Nothing starts with Sterling until that letter is signed.`
- Sterling invoices production and taking the case forward. Strata packaging is free. No invented pounds. No 1% figures.
- We do not write the business plan. Missing CF, MA, or BP still fires the accounts-prep ask.
- `REQUIRED_FOR_STERLING_SEND` is unchanged. Business plan does not newly block the zip.
- E-sign is native `/sign/:token` on the existing `uploadToken`. Letter version constant `ENGAGEMENT_LETTER_VERSION = "placeholder-v1"`.
- Introducer stream does not gain these nodes.
- Inbound drafts still are not SMTP-sent by SAL-1.
- Windows PowerShell: `git commit -m "message"` (no bash heredocs).
- Tests: `npx vitest run <file>`.

## File map

- Modify: `shared/strataOutreach.ts` — phone helper, `accounts_prep` / `engagement_sign` touches, voicemail with no dangling number
- Modify: `client/src/pages/PackUpload.tsx` — no 0115
- Modify: `shared/agenticWorkflow.ts` — `accountsPrep` and `engagement` on the deal
- Create: `shared/accountsPrep.ts` — missing items, classify reply, `not_needed`
- Modify: `shared/sterlingCompleteness.ts` — `clientChaseGaps`
- Modify: `shared/factoryGraph.ts` — nodes, edges, `nodeForDeal`
- Create: `shared/engagementLetter.ts` — version, letter text, sign payload, live-signature helpers, `engagementSignUrl`, house line
- Modify: `server/services/sterlingPack.ts` — zip gate
- Modify: `server/services/agenticWorkflow.ts` — prep email once, skip CF/MA chase on sterling path, complete-to-Sterling requires live signature
- Create: `server/services/signEngagement.ts` — get/sign by token
- Create: `server/routes/signEngagement.ts`
- Modify: `server/routes.ts` — mount sign router
- Modify: `server/sqliteStorage.ts` — `getAgenticDealByProspectId` if missing
- Create: `client/src/pages/SignEngagement.tsx`
- Modify: `client/src/App.tsx` — `/sign/:token`, full-screen like pack
- Modify: `shared/learn.ts` — handbook slug insert
- Create: `scripts/learn_courses/10-how-strata-and-sterling-work.md`
- Modify: `scripts/learn_courses/01-if-the-business-is-in-trouble.md`, `02-warehouse-brokers.md`, `03-hidden-commissions.md`, `08-help-that-is-actually-there.md`
- Modify: `shared/learnLibrarian.ts` — system prompt + desk prompt
- Modify: `client/src/pages/learn/LearnHome.tsx` — packager line
- Modify: `docs/agentic-org/strata-inbound/answer-bank.md`, `intake.md`, `agents/SAL-1.md`, `corporate_structure.md`, `CLAUDE.md`, `launch_readiness.md`
- Tests beside each module as listed per task

---

### Task 1: Strip the office number from agent email and pack-upload

**Files:**
- Modify: `shared/strataOutreach.ts` (PHONE const ~141, `signatureText`, `signatureHtml`, `renderSmeCall`, `renderIntroducerCall`)
- Modify: `client/src/pages/PackUpload.tsx` (invalid-link copy ~182, footer ~293)
- Modify: `server/__tests__/services/strataOutreach.test.ts`
- Create: `server/__tests__/routes/packUploadUi.test.ts`

**Interfaces:**
- Consumes: existing `signatureHtml` / `signatureText` / `renderOutreachEmail` / `renderSmeCall` / `renderIntroducerCall`
- Produces: `strataCallbackNumber(): string` — `process.env.STRATA_PHONE || process.env.STRATA_CALLBACK_NUMBER || ""`. Signatures omit the phone line when empty. Call voicemail with empty number is “I'll try you again” with no “call me on” dangling and no 0115.

- [ ] **Step 1: Write the failing tests**

In `server/__tests__/services/strataOutreach.test.ts` change the existing assertion:

```ts
expect(email.html).not.toMatch(/0115 984 9800/);
expect(email.text).not.toMatch(/0115 984 9800/);
expect(email.html).toMatch(/Sterling House/);
expect(email.html).toMatch(/not authorised or regulated by the FCA/i);
```

Add:

```ts
import { strataCallbackNumber, renderSmeCall, renderIntroducerCall } from "@shared/strataOutreach";

it("does not default the callback number to David's office", () => {
  const prevP = process.env.STRATA_PHONE;
  const prevC = process.env.STRATA_CALLBACK_NUMBER;
  delete process.env.STRATA_PHONE;
  delete process.env.STRATA_CALLBACK_NUMBER;
  try {
    expect(strataCallbackNumber()).toBe("");
    const sme = renderSmeCall({ companyName: "Acme Joinery Limited", contactName: "David Cole" });
    expect(sme.voicemail).not.toMatch(/0115/);
    expect(sme.voicemail).not.toMatch(/call me on\s*$/i);
    const intro = renderIntroducerCall({ companyName: "Hartley Accountants", contactName: "Pat Hartley" });
    expect(intro.voicemail).not.toMatch(/0115/);
    expect(intro.voicemail).not.toMatch(/Call me on\s*$/i);
  } finally {
    if (prevP === undefined) delete process.env.STRATA_PHONE;
    else process.env.STRATA_PHONE = prevP;
    if (prevC === undefined) delete process.env.STRATA_CALLBACK_NUMBER;
    else process.env.STRATA_CALLBACK_NUMBER = prevC;
  }
});

it("prints STRATA_PHONE on the signature when set", () => {
  const prev = process.env.STRATA_PHONE;
  process.env.STRATA_PHONE = "020 7946 0018";
  try {
    const email = renderOutreachEmail(huntDeal, "sme_1", "outreach-sales");
    expect(email.html).toMatch(/020 7946 0018/);
    expect(email.html).not.toMatch(/0115 984 9800/);
  } finally {
    if (prev === undefined) delete process.env.STRATA_PHONE;
    else process.env.STRATA_PHONE = prev;
  }
});
```

Create `server/__tests__/routes/packUploadUi.test.ts`:

```ts
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("pack upload customer copy", () => {
  it("does not print the Nottingham office number", () => {
    const src = readFileSync(path.resolve("client/src/pages/PackUpload.tsx"), "utf8");
    expect(src).not.toMatch(/0115 984 9800/);
    expect(src).toMatch(/enquiries@stratafinance\.co\.uk/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/services/strataOutreach.test.ts server/__tests__/routes/packUploadUi.test.ts`

Expected: FAIL — HTML still matches `0115 984 9800`; `strataCallbackNumber` is not exported; PackUpload still contains the number.

- [ ] **Step 3: Write minimal implementation**

In `shared/strataOutreach.ts` replace the `PHONE` const with:

```ts
export function strataCallbackNumber(): string {
  return String(process.env.STRATA_PHONE || process.env.STRATA_CALLBACK_NUMBER || "").trim();
}
```

`signatureText`: push `strataCallbackNumber()` into the lines array only if non-empty (keep using `.filter` so empty string is dropped, or skip the push).

`signatureHtml`: `${strataCallbackNumber() ? `<p style="margin:0;color:#374151;">${escapeHtml(strataCallbackNumber())}</p>` : ""}`

`renderSmeCall` / `renderIntroducerCall`: `const callback = callbackNumber || strataCallbackNumber();` then voicemail:

```ts
voicemail: callback
  ? `${agentName} from Strata Finance, calling about restructuring high-cost borrowing for ${deal.companyName}. I'll try you again, or call me on ${callback}.`
  : `${agentName} from Strata Finance, calling about restructuring high-cost borrowing for ${deal.companyName}. I'll try you again.`,
```

Same pattern for introducer voicemail (no “Call me on” when empty).

Leave `renderWarmCall` fallback “the number on your enquiry email”.

In `PackUpload.tsx` invalid-link paragraph:

```
Ask Maya to send the email again, or write to enquiries@stratafinance.co.uk.
```

Footer:

```
Sterling House, Unit 5 Wheatcroft Business Park, Landmere Lane, Edwalton, Nottingham NG12 4DG
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/services/strataOutreach.test.ts server/__tests__/routes/packUploadUi.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add shared/strataOutreach.ts client/src/pages/PackUpload.tsx server/__tests__/services/strataOutreach.test.ts server/__tests__/routes/packUploadUi.test.ts
git commit -m "fix: drop 0115 office number from agent email and pack upload"
```

---

### Task 2: Accounts-prep helpers and chase vs zip

**Files:**
- Modify: `shared/agenticWorkflow.ts` (`AgenticDealFile` after `sterlingHandoffId`)
- Create: `shared/accountsPrep.ts`
- Create: `server/__tests__/shared/accountsPrep.test.ts`
- Modify: `shared/sterlingCompleteness.ts`
- Modify: `server/__tests__/shared/sterlingCompleteness.test.ts`

**Interfaces:**
- Consumes: `packCategoryForAttachment`, `namedPackGaps`, `evaluateSterlingCompleteness`, `PackDocRef` from `@shared/sterlingCompleteness`; `ATTACHMENT_ITEMS` ids
- Produces:
  - On `AgenticDealFile`:
    ```ts
    accountsPrep?: {
      status: "not_needed" | "asked" | "sterling" | "accountant" | "received";
      askedAt?: string;
      decidedAt?: string;
      missing: Array<"cashflow" | "management-accounts" | "business-plan">;
    };
    engagement?: {
      status: "not_sent" | "sent" | "signed" | "void";
      version: string;
      sentAt?: string;
      signedAt?: string;
      signedName?: string;
      signedIp?: string;
    };
    ```
  - `PREP_ITEMS = ["cashflow", "management-accounts", "business-plan"] as const`
  - `missingPrepItems(documents?: PackDocRef[]): typeof PREP_ITEMS[number][]`
  - `classifyAccountsPrepReply(text: string): "sterling" | "accountant" | "unclear"`
  - `resolveAccountsPrep(input: { documents?: PackDocRef[]; existing?: AgenticDealFile["accountsPrep"] }): NonNullable<AgenticDealFile["accountsPrep"]>`
  - `clientChaseGaps(input: Parameters<typeof namedPackGaps>[0] & { accountsPrep?: AgenticDealFile["accountsPrep"] }): string[]`

- [ ] **Step 1: Write the failing tests**

`server/__tests__/shared/accountsPrep.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  classifyAccountsPrepReply,
  missingPrepItems,
  resolveAccountsPrep,
} from "@shared/accountsPrep";
import { clientChaseGaps, evaluateSterlingCompleteness } from "@shared/sterlingCompleteness";

describe("missingPrepItems", () => {
  it("lists cashflow, management accounts, and business plan when absent", () => {
    expect(missingPrepItems([])).toEqual(["cashflow", "management-accounts", "business-plan"]);
    expect(
      missingPrepItems([
        { category: "cashflow" },
        { category: "management-accounts" },
        { category: "business-plan" },
      ]),
    ).toEqual([]);
    expect(missingPrepItems([{ category: "accounts" }])).toContain("management-accounts");
  });
});

describe("classifyAccountsPrepReply", () => {
  it("recognises Sterling vs accountant vs unclear", () => {
    expect(classifyAccountsPrepReply("Please can Sterling prepare the cashflow")).toBe("sterling");
    expect(classifyAccountsPrepReply("you do it — please quote")).toBe("sterling");
    expect(classifyAccountsPrepReply("Our accountant will send the forecasts")).toBe("accountant");
    expect(classifyAccountsPrepReply("Thanks")).toBe("unclear");
  });
});

describe("resolveAccountsPrep", () => {
  it("is not_needed when all three are on file", () => {
    const row = resolveAccountsPrep({
      documents: [
        { category: "cashflow" },
        { category: "management-accounts" },
        { category: "business-plan" },
      ],
    });
    expect(row.status).toBe("not_needed");
    expect(row.missing).toEqual([]);
  });
});

describe("clientChaseGaps", () => {
  it("omits cashflow and management accounts while Sterling is producing, but zip still needs cashflow", () => {
    const docs = [
      { fileName: "june.pdf", category: "bank-statements" },
      { fileName: "accounts-2024.pdf", category: "accounts" },
      { fileName: "debts.xlsx", category: "debt-schedule" },
      { fileName: "passport.pdf", category: "id" },
    ];
    const chase = clientChaseGaps({
      documents: docs,
      fundingReason: "Refinance",
      companyNumber: "12345678",
      accountsPrep: { status: "sterling", missing: ["cashflow"] },
    });
    expect(chase.join(" ")).not.toMatch(/cash flow/i);
    expect(chase.join(" ")).not.toMatch(/management accounts/i);
    const zip = evaluateSterlingCompleteness({
      documents: docs,
      fundingReason: "Refinance",
      companyNumber: "12345678",
      sfpStatus: "COMPLETE",
    });
    expect(zip.ok).toBe(false);
    expect(zip.missing.map((item) => item.id)).toContain("cashflow");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/accountsPrep.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Add the two optional fields to `AgenticDealFile` in `shared/agenticWorkflow.ts`.

`shared/accountsPrep.ts`:

```ts
import type { AgenticDealFile } from "./agenticWorkflow";
import { packCategoryForAttachment, type PackDocRef } from "./sterlingCompleteness";

export const PREP_ITEMS = ["cashflow", "management-accounts", "business-plan"] as const;
export type PrepItem = (typeof PREP_ITEMS)[number];

export function missingPrepItems(documents?: PackDocRef[]): PrepItem[] {
  const found = new Set((documents || []).map((doc) => packCategoryForAttachment(doc.category)));
  return PREP_ITEMS.filter((id) => !found.has(id));
}

export function classifyAccountsPrepReply(text: string): "sterling" | "accountant" | "unclear" {
  const raw = String(text || "");
  const sterling = /\b(sterling|you (do|prepare|produce)|please quote|us to prepare|you to prepare)\b/i.test(raw);
  const accountant = /\b(accountant|our (own )?accountant|we will (send|prepare|produce)|they('ll| will) (send|prepare))\b/i.test(raw);
  if (sterling && !accountant) return "sterling";
  if (accountant && !sterling) return "accountant";
  return "unclear";
}

export function resolveAccountsPrep(input: {
  documents?: PackDocRef[];
  existing?: AgenticDealFile["accountsPrep"];
}): NonNullable<AgenticDealFile["accountsPrep"]> {
  const missing = missingPrepItems(input.documents);
  if (missing.length === 0) {
    return { status: "not_needed", missing: [], askedAt: input.existing?.askedAt, decidedAt: input.existing?.decidedAt };
  }
  const status = input.existing?.status && input.existing.status !== "not_needed" ? input.existing.status : undefined;
  return {
    status: status || "asked",
    missing,
    askedAt: input.existing?.askedAt,
    decidedAt: input.existing?.decidedAt,
  };
}
```

If existing status is `asked` but we have not asked yet, `resolveAccountsPrep` on a first call with no existing should return `{ status: "asked", missing }` only when the caller is recording a send. For the “all three present” path, `not_needed` is enough. When existing is unset and items are missing, return `{ status: "asked", missing }` from `resolveAccountsPrep` only if `existing?.status` is already `asked`/`sterling`/`accountant`/`received`; if unset, return `{ status: "asked", missing }` as the proposed row for the send — tests above only cover `not_needed`. Add this case if you write it: unset + missing → `{ status: "asked", missing }` is acceptable as a proposed value; the workflow send is what persists `askedAt`.

In `sterlingCompleteness.ts`:

```ts
export function clientChaseGaps(
  input: Parameters<typeof namedPackGaps>[0] & {
    accountsPrep?: { status?: string } | null;
  },
): string[] {
  const gaps = namedPackGaps(input);
  if (input.accountsPrep?.status !== "sterling") return gaps;
  return gaps.filter((label) => !/cash flow|management accounts/i.test(label));
}
```

`namedPackGaps` / `evaluateSterlingCompleteness` stay unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/accountsPrep.test.ts server/__tests__/shared/sterlingCompleteness.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add shared/agenticWorkflow.ts shared/accountsPrep.ts shared/sterlingCompleteness.ts server/__tests__/shared/accountsPrep.test.ts server/__tests__/shared/sterlingCompleteness.test.ts
git commit -m "feat: track accounts-prep choice and stop chasing Sterling-produced papers"
```

---

### Task 3: Factory graph — accounts-prep and engagement nodes

**Files:**
- Modify: `shared/factoryGraph.ts`
- Modify: `server/__tests__/shared/factoryGraph.test.ts`

**Interfaces:**
- Consumes: `AgenticDealFile` `accountsPrep` / `engagement` from Task 2; `isLiveEngagement` is Task 4 — until then, inline `deal.engagement?.status === "signed" && deal.engagement.version === (deal.engagement.version || "placeholder-v1")` is wrong. Use a local helper in this file:

  ```ts
  function letterSigned(deal: { engagement?: { status?: string; version?: string } | null }): boolean {
    return deal.engagement?.status === "signed";
  }
  ```

  Task 4 will switch this to `isLiveEngagement` (version-aware). For this task, unsigned means status is not `"signed"`.
- Produces: nodes `accounts-prep` and `engagement`; edges `credit` → `engagement` → `sterling` → `david`; `nodeForDeal` mapping below.

`nodeForDeal` extra pick fields: `accountsPrep`, `engagement`, `packDocuments`.

Rules (introducer unchanged, fail/PECR/LinkedIn/SMTP unchanged):

- If `stream !== "introducer"` and `missingPrepItems(packDocuments).length > 0` and `accountsPrep.status` is unset or `"asked"` and stage is `fulfilment` | `processing` | `pipeline` → `"accounts-prep"`
- If `accountsPrep.status === "accountant"` and those items still missing and stage is `fulfilment` | `processing` → existing `"fulfil"` / `"partial"` / `"pack"` chase path
- If `accountsPrep.status === "sterling"` and not `letterSigned` → `"engagement"`
- `human_review`: if `engagement?.status` is `"sent"` or `"void"` → `"engagement"`; else `"credit"`
- `complete`: if not `letterSigned` → `"engagement"`; else `sterlingHandoffId` ? `"david"` : `"sterling"`

- [ ] **Step 1: Write the failing tests**

Replace the connected-process assertion that `credit` → `sterling` with `credit` → `engagement` → `sterling`.

Add to `server/__tests__/shared/factoryGraph.test.ts`:

```ts
it("places accounts-prep and engagement on the path to David", () => {
  const ids = new Set(FACTORY_NODES.map((node) => node.id));
  expect(ids.has("accounts-prep")).toBe(true);
  expect(ids.has("engagement")).toBe(true);
  expect(FACTORY_NODES.find((node) => node.id === "accounts-prep")?.desk).toBe("James");
  expect(FACTORY_NODES.find((node) => node.id === "engagement")?.desk).toBe("Customer");
  expect(FACTORY_EDGES.some((edge) => edge.source === "credit" && edge.target === "engagement")).toBe(true);
  expect(FACTORY_EDGES.some((edge) => edge.source === "engagement" && edge.target === "sterling")).toBe(true);
  expect(FACTORY_EDGES.some((edge) => edge.source === "credit" && edge.target === "sterling")).toBe(false);
});

it("sits a file missing cashflow on accounts-prep until they choose", () => {
  expect(
    nodeForDeal({
      stage: "fulfilment",
      status: "waiting_timer",
      source: "strata_inbound",
      packDocuments: [{ category: "bank-statements" } as any],
      accountsPrep: { status: "asked", missing: ["cashflow"] },
    }),
  ).toBe("accounts-prep");
});

it("does not put introducers on accounts-prep or engagement", () => {
  expect(
    nodeForDeal({
      stage: "complete",
      status: "complete",
      source: "distress_scan",
      stream: "introducer",
      email: "partner@hartleyaccountants.co.uk",
    }),
  ).toBe("introducer-pipeline");
});

it("holds complete-but-unsigned files on engagement, not sterling", () => {
  expect(
    nodeForDeal({
      stage: "complete",
      status: "complete",
      source: "strata_inbound",
    }),
  ).toBe("engagement");
  expect(
    nodeForDeal({
      stage: "complete",
      status: "complete",
      source: "strata_inbound",
      engagement: { status: "signed", version: "placeholder-v1" },
    }),
  ).toBe("sterling");
});
```

Keep the existing `human_review` → `credit` count test (unsigned memo still sits on credit until the letter is sent).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/factoryGraph.test.ts`

Expected: FAIL — no `accounts-prep` node; `credit` still edges to `sterling`; unsigned complete still maps to `sterling`.

- [ ] **Step 3: Write minimal implementation**

Add nodes (place `accounts-prep` near ingest/partial, `engagement` between credit and sterling; shift `sterling`/`david` x if they overlap — credit is x=2520, sterling 2800, david 3080. Put engagement at x=2660, y=360; move sterling to 2940 and david to 3220):

```ts
{ id: "accounts-prep", label: "Accounts prep", desk: "James", kind: "gate", detail: "Sterling to prepare CF/MA, or their accountant?", x: 2100, y: 280 },
{ id: "engagement", label: "Engagement letter", desk: "Customer", kind: "human", detail: "E-sign Sterling terms before the pack leaves", x: 2660, y: 360 },
```

Replace `{ id: "e-credit-sterling", source: "credit", target: "sterling" }` with:

```ts
{ id: "e-ingest-prep", source: "ingest", target: "accounts-prep", label: "CF / MA / plan missing" },
{ id: "e-partial-prep", source: "partial", target: "accounts-prep", label: "not decided" },
{ id: "e-prep-fulfil", source: "accounts-prep", target: "fulfil", label: "accountant" },
{ id: "e-prep-engagement", source: "accounts-prep", target: "engagement", label: "Sterling prepares" },
{ id: "e-credit-engagement", source: "credit", target: "engagement" },
{ id: "e-engagement-sterling", source: "engagement", target: "sterling" },
```

Extend `nodeForDeal` pick type and implement the rules above. Import `missingPrepItems` from `@shared/accountsPrep`.

Check `countDealsOnNodes` still initialises counts for the new ids (it loops `FACTORY_NODES`, so it will).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/factoryGraph.test.ts server/__tests__/shared/processGraph.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add shared/factoryGraph.ts server/__tests__/shared/factoryGraph.test.ts
git commit -m "feat: add accounts-prep and engagement nodes to the factory"
```

---

### Task 4: Engagement letter kernel

**Files:**
- Create: `shared/engagementLetter.ts`
- Create: `server/__tests__/shared/engagementLetter.test.ts`
- Modify: `shared/factoryGraph.ts` — `letterSigned` becomes `isLiveEngagement`
- Modify: `shared/strataOutreach.ts` — `engagementSignUrl` can live here next to `packUploadUrl`, or in `engagementLetter.ts`. Put `engagementSignUrl` in `engagementLetter.ts`.

**Interfaces:**
- Consumes: none besides env for URL base (same as `packUploadUrl`)
- Produces:
  - `ENGAGEMENT_LETTER_VERSION = "placeholder-v1"`
  - `HOUSE_COST_LINE` — the spec house line, straight apostrophes
  - `engagementLetterText(companyName: string): string`
  - `engagementSignUrl(token?: string | null): string | undefined` — `{base}/sign/{token}`
  - `parseSignPayload(body: { name?: unknown; accepted?: unknown }): { ok: true; name: string } | { ok: false; error: string }`
  - `isLiveEngagement(engagement?: { status?: string; version?: string } | null): boolean` — status `signed` AND version === `ENGAGEMENT_LETTER_VERSION`
  - `applyEngagementSignature(input: { name: string; ip?: string; at?: string }): { status: "signed"; version: string; signedAt: string; signedName: string; signedIp?: string }`
  - `voidStaleEngagement(engagement?: { status?: string; version?: string } | null): "signed" | "void" | "not_sent" | "sent"` — if signed but version mismatch, `"void"`

Letter text must include: customer company name, “Sterling Commercial Finance”, Strata packages and does not lend, Strata’s packaging is free, Sterling takes the case forward only after this letter is signed, fees (including optional CF/MA production) will be set out in pounds in a later version / written quotation, this placeholder does not create a specific fee, signature agrees to proceed under terms to be confirmed in writing before any fee is payable. Must not include `0115` or `1%`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  ENGAGEMENT_LETTER_VERSION,
  HOUSE_COST_LINE,
  applyEngagementSignature,
  engagementLetterText,
  engagementSignUrl,
  isLiveEngagement,
  parseSignPayload,
  voidStaleEngagement,
} from "@shared/engagementLetter";

describe("placeholder letter", () => {
  it("names the parties and does not invent fees or an office number", () => {
    expect(ENGAGEMENT_LETTER_VERSION).toBe("placeholder-v1");
    const text = engagementLetterText("Acme Joinery Limited");
    expect(text).toMatch(/Acme Joinery Limited/);
    expect(text).toMatch(/Sterling Commercial Finance/);
    expect(text).toMatch(/does not lend/i);
    expect(text).toMatch(/packaging is free/i);
    expect(text).toMatch(/quotation/i);
    expect(text).not.toMatch(/0115/);
    expect(text).not.toMatch(/1%/);
    expect(HOUSE_COST_LINE).toMatch(/Strata's packaging is free/);
  });
});

describe("sign payload", () => {
  it("rejects empty name or no tick", () => {
    expect(parseSignPayload({ name: "", accepted: true }).ok).toBe(false);
    expect(parseSignPayload({ name: "Pat Cole", accepted: false }).ok).toBe(false);
    expect(parseSignPayload({ name: "Pat Cole", accepted: true })).toEqual({
      ok: true,
      name: "Pat Cole",
    });
  });
});

describe("live signature", () => {
  it("counts only a signature on the live version", () => {
    expect(isLiveEngagement({ status: "signed", version: "placeholder-v1" })).toBe(true);
    expect(isLiveEngagement({ status: "signed", version: "old" })).toBe(false);
    expect(isLiveEngagement({ status: "sent", version: "placeholder-v1" })).toBe(false);
    expect(voidStaleEngagement({ status: "signed", version: "old" })).toBe("void");
    const applied = applyEngagementSignature({ name: "Pat Cole", ip: "1.1.1.1", at: "2026-09-07T12:00:00.000Z" });
    expect(applied.status).toBe("signed");
    expect(applied.version).toBe("placeholder-v1");
    expect(applied.signedName).toBe("Pat Cole");
  });
});

describe("sign URL", () => {
  it("mirrors pack upload on /sign/:token", () => {
    expect(engagementSignUrl("abc")).toMatch(/\/sign\/abc$/);
    expect(engagementSignUrl("")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/engagementLetter.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Implement `shared/engagementLetter.ts` as specified. `parseSignPayload` trims name; reject if `!accepted` or name length < 2. `engagementSignUrl` copies `packUploadUrl`’s base env (`PUBLIC_APP_URL` || `APP_URL` || `https://leads.stratanexus.co.uk`).

Switch `factoryGraph.ts` `letterSigned` to `isLiveEngagement`. Update the unsigned-complete test if it started passing via status-only signed without version — the Task 3 test already sends `version: "placeholder-v1"`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/engagementLetter.test.ts server/__tests__/shared/factoryGraph.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add shared/engagementLetter.ts server/__tests__/shared/engagementLetter.test.ts shared/factoryGraph.ts
git commit -m "feat: add placeholder Sterling engagement letter kernel"
```

---

### Task 5: Block Sterling zip and Deal Files complete until signed

**Files:**
- Modify: `server/services/sterlingPack.ts` (`buildSterlingPackZip`)
- Modify: `server/services/agenticWorkflow.ts` (the `complete` method that calls `evaluateSterlingCompleteness` then `ensureSterlingHandoff`, ~2595)
- Modify: `server/sqliteStorage.ts` — add `getAgenticDealByProspectId(prospectId: number)` if it does not exist (mirror `getAgenticDealByUploadToken`)
- Create: `server/__tests__/shared/engagementGate.test.ts` for the pure error string
- Modify: `server/__tests__/services/sterlingHandoff.test.ts` only if you touch that module — prefer keeping the gate in shared:

Move this into `shared/engagementLetter.ts`:

```ts
export function engagementBlockReason(
  engagement?: { status?: string; version?: string } | null,
): string | null {
  if (isLiveEngagement(engagement)) return null;
  return "Engagement Letter not signed";
}
```

`buildSterlingPackZip` loads the agentic deal by `handoff.prospectId` and throws `File is not complete for Sterling: Engagement Letter not signed` with `{ status: 400 }` when blocked. If no deal is found, still block (every case to David needs a letter).

`complete` in agenticWorkflow throws the same family of error before `ensureSterlingHandoff`.

**Interfaces:**
- Consumes: `isLiveEngagement`, `engagementBlockReason`
- Produces: zip and complete refuse unsigned files

- [ ] **Step 1: Write the failing tests**

Add to `server/__tests__/shared/engagementLetter.test.ts`:

```ts
import { engagementBlockReason } from "@shared/engagementLetter";

it("names the unsigned gap for the zip", () => {
  expect(engagementBlockReason(undefined)).toBe("Engagement Letter not signed");
  expect(engagementBlockReason({ status: "signed", version: "placeholder-v1" })).toBeNull();
});
```

Add `server/__tests__/services/sterlingPack.engagement.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getAgenticDealByProspectId: vi.fn(),
  },
}));

import { storage } from "../../storage";
import { engagementBlockReason } from "@shared/engagementLetter";

describe("sterling pack engagement gate", () => {
  it("blocks when the deal has no live signature", async () => {
    (storage.getAgenticDealByProspectId as any).mockResolvedValue({
      prospectId: 1,
      engagement: { status: "sent", version: "placeholder-v1" },
    });
    const deal = await storage.getAgenticDealByProspectId(1);
    expect(engagementBlockReason(deal?.engagement)).toBe("Engagement Letter not signed");
  });
});
```

That test is thin. Stronger: export a helper `assertSterlingEngagement(deal)` used by both zip and complete:

```ts
export function assertSterlingEngagement(engagement?: { status?: string; version?: string } | null): void {
  const reason = engagementBlockReason(engagement);
  if (reason) {
    throw Object.assign(new Error(`File is not complete for Sterling: ${reason}`), { status: 400 });
  }
}
```

Test that it throws.

Also add a unit test in `server/__tests__/services/agenticWorkflow.complete.test.ts` only if a focused complete-test file already exists. If not, keep the throw helper test plus a source assertion:

```ts
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

it("complete-to-Sterling and zip both call assertSterlingEngagement", () => {
  const workflow = readFileSync(path.resolve("server/services/agenticWorkflow.ts"), "utf8");
  const pack = readFileSync(path.resolve("server/services/sterlingPack.ts"), "utf8");
  expect(workflow).toMatch(/assertSterlingEngagement/);
  expect(pack).toMatch(/assertSterlingEngagement/);
});
```

Put the source assertion in `server/__tests__/services/sterlingPack.engagement.test.ts` alongside the helper test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/engagementLetter.test.ts server/__tests__/services/sterlingPack.engagement.test.ts`

Expected: FAIL — `assertSterlingEngagement` missing; sources do not match.

- [ ] **Step 3: Write minimal implementation**

Add `engagementBlockReason` and `assertSterlingEngagement` to `shared/engagementLetter.ts`.

`sqliteStorage.ts`:

```ts
async getAgenticDealByProspectId(prospectId: number) {
  return getCollection("agentic_deals").find((deal) => deal.prospectId === prospectId) || undefined;
}
```

Add the method to the storage interface if `IStorage` lists agentic methods.

In `buildSterlingPackZip`, after the existing completeness gate:

```ts
const deal = await storage.getAgenticDealByProspectId(ctx.prospect.id);
assertSterlingEngagement(deal?.engagement);
```

In `agenticWorkflow` complete, after the existing `evaluateSterlingCompleteness` gate:

```ts
assertSterlingEngagement(deal.engagement);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/engagementLetter.test.ts server/__tests__/services/sterlingPack.engagement.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add shared/engagementLetter.ts server/services/sterlingPack.ts server/services/agenticWorkflow.ts server/sqliteStorage.ts server/__tests__/shared/engagementLetter.test.ts server/__tests__/services/sterlingPack.engagement.test.ts
git commit -m "feat: block Sterling send until the engagement letter is signed"
```

If `server/storage.ts` re-exports sqlite methods, add `getAgenticDealByProspectId` there too.

---

### Task 6: Accounts-prep and engagement-sign emails

**Files:**
- Modify: `shared/strataOutreach.ts` (`OutreachTouchId`, `renderOutreachEmail`)
- Modify: `server/__tests__/services/strataOutreach.test.ts`

**Interfaces:**
- Consumes: `HOUSE_COST_LINE`, `engagementSignUrl`, `missingPrepItems`, `requiredCustomerPackLabels`
- Produces: `OutreachTouchId` includes `"accounts_prep" | "engagement_sign"`. `renderOutreachEmail(deal, "accounts_prep" | "engagement_sign", mailbox)` returns subject/html/text with the house line, no 0115, no invented pounds.

`canonicalTouchId` must pass these ids through (extend its return union). Do not add them to the SME cadence.

Accounts-prep body:

- Hi {firstName}
- File for {company} is in. Still missing: {human list of missingPrepItems}
- Two choices: Sterling prepares a cashflow forecast and/or management accounts, or their accountant will.
- We do not prepare the business plan.
- Include `HOUSE_COST_LINE`
- If they choose Sterling, next step is the Engagement Letter. Production does not start before that.

Engagement-sign body:

- Hi {firstName}
- Before we send the {company} pack to Sterling, the director needs to e-sign the Engagement Letter.
- Include `HOUSE_COST_LINE`
- Button/link via `engagementSignUrl(deal.uploadToken)` using the same `ctaButtonHtml` helper as Learn/quiz buttons, label `Review and sign the Engagement Letter`.

- [ ] **Step 1: Write the failing tests**

```ts
it("asks who will prepare missing forecasts without quoting a fee", () => {
  const email = renderOutreachEmail(
    { ...huntDeal, packDocuments: [{ category: "bank-statements" }] } as any,
    "accounts_prep",
    "inbound-enquiries",
  );
  expect(email.subject).toMatch(/Acme Joinery Limited/i);
  expect(email.text).toMatch(/accountant/i);
  expect(email.text).toMatch(/Sterling/i);
  expect(email.text).toMatch(/business plan/i);
  expect(email.text).toMatch(/packaging is free/i);
  expect(email.text).toMatch(/quotation/i);
  expect(email.text).not.toMatch(/0115/);
  expect(email.text).not.toMatch(/1%/);
});

it("sends the engagement sign link", () => {
  const email = renderOutreachEmail(
    { ...huntDeal, uploadToken: "tok_sign" } as any,
    "engagement_sign",
    "inbound-enquiries",
  );
  expect(email.html).toMatch(/\/sign\/tok_sign/);
  expect(email.text).toMatch(/Engagement Letter/i);
  expect(email.text).toMatch(/packaging is free/i);
  expect(email.html).not.toMatch(/0115/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/strataOutreach.test.ts`

Expected: FAIL — unknown touch id / empty body.

- [ ] **Step 3: Write minimal implementation**

Extend `OutreachTouchId`. In `renderOutreachEmail`, handle `accounts_prep` and `engagement_sign` before the cadence templates. Use `withSignature`. Humanise missing items (`cashflow` → `cashflow forecast`, etc.).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/services/strataOutreach.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add shared/strataOutreach.ts server/__tests__/services/strataOutreach.test.ts
git commit -m "feat: add accounts-prep and engagement-sign emails"
```

---

### Task 7: Workflow — one prep ask, skip CF/MA chase, send the sign link

**Files:**
- Modify: `server/services/agenticWorkflow.ts` (`onPackArrived`, `runProcessing`, `keepChasingPack`, `complete`)
- Modify: `client/src/components/agentic/DealFilesPanel.tsx` (`namedPackGaps` → `clientChaseGaps`; add two actions if a mutate endpoint already exists — otherwise add methods on the workflow object and a tiny POST on the agentic router)
- Modify: `server/routes/agenticWorkflow.ts` if you add POST endpoints
- Create: `server/__tests__/services/accountsPrepWorkflow.test.ts`

**Interfaces:**
- Consumes: `resolveAccountsPrep`, `missingPrepItems`, `classifyAccountsPrepReply`, `clientChaseGaps`, `renderOutreachEmail`, `assertSterlingEngagement`
- Produces:
  - `sendAccountsPrepIfNeeded(deal): Promise<AgenticDealFile>` — if missing items and status unset/`asked` without `askedAt`, send `accounts_prep` once, persist `{ status: "asked", askedAt, missing }`. If already `asked` with `askedAt`, no second send.
  - `chooseAccountsPrep(dealId, choice: "sterling" | "accountant"): Promise<AgenticDealFile>`
  - `sendEngagementLetterIfNeeded(deal): Promise<AgenticDealFile>` — sets `engagement.status = "sent"`, `version: ENGAGEMENT_LETTER_VERSION`, `sentAt`, emails `engagement_sign`
  - `keepChasingPack` uses `clientChaseGaps(deal)` not `namedPackGaps(deal)`
  - `onPackArrived` / `runProcessing` call `sendAccountsPrepIfNeeded` when SFP is PARTIAL and prep items missing, **before** a generic chase
  - `complete`: if unsigned, call `sendEngagementLetterIfNeeded` and throw/return waiting_human rather than opening the handoff. Prefer throw `Engagement Letter not signed` after sending, so Shaun sees the gap. Also send the letter when `chooseAccountsPrep` is `"sterling"`.

- [ ] **Step 1: Write the failing test**

Keep this service test injectable: extract the “should send prep” predicate to shared if easier.

```ts
import { describe, expect, it } from "vitest";
import { missingPrepItems, resolveAccountsPrep } from "@shared/accountsPrep";

it("only proposes one ask when already asked", () => {
  const docs = [{ category: "bank-statements" as const }];
  const first = resolveAccountsPrep({ documents: docs });
  expect(first.missing.length).toBeGreaterThan(0);
  const second = resolveAccountsPrep({
    documents: docs,
    existing: { status: "asked", askedAt: "2026-09-07T00:00:00.000Z", missing: first.missing },
  });
  expect(second.status).toBe("asked");
  expect(second.askedAt).toBe("2026-09-07T00:00:00.000Z");
});
```

Add source assertions in `server/__tests__/services/accountsPrepWorkflow.test.ts`:

```ts
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const src = readFileSync(path.resolve("server/services/agenticWorkflow.ts"), "utf8");

it("sends accounts_prep once and uses clientChaseGaps on the sterling path", () => {
  expect(src).toMatch(/accounts_prep/);
  expect(src).toMatch(/engagement_sign/);
  expect(src).toMatch(/clientChaseGaps/);
  expect(src).toMatch(/sendAccountsPrepIfNeeded|askedAt/);
});
```

DealFilesPanel: replace `namedPackGaps(deal)` with `clientChaseGaps({ ...deal, accountsPrep: deal.accountsPrep })`. Source assertion optional.

If you add POST `/api/agentic/deals/:id/accounts-prep` `{ choice: "sterling" | "accountant" }` and POST `/api/agentic/deals/:id/engagement-send`, test the router with the existing agentic test harness if there is one; otherwise source-assert the route file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/accountsPrepWorkflow.test.ts`

Expected: FAIL — source does not contain `accounts_prep`.

- [ ] **Step 3: Write minimal implementation**

Implement the methods on the existing `agenticWorkflow` object. Reuse `sendEmail` + mailbox `inbound-enquiries` (James) for both new touches. Persist events.

`keepChasingPack`: `const gaps = clientChaseGaps({ documents: deal.packDocuments, fundingReason: deal.fundingReason, companyNumber: deal.companyNumber, accountsPrep: deal.accountsPrep });` If `accountsPrep.status === "sterling"` and letter unsigned, call `sendEngagementLetterIfNeeded` instead of the pack chase.

`chooseAccountsPrep`: set `decidedAt`, status. If sterling, `sendEngagementLetterIfNeeded`.

Do not SMTP-send as a new SAL-1 path; these are the same `sendEmail` the fulfilment manager already uses for chase (live factory). That matches existing chase behaviour, not the inbound-drafts-only rule.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/services/accountsPrepWorkflow.test.ts server/__tests__/shared/accountsPrep.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add server/services/agenticWorkflow.ts server/routes/agenticWorkflow.ts client/src/components/agentic/DealFilesPanel.tsx server/__tests__/services/accountsPrepWorkflow.test.ts
git commit -m "feat: ask accounts-prep once and hold Sterling production for a signature"
```

---

### Task 8: Public sign API

**Files:**
- Create: `server/services/signEngagement.ts`
- Create: `server/routes/signEngagement.ts`
- Create: `server/__tests__/services/signEngagement.test.ts`
- Modify: `server/routes.ts` — `import signEngagementRouter from "./routes/signEngagement";` then `app.use(signEngagementRouter);` next to `packUploadRouter`

**Interfaces:**
- Consumes: `storage.getAgenticDealByUploadToken`, `parseSignPayload`, `applyEngagementSignature`, `isLiveEngagement`, `ENGAGEMENT_LETTER_VERSION`, `engagementLetterText`, `voidStaleEngagement`
- Produces:
  - `getPublicSign(token: string): Promise<PublicSignState | null>`
  - `submitPublicSign(token: string, body: { name?: unknown; accepted?: unknown }, ip?: string): Promise<{ status: number; body: object }>`
  - `PublicSignState = { companyName: string; contactFirstName: string; version: string; letter: string; signed: boolean; signedName?: string }`

GET `/api/sign/:token` — CORS like pack (`Access-Control-Allow-Origin: *`). 404 `{ error: "This signing link is not valid." }` if no deal. If stored engagement is signed on a stale version, treat as void and show the live letter with `signed: false`.

POST `/api/sign/:token` JSON `{ name, accepted }`. 400 if parse fails. 409 `{ error: "Please sign the current Engagement Letter." }` if previously signed on another version (after voiding). 200 idempotent if already live-signed. On success persist engagement via `storage.updateAgenticDeal` and return the public state.

- [ ] **Step 1: Write the failing tests**

Follow `packUpload.flow.test.ts`: create a deal with `storage.createAgenticDeal`, use `uploadToken`.

```ts
import { afterAll, describe, expect, it } from "vitest";
import { storage } from "../../storage";
import { getPublicSign, submitPublicSign } from "../../services/signEngagement";
import { ENGAGEMENT_LETTER_VERSION } from "@shared/engagementLetter";

describe("public engagement sign", () => {
  let token = "";

  it("loads the placeholder letter and records a signature", async () => {
    const deal = await storage.createAgenticDeal({
      source: "strata_inbound",
      stage: "human_review",
      status: "waiting_human",
      ownerUserId: "pack-upload-test",
      companyName: "Pack Upload Test Ltd",
      contactName: "Test Director",
    });
    token = deal.uploadToken || "";
    const page = await getPublicSign(token);
    expect(page?.companyName).toBe("Pack Upload Test Ltd");
    expect(page?.signed).toBe(false);
    expect(page?.letter).toMatch(/Sterling Commercial Finance/);
    expect(page?.version).toBe(ENGAGEMENT_LETTER_VERSION);

    const bad = await submitPublicSign(token, { name: "", accepted: true });
    expect(bad.status).toBe(400);

    const ok = await submitPublicSign(token, { name: "Test Director", accepted: true }, "127.0.0.1");
    expect(ok.status).toBe(200);
    expect((ok.body as any).signed).toBe(true);

    const again = await submitPublicSign(token, { name: "Someone Else", accepted: true });
    expect(again.status).toBe(200);
    expect((again.body as any).signedName).toBe("Test Director");
  });

  it("rejects a missing token", async () => {
    expect(await getPublicSign("does-not-exist")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/signEngagement.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`firstName` from `@shared/strataOutreach` for `contactFirstName`. Router mirrors `packUpload.ts` CORS + GET/POST. No auth.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/services/signEngagement.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add server/services/signEngagement.ts server/routes/signEngagement.ts server/routes.ts server/__tests__/services/signEngagement.test.ts
git commit -m "feat: add public tokenised engagement-letter signing"
```

---

### Task 9: Sign page

**Files:**
- Create: `client/src/pages/SignEngagement.tsx`
- Modify: `client/src/App.tsx` — lazy import, `<Route path="/sign/:token" component={SignEngagement} />` on both the public Switch and the external_broker Switch (same as pack). `isCustomerPack` becomes `location.startsWith("/pack/") || location.startsWith("/sign/")`.
- Create: `server/__tests__/routes/signEngagementUi.test.ts`

**Interfaces:**
- Consumes: GET/POST `/api/sign/:token` from Task 8
- Produces: public page with letter, name field, required tick “I have read and agree”, submit. Invalid token: pack-upload tone, `enquiries@stratafinance.co.uk`, no phone. Already signed: confirmation with signed name, no second form.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("sign page wiring", () => {
  it("is a public full-screen route with no office number", () => {
    const app = readFileSync(path.resolve("client/src/App.tsx"), "utf8");
    expect(app).toMatch(/path="\/sign\/:token"/);
    expect(app).toMatch(/startsWith\("\/sign\/"\)/);
    const page = readFileSync(path.resolve("client/src/pages/SignEngagement.tsx"), "utf8");
    expect(page).not.toMatch(/0115/);
    expect(page).toMatch(/enquiries@stratafinance\.co\.uk/);
    expect(page).toMatch(/I have read and agree/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/routes/signEngagementUi.test.ts`

Expected: FAIL — file missing / App has no `/sign/`.

- [ ] **Step 3: Write minimal implementation**

Copy structure from `PackUpload.tsx` (token from `useParams`, slate-950 page, fetch JSON). Form: `<input>` name, checkbox, button. POST `{ name, accepted: true }`. Do not submit if empty name or unticked (client-side, matching 400).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/routes/signEngagementUi.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add client/src/pages/SignEngagement.tsx client/src/App.tsx server/__tests__/routes/signEngagementUi.test.ts
git commit -m "feat: add customer engagement-letter sign page"
```

---

### Task 10: Learn handbook — new lesson and patches

**Files:**
- Modify: `shared/learn.ts` (`DIRECTORS_HANDBOOK_SLUGS`)
- Create: `scripts/learn_courses/10-how-strata-and-sterling-work.md`
- Modify: `scripts/learn_courses/01-if-the-business-is-in-trouble.md`
- Modify: `scripts/learn_courses/02-warehouse-brokers.md`
- Modify: `scripts/learn_courses/03-hidden-commissions.md`
- Modify: `scripts/learn_courses/08-help-that-is-actually-there.md`
- Existing: `server/__tests__/shared/learnCourses.test.ts` (will pick up the new file automatically)
- Modify: `server/__tests__/shared/learnQuiz.test.ts` only if slug order assertions need the new id — the order test uses a subset and can stay

**Interfaces:**
- Consumes: `parseLearnCourseMarkdown`, `reviewLearnCopy` (must pass; include “does not lend” / packager)
- Produces: slug `how-strata-and-sterling-work` inserted after `hidden-commissions`. New file has ≥5 quizzes (corpus test), excerpt >40, body >1200, `topic: directors-handbook`.

- [ ] **Step 1: Write the failing test**

Add to `server/__tests__/shared/learnCourses.test.ts` (or a short extra it in that file):

```ts
it("inserts how-strata-and-sterling-work after hidden-commissions", () => {
  const i = DIRECTORS_HANDBOOK_SLUGS.indexOf("hidden-commissions");
  expect(DIRECTORS_HANDBOOK_SLUGS[i + 1]).toBe("how-strata-and-sterling-work");
});
```

The existing “one live article per handbook slug” test will fail until the markdown exists.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/learnCourses.test.ts`

Expected: FAIL — slug missing / course list mismatch.

- [ ] **Step 3: Write minimal implementation**

Update `DIRECTORS_HANDBOOK_SLUGS` to:

```ts
export const DIRECTORS_HANDBOOK_SLUGS = [
  "if-the-business-is-in-trouble",
  "warehouse-brokers",
  "hidden-commissions",
  "how-strata-and-sterling-work",
  "hmrc-time-to-pay",
  "terms-that-should-stop-the-pen",
  "products-that-finish-companies",
  "directors-in-the-danger-zone",
  "help-that-is-actually-there",
  "stacked-debt",
] as const;
```

Create `scripts/learn_courses/10-how-strata-and-sterling-work.md` with this body (keep the quizzes; do not invent rates):

```md
---
slug: how-strata-and-sterling-work
title: How Strata and Sterling work
excerpt: Strata's packaging is free. Sterling taking the case forward needs signed terms. Missing forecasts can be prepared by Sterling or by your accountant.
durationLabel: 8 min
topic: directors-handbook
---

Strata packages files. We do not lend. That is the whole of Strata's job: build one file, properly, and put it in front of a partner who can take it to lenders. Strata's packaging is free.

Sterling Commercial Finance takes the case forward. That is not free, and it does not start on a handshake. Before the pack is sent to Sterling, the company e-signs an Engagement Letter. The letter sets out Sterling's terms. Optional production of a cashflow forecast or management accounts is a Sterling charge, quoted on request against the amount of funding sought, and invoiced under that letter. Nothing starts with Sterling until the letter is signed.

This is the opposite of a warehouse. A warehouse wants a commitment fee on a card before anyone has seen management accounts. Strata does not charge to look. Sterling does not invent a number on a call. If the pounds are not in writing yet, they are not due yet.

## What is free, and what is not

Free: the enquiry, the assessment, collecting the pack, building the file. That is Strata.

Not free: Sterling taking the case to lenders, and Sterling preparing a cashflow forecast or management accounts if you ask them to. Those sit in the Engagement Letter. A quotation is given on request. This lesson will not quote a fee in pounds because the pounds are not on this page. They belong in the letter.

## If forecasts or accounts are missing

After the core information is in, if a cashflow forecast, management accounts, or a business plan is still missing, you will be asked a straight question.

Sterling can prepare a cashflow forecast and/or management accounts. That is chargeable, quoted on request, invoiced under the Engagement Letter, and does not start until that letter is signed.

Or your own accountant can produce them, and you send them in.

Strata does not write the business plan. If that is missing, it stays with the company or the accountant.

Filed accounts on the file do not skip the management-accounts question when the latest management accounts are still missing.

## The Engagement Letter

Every file that goes to Sterling needs the letter signed, not only the files that asked Sterling to prepare papers. You type your name. You tick that you have read it. The pack does not leave without that.

If the letter's wording later changes, a previous signature does not carry. You would be asked to sign the live version.

Strata packages. We do not lend. We will not pretend that "free to look" means "free all the way through".

:::quiz
Q: Is Strata's packaging free?
A: No. There is a commitment fee before anyone reads the file.
B: Yes. Strata's packaging is free. Sterling taking the case forward requires signed terms. *
C: Yes, including Sterling's lender work.
D: Only if the lender pays a commission.
Explain: Strata packages and does not lend. Packaging is free. Sterling's work needs an Engagement Letter.
:::

:::quiz
Q: Cashflow forecasts are missing. Who can prepare them?
A: Only the company's accountant.
B: Strata writes them at no charge.
C: Sterling can prepare them (quoted, invoiced under the Engagement Letter) or the company's accountant can. *
D: Skip them. The pack can go to a lender without a forecast.
Explain: Production is optional and chargeable. The accountant path is equally valid. Business plans are not a Sterling product.
:::

:::quiz
Q: When does the pack go to Sterling?
A: As soon as the first email arrives.
B: After a card payment.
C: After the customer e-signs the Engagement Letter and the required papers are on the file. *
D: After a verbal "go ahead" on a call.
Explain: Signed terms first. That is the point of the letter.
:::

:::quiz
Q: A warehouse broker wants a commitment fee on a card before they have seen management accounts. Is that how Strata works?
A: Yes. Everyone does.
B: No. Strata does not charge to look. Sterling's terms come later, in writing, signed. *
C: Yes, but it is refundable.
D: Only on HMRC petition files.
Explain: The warehouse tell is a fee before the file. That is not this house.
:::

:::quiz
Q: This lesson quotes the exact Sterling fee in pounds. True or false?
A: True.
B: False. A quotation is given on request. The pounds belong in the Engagement Letter. *
C: True, it is always 1%.
D: True, it is deducted from the advance so it is free.
Explain: No invented pounds. No 1%. Quoted on request, in writing.
:::
```

Patch `01-if-the-business-is-in-trouble.md`: change “Nine lessons” to “Ten lessons”. After the hidden-commissions bullet add:

```
- [How Strata and Sterling work](/read/how-strata-and-sterling-work) — packaging is free; Sterling needs signed terms; missing forecasts are Sterling or your accountant.
```

Close of that lesson already says Strata is a packager; add one sentence: `Strata's packaging is free. Sterling taking the case forward requires signed terms.`

Patch `02-warehouse-brokers.md` after “A packager who is doing the job does not need to sell your mobile number to eat.”:

```
A packager who is doing the job does not take a commitment fee to look. Strata's packaging is free. Sterling's terms come later, in writing, signed. [How Strata and Sterling work](/read/how-strata-and-sterling-work).
```

Patch `03-hidden-commissions.md` after the “every fee in pounds” list, one paragraph:

```
A fee that is in writing, in pounds, and signed before you are bound is not a secret commission. That is the opposite of *Wood*. Sterling's Engagement Letter is that door. Until the pounds are on it, they are not due. Strata's packaging stays free.
```

Patch `08-help-that-is-actually-there.md` “Where Strata sits”:

```
After the free advice, after the IP conversation if you need it, after HMRC is a fact rather than a rumour: if there is still a refinance that can last, a packager builds the file. Strata packages. We do not lend. Strata's packaging is free. Sterling taking the case forward requires signed terms. Optional cashflow or management-accounts production is a Sterling charge, quoted on request, invoiced under the Engagement Letter. The 60-second assessment is the public door. It is not a substitute for Business Debtline or a licensed IP, and it will not take a personal guarantee off a house at 17:00 on a Friday.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/learnCourses.test.ts server/__tests__/shared/learnQuiz.test.ts`

Expected: PASS. If `reviewLearnCopy` or editorial review fails, fix the lesson (packager identity, no banned words, no em dashes if the editorial linter forbids them — the corpus uses ASCII `--` or commas; the new lesson above uses ASCII apostrophes and no em dashes).

- [ ] **Step 5: Commit**

```
git add shared/learn.ts scripts/learn_courses/10-how-strata-and-sterling-work.md scripts/learn_courses/01-if-the-business-is-in-trouble.md scripts/learn_courses/02-warehouse-brokers.md scripts/learn_courses/03-hidden-commissions.md scripts/learn_courses/08-help-that-is-actually-there.md server/__tests__/shared/learnCourses.test.ts
git commit -m "feat(learn): teach free packaging vs signed Sterling terms"
```

Do not run `scripts/ingest_learn_courses.ts --force` in CI. After merge, on the live box: `npx tsx scripts/ingest_learn_courses.ts --force`. Until that runs, the public host still serves old snapshots.

---

### Task 11: Librarian, Learn chrome, agent docs

**Files:**
- Modify: `shared/learnLibrarian.ts` (`LEARN_LIBRARIAN_SYSTEM`, `LEARN_DESK_PROMPTS`)
- Modify: `server/__tests__/shared/learnLibrarian.test.ts`
- Modify: `client/src/pages/learn/LearnHome.tsx` (`PackagerLine`, `HOME_DESCRIPTION`)
- Create: `server/__tests__/routes/learnHomeCopy.test.ts`
- Modify: `docs/agentic-org/strata-inbound/answer-bank.md`
- Modify: `docs/agentic-org/strata-inbound/intake.md`
- Modify: `docs/agentic-org/agents/SAL-1.md`
- Modify: `docs/agentic-org/corporate_structure.md`
- Modify: `docs/agentic-org/CLAUDE.md`
- Modify: `docs/agentic-org/launch_readiness.md`

**Interfaces:**
- Consumes: `HOUSE_COST_LINE` (optional import in librarian prompt string)
- Produces: librarian will not quote pounds; “what will I pay” remains handoff; desk prompt `{ question: "Is Strata's packaging free?", slug: "how-strata-and-sterling-work" }`. `PackagerLine` two facts, short, no pounds.

- [ ] **Step 1: Write the failing tests**

In `learnLibrarian.test.ts` desk prompts loop already requires `shouldHandoffQuestion(prompt.question) === false`. Add:

```ts
it("hands off what-will-I-pay and keeps the free-packaging desk prompt", () => {
  expect(shouldHandoffQuestion("what would I pay")).toBe(true);
  expect(LEARN_DESK_PROMPTS.some((row) => row.slug === "how-strata-and-sterling-work")).toBe(true);
  expect(LEARN_LIBRARIAN_SYSTEM).toMatch(/packaging is free/i);
  expect(LEARN_LIBRARIAN_SYSTEM).toMatch(/Engagement Letter/i);
});
```

`QUESTION_HANDOFF` already includes `what would i pay`. Confirm the new desk prompt does not match that regex.

`server/__tests__/routes/learnHomeCopy.test.ts`:

```ts
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

it("states free packaging and signed Sterling terms on Learn home", () => {
  const src = readFileSync(path.resolve("client/src/pages/learn/LearnHome.tsx"), "utf8");
  expect(src).toMatch(/does not lend/i);
  expect(src).toMatch(/free/i);
  expect(src).toMatch(/signed terms/i);
  expect(src).not.toMatch(/0115/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/shared/learnLibrarian.test.ts server/__tests__/routes/learnHomeCopy.test.ts`

Expected: FAIL — prompt/slug/copy missing.

- [ ] **Step 3: Write minimal implementation**

Append to `LEARN_LIBRARIAN_SYSTEM`: `Strata packaging is free. Sterling requires a signed Engagement Letter. Do not quote fees in pounds. Production of forecasts or management accounts is Sterling, quoted on request.`

Add the desk prompt as the last entry.

`PackagerLine`:

```tsx
<p className={`font-['Plus_Jakarta_Sans'] text-sm text-zinc-400 ${className}`}>
  <span className="chrome-text font-['Unbounded']">Strata</span> packages; it does not lend. Packaging is free. Sterling requires signed terms.
</p>
```

Answer bank **What does it cost?** — keep `[SHAUN TO CONFIRM]` for pounds, replace the “until confirmed” sentence with the house line (James may now say it).

Intake.md: add stages 4 and 5 from the spec table after stage 3.

SAL-1.md responsibilities: “accounts-prep drafts and the e-sign send”. Still no SMTP.

`corporate_structure.md` executive summary: complete Sterling file also requires a signed Engagement Letter on the live version.

`CLAUDE.md` Never list: “Send or mark complete a Sterling pack with required items missing, SFP PARTIAL, or the Engagement Letter unsigned.”

`launch_readiness.md` pack collection bullet: note the accounts-prep fork and engagement gate (no longer “three things then jump” as the honest end-state).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/learnLibrarian.test.ts server/__tests__/routes/learnHomeCopy.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add shared/learnLibrarian.ts client/src/pages/learn/LearnHome.tsx server/__tests__/shared/learnLibrarian.test.ts server/__tests__/routes/learnHomeCopy.test.ts docs/agentic-org
git commit -m "docs: align Learn, librarian, and James with free packaging vs Sterling terms"
```

---

## Self-review (spec coverage)

| Spec requirement | Task |
|---|---|
| No 0115 on agent email; env drop-in | 1 |
| Pack-upload loses 0115 | 1 |
| Call voicemail no default 0115 | 1 |
| `accountsPrep` / `engagement` on the deal | 2 |
| `clientChaseGaps` omits CF/MA on sterling path; zip still needs cashflow | 2 |
| Factory nodes + edges + `nodeForDeal` | 3 |
| Placeholder letter, version, parse, live signature | 4 |
| Zip + complete gate | 5 |
| Accounts-prep / engagement-sign emails + house line | 6 |
| One send, classify/choose, hold production for signature | 7 |
| GET/POST `/api/sign/:token` | 8 |
| `/sign/:token` page | 9 |
| Handbook slug + new lesson + patches | 10 |
| Librarian, PackagerLine, answer bank, intake, CLAUDE | 11 |
| Introducer stream unchanged | 3 |
| No DocuSign, no fee table, no business-plan product | non-goals, unblocked |
| Live Learn snapshots | Task 10 notes ingest on the live box; not claimed in CI |

No `TBD` / `implement later` steps. Types `accountsPrep`, `engagement`, `ENGAGEMENT_LETTER_VERSION`, `isLiveEngagement`, `assertSterlingEngagement`, `clientChaseGaps` are used under the same names in later tasks.
