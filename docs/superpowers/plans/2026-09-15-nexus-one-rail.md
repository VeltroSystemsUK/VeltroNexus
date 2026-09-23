# Nexus one-rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deal Files approve and the Sterling portal compile the same zip from the same file. A deal cannot be `complete` unless that zip has been compiled.

**Architecture:** Pure kernel in `shared/sterlingRail.ts` decides success. `compileSterlingRailPack` is the only zip compile used by `approve_sterling` and portal POST `/pack`. Approve seeds the handoff recommendation from `underwritingJudgement` and compiles with the handoff lender, or `ffe` as the file-pack lender when David has not picked yet. Portal send may rebuild for a different CDFI, then stamps the same compile proof and marks the matching deal complete.

**Tech Stack:** TypeScript, Vitest, existing `buildSterlingPackZip`. No new npm packages. No new SQLite tables. No zip-on-disk store (recompile from the file).

**Spec:** `docs/superpowers/specs/2026-09-15-nexus-best-definition-design.md` (One rail)

## Global Constraints

- Company: Veltro Ltd. OS: Nexus. Client: Sterling Commercial Finance Ltd t/a Strata Finance
- The file is the product. Complete without a zip is a lie
- Completeness gate already blocks `buildSterlingPackZip` — do not weaken it
- Shaun does not email Sterling; he approves. The zip is the artefact
- Do not delete Workforce, Learn, Craft, Veltro landing
- Do not start Learn/Editorial/Craft-week work
- Default file-pack lender when Shaun approves with no pick: `ffe` (`STERLING_LENDERS[0].id`)
- No live SMTP or Companies House in CI
- Windows PowerShell: `git commit -m "message"` (no bash heredocs)
- Do not commit unrelated Direct Outreach / Craft WIP sitting dirty on this branch

This plan is **slice 3 only** (one rail). Names-true is done. Completeness-as-send-stop already throws in `buildSterlingPackZip`. Ingest-from-pack and live-file are later.

## File map

- Create: `shared/sterlingRail.ts`
- Create: `server/__tests__/shared/sterlingRail.test.ts`
- Modify: `shared/agenticWorkflow.ts` — `sterlingPackCompiledAt?: string`
- Modify: `shared/factoryGraph.ts` — `david` node requires compiled zip, not merely a handoff id
- Modify: `server/__tests__/shared/factoryGraph.test.ts`
- Modify: `server/services/sterlingPack.ts` — `compileSterlingRailPack`
- Modify: `server/__tests__/services/sterlingPack.test.ts`
- Modify: `server/services/sterlingHandoff.ts` — `markDealCompleteFromSterlingPack`
- Modify: `server/__tests__/services/sterlingHandoff.test.ts`
- Modify: `server/sqliteStorage.ts`, `server/storage.ts` — `getAgenticDealByProspectId`
- Modify: `server/services/agenticWorkflow.ts` — `approve_sterling` compiles then completes
- Create: `server/__tests__/services/sterlingRailApprove.test.ts`
- Modify: `server/routes/brokerPortal.ts` — POST `/pack` uses `compileSterlingRailPack` then marks the deal complete
- Do not modify: frozen desks, Craft WIP, identity module

---

### Task 1: Rail kernel

**Files:**
- Create: `shared/sterlingRail.ts`
- Create: `server/__tests__/shared/sterlingRail.test.ts`
- Modify: `shared/agenticWorkflow.ts`
- Modify: `shared/factoryGraph.ts`
- Modify: `server/__tests__/shared/factoryGraph.test.ts`

**Interfaces:**
- Consumes: `STERLING_LENDERS` / `isSterlingLenderId` from `shared/sterlingPortal.ts`
- Produces:
  - `FILE_PACK_LENDER_ID` — `STERLING_LENDERS[0].id` (`"ffe"`)
  - `hasSterlingZip(input: { packGeneratedAt?: string | null; sterlingPackCompiledAt?: string | null }): boolean`
  - `sterlingRailSucceeded(deal: { stage?: string; packGeneratedAt?: string | null; sterlingPackCompiledAt?: string | null }): boolean` — `stage === "complete"` AND `hasSterlingZip(deal)`
  - `recommendationForPack(opts: { handoffRecommendation?: string | null; underwritingJudgement?: string | null }): string` — trim handoff first, else judgement, else `""`
  - `lenderForPack(opts: { requestedLenderId?: string | null; approvedLenderId?: string | null }): string` — requested if valid, else approved if valid, else `FILE_PACK_LENDER_ID`
  - `AgenticDealFile.sterlingPackCompiledAt?: string`

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/shared/sterlingRail.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  FILE_PACK_LENDER_ID,
  hasSterlingZip,
  lenderForPack,
  recommendationForPack,
  sterlingRailSucceeded,
} from "@shared/sterlingRail";

describe("sterling rail", () => {
  it("treats a handoff without packGeneratedAt as no zip", () => {
    expect(hasSterlingZip({})).toBe(false);
    expect(hasSterlingZip({ packGeneratedAt: "2026-09-15T08:00:00.000Z" })).toBe(true);
    expect(hasSterlingZip({ sterlingPackCompiledAt: "2026-09-15T08:00:00.000Z" })).toBe(true);
  });

  it("does not count complete-without-zip as success", () => {
    expect(sterlingRailSucceeded({ stage: "complete" })).toBe(false);
    expect(sterlingRailSucceeded({ stage: "human_review", packGeneratedAt: "2026-09-15T08:00:00.000Z" })).toBe(false);
    expect(
      sterlingRailSucceeded({ stage: "complete", sterlingPackCompiledAt: "2026-09-15T08:00:00.000Z" }),
    ).toBe(true);
  });

  it("prefers the handoff recommendation, then the director judgement", () => {
    expect(recommendationForPack({ handoffRecommendation: "  Supportable.  ", underwritingJudgement: "memo" })).toBe(
      "Supportable.",
    );
    expect(recommendationForPack({ underwritingJudgement: "Recommendation only." })).toBe("Recommendation only.");
    expect(recommendationForPack({})).toBe("");
  });

  it("uses David's lender, else the file-pack lender ffe", () => {
    expect(FILE_PACK_LENDER_ID).toBe("ffe");
    expect(lenderForPack({ requestedLenderId: "cwrt" })).toBe("cwrt");
    expect(lenderForPack({ approvedLenderId: "bcrs" })).toBe("bcrs");
    expect(lenderForPack({})).toBe("ffe");
    expect(lenderForPack({ requestedLenderId: "not-a-lender" })).toBe("ffe");
  });
});
```

Add to `server/__tests__/shared/factoryGraph.test.ts` in the existing `nodeForDeal` example block (replace the current `sterlingHandoffId: 9` → `david` case):

```ts
expect(
  nodeForDeal({
    stage: "complete",
    status: "complete",
    source: "strata_inbound",
    sterlingHandoffId: 9,
  }),
).toBe("sterling");
expect(
  nodeForDeal({
    stage: "complete",
    status: "complete",
    source: "strata_inbound",
    sterlingHandoffId: 9,
    sterlingPackCompiledAt: "2026-09-15T08:00:00.000Z",
  }),
).toBe("david");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/shared/sterlingRail.test.ts server/__tests__/shared/factoryGraph.test.ts`
Expected: FAIL — `@shared/sterlingRail` missing; factoryGraph still maps handoff-only complete to `david`.

- [ ] **Step 3: Minimal kernel**

Create `shared/sterlingRail.ts`:

```ts
import { isSterlingLenderId, STERLING_LENDERS } from "./sterlingPortal";

export const FILE_PACK_LENDER_ID = STERLING_LENDERS[0].id;

export function hasSterlingZip(input: {
  packGeneratedAt?: string | null;
  sterlingPackCompiledAt?: string | null;
}): boolean {
  return Boolean(String(input.packGeneratedAt || input.sterlingPackCompiledAt || "").trim());
}

export function sterlingRailSucceeded(deal: {
  stage?: string;
  packGeneratedAt?: string | null;
  sterlingPackCompiledAt?: string | null;
}): boolean {
  return deal.stage === "complete" && hasSterlingZip(deal);
}

export function recommendationForPack(opts: {
  handoffRecommendation?: string | null;
  underwritingJudgement?: string | null;
}): string {
  const fromHandoff = String(opts.handoffRecommendation || "").trim();
  if (fromHandoff) return fromHandoff;
  return String(opts.underwritingJudgement || "").trim();
}

export function lenderForPack(opts: {
  requestedLenderId?: string | null;
  approvedLenderId?: string | null;
}): string {
  const requested = String(opts.requestedLenderId || "").trim();
  if (isSterlingLenderId(requested)) return requested;
  const approved = String(opts.approvedLenderId || "").trim();
  if (isSterlingLenderId(approved)) return approved;
  return FILE_PACK_LENDER_ID;
}
```

Add `sterlingPackCompiledAt?: string` to `AgenticDealFile` in `shared/agenticWorkflow.ts`.

In `shared/factoryGraph.ts`:
- Add `sterlingPackCompiledAt` to the `nodeForDeal` Pick
- Change the `complete` branch:

```ts
case "complete":
  if (hasSterlingZip(deal)) return "david";
  if (deal.sterlingHandoffId) return "sterling";
  if (!isLiveSigned(deal.engagement)) return "engagement";
  return "sterling";
```

Import `hasSterlingZip` from `./sterlingRail`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/__tests__/shared/sterlingRail.test.ts server/__tests__/shared/factoryGraph.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add shared/sterlingRail.ts server/__tests__/shared/sterlingRail.test.ts shared/agenticWorkflow.ts shared/factoryGraph.ts server/__tests__/shared/factoryGraph.test.ts
git commit -m "feat: Sterling rail succeeds only when the zip exists"
```

---

### Task 2: One compile function

**Files:**
- Modify: `server/services/sterlingPack.ts`
- Modify: `server/__tests__/services/sterlingPack.test.ts`
- Modify: `server/storage.ts`
- Modify: `server/sqliteStorage.ts`
- Modify: `server/services/sterlingHandoff.ts`
- Modify: `server/__tests__/services/sterlingHandoff.test.ts`

**Interfaces:**
- Consumes: `buildSterlingPackZip`, `recommendationForPack`, `lenderForPack`, `storage`
- Produces:
  - `compileSterlingRailPack(opts: { handoff: any; lenderId?: string; signedBy?: string; underwritingJudgement?: string }): Promise<{ buffer: Buffer; filename: string; compiledAt: string; lenderId: string }>`
    - `lenderId = lenderForPack({ requestedLenderId: opts.lenderId, approvedLenderId: opts.handoff.approvedLenderId })`
    - `recommendation = recommendationForPack({ handoffRecommendation: opts.handoff.recommendation, underwritingJudgement: opts.underwritingJudgement })`
    - if recommendation empty: throw `{ status: 400, message: "Write a recommendation before compiling the pack" }`
    - call `buildSterlingPackZip({ handoff: { ...opts.handoff, recommendation }, lenderId, signedBy: opts.signedBy })`
    - `compiledAt = new Date().toISOString()`
    - `storage.updateBrokerHandoff(handoff.id, { approvedLenderId: lenderId, packGeneratedAt: compiledAt, recommendation })` when `handoff.id` is a number
    - return `{ ...pack, compiledAt, lenderId }`
  - `markDealCompleteFromSterlingPack(opts: { prospectId: number; compiledAt: string; handoffId?: number }): Promise<void>`
    - load deal via `storage.getAgenticDealByProspectId(prospectId)`
    - if none, return
    - `storage.updateAgenticDeal(deal.id, { stage: "complete", status: "complete", sterlingHandoffId: opts.handoffId ?? deal.sterlingHandoffId, sterlingPackCompiledAt: opts.compiledAt, humanReason: undefined, events: addEvent(...) })`
  - `storage.getAgenticDealByProspectId(prospectId: number): Promise<AgenticDealFile | undefined>`

- [ ] **Step 1: Write failing tests**

Add to `server/__tests__/services/sterlingPack.test.ts` (reuse `seedStorage` + signed application from the existing “puts the filled Word application” test):

```ts
it("compileSterlingRailPack stamps packGeneratedAt on the handoff", async () => {
  seedStorage({
    status: "signed",
    signedAt: "2026-09-09T12:00:00Z",
    signedName: "Kirsty Bevan",
    answers: { legalName: "THE HOME CRAFTERS LTD.", loanAmount: "£120,000" },
    directors: [{ id: "d1", fullName: "Kirsty Bevan" }],
  });
  mocked.updateBrokerHandoff = vi.fn().mockResolvedValue({});
  const { compileSterlingRailPack } = await import("../../services/sterlingPack");
  const result = await compileSterlingRailPack({
    handoff: { id: 11, prospectId: 42, recommendation: "Supportable subject to statements." },
    lenderId: "cwrt",
    signedBy: "Shaun",
  });
  expect(result.lenderId).toBe("cwrt");
  expect(result.compiledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(result.buffer.length).toBeGreaterThan(0);
  expect(mocked.updateBrokerHandoff).toHaveBeenCalledWith(
    11,
    expect.objectContaining({
      approvedLenderId: "cwrt",
      packGeneratedAt: result.compiledAt,
      recommendation: "Supportable subject to statements.",
    }),
  );
});

it("compileSterlingRailPack refuses an empty recommendation", async () => {
  const { compileSterlingRailPack } = await import("../../services/sterlingPack");
  await expect(
    compileSterlingRailPack({ handoff: { id: 11, prospectId: 42, recommendation: "  " } }),
  ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/recommendation/i) });
});
```

The storage mock at the top of that file must include `updateBrokerHandoff: vi.fn()`. Add it to the `vi.mock("../../storage")` object and the `mocked` type.

Add to `server/__tests__/services/sterlingHandoff.test.ts`:

```ts
describe("markDealCompleteFromSterlingPack", () => {
  it("marks the matching deal complete with the compile stamp", async () => {
    mocked.getAgenticDealByProspectId = vi.fn();
    mocked.updateAgenticDeal = vi.fn();
    mocked.getAgenticDealByProspectId.mockResolvedValue({
      id: 88,
      stage: "human_review",
      status: "waiting_human",
      events: [],
    });
    mocked.updateAgenticDeal.mockResolvedValue({ id: 88, stage: "complete" });
    const { markDealCompleteFromSterlingPack } = await import("../../services/sterlingHandoff");
    await markDealCompleteFromSterlingPack({
      prospectId: 42,
      compiledAt: "2026-09-15T08:00:00.000Z",
      handoffId: 11,
    });
    expect(mocked.updateAgenticDeal).toHaveBeenCalledWith(
      88,
      expect.objectContaining({
        stage: "complete",
        status: "complete",
        sterlingHandoffId: 11,
        sterlingPackCompiledAt: "2026-09-15T08:00:00.000Z",
      }),
    );
  });

  it("no-ops when no deal is on that prospect", async () => {
    mocked.getAgenticDealByProspectId = vi.fn().mockResolvedValue(undefined);
    mocked.updateAgenticDeal = vi.fn();
    const { markDealCompleteFromSterlingPack } = await import("../../services/sterlingHandoff");
    await markDealCompleteFromSterlingPack({ prospectId: 42, compiledAt: "2026-09-15T08:00:00.000Z" });
    expect(mocked.updateAgenticDeal).not.toHaveBeenCalled();
  });
});
```

Extend the handoff storage mock with `getAgenticDealByProspectId` and `updateAgenticDeal`.

- [ ] **Step 2: Run tests — fail**

Run: `npx vitest run server/__tests__/services/sterlingPack.test.ts server/__tests__/services/sterlingHandoff.test.ts`
Expected: FAIL — `compileSterlingRailPack` / `markDealCompleteFromSterlingPack` missing.

- [ ] **Step 3: Implement**

In `server/storage.ts` add next to `getAgenticDeal`:

```ts
getAgenticDealByProspectId(prospectId: number): Promise<import("@shared/agenticWorkflow").AgenticDealFile | undefined>;
```

In `server/sqliteStorage.ts`:

```ts
async getAgenticDealByProspectId(prospectId: number) {
  const id = Number(prospectId);
  if (!Number.isFinite(id) || id <= 0) return undefined;
  return getCollection("agentic_deals").find((deal) => Number(deal.prospectId) === id);
}
```

In `server/services/sterlingPack.ts` add `compileSterlingRailPack` using the interface above. Import `lenderForPack` and `recommendationForPack` from `@shared/sterlingRail`. Import `storage`.

In `server/services/sterlingHandoff.ts` add `markDealCompleteFromSterlingPack`. Import `addEvent` from `@shared/agenticWorkflow` if that helper is exported from the shared module; if `addEvent` lives only in `server/services/agenticWorkflow.ts`, duplicate a one-line event append here:

```ts
events: [
  ...(deal.events || []),
  {
    at: opts.compiledAt,
    stage: "complete",
    message: "Sterling pack compiled — zip is on the file.",
    agent: "deal-processing-underwriter",
  },
],
```

Do not import the huge `agenticWorkflow` service from handoff (cycle risk).

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/__tests__/services/sterlingPack.test.ts server/__tests__/services/sterlingHandoff.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add server/services/sterlingPack.ts server/__tests__/services/sterlingPack.test.ts server/services/sterlingHandoff.ts server/__tests__/services/sterlingHandoff.test.ts server/storage.ts server/sqliteStorage.ts
git commit -m "feat: one compile function stamps the Sterling zip on the file"
```

---

### Task 3: approve_sterling compiles then completes

**Files:**
- Modify: `server/services/agenticWorkflow.ts` (`resolveHuman` approve_sterling branch ~2937–2959)
- Create: `server/__tests__/services/sterlingRailApprove.test.ts`

**Interfaces:**
- Consumes: `compileSterlingRailPack`, existing completeness / BBB / engagement gates, `ensureSterlingHandoff`, `DIRECTOR_NAME` from `@shared/identity`
- Produces: `resolveHuman(..., "approve_sterling")` after a successful compile:
  - `stage: "complete"`, `status: "complete"`
  - `sterlingHandoffId`
  - `sterlingPackCompiledAt` = compile `compiledAt`
  - event message includes `pack compiled` or `zip`
  - if `compileSterlingRailPack` throws, do **not** write `stage: "complete"`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/services/sterlingRailApprove.test.ts` following the smeConvertTick mock style:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getAgenticDeal: vi.fn(),
    updateAgenticDeal: vi.fn(),
    listProspectDocuments: vi.fn(),
    getSystemSetting: vi.fn(),
  },
}));
vi.mock("../../services/sterlingHandoff", () => ({
  ensureSterlingHandoff: vi.fn(),
  markDealCompleteFromSterlingPack: vi.fn(),
}));
vi.mock("../../services/sterlingPack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/sterlingPack")>();
  return { ...actual, compileSterlingRailPack: vi.fn() };
});

import { storage } from "../../storage";
import { ensureSterlingHandoff } from "../../services/sterlingHandoff";
import { compileSterlingRailPack } from "../../services/sterlingPack";
import { agenticWorkflow } from "../../services/agenticWorkflow";

const mockedStorage = storage as unknown as {
  getAgenticDeal: ReturnType<typeof vi.fn>;
  updateAgenticDeal: ReturnType<typeof vi.fn>;
};

function completeDeal() {
  return {
    id: 88,
    prospectId: 42,
    ownerUserId: "shaun",
    stage: "human_review",
    status: "waiting_human",
    companyName: "Acme Joinery Limited",
    companyNumber: "12345678",
    fundingReason: "Stacked MCA refinance",
    packDocuments: [
      { fileName: "june.pdf", category: "bank-statements" },
      { fileName: "accounts.pdf", category: "accounts" },
      { fileName: "cff.xlsx", category: "cashflow" },
      { fileName: "debts.xlsx", category: "debt-schedule" },
      { fileName: "passport.pdf", category: "id" },
    ],
    sfp: { status: "COMPLETE" },
    bbbEligibility: { status: "pass" },
    underwritingJudgement: "Recommendation only — Supportable.",
    engagement: { status: "signed" },
    events: [],
  };
}

describe("approve_sterling one rail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStorage.updateAgenticDeal.mockImplementation(async (id: number, patch: object) => ({
      ...completeDeal(),
      id,
      ...patch,
    }));
  });

  it("does not mark complete when the zip compile fails", async () => {
    mockedStorage.getAgenticDeal.mockResolvedValue(completeDeal());
    vi.mocked(ensureSterlingHandoff).mockResolvedValue({ ok: true, handoff: { id: 11, prospectId: 42 } });
    vi.mocked(compileSterlingRailPack).mockRejectedValue(
      Object.assign(new Error("File is not complete for Sterling: Cash flow forecast"), { status: 400 }),
    );
    await expect(agenticWorkflow.resolveHuman(88, "approve_sterling")).rejects.toThrow(/not complete/i);
    const patches = mockedStorage.updateAgenticDeal.mock.calls.map((call) => call[1]);
    expect(patches.some((patch) => patch && (patch as { stage?: string }).stage === "complete")).toBe(false);
  });

  it("marks complete only after the zip is compiled", async () => {
    mockedStorage.getAgenticDeal.mockResolvedValue(completeDeal());
    vi.mocked(ensureSterlingHandoff).mockResolvedValue({
      ok: true,
      handoff: { id: 11, prospectId: 42, recommendation: "" },
    });
    vi.mocked(compileSterlingRailPack).mockResolvedValue({
      buffer: Buffer.from("zip"),
      filename: "pack.zip",
      compiledAt: "2026-09-15T08:00:00.000Z",
      lenderId: "ffe",
    });
    const updated = await agenticWorkflow.resolveHuman(88, "approve_sterling");
    expect(compileSterlingRailPack).toHaveBeenCalledWith(
      expect.objectContaining({
        handoff: expect.objectContaining({ id: 11 }),
        underwritingJudgement: "Recommendation only — Supportable.",
      }),
    );
    expect(updated.stage).toBe("complete");
    expect(updated.sterlingPackCompiledAt).toBe("2026-09-15T08:00:00.000Z");
    expect(updated.sterlingHandoffId).toBe(11);
  });
});
```

`engagement` shape must satisfy `sterlingSendBlockedByEngagement`. Read that helper before writing the fixture; if signed engagement is a specific object, copy it from `server/__tests__/shared/engagementPack.test.ts`. If the completeness gate fails on this fixture, add the same documents/fundingReason the gate already uses in `agenticWorkflow.ts`.

- [ ] **Step 2: Run test — fail**

Run: `npx vitest run server/__tests__/services/sterlingRailApprove.test.ts`
Expected: FAIL — approve still completes without calling `compileSterlingRailPack`, or the mock never runs because compile is not imported yet.

- [ ] **Step 3: Wire approve_sterling**

Replace the success path after `ensureSterlingHandoff` in `resolveHuman` with:

```ts
const compiled = await compileSterlingRailPack({
  handoff: handoff.handoff,
  underwritingJudgement: deal.underwritingJudgement,
  signedBy: DIRECTOR_NAME,
});
return storage.updateAgenticDeal(deal.id, {
  stage: "complete",
  status: "complete",
  sterlingHandoffId: handoff.handoff?.id,
  sterlingPackCompiledAt: compiled.compiledAt,
  humanReason: undefined,
  events: addEvent(
    deal,
    "complete",
    note || "Director approved. Sterling pack compiled — zip is on the file.",
  ),
}) as Promise<AgenticDealFile>;
```

If compile throws, do not catch it — let it fail the request. Completeness already ran; compile is the zip.

Import `compileSterlingRailPack` from `./sterlingPack` and `DIRECTOR_NAME` from `@shared/identity`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/__tests__/services/sterlingRailApprove.test.ts`
Expected: PASS

If engagement/completeness fixtures are wrong, fix the fixture first (the production branch is already gated). Do not skip compile to make the test pass.

- [ ] **Step 5: Commit**

```
git add server/services/agenticWorkflow.ts server/__tests__/services/sterlingRailApprove.test.ts
git commit -m "feat: approve_sterling compiles the zip before complete"
```

---

### Task 4: Portal pack is the same rail

**Files:**
- Modify: `server/routes/brokerPortal.ts` POST `/api/broker-portal/handoffs/:id/pack`

**Interfaces:**
- Consumes: `compileSterlingRailPack`, `markDealCompleteFromSterlingPack`
- Produces: same zip stamp; matching agentic deal marked complete

- [ ] **Step 1: Write a source/contract test** (this route is Express + auth; do not stand up the whole portal)

Add to `server/__tests__/services/sterlingPortal.test.ts` (or a small new `server/__tests__/routes/brokerPortalPack.test.ts` that reads the route file if that is the house style — prefer a real handler test only if `openersUi` already shows how). Simplest honest test: extend `sterlingRailApprove` style is wrong here.

Add to `server/__tests__/services/sterlingPack.test.ts` a grep-style sibling already used in `sterlingPackProposal.test.ts` is weaker. Prefer:

Create `server/__tests__/routes/brokerPortalPack.test.ts` that reads `server/routes/brokerPortal.ts` as text:

```ts
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const src = fs.readFileSync(path.resolve("server/routes/brokerPortal.ts"), "utf8");

describe("broker portal pack is the sterling rail", () => {
  it("compiles through compileSterlingRailPack, not a second zip builder", () => {
    expect(src).toMatch(/compileSterlingRailPack/);
    expect(src).toMatch(/markDealCompleteFromSterlingPack/);
    expect(src).not.toMatch(/buildSterlingPackZip\(\{\s*handoff,\s*lenderId,\s*signedBy\s*\}\)/);
  });
});
```

That is a lock test. Also keep the existing zip tests on `compileSterlingRailPack`.

- [ ] **Step 2: Run — fail**

Run: `npx vitest run server/__tests__/routes/brokerPortalPack.test.ts`
Expected: FAIL

- [ ] **Step 3: Patch the route**

Replace the body of POST `/api/broker-portal/handoffs/:id/pack` after `loadHandoff` / lender check:

```ts
const pack = await compileSterlingRailPack({
  handoff,
  lenderId,
  signedBy,
});
if (handoff.submissionId) {
  await storage.createUnderwritingActivity(
    {
      submissionId: handoff.submissionId,
      activityType: "sterling_pack_downloaded",
      content: `Sterling downloaded pack for ${lenderId}`,
    },
    req.user!.id
  );
}
await markDealCompleteFromSterlingPack({
  prospectId: handoff.prospectId,
  compiledAt: pack.compiledAt,
  handoffId: handoff.id,
});
const { encodeContentDisposition } = await import("../utils/security");
res.setHeader("Content-Type", "application/zip");
res.setHeader("Content-Disposition", encodeContentDisposition(pack.filename));
res.send(pack.buffer);
```

Remove the inline `updateBrokerHandoff({ status: "sent", ... })` **only if** `compileSterlingRailPack` should also set `status: "sent"` when called from the portal.

**Do this:** add an optional `markSent?: boolean` to `compileSterlingRailPack`. Portal passes `markSent: true` (sets `status: "sent"` plus pack stamp). `approve_sterling` omits it so the handoff stays `awaiting_recommendation` until David actually sends to a CDFI — Shaun’s approve compiled the zip; David’s download is the send.

Update Task 2 types: `compileSterlingRailPack` accepts `markSent?: boolean`. When true, handoff update includes `status: "sent"`. Add one assertion on the portal lock test is enough; add a pack-test that `markSent: true` writes `status: "sent"` in `sterlingPack.test.ts`.

- [ ] **Step 4: Run**

Run: `npx vitest run server/__tests__/routes/brokerPortalPack.test.ts server/__tests__/services/sterlingPack.test.ts server/__tests__/services/sterlingRailApprove.test.ts server/__tests__/shared/sterlingRail.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```
git add server/routes/brokerPortal.ts server/services/sterlingPack.ts server/__tests__/routes/brokerPortalPack.test.ts server/__tests__/services/sterlingPack.test.ts
git commit -m "feat: Sterling portal send uses the same zip rail"
```

---

## Self-review

- Spec “one rail / Deal Files cannot succeed without that zip” → Tasks 1–3
- Spec “approving compiles the zip” → Task 3
- Portal still produces the zip David downloads → Task 4, same function
- Completeness gate unchanged (still inside `buildSterlingPackZip`)
- No deletion of costume/frozen desks
- Unrelated dirty WIP not in any `git add`
- `markSent` is specified (not a placeholder)
- Default lender `ffe` is explicit
