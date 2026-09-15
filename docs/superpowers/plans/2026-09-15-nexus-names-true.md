# Nexus names-true Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Nexus names true in the identity module, governing docs, and operator-facing copy: Veltro Ltd owns Nexus; contracted to Sterling Commercial Finance Ltd, trading as Strata Finance.

**Architecture:** One shared identity module is the lock. Tests read that module and the governing docs. Docs and `PACKAGING_FRAMEWORK.operator` consume the module (or match it verbatim). Do not rename HTTP headers (`X-FlowLoan-Api-Key` stays). Do not delete borrower-facing Strata chrome. Do not delete Workforce/Learn/Craft.

**Tech Stack:** TypeScript, Vitest. No new npm packages. No schema changes.

**Spec:** `docs/superpowers/specs/2026-09-15-nexus-best-definition-design.md`

## Global Constraints

- Company: `Veltro Ltd`
- OS: `Nexus`
- Client legal: `Sterling Commercial Finance Ltd`
- Client trading: `Strata Finance`
- Contract: Veltro Ltd ↔ Sterling Commercial Finance Ltd
- Retire `Sterling Capital Reserve` from governing docs and operator-facing copy
- Retire `You work for **Strata Finance**` (agents work for Veltro Ltd, on Nexus)
- Engagement footer `Sterling Commercial Finance Limited trading as Strata Finance` stays
- Do not delete Learn, Editorial, Craft, Workforce, ARES, Veltro landing, Openers, or Agent Mail
- Do not change `X-FlowLoan-Api-Key` (protocol, not chrome)
- No live SMTP or Companies House in CI
- Windows PowerShell: `git commit -m "message"` (no bash heredocs)

This plan is **slice 1 only** of the spec order of work. Later slices (Direct Outreach land, one rail, completeness-as-send-stop, ingest-from-pack, live file) get their own plans. Completeness already throws in `buildSterlingPackZip` when `evaluateSterlingCompleteness` fails — do not re-implement it here.

## File map

- Create: `shared/identity.ts` — locked legal names
- Create: `server/__tests__/shared/identity.test.ts` — constants + governing-doc guards
- Modify: `shared/salesOs.ts` — `PACKAGING_FRAMEWORK.operator` from identity
- Modify: `docs/agentic-org/CLAUDE.md` — agents work for Veltro Ltd on Nexus
- Modify: `docs/agentic-org/corporate_structure.md` — contract parties
- Modify: `README.md` — Nexus is the OS; Veltro Ltd is the company
- Modify: `docs/ARCHITECTURE.md` — product name Nexus (not FlowLoan) in the title/intro
- Modify: `docs/RELEASE.md`, `docs/ENV.md`, `docs/SECURITY.md`, `docs/RUNBOOK.md` — FlowLoan → Nexus in titles/intros only
- Modify: `server/utils/reportPdf.ts` — regulated-entity line
- Modify: `server/routes/submissions.ts` — comment
- Modify: `server/Lead Agent/src/strategyAgent.ts` — packaging operator in the prompt
- Do not modify: `client/src/pages/SignEngagement.tsx` footer (already correct)
- Do not modify: API header `X-FlowLoan-Api-Key`

---

### Task 1: Identity lock + failing tests

**Files:**
- Create: `shared/identity.ts`
- Create: `server/__tests__/shared/identity.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `COMPANY_LEGAL_NAME = "Veltro Ltd"`
  - `OS_NAME = "Nexus"`
  - `CLIENT_LEGAL_NAME = "Sterling Commercial Finance Ltd"`
  - `CLIENT_TRADING_NAME = "Strata Finance"`
  - `PACKAGING_OPERATOR = "Sterling Commercial Finance Ltd"`
  - `DIRECTOR_NAME = "Shaun"`
  - `STERLING_RECEIVER_NAME = "David"`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/shared/identity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  CLIENT_LEGAL_NAME,
  CLIENT_TRADING_NAME,
  COMPANY_LEGAL_NAME,
  DIRECTOR_NAME,
  OS_NAME,
  PACKAGING_OPERATOR,
  STERLING_RECEIVER_NAME,
} from "@shared/identity";
import { PACKAGING_FRAMEWORK } from "@shared/salesOs";

const root = process.cwd();
function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("identity lock", () => {
  it("names the company, OS, client legal, and trading name", () => {
    expect(COMPANY_LEGAL_NAME).toBe("Veltro Ltd");
    expect(OS_NAME).toBe("Nexus");
    expect(CLIENT_LEGAL_NAME).toBe("Sterling Commercial Finance Ltd");
    expect(CLIENT_TRADING_NAME).toBe("Strata Finance");
    expect(PACKAGING_OPERATOR).toBe("Sterling Commercial Finance Ltd");
    expect(DIRECTOR_NAME).toBe("Shaun");
    expect(STERLING_RECEIVER_NAME).toBe("David");
  });

  it("Sales OS packaging operator is Sterling Commercial Finance Ltd", () => {
    expect(PACKAGING_FRAMEWORK.operator).toBe("Sterling Commercial Finance Ltd");
  });

  it("CLAUDE.md says agents work for Veltro Ltd on Nexus, not for Strata as the company", () => {
    const text = read("docs/agentic-org/CLAUDE.md");
    expect(text).toMatch(/You work for \*\*Veltro Ltd\*\*/);
    expect(text).toMatch(/\*\*Nexus\*\*/);
    expect(text).toMatch(/Sterling Commercial Finance Ltd/);
    expect(text).toMatch(/Strata Finance/);
    expect(text).not.toMatch(/You work for \*\*Strata Finance\*\*/);
    expect(text).not.toMatch(/Sterling Capital Reserve/);
  });

  it("corporate_structure.md names the Veltro–Sterling contract, not Sterling Capital Reserve", () => {
    const text = read("docs/agentic-org/corporate_structure.md");
    expect(text).toMatch(/Veltro Ltd/);
    expect(text).toMatch(/Sterling Commercial Finance Ltd/);
    expect(text).toMatch(/trades as Strata Finance|trading as Strata Finance/);
    expect(text).not.toMatch(/Sterling Capital Reserve/);
  });

  it("README presents Nexus as the OS and Veltro Ltd as the company", () => {
    const text = read("README.md");
    expect(text).toMatch(/^# Nexus/m);
    expect(text).toMatch(/Veltro Ltd/);
    expect(text).toMatch(/operating system/i);
    expect(text).not.toMatch(/Sterling Capital Reserve/);
  });
});

describe("retired names in operator copy", () => {
  const files = [
    "docs/agentic-org/corporate_structure.md",
    "docs/agentic-org/CLAUDE.md",
    "README.md",
    "shared/salesOs.ts",
    "server/utils/reportPdf.ts",
    "server/routes/submissions.ts",
    "server/Lead Agent/src/strategyAgent.ts",
  ];

  it("does not say Sterling Capital Reserve", () => {
    for (const rel of files) {
      expect(read(rel), rel).not.toMatch(/Sterling Capital Reserve/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/identity.test.ts`
Expected: FAIL (module `@shared/identity` not found, and/or docs still say Strata as employer / Sterling Capital Reserve)

- [ ] **Step 3: Write minimal identity module**

Create `shared/identity.ts`:

```ts
export const COMPANY_LEGAL_NAME = "Veltro Ltd";
export const OS_NAME = "Nexus";
export const CLIENT_LEGAL_NAME = "Sterling Commercial Finance Ltd";
export const CLIENT_TRADING_NAME = "Strata Finance";
export const PACKAGING_OPERATOR = "Sterling Commercial Finance Ltd";
export const DIRECTOR_NAME = "Shaun";
export const STERLING_RECEIVER_NAME = "David";
```

- [ ] **Step 4: Point Sales OS operator at the lock**

In `shared/salesOs.ts`, add:

```ts
import { PACKAGING_OPERATOR } from "./identity";
```

Change `PACKAGING_FRAMEWORK.operator` from `"Sterling Capital Reserve Limited"` to `PACKAGING_OPERATOR`.

Keep the file header. Change “Strata Finance lead identification” to “Nexus Sales Agent Operating System for the Veltro–Sterling contract (borrowers see Strata Finance).”

- [ ] **Step 5: Run tests — still fail on docs**

Run: `npx vitest run server/__tests__/shared/identity.test.ts`
Expected: identity constants and salesOs pass; CLAUDE.md / corporate_structure / README / reportPdf / strategyAgent / submissions still fail.

- [ ] **Step 6: Commit kernel**

```
git add shared/identity.ts shared/salesOs.ts server/__tests__/shared/identity.test.ts
git commit -m "feat: lock Veltro / Nexus / Sterling Commercial Finance identity"
```

---

### Task 2: Governing docs

**Files:**
- Modify: `docs/agentic-org/CLAUDE.md`
- Modify: `docs/agentic-org/corporate_structure.md`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md` (title/intro only)
- Modify: `docs/RELEASE.md`, `docs/ENV.md`, `docs/SECURITY.md`, `docs/RUNBOOK.md` (FlowLoan → Nexus in the opening sentence)

**Interfaces:**
- Consumes: identity table from the spec / `shared/identity.ts`
- Produces: docs that pass Task 1 tests

- [ ] **Step 1: Patch CLAUDE.md opening**

Replace the title and first paragraph with:

```md
# Veltro / Nexus — agent runtime context

You work for **Veltro Ltd**, on **Nexus**, fulfilling the contract with **Sterling Commercial Finance Ltd** (trading as **Strata Finance**). You originate Stream A SME distress-refinance and Stream B introducer files, collect a complete pack, and compile a Sterling-ready file. You do not lend. You do not make the credit decision.
```

Leave the rest of the Never / Escalate lists. Keep “David at Sterling”. Do not impersonate. Borrower-facing Strata (enquiries@, stratafinance.co.uk) stays wherever it already is.

- [ ] **Step 2: Patch corporate_structure.md header and executive summary**

Frontmatter `business:` → `Veltro Ltd (Nexus OS) · contract with Sterling Commercial Finance Ltd t/a Strata Finance`

Title → `Corporate Structure Directive — Veltro / Nexus origination`

Executive summary first paragraph →:

```md
Veltro Ltd owns Nexus and is contracted to Sterling Commercial Finance Ltd, which trades as Strata Finance. Nexus originates Stream A SME distress-refinance and Stream B introducer files (£25k–£250k, turnover £250k–£5m), collects a complete pack, and compiles a Sterling-ready file. Shaun is the sole human director above the loop. AI agents run origination, outreach, pack collection, ingest, numbering, and compilation. The only end product that counts is a **complete Sterling file** — funding proposal plus supporting documents with nothing required still missing — ready for Shaun to send to David at Sterling Commercial Finance Ltd.
```

Search the rest of the file for `Sterling Capital Reserve` and replace with `Sterling Commercial Finance Ltd`. Do not replace borrower-facing “Strata” (site, mailbox, packager brand). Agents remain Veltro staff on Nexus, not “Strata staff.”

- [ ] **Step 3: Patch README identity**

Replace the H1 and Overview (keep Key Features; do not delete Ares/Workforce sections):

```md
# Nexus

**Veltro Ltd’s operating system.** Run for Sterling Commercial Finance Ltd, trading as Strata Finance.

## Overview

Nexus is the operating system Veltro Ltd uses to fulfil its contract with Sterling Commercial Finance Ltd (trading as Strata Finance). It originates UK SME files, runs legal outreach, collects a pack, and compiles a complete Sterling zip. Borrowers see Strata. The file is a Sterling file. Shaun sends.
```

- [ ] **Step 4: Patch remaining FlowLoan titles**

In `docs/ARCHITECTURE.md`, `docs/RELEASE.md`, `docs/ENV.md`, `docs/SECURITY.md`, `docs/RUNBOOK.md`: replace the product name `FlowLoan` with `Nexus` in the opening sentence / title. Do not rename `X-FlowLoan-Api-Key`. Do not rewrite the Postgres diagram in this task beyond one sentence: storage is local SQLite; see README.

- [ ] **Step 5: Run identity tests**

Run: `npx vitest run server/__tests__/shared/identity.test.ts`
Expected: CLAUDE / corporate_structure / README / salesOs pass. reportPdf / submissions / strategyAgent may still fail.

- [ ] **Step 6: Commit docs**

```
git add docs/agentic-org/CLAUDE.md docs/agentic-org/corporate_structure.md README.md docs/ARCHITECTURE.md docs/RELEASE.md docs/ENV.md docs/SECURITY.md docs/RUNBOOK.md
git commit -m "docs: names true — Veltro Ltd / Nexus / Sterling Commercial Finance"
```

---

### Task 3: Remaining operator copy

**Files:**
- Modify: `server/utils/reportPdf.ts`
- Modify: `server/routes/submissions.ts`
- Modify: `server/Lead Agent/src/strategyAgent.ts`

**Interfaces:**
- Consumes: `PACKAGING_OPERATOR` / identity strings
- Produces: no `Sterling Capital Reserve` in the Task 1 file list

- [ ] **Step 1: reportPdf.ts**

Replace the regulated-entity sentence that names `Sterling Capital Reserve / Sterling Capital Finance` with:

```ts
"Any regulated activities or secondary requirements are held and processed under Sterling Commercial Finance Ltd (trading as Strata Finance).",
```

Do not invent a new FCA story. Do not remove David from other lines unless this is the only mention.

- [ ] **Step 2: submissions.ts comment**

```ts
// Send a submission to the external broker partner (Sterling Commercial Finance Ltd)
```

- [ ] **Step 3: strategyAgent.ts prompt line**

```
- Packaging is Passan-format 24-month CFF / balance sheet / CFADS-DSCR under Sterling Commercial Finance Ltd.
```

- [ ] **Step 4: Run identity tests**

Run: `npx vitest run server/__tests__/shared/identity.test.ts`
Expected: PASS (all describes)

- [ ] **Step 5: Run a sanity slice of existing tests that import salesOs**

Run: `npx vitest run server/__tests__/shared/smeConvert.test.ts server/__tests__/services/salesOs.test.ts`
If `salesOs.test.ts` does not exist, run `npx vitest run server/__tests__/shared/smeConvert.test.ts` only.
Expected: PASS

- [ ] **Step 6: Commit**

```
git add server/utils/reportPdf.ts server/routes/submissions.ts "server/Lead Agent/src/strategyAgent.ts"
git commit -m "fix: retire Sterling Capital Reserve from operator copy"
```

---

## Self-review

- Spec item 1 (names true) → Tasks 1–3
- Spec “do not delete” → no deletion tasks
- Spec later slices (Direct Outreach, one rail, ingest, live file) → explicitly out of this plan
- `X-FlowLoan-Api-Key` left intact
- Engagement footer not rewritten
- No placeholders
