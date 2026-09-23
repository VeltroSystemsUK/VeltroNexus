# Direct Outreach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Openers an on-site desk with a Direct Outreach column (5+ dwells), move Unsubscribed to a Marketing graveyard, and let Shaun generate/review/send a private HTML briefing that auto-Promotes on pack dwell or reply.

**Architecture:** Pure board/gate/resume logic in `shared/openers.ts`. Hypothesis and pack HTML in `shared/briefing*.ts`. JSON stores for briefings and the house template. Hydrate applies the gate (backfill). `sendEmail` sends the cover from `director` (Shaun) via `enquiries@`. Public `/briefing/:token` is unlisted; Veltro is a separate public page that flags interest and does not Promote.

**Tech Stack:** TypeScript, Vitest, Express, React. No new npm packages. No new SQLite tables.

**Spec:** `docs/superpowers/specs/2026-09-14-direct-outreach-design.md`

## Global Constraints

- Openers desk is on-site only: `dwellCount >= 1`; zero-dwell stays on Agent Mail
- Direct Outreach gate is **dwells only**: `dwellCount >= 5`; email clicks and in-page clicks do not qualify
- Unsubscribed is a graveyard page, not an Openers column and not a marketing list
- James/convert stop on gate (`stopReason: "direct_outreach"`); drag back to Nurturing **auto-restarts James**
- Hydrate must not re-pull a dismissed card unless `dwellCount` rises after the drag
- Pack is hosted HTML, not `emailHtmlFromCraft` tables
- Cover email: Shaun Tuhey (`agentId: "director"`) via `enquiries@`; no Veltro in the subject
- Hypothesis: proven facts + named pattern; never “you have late payers”
- Auto-Promote on briefing dwell (10s) or inbound reply / enquiry / Apply; Veltro interest does **not** Promote
- Unlisted token; invalid/revoked/unsent → private wall with no company name; `X-Robots-Tag: noindex, nofollow`
- Staff preview does not track and does not Promote
- Every outbound send goes through `sendEmail` / `mailIsSuppressed`
- STOP revokes the token and parks Unsubscribed
- Completing `fez-crm` / trial logins / in-page site clicks / Open-in-Craft everyday path are out of this plan
- No live SMTP or Companies House in CI
- Windows PowerShell: `git commit -m "message"` (no bash heredocs)

## File map

- Modify: `shared/openers.ts` — `direct_outreach` status, gate, desk predicates, drag, rank, stop reason, resume James
- Modify: `server/__tests__/shared/openers.test.ts`
- Modify: `server/services/openers.ts` — hydrate pass, PATCH resume, list filters, briefing dwell promote, STOP revoke
- Modify: `server/__tests__/services/openers.test.ts`
- Modify: `server/routes/openers.ts` — list filter, unsubscribed GET, generate/preview/send, PATCH resume
- Modify: `server/__tests__/routes/openers.test.ts`
- Modify: `server/__tests__/routes/openersUi.test.ts`
- Modify: `client/src/pages/Openers.tsx` — columns, generate/send, no Unsubscribed column
- Create: `client/src/pages/Unsubscribed.tsx`
- Modify: `client/src/components/shell/navModel.ts`, `client/src/components/Sidebar.tsx`, `client/src/App.tsx`
- Create: `shared/briefingHypothesis.ts`, `server/__tests__/shared/briefingHypothesis.test.ts`
- Create: `shared/briefingRender.ts`, `shared/briefingCover.ts`
- Create: `server/services/briefings.ts`, `server/__tests__/services/briefings.test.ts`
- Create: `server/routes/briefings.ts`
- Create: `client/src/pages/BriefingPack.tsx`, `client/src/pages/Veltro.tsx`
- Modify: `server/routes.ts` — mount briefing/veltro routes
- Modify: `server/auth.ts` — CSRF exempt public briefing/veltro POSTs
- Modify: `server/__tests__/security.test.ts`
- Modify: inbound/STOP path already in `stopOpenerNurtureByEmail` — call revoke
- Do not rewrite: `docs/superpowers/specs/2026-09-14-direct-outreach-design.md`

---

### Task 1: Board kernel (status, desk, gate, drag, rank)

**Files:**
- Modify: `shared/openers.ts`
- Test: `server/__tests__/shared/openers.test.ts`

**Interfaces:**
- Consumes: existing `OpenerRecord`, `emptyNurture`, `normalizeOpener`, `canDragOpenerTo`, `openerBelongsToDesk`, `compareOpenersByOpenCount`, `stopNurture`, `isDoNotContactOpener`
- Produces:
  - `OPENER_BOARD_STATUSES = ["new", "nurturing", "direct_outreach", "promoted"]`
  - `OPENER_STATUSES = ["non_responsive", "new", "nurturing", "direct_outreach", "not_now", "promoted"]`
  - `OpenerNurture.stopReason` includes `"direct_outreach"`
  - `OpenerNurture.directOutreachDismissedDwellCount?: number`
  - `OpenerRecord.veltroInterestAt?: string`
  - `OpenerRecord.briefingId?: string`
  - `DIRECT_OUTREACH_DWELL_MIN = 5`
  - `eligibleDirectOutreach(opener: OpenerRecord): boolean`
  - `openerOnOpenersBoard(opener: OpenerRecord): boolean`
  - `isDirectOutreachOpener(opener: Pick<OpenerRecord, "status">): boolean`

- [ ] **Step 1: Write the failing tests**

Add to `server/__tests__/shared/openers.test.ts` (reuse the existing `opener()` helper):

```ts
import {
  DIRECT_OUTREACH_DWELL_MIN,
  eligibleDirectOutreach,
  openerOnOpenersBoard,
  isDirectOutreachOpener,
} from "@shared/openers";

describe("direct outreach gate", () => {
  it("requires 5 dwells, not clicks", () => {
    expect(eligibleDirectOutreach(opener({ dwellCount: 4, clickCount: 12, status: "new" }))).toBe(false);
    expect(eligibleDirectOutreach(opener({ dwellCount: 5, status: "new" }))).toBe(true);
    expect(DIRECT_OUTREACH_DWELL_MIN).toBe(5);
  });

  it("rejects promoted, non_responsive, and do-not-contact", () => {
    expect(eligibleDirectOutreach(opener({ dwellCount: 9, status: "promoted", companyNumber: "08765432" }))).toBe(false);
    expect(eligibleDirectOutreach(opener({ dwellCount: 9, status: "non_responsive" }))).toBe(false);
    expect(eligibleDirectOutreach(opener({ dwellCount: 9, status: "not_now" }))).toBe(false);
  });

  it("does not re-pull at the dismissed dwell count", () => {
    const row = opener({
      dwellCount: 5,
      status: "nurturing",
      nurture: { ...opener().nurture, step: 1, directOutreachDismissedDwellCount: 5 },
    });
    expect(eligibleDirectOutreach(row)).toBe(false);
    expect(eligibleDirectOutreach({ ...row, dwellCount: 6 })).toBe(true);
  });

  it("hides zero-dwell cards from the Openers desk", () => {
    expect(openerOnOpenersBoard(opener({ dwellCount: 0, status: "new", clickCount: 12 }))).toBe(false);
    expect(openerOnOpenersBoard(opener({ dwellCount: 1, status: "new" }))).toBe(true);
    expect(openerOnOpenersBoard(opener({ dwellCount: 9, status: "not_now" }))).toBe(false);
    expect(openerOnOpenersBoard(opener({ dwellCount: 2, status: "non_responsive" }))).toBe(false);
  });
});
```

Update the existing `"drag rules match the spec"` test:

```ts
it("drag rules match the spec", () => {
  const fresh = opener();
  expect(canDragOpenerTo(fresh, "new")).toBe(true);
  expect(canDragOpenerTo(fresh, "nurturing")).toBe(false);
  expect(canDragOpenerTo(fresh, "not_now")).toBe(true);
  expect(canDragOpenerTo(fresh, "promoted")).toBe(false);
  expect(canDragOpenerTo(fresh, "direct_outreach")).toBe(false);

  const desk = opener({ status: "direct_outreach", dwellCount: 5, companyNumber: "08765432" });
  expect(canDragOpenerTo(desk, "direct_outreach")).toBe(false);
  expect(canDragOpenerTo(desk, "nurturing")).toBe(true);
  expect(canDragOpenerTo(desk, "not_now")).toBe(true);
  expect(canDragOpenerTo(desk, "promoted")).toBe(true);
  expect(canDragOpenerTo(desk, "new")).toBe(false);

  const parked = stopNurture(opener(), "opt_out");
  expect(canDragOpenerTo(parked, "direct_outreach")).toBe(false);
});
```

Add rank test: after equal dwell, `veltroInterestAt` sorts first.

```ts
it("ranks Veltro interest after dwell inside Direct Outreach", () => {
  const a = opener({ id: "a", companyName: "Alpha", dwellCount: 5, veltroInterestAt: "2026-09-14T10:00:00.000Z" });
  const b = opener({ id: "b", companyName: "Beta", dwellCount: 5 });
  expect(compareOpenersByOpenCount(a, b)).toBeLessThan(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/shared/openers.test.ts`

Expected: FAIL — `eligibleDirectOutreach` is not exported.

- [ ] **Step 3: Implement the kernel**

In `shared/openers.ts`:

```ts
export const OPENER_BOARD_STATUSES = ["new", "nurturing", "direct_outreach", "promoted"] as const;
export const OPENER_STATUSES = ["non_responsive", "new", "nurturing", "direct_outreach", "not_now", "promoted"] as const;
export const DIRECT_OUTREACH_DWELL_MIN = 5;
```

Extend `OpenerNurture.stopReason` with `"direct_outreach"` and add `directOutreachDismissedDwellCount?: number`.

Add on `OpenerRecord`: `veltroInterestAt?: string`; `briefingId?: string`.

`STATUS_RANK`: `promoted: 5`, `direct_outreach: 4`, `nurturing: 3`, `not_now: 2`, `new: 1`, `non_responsive: 0`.

`normalizeOpener` copies `veltroInterestAt` and `briefingId`. `normalizeNurture` copies `directOutreachDismissedDwellCount`.

```ts
export function isDirectOutreachOpener(opener: Pick<OpenerRecord, "status">): boolean {
  return opener.status === "direct_outreach";
}

export function eligibleDirectOutreach(opener: OpenerRecord): boolean {
  if ((opener.dwellCount || 0) < DIRECT_OUTREACH_DWELL_MIN) return false;
  if (opener.status === "promoted" || opener.status === "non_responsive") return false;
  if (isDoNotContactOpener(opener)) return false;
  const dismissed = opener.nurture.directOutreachDismissedDwellCount ?? 0;
  return (opener.dwellCount || 0) > dismissed;
}

export function openerOnOpenersBoard(opener: OpenerRecord): boolean {
  if (opener.status === "non_responsive") return false;
  if (isDoNotContactOpener(opener)) return false;
  return (opener.dwellCount || 0) >= 1;
}
```

`canDragOpenerTo`: if `column === "direct_outreach"` return `false`. If `opener.status === "direct_outreach"`: allow `nurturing`, `not_now`, and `promoted` when `canPromoteOpener`; deny `new`.

`compareOpenersByOpenCount`: after dwell, if `a.veltroInterestAt` xor `b.veltroInterestAt`, the one with the stamp sorts first; then existing heat/clicks/opens/name.

Keep `openerBelongsToDesk` as today (Non Responsive split). Board visibility is `openerOnOpenersBoard`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/openers.test.ts`

Expected: PASS (update any drag tests that assumed `direct_outreach` was invalid-unknown).

- [ ] **Step 5: Commit**

```powershell
git add shared/openers.ts server/__tests__/shared/openers.test.ts
git commit -m "feat: Direct Outreach board kernel and dwell gate"
```

---

### Task 2: Apply Direct Outreach and resume James

**Files:**
- Modify: `shared/openers.ts`
- Test: `server/__tests__/shared/openers.test.ts`

**Interfaces:**
- Consumes: `eligibleDirectOutreach`, `stopNurture`, `enrolConvertOpener`, `startNurture`, `isConvertOpener`, `nextConvertSendWindow` from `shared/smeConvert.ts`
- Produces:
  - `applyDirectOutreach(opener, now?: Date): OpenerRecord`
  - `resumeJamesFromDirectOutreach(opener, opts?: { dualOpenEligible?: boolean; now?: Date; draft?: { subject: string; html: string } }): OpenerRecord`

- [ ] **Step 1: Write the failing tests**

```ts
import { applyDirectOutreach, resumeJamesFromDirectOutreach, enrolConvertOpener, recordConvertSend, startNurture } from "@shared/openers";

describe("applyDirectOutreach", () => {
  it("moves a 5-dwell nurturing convert card and stops James", () => {
    const row = recordConvertSend(
      enrolConvertOpener(opener({ dwellCount: 5, companyNumber: "08765432" })),
      "sme_n1",
      "mail-n1"
    );
    const next = applyDirectOutreach(row);
    expect(next.status).toBe("direct_outreach");
    expect(next.nurture.stopReason).toBe("direct_outreach");
    expect(next.nurture.wakeAt).toBeUndefined();
    expect(next.nurture.n1At).toBeTruthy();
  });

  it("is a no-op when ineligible", () => {
    const row = opener({ dwellCount: 4, status: "new" });
    expect(applyDirectOutreach(row)).toBe(row);
  });
});

describe("resumeJamesFromDirectOutreach", () => {
  it("resumes convert at the next unsent step", () => {
    const stopped = applyDirectOutreach(
      recordConvertSend(enrolConvertOpener(opener({ dwellCount: 5 })), "sme_n1", "mail-n1")
    );
    const next = resumeJamesFromDirectOutreach(stopped, { now: new Date("2026-09-14T12:00:00.000Z") });
    expect(next.status).toBe("nurturing");
    expect(next.nurture.stopReason).toBeUndefined();
    expect(next.nurture.directOutreachDismissedDwellCount).toBe(5);
    expect(next.nurture.n1At).toBeTruthy();
    expect(next.nurture.n2At).toBeUndefined();
    expect(next.nurture.wakeAt).toBeTruthy();
  });

  it("enrols convert when they never started and dual-open is eligible", () => {
    const desk = applyDirectOutreach(opener({ dwellCount: 5, status: "new" }));
    const next = resumeJamesFromDirectOutreach(desk, { dualOpenEligible: true });
    expect(next.nurture.stream).toBe("convert");
    expect(next.status).toBe("nurturing");
    expect(next.nurture.stopReason).toBeUndefined();
  });

  it("starts 3-touch when they never started and convert does not apply", () => {
    const desk = applyDirectOutreach(opener({ dwellCount: 5, status: "new" }));
    const next = resumeJamesFromDirectOutreach(desk, {
      dualOpenEligible: false,
      draft: { subject: "Next", html: "<p>Hi</p>" },
    });
    expect(next.nurture.stream).toBe("opener_3touch");
    expect(next.nurture.touch1Status).toBe("pending_approval");
  });

  it("does not restart do-not-contact", () => {
    const parked = stopNurture(opener({ dwellCount: 9 }), "opt_out");
    expect(resumeJamesFromDirectOutreach(parked).status).toBe("not_now");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/shared/openers.test.ts`

Expected: FAIL — `applyDirectOutreach` is not exported.

- [ ] **Step 3: Implement**

```ts
import { nextConvertSendWindow } from "./smeConvert";

export function applyDirectOutreach(opener: OpenerRecord, now?: Date): OpenerRecord {
  if (opener.status === "direct_outreach") return opener;
  if (!eligibleDirectOutreach(opener)) return opener;
  if (opener.status !== "new" && opener.status !== "nurturing") return opener;
  const stopped = stopNurture(opener, "direct_outreach", now);
  return {
    ...stopped,
    status: "direct_outreach",
    nurture: { ...stopped.nurture, wakeAt: undefined },
  };
}

export function resumeJamesFromDirectOutreach(
  opener: OpenerRecord,
  opts?: {
    dualOpenEligible?: boolean;
    now?: Date;
    draft?: { subject: string; html: string };
  }
): OpenerRecord {
  if (isDoNotContactOpener(opener)) return opener;
  const now = opts?.now;
  const stamp = nowIso(now);
  const dismissed = opener.dwellCount || 0;
  const base: OpenerRecord = {
    ...opener,
    status: "nurturing",
    updatedAt: stamp,
    nurture: {
      ...opener.nurture,
      directOutreachDismissedDwellCount: dismissed,
      stopReason: opener.nurture.stopReason === "direct_outreach" ? undefined : opener.nurture.stopReason,
      stoppedAt: opener.nurture.stopReason === "direct_outreach" ? undefined : opener.nurture.stoppedAt,
    },
  };
  if (base.nurture.stopReason === "opt_out" || base.nurture.stopReason === "promoted") return opener;

  const convertInFlight =
    isConvertOpener(base) &&
    Boolean(base.nurture.n1At) &&
    base.nurture.closerStatus !== "done" &&
    base.nurture.closerStatus !== "skipped";
  if (convertInFlight) {
    return {
      ...base,
      nurture: { ...base.nurture, stream: "convert", wakeAt: nextConvertSendWindow(now).toISOString() },
    };
  }

  const threeTouchInFlight = base.nurture.stream !== "convert" && base.nurture.step >= 1;
  if (threeTouchInFlight) return base;

  if (opts?.dualOpenEligible) return enrolConvertOpener(base, now);

  const draft = opts?.draft ?? {
    subject: "A note from Strata",
    html: "<p>Hi,</p><p>If this isn't useful, reply stop and we won't email again.</p>",
  };
  return startNurture({ ...base, nurture: { ...base.nurture, stream: "opener_3touch" } }, draft, now);
}
```

`stopNurture` today sets `status` to `not_now` only for `opt_out`. Leave that. It also sets `step: 3`. For convert resume that is fine; convert uses `n1At` not `step`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/openers.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/openers.ts server/__tests__/shared/openers.test.ts
git commit -m "feat: apply Direct Outreach and resume James on drag-back"
```

---

### Task 3: Hydrate backfill

**Files:**
- Modify: `server/services/openers.ts` (`hydrateFromAgentMail`, after unsubscribe/bounce passes)
- Test: `server/__tests__/services/openers.test.ts`

**Interfaces:**
- Consumes: `applyDirectOutreach`, `eligibleDirectOutreach`
- Produces: hydrate moves existing 5-dwell New/Nurturing cards to `direct_outreach` and stops James

- [ ] **Step 1: Write the failing test**

In `server/__tests__/services/openers.test.ts` (same temp-store pattern as existing hydrate tests):

```ts
it("hydrate migrates 5-dwell cards into Direct Outreach and leaves 4-dwell and unsubscribed", () => {
  const hot = normalizeOpener({
    id: "hot",
    email: "hot@firm.co.uk",
    status: "nurturing",
    dwellCount: 5,
    firstOpenedAt: "2026-09-01T10:00:00.000Z",
    lastOpenedAt: "2026-09-01T10:00:00.000Z",
    nurture: { step: 1, touch1Status: "sent", touch2Status: "idle", stream: "opener_3touch", closerStatus: "idle" },
  });
  const warm = normalizeOpener({
    id: "warm",
    email: "warm@firm.co.uk",
    status: "new",
    dwellCount: 4,
    firstOpenedAt: "2026-09-01T10:00:00.000Z",
    lastOpenedAt: "2026-09-01T10:00:00.000Z",
  });
  const dead = normalizeOpener({
    id: "dead",
    email: "dead@firm.co.uk",
    status: "not_now",
    dwellCount: 9,
    firstOpenedAt: "2026-09-01T10:00:00.000Z",
    lastOpenedAt: "2026-09-01T10:00:00.000Z",
    nurture: { step: 3, touch1Status: "sent", touch2Status: "idle", stopReason: "opt_out", stream: "opener_3touch", closerStatus: "idle" },
  });
  writeOpeners([hot, warm, dead]);
  const rows = hydrateFromAgentMail([]);
  expect(rows.find((r) => r.id === "hot")?.status).toBe("direct_outreach");
  expect(rows.find((r) => r.id === "hot")?.nurture.stopReason).toBe("direct_outreach");
  expect(rows.find((r) => r.id === "warm")?.status).toBe("new");
  expect(rows.find((r) => r.id === "dead")?.status).toBe("not_now");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/openers.test.ts`

Expected: FAIL — hot stays `nurturing`.

- [ ] **Step 3: Implement**

At the end of `hydrateFromAgentMail`, after bounce pass, before `if (dirty) writeOpeners`:

```ts
const desk = applyDirectOutreachPass(all);
all = desk.all;
if (desk.dirty) dirty = true;
```

```ts
function applyDirectOutreachPass(all: OpenerRecord[]): { all: OpenerRecord[]; dirty: boolean } {
  let dirty = false;
  const next = all.map((row) => {
    const moved = applyDirectOutreach(row);
    if (moved !== row) dirty = true;
    return moved;
  });
  return { all: next, dirty };
}
```

Import `applyDirectOutreach` from `@shared/openers`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/services/openers.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add server/services/openers.ts server/__tests__/services/openers.test.ts
git commit -m "feat: hydrate backfill into Direct Outreach"
```

---

### Task 4: List API, unsubscribed API, PATCH resume

**Files:**
- Modify: `server/routes/openers.ts`
- Modify: `server/services/openers.ts` (PATCH helper if needed)
- Test: `server/__tests__/routes/openers.test.ts`

**Interfaces:**
- Consumes: `openerOnOpenersBoard`, `isDoNotContactOpener`, `resumeJamesFromDirectOutreach`, `isDualOpenConvertEligible` from `shared/smeConvert.ts`
- Produces:
  - `GET /api/openers` (desk=openers) returns only `openerOnOpenersBoard`
  - `GET /api/openers/unsubscribed` returns DNC graveyard
  - `PATCH` status `nurturing` from `direct_outreach` calls `resumeJamesFromDirectOutreach`
  - `PATCH` to `direct_outreach` is 400

- [ ] **Step 1: Write the failing tests**

Follow the existing authenticated openers route test harness. Add:

```ts
it("GET /api/openers omits zero-dwell and unsubscribed", async () => {
  writeOpeners([
    normalizeOpener({ id: "zero", email: "zero@x.co.uk", dwellCount: 0, status: "new", firstOpenedAt: "2026-09-01T10:00:00.000Z", lastOpenedAt: "2026-09-01T10:00:00.000Z" }),
    normalizeOpener({ id: "site", email: "site@x.co.uk", dwellCount: 2, status: "new", firstOpenedAt: "2026-09-01T10:00:00.000Z", lastOpenedAt: "2026-09-01T10:00:00.000Z" }),
    normalizeOpener({ id: "dead", email: "dead@x.co.uk", dwellCount: 6, status: "not_now", firstOpenedAt: "2026-09-01T10:00:00.000Z", lastOpenedAt: "2026-09-01T10:00:00.000Z" }),
  ]);
  const res = await request(app).get("/api/openers").set(auth);
  const ids = res.body.map((row: { id: string }) => row.id);
  expect(ids).toContain("site");
  expect(ids).not.toContain("zero");
  expect(ids).not.toContain("dead");
});

it("GET /api/openers/unsubscribed is the graveyard", async () => {
  const res = await request(app).get("/api/openers/unsubscribed").set(auth);
  expect(res.body.some((row: { id: string }) => row.id === "dead")).toBe(true);
});
```

If the route test file does not boot a full app, add source-contract tests like `openers.test.ts` already does (`expect(src).toMatch(...)`) **and** a service-level test:

```ts
it("resume on patch from direct_outreach restarts James", () => {
  const row = applyDirectOutreach(normalizeOpener({ id: "d", email: "d@x.co.uk", dwellCount: 5, status: "new", firstOpenedAt: "2026-09-01T10:00:00.000Z", lastOpenedAt: "2026-09-01T10:00:00.000Z" }));
  writeOpeners([row]);
  const next = resumeOpenerFromDirectOutreach(row.id);
  expect(next?.status).toBe("nurturing");
  expect(next?.nurture.directOutreachDismissedDwellCount).toBe(5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/routes/openers.test.ts server/__tests__/services/openers.test.ts`

Expected: FAIL — unsubscribed route missing; GET still returns zero-dwell.

- [ ] **Step 3: Implement**

`GET /api/openers`: after desk filter, if desk is `openers`, `.filter(openerOnOpenersBoard)`.

Register **before** `GET /:id`:

```ts
router.get("/api/openers/unsubscribed", isAuthenticated, requireOpenersAccess, async (req, res) => {
  const mail = listAgentMail(5000);
  const pipelineCompanyNumbers = await listOpenerPipelineCompanyNumbers(String((req.user as any)?.id || ""));
  const rows = listOpeners().filter(isDoNotContactOpener);
  res.json(rows.map((opener) => presentOpener(opener, mail, pipelineCompanyNumbers)));
});
```

`PATCH`: if `status === "direct_outreach"` → 400. If `current.status === "direct_outreach" && status === "nurturing"`:

```ts
opener = resumeOpenerFromDirectOutreach(current.id) ?? opener;
```

```ts
export function resumeOpenerFromDirectOutreach(id: string): OpenerRecord | undefined {
  const opener = getOpener(id);
  if (!opener) return undefined;
  return saveOpener(resumeJamesFromDirectOutreach(opener, { dualOpenEligible: false }));
}
```

v1: `dualOpenEligible: false` unless you already have deal mail on the opener (`nurture.stream === "convert"` is handled inside resume). Passing `false` still enrols 3-touch for never-started; convert-in-flight uses `n1At`. That matches “don’t miss them.”

If `status === "not_now"` from Direct Outreach, `stopNurture(..., "opt_out")` is wrong — Shaun parking them as unsubscribed is rare; spec allows drag to Unsubscribed. Use `stopNurture(opener, "opt_out")` only for real STOP. For manual graveyard: `patchOpener` status `not_now` plus `stopReason: "manual"` is existing. Also call `revokeBriefingsForOpener(id)` once Task 7 exists; in this task add a named empty hook:

```ts
export function onOpenerUnsubscribed(openerId: string): void {
  void openerId;
}
```

Task 10 replaces the body.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/routes/openers.test.ts server/__tests__/services/openers.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add server/routes/openers.ts server/services/openers.ts server/__tests__/routes/openers.test.ts server/__tests__/services/openers.test.ts
git commit -m "feat: Openers list is on-site only; Unsubscribed API; James restarts on drag-back"
```

---

### Task 5: Openers UI columns and Unsubscribed page

**Files:**
- Modify: `client/src/pages/Openers.tsx`
- Create: `client/src/pages/Unsubscribed.tsx`
- Modify: `client/src/components/shell/navModel.ts`
- Modify: `client/src/components/Sidebar.tsx` (if it still has a hardcoded Marketing list)
- Modify: `client/src/App.tsx`
- Test: `server/__tests__/routes/openersUi.test.ts`

**Interfaces:**
- Consumes: `OPENER_BOARD_STATUSES` (now without `not_now`), `canDragOpenerTo`
- Produces: columns New / Nurturing / Direct Outreach / Promoted; Marketing nav Unsubscribed; `data-testid`s from the spec

- [ ] **Step 1: Write the failing UI contract tests**

Replace Unsubscribed-column expectations in `openersUi.test.ts`:

```ts
expect(page).toMatch(/data-testid="column-direct-outreach"/);
expect(page).toMatch(/data-testid="btn-generate-briefing"/);
expect(page).toMatch(/data-testid="btn-send-briefing"/);
expect(page).toMatch(/data-testid="badge-veltro-interest"/);
expect(page).not.toMatch(/data-testid="column-not_now"/);

const unsub = fs.readFileSync(path.resolve("client/src/pages/Unsubscribed.tsx"), "utf8");
expect(unsub).toMatch(/data-testid="page-unsubscribed"/);
expect(unsub).not.toMatch(/btn-generate-briefing/);
expect(unsub).not.toMatch(/\/api\/campaigns/);

expect(nav).toMatch(/path: "\/unsubscribed".*group: "Marketing"/);
expect(nav).toMatch(/label: "Unsubscribed"/);
expect(app).toMatch(/path="\/unsubscribed"/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/routes/openersUi.test.ts`

Expected: FAIL — no Direct Outreach column; Unsubscribed.tsx missing.

- [ ] **Step 3: Implement UI**

`Openers.tsx`:
- `COLUMN_LABELS.direct_outreach = "Direct Outreach"`
- Remove the Unsubscribed column from the board (keep Non Responsive desk as today).
- Droppable `data-testid="column-direct-outreach"` for `direct_outreach`.
- Filter cards by `status` matching the column; server already omits zero-dwell.
- Badge `veltroInterestAt` → `data-testid="badge-veltro-interest"` text `Veltro`.
- Drawer: if `status === "direct_outreach"`, show Generate and Send buttons (Send disabled until a draft exists). Wire to `/api/openers/${id}/briefing/generate` and `/send` in Task 8; for this task the buttons may `apiRequest` those URLs so the contract test passes.

`Unsubscribed.tsx`: copy the Openers list/table pattern but `GET /api/openers/unsubscribed`, no drag to sales columns, no Generate, heading “Unsubscribed”, `data-testid="page-unsubscribed"`. Cards are read-only (company, email, date).

`navModel.ts` Marketing group, after Openers:

```ts
{ path: "/unsubscribed", label: "Unsubscribed", icon: Ban, group: "Marketing", roles: ["super_admin", "sales_admin"], keywords: "unsubscribed opt-out stop pecr", description: "Opted out — not a sales queue" },
```

`App.tsx`: authenticated route `/unsubscribed` → `Unsubscribed`.

If `Sidebar.tsx` duplicates Marketing links, add the same path.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/routes/openersUi.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add client/src/pages/Openers.tsx client/src/pages/Unsubscribed.tsx client/src/components/shell/navModel.ts client/src/components/Sidebar.tsx client/src/App.tsx server/__tests__/routes/openersUi.test.ts
git commit -m "feat: Direct Outreach column and Unsubscribed graveyard page"
```

---

### Task 6: Hypothesis engine and cover copy

**Files:**
- Create: `shared/briefingHypothesis.ts`
- Create: `shared/briefingCover.ts`
- Test: `server/__tests__/shared/briefingHypothesis.test.ts`

**Interfaces:**
- Consumes: `OpenerRecord` fields; `CONVERT_STOP_LINE` from `shared/smeConvert.ts`
- Produces:
  - `BriefingHypothesis = { id: "stacked_debt" | "sector_late_pay" | "working_capital" | "return_visits"; headline: string; body: string; mechanism: string }`
  - `pickBriefingHypothesis(input: { nonBankChargeCount: number; sicCodes: string[]; lastDwellPath?: string; dwellCount: number }): BriefingHypothesis`
  - `dwellLine(input: { dwellCount: number; lastDwellPath?: string }): string`
  - `filingsLine(input: { dateOfCreation?: string; sicCodes: string[]; liveCharges: unknown[]; nonBankChargeCount: number }): string`
  - `briefingCopyOk(text: string): { ok: true } | { ok: false; reason: string }`
  - `buildCoverEmail(opts: { companyName: string; firstName?: string; briefingUrl: string }): { subject: string; html: string }`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  pickBriefingHypothesis,
  dwellLine,
  briefingCopyOk,
} from "@shared/briefingHypothesis";

describe("pickBriefingHypothesis", () => {
  it("uses stacked debt when non-bank charges are 2+", () => {
    const h = pickBriefingHypothesis({ nonBankChargeCount: 2, sicCodes: ["41201"], dwellCount: 5 });
    expect(h.id).toBe("stacked_debt");
    expect(h.body.toLowerCase()).not.toMatch(/you have late payers/);
    expect(h.mechanism.toLowerCase()).toMatch(/packag/);
    expect(h.mechanism.toLowerCase()).not.toMatch(/we lend/);
  });

  it("frames construction as sector culture, not their invoices", () => {
    const h = pickBriefingHypothesis({ nonBankChargeCount: 0, sicCodes: ["41201"], dwellCount: 5 });
    expect(h.id).toBe("sector_late_pay");
    expect(h.body.toLowerCase()).toMatch(/sector|construction|trade/);
    expect(h.body.toLowerCase()).not.toMatch(/you have late payers/);
  });

  it("uses working capital when they dwelled on tools", () => {
    const h = pickBriefingHypothesis({
      nonBankChargeCount: 0,
      sicCodes: ["62012"],
      lastDwellPath: "/#tools",
      dwellCount: 5,
    });
    expect(h.id).toBe("working_capital");
  });
});

describe("dwellLine", () => {
  it("never mentions opened email", () => {
    const line = dwellLine({ dwellCount: 5, lastDwellPath: "/#tools" });
    expect(line.toLowerCase()).not.toMatch(/opened our email/);
    expect(line.toLowerCase()).toMatch(/site|tools/);
  });
});

describe("copy guard", () => {
  it("rejects we lend and invented late payers", () => {
    expect(briefingCopyOk("We lend at 1.5% a month").ok).toBe(false);
    expect(briefingCopyOk("you have late payers").ok).toBe(false);
    expect(briefingCopyOk("Businesses with two live non-bank charges often have a cost-of-debt problem.").ok).toBe(true);
  });
});
```

Put `buildCoverEmail` tests in the same file (re-export from `briefingCover.ts` via `briefingHypothesis.ts` **or** import from `briefingCover.ts` directly — prefer direct):

```ts
import { buildCoverEmail } from "@shared/briefingCover";
it("cover subject does not mention Veltro and includes a private link", () => {
  const mail = buildCoverEmail({
    companyName: "North Peak Ltd",
    briefingUrl: "https://leads.example/briefing/tok",
  });
  expect(mail.subject.toLowerCase()).not.toMatch(/veltro/);
  expect(mail.html).toMatch(/briefing\/tok/);
  expect(mail.html.toLowerCase()).toMatch(/isn't published|is not published|isn't on the internet/);
  expect(mail.html).toMatch(/reply stop/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/shared/briefingHypothesis.test.ts`

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`shared/briefingHypothesis.ts`:

Construction SIC: code starts with `41`, `42`, or `43`.

Tools path: `/tools`, `#tools`, `calculator`, `cashflow` case-insensitive.

Copy strings (locked meaning, words may be tightened but must pass tests):

- stacked_debt headline: `The cost of stacked facilities`
- body: `Businesses with two or more live non-bank charges often have a cost-of-debt problem. That is a pattern in the filings, not a claim about your invoices.`
- mechanism: `Strata is a packager, not a lender. We would line up a facility that can replace expensive stacked debt where a lender will actually take it.`

- sector_late_pay: body must include sector/construction/trade and must not include `you have late payers`.

- working_capital: they sat on tools; cash timing / working capital; packager.

- return_visits: default; firms that keep returning to the site often have a cashflow timing problem.

`briefingCopyOk`: reject `/we lend/i`, `/you have late payers/i`, `/\d+(\.\d+)?%/`, `/learn\.stratanexus/i`.

`dwellLine`: if path matches tools → `You spent time on the tools.` else if dwellCount >= 5 → `You've been back on the site several times.` else → `You spent time on the site.`

`filingsLine`: `${years} year(s) trading · SIC ${code} · ${n} live charge(s) · ${nonBank} non-bank`.

`shared/briefingCover.ts`:

```ts
import { CONVERT_STOP_LINE } from "./smeConvert";

export function buildCoverEmail(opts: { companyName: string; firstName?: string; briefingUrl: string }): {
  subject: string;
  html: string;
} {
  const name = opts.companyName || "your company";
  const hi = opts.firstName ? `Hi ${opts.firstName},` : "Hi,";
  return {
    subject: `A private note for the directors of ${name}`,
    html: `<p>${hi}</p><p>I put together a short private briefing for ${name}. The link isn't published — it's for you.</p><p><a href="${opts.briefingUrl}">Open your briefing</a></p><p>If this is in the right area, reply and I'll put a file together.</p><p>${CONVERT_STOP_LINE}</p>`,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/briefingHypothesis.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/briefingHypothesis.ts shared/briefingCover.ts server/__tests__/shared/briefingHypothesis.test.ts
git commit -m "feat: Direct Outreach hypothesis engine and cover email"
```

---

### Task 7: Briefing store, tokens, private wall

**Files:**
- Create: `shared/briefingRender.ts`
- Create: `server/services/briefings.ts`
- Test: `server/__tests__/services/briefings.test.ts`

**Interfaces:**
- Consumes: hypothesis + cover helpers; `crypto`
- Produces:
  - `BriefingRecord = { id: string; token: string; openerId: string; companyName: string; status: "draft" | "live" | "revoked"; slides: BriefingSlide[]; cover: { subject: string; html: string }; sentAt?: string; revokedAt?: string; dwellAt?: string; openedAt?: string; slidesViewed: number[]; createdAt: string }`
  - `BriefingSlide = { title: string; body: string; enquiryUrl?: string; veltroUrl?: string }`
  - `createDraftBriefing(opener): BriefingRecord` — no usable public token until send (store token but `status: "draft"`)
  - `activateBriefing(id): BriefingRecord` — `status: "live"`
  - `revokeBriefing(id | token | openerId)`
  - `getLiveBriefingByToken(token): BriefingRecord | undefined` — only live
  - `renderBriefingHtml(record, opts: { live: boolean }): string`
  - `privateWallHtml(): string` — no company name; `data-testid="briefing-private-wall"`
  - `mintBriefingToken(): string` — `crypto.randomBytes(32).toString("base64url")`

- [ ] **Step 1: Write the failing tests**

Use a temp dir like other JSON stores (`process.env.UPLOADS_DIR` or the same `uploads` override the openers tests use). If briefings share `uploads/`, isolate with `BRIEFINGS_PATH` env in the service:

```ts
it("draft tokens do not resolve as live", () => {
  const draft = createDraftBriefing(sampleOpener());
  expect(getLiveBriefingByToken(draft.token)).toBeUndefined();
  expect(privateWallHtml()).toMatch(/briefing-private-wall/);
  expect(privateWallHtml()).not.toMatch(/North Peak/);
});

it("activate then revoke", () => {
  const draft = createDraftBriefing(sampleOpener());
  const live = activateBriefing(draft.id);
  expect(getLiveBriefingByToken(live.token)?.status).toBe("live");
  revokeBriefingsForOpener(sampleOpener().id);
  expect(getLiveBriefingByToken(live.token)).toBeUndefined();
});

it("live html names the company; wall does not", () => {
  const live = activateBriefing(createDraftBriefing(sampleOpener()).id);
  const html = renderBriefingHtml(live, { live: true });
  expect(html).toMatch(/North Peak/);
  expect(html).toMatch(/Prepared for the directors/);
  expect(html).toMatch(/noindex/);
  expect(html).not.toMatch(/Openers/);
});
```

`sampleOpener`: `normalizeOpener` with `companyName: "North Peak Ltd"`, `dwellCount: 5`, `nonBankChargeCount: 2`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/services/briefings.test.ts`

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

`server/services/briefings.ts`: JSON file `uploads/briefings.json`, `atomicWriteFileSync` like openers.

`createDraftBriefing`:
- `pickBriefingHypothesis` + `dwellLine` + `filingsLine`
- Five slides from `defaultBriefingSlides(bound)` in `shared/briefingRender.ts`:
  1. Cover — companyName + dwellLine
  2. What we can see — filingsLine
  3. Hypothesis — headline + body
  4. How Strata would attack it — mechanism
  5. Next step — reply ask; enquiryUrl `https://www.stratafinance.co.uk/` (contact/apply path used in convert CTAs: `https://www.stratafinance.co.uk/#contact`); veltroUrl filled at activate as `/veltro?b=<token>`
- Cover html uses a placeholder URL `about:blank` until activate, then rewrite to `/briefing/<token>`
- `briefingCopyOk` on concatenated HTML; if fail throw `httpError("Briefing copy failed guard", 400)`

`renderBriefingHtml`: standalone HTML, system fonts, dark sparse layout, `X-Robots-Tag` is a **response header** not only meta — still include `<meta name="robots" content="noindex,nofollow">`. Slides are `<section data-testid="briefing-slide-N">`. Root `data-testid="briefing-pack"` when live.

`privateWallHtml`: short “This note is private.” No company, no token echo.

Wire `onOpenerUnsubscribed` from Task 4 to `revokeBriefingsForOpener`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/services/briefings.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/briefingRender.ts server/services/briefings.ts server/__tests__/services/briefings.test.ts server/services/openers.ts
git commit -m "feat: private briefing store and unlisted token lifecycle"
```

---

### Task 8: Generate, preview, send

**Files:**
- Modify: `server/routes/openers.ts`
- Modify: `server/services/openers.ts` (or keep send in briefings.ts)
- Test: `server/__tests__/routes/openers.test.ts` and/or `server/__tests__/services/briefings.test.ts`

**Interfaces:**
- Consumes: `createDraftBriefing`, `activateBriefing`, `sendEmail`, `mailboxForAgent("director")`, `briefingCopyOk`
- Produces:
  - `POST /api/openers/:id/briefing/generate` — 409 if not `direct_outreach`; returns `{ briefing, cover, previewHtml }`
  - `GET /api/openers/:id/briefing/preview` — staff HTML; draft or live; no tracking pixel
  - `PATCH /api/openers/:id/briefing` — `{ coverSubject?, coverHtml?, slides? }`; re-run `briefingCopyOk`
  - `POST /api/openers/:id/briefing/send` — `sendEmail`; 403 suppressed; 409 if no draft

- [ ] **Step 1: Write the failing tests**

Service-level (easier than full HTTP):

```ts
it("generate refuses non Direct Outreach", async () => {
  await expect(generateOpenerBriefing("warm-id")).rejects.toMatchObject({ status: 409 });
});

it("send is blocked when suppressed", async () => {
  // seed suppression for the opener email; expect sendOpenerBriefing to throw 403
  // and briefing status to remain draft
});

it("send calls sendEmail and activates the token", async () => {
  // mock sendEmail via vi.mock("../email") returning { success: true, id: "mail-1" }
  const sent = await sendOpenerBriefing("hot-id");
  expect(sent.status).toBe("live");
  expect(getLiveBriefingByToken(sent.token)).toBeTruthy();
});
```

Also a source test: routes file matches `/briefing/generate`, `/briefing/preview`, `/briefing/send`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/services/briefings.test.ts`

Expected: FAIL — generateOpenerBriefing missing.

- [ ] **Step 3: Implement**

```ts
export async function generateOpenerBriefing(id: string): Promise<BriefingRecord> {
  const opener = requireOpener(id);
  if (opener.status !== "direct_outreach") throw httpError("Only Direct Outreach cards can generate a briefing", 409);
  const draft = createDraftBriefing(opener);
  saveOpener({ ...opener, briefingId: draft.id, updatedAt: new Date().toISOString() });
  return draft;
}

export async function sendOpenerBriefing(id: string): Promise<BriefingRecord> {
  const opener = requireOpener(id);
  if (isDoNotContactOpener(opener)) throw httpError("Suppressed", 403);
  const draft = opener.briefingId ? getBriefing(opener.briefingId) : undefined;
  if (!draft || draft.status === "revoked") throw httpError("Generate a briefing first", 409);
  const live = activateBriefing(draft.id);
  const mailbox = mailboxForAgent("director");
  const cover = buildCoverEmail({
    companyName: opener.companyName || opener.email,
    briefingUrl: briefingPublicUrl(live.token),
  });
  const result = await sendEmail(
    { agentId: mailbox.agentId, fromName: mailbox.fromName, fromEmail: mailbox.address, touchId: "direct_outreach" },
    opener.email,
    cover.subject,
    cover.html
  );
  if (!result.success) {
    if (result.blocked === "suppressed") throw httpError("Suppressed", 403);
    throw httpError("Send failed", 502);
  }
  return live;
}
```

`briefingPublicUrl(token)`: `process.env.PUBLIC_APP_URL` or request host; in tests `http://localhost/briefing/${token}`.

Preview route returns `renderBriefingHtml(draft, { live: false })` with `Content-Type: text/html`. No dwell script.

Generate/send routes: same `isAuthenticated` + `requireOpenersAccess` as other opener POSTs.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/services/briefings.test.ts server/__tests__/routes/openers.test.ts`

Expected: PASS. Mock `sendEmail` so CI does not hit SMTP.

- [ ] **Step 5: Commit**

```powershell
git add server/routes/openers.ts server/services/openers.ts server/services/briefings.ts server/__tests__/services/briefings.test.ts server/__tests__/routes/openers.test.ts
git commit -m "feat: generate and send Direct Outreach briefings via sendEmail"
```

---

### Task 9: Public pack, dwell tracking, auto-Promote

**Files:**
- Create: `server/routes/briefings.ts`
- Create: `client/src/pages/BriefingPack.tsx` (optional if HTML is fully server-rendered)
- Modify: `server/routes.ts` — `app.use(briefingsRouter)`
- Modify: `client/src/App.tsx` — public `path="/briefing/:token"`
- Modify: `server/auth.ts` — exempt `POST /api/briefing/`
- Test: `server/__tests__/services/briefings.test.ts`, `server/__tests__/security.test.ts`

**Interfaces:**
- Consumes: `getLiveBriefingByToken`, `privateWallHtml`, `shouldRecordMailTracking`, `promoteOpener`, `MAIL_DWELL_MS`
- Produces:
  - `GET /briefing/:token` — 200 pack or 200 wall; header `X-Robots-Tag: noindex, nofollow`
  - `GET /api/briefing/:token/dwell.gif` — records first dwell, then Promote
  - `POST /api/briefing/:token/slide` `{ index }`
  - Staff session / Nexus referer: no dwell, no Promote

- [ ] **Step 1: Write the failing tests**

```ts
it("unknown token is a wall without the company name", () => {
  const html = briefingHtmlForToken("nope");
  expect(html).toMatch(/briefing-private-wall/);
  expect(html).not.toMatch(/North Peak/);
});

it("first dwell promotes; staff session does not", async () => {
  const live = activateBriefing(createDraftBriefing(sampleOpener({ companyNumber: "08765432" })).id);
  const ignored = recordBriefingDwell(live.token, { staffSession: true });
  expect(ignored.recorded).toBe(false);
  const first = await recordBriefingDwellAndPromote(live.token, { staffSession: false });
  expect(first.recorded).toBe(true);
  expect(first.promoted).toBe(true);
  const second = await recordBriefingDwellAndPromote(live.token, { staffSession: false });
  expect(second.promoted).toBe(false);
});
```

Security: POST `/api/briefing/tok/slide` without Origin in production is allowed (exempt). Add to `security.test.ts` like inbound.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/services/briefings.test.ts server/__tests__/security.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement**

`recordBriefingDwell(token, { staffSession, referer })`:
- if `!shouldRecordMailTracking({ staffSession, referer })` return `{ recorded: false }`
- live briefing only
- if `dwellAt` already set, `{ recorded: false, already: true }`
- set `dwellAt`, `openedAt`
- return `{ recorded: true }`

`recordBriefingDwellAndPromote`: if recorded, `promoteOpener(openerId, userId)` inside try/catch; if `canPromoteOpener` is false (no company number), still record dwell, `promoted: false`. Use `resolvePipelineOwnerUserId` when no user.

Public GET `/briefing/:token`: if live, `renderBriefingHtml` plus a 10s `setTimeout` fetch to `/api/briefing/:token/dwell.gif` (img or fetch). If not live, wall.

Mount router **without** `isAuthenticated` for those paths.

`App.tsx` public route can be a passthrough; the Express handler can serve HTML for `/briefing/:token` so React is not required. Prefer Express HTML to avoid auth shell wrapping the pack. If Vite SPA catches the path, add the public route **and** an Express `app.get("/briefing/:token", ...)` registered in `registerRoutes` before the SPA fallback.

CSRF: `path.startsWith("/api/briefing/")` in `isCsrfExemptPath`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/services/briefings.test.ts server/__tests__/security.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add server/routes/briefings.ts server/routes.ts server/auth.ts server/services/briefings.ts client/src/App.tsx server/__tests__/services/briefings.test.ts server/__tests__/security.test.ts
git commit -m "feat: unlisted briefing player and dwell auto-promote"
```

---

### Task 10: Veltro page, interest flag, STOP revoke

**Files:**
- Create: `client/src/pages/Veltro.tsx`
- Modify: `client/src/App.tsx` — public `/veltro`
- Modify: `server/routes/briefings.ts` or `server/routes/veltro.ts` — `POST /api/veltro/interest`
- Modify: `server/auth.ts` — exempt that POST
- Modify: `server/services/openers.ts` — `stopOpenerNurtureByEmail` opt_out → `revokeBriefingsForOpener`
- Test: `server/__tests__/services/briefings.test.ts`, `server/__tests__/routes/openersUi.test.ts`, `server/__tests__/security.test.ts`

**Interfaces:**
- Consumes: live briefing token, `patchOpener` `veltroInterestAt`
- Produces: public Veltro page; concierge POST flags opener; does not Promote; STOP kills the pack

- [ ] **Step 1: Write the failing tests**

```ts
it("Veltro interest flags the opener and does not promote", async () => {
  const openerRow = sampleOpener({ companyNumber: "08765432", status: "direct_outreach" });
  writeOpeners([openerRow]);
  const live = activateBriefing(createDraftBriefing(openerRow).id);
  const result = recordVeltroInterest(live.token);
  expect(result.flagged).toBe(true);
  expect(getOpener(openerRow.id)?.veltroInterestAt).toBeTruthy();
  expect(getOpener(openerRow.id)?.status).toBe("direct_outreach");
});

it("STOP revokes the briefing", () => {
  const openerRow = sampleOpener({ status: "direct_outreach", dwellCount: 5 });
  writeOpeners([openerRow]);
  const live = activateBriefing(createDraftBriefing(openerRow).id);
  stopOpenerNurtureByEmail(openerRow.email, "opt_out");
  expect(getLiveBriefingByToken(live.token)).toBeUndefined();
  expect(getOpener(openerRow.id)?.status).toBe("not_now");
});
```

UI contract:

```ts
const veltro = fs.readFileSync(path.resolve("client/src/pages/Veltro.tsx"), "utf8");
expect(veltro).toMatch(/data-testid="btn-veltro-concierge"/);
expect(veltro.toLowerCase()).toMatch(/email verification/);
expect(veltro.toLowerCase()).toMatch(/lead/);
expect(veltro.toLowerCase()).not.toMatch(/we lend/);
expect(veltro.toLowerCase()).not.toMatch(/ai workforce|ares/);
expect(app).toMatch(/path="\/veltro"/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/services/briefings.test.ts server/__tests__/routes/openersUi.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement**

`recordVeltroInterest(token)`:
- live briefing required, else `{ flagged: false }`
- `patchOpener(openerId, { veltroInterestAt: now })`
- do not call `promoteOpener`

`Veltro.tsx`: public marketing page. Four pillars from fez-crm README: email verification, lead generation, CRM pipeline, business building. Line: this is not a loan; Strata packaging is a separate conversation. Button `data-testid="btn-veltro-concierge"` POSTs `{ token }` from `?b=`. Success: “We’ll be in touch.”

`stopOpenerNurtureByEmail`: on `opt_out`, after save, `revokeBriefingsForOpener(opener.id)`.

CSRF exempt `/api/veltro/interest`.

Do not add Veltro to Strata nav (public URL only).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/openers.test.ts server/__tests__/services/openers.test.ts server/__tests__/services/briefings.test.ts server/__tests__/routes/openers.test.ts server/__tests__/routes/openersUi.test.ts server/__tests__/security.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add client/src/pages/Veltro.tsx client/src/App.tsx server/routes/briefings.ts server/auth.ts server/services/openers.ts server/services/briefings.ts server/__tests__/services/briefings.test.ts server/__tests__/routes/openersUi.test.ts server/__tests__/security.test.ts
git commit -m "feat: Veltro concierge flag and STOP revokes private briefings"
```

---

## Self-review (spec coverage)

| Spec item | Task |
|---|---|
| On-site-only Openers; 0 dwell hidden | 1, 4, 5 |
| Direct Outreach = 5+ dwells; clicks do not qualify | 1, 3 |
| Backfill on hydrate | 3 |
| Unsubscribed graveyard page, not a list | 4, 5 |
| James stops on gate | 2, 3 |
| Drag-back auto-restarts James; dismiss watermark | 2, 4 |
| No drag into Direct Outreach | 1 |
| Generate → review → send | 8, 5 |
| Hypothesis + no invented late payers | 6 |
| Five slides; private unlisted token; wall | 7, 9 |
| Cover from Shaun via enquiries@; `sendEmail` | 8 |
| Auto-Promote on pack dwell / reply; not Veltro | 9, 10 |
| Veltro landing + concierge flag | 10 |
| STOP revokes | 10 |
| CSRF for public POSTs | 9, 10 |
| Rank: dwell then Veltro flag | 1 |
| Open in Craft everyday / fez-crm completion / in-page clicks | out of plan (spec non-goals) |
