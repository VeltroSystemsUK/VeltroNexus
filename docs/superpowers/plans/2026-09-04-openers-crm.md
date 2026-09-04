# Openers CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Sales Openers desk — one card per company that opened Agent Mail — with Companies House identity, a 3-touch nurture, and create-or-jump Promote to the Deck, and strip Jobs off Clients.

**Architecture:** Pure record/nurture/merge logic in `shared/openers.ts`. Thin JSON store `uploads/openers.json` plus service in `server/services/openers.ts`. Express router `server/routes/openers.ts`. `recordOpen` upserts an opener. React status board + side drawer at `/openers`. Activity stays in Agent Mail; CH, WhatsApp, sendEmail, and createProspect are existing providers.

**Tech Stack:** TypeScript, Vitest, Express, React, TanStack Query, wouter, @hello-pangea/dnd, shadcn Sheet. No new npm packages. No new SQLite tables.

**Spec:** `docs/superpowers/specs/2026-09-04-openers-crm-design.md`

## Global Constraints

- One company per card; mail activity is joined from Agent Mail, never copied into the opener JSON
- Every unique company that opened any Agent Mail outbound is in the population — including already-on-Pipeline and inbound
- CH identity only (name, number, status, SIC, directors, trading age, live charges, `nonBankChargeCount`); no Places, Firecrawl, Creditsafe, or nightly CH refresh
- 3-touch: Start nurture → approve email send → 3 days later WhatsApp or call (manual) → stop. Not a duplicate of `sme_1` / `sme_open`
- Promote creates a Deck prospect at `lead` with `referralSource: "Openers"` only when none exists for that company number
- `/openers` is `super_admin` only; nav item **Openers** immediately after Agent Mail
- Status board New / Nurturing / Not now / Promoted; click opens a side drawer
- Remove `AgentJobProgress` from `GodModeCRM.tsx`; Workforce Jobs stay
- Do not call live Companies House, WhatsApp, SMTP, or Telnyx in CI
- Do not change Agent Mail’s Opened folder behaviour
- Windows PowerShell: `git commit -m "message"` (no bash heredocs)

## File map

- Create: `shared/openers.ts` — types, merge, days sitting, nurture reducers, draft copy, drag/promote gates
- Create: `server/__tests__/shared/openers.test.ts`
- Create: `server/services/openers.ts` — JSON store, upsert, hydrate, enrich, nurture send, promote
- Create: `server/__tests__/services/openers.test.ts`
- Create: `server/routes/openers.ts`
- Create: `server/__tests__/routes/openers.test.ts`
- Create: `client/src/pages/Openers.tsx`
- Modify: `server/services/agentMailLog.ts` — call upsert after a real `recordOpen`
- Modify: `server/routes/agentMail.ts` — inbound reply/opt-out stops opener nurture
- Modify: `server/routes.ts` — mount openers router
- Modify: `client/src/App.tsx` — lazy `/openers`
- Modify: `client/src/components/shell/navModel.ts` — Openers destination
- Modify: `client/src/components/Sidebar.tsx` — Openers item after Agent mail
- Modify: `shared/navLocks.ts` — lock `/openers` for `sales_admin`
- Modify: `server/__tests__/shared/navLocks.test.ts`
- Modify: `client/src/pages/GodModeCRM.tsx` — remove Jobs panel
- Create: `server/__tests__/routes/openersUi.test.ts` — source assertions for Jobs removal and board columns

---

### Task 1: Shared opener kernel

**Files:**
- Create: `shared/openers.ts`
- Create: `server/__tests__/shared/openers.test.ts`

**Interfaces:**
- Consumes: `isOpenedOutboundMail`, `lastMailOpenAt` from `@shared/mailTracking`; `countLiveNonBankCharges` from `@shared/chargeClassifier` (used in Task 3; import is allowed here if snapshot mapping lives in shared)
- Produces:
  - `OPENER_STATUSES`, `OPENER_TOUCH2_DELAY_MS` (`3 * 24 * 60 * 60 * 1000`)
  - `OpenerStatus`, `OpenerNurture`, `OpenerRecord`, `OpenerMailLike`
  - `normalizeEmail(value?: string | null): string`
  - `normalizeCompanyNumber(value?: string | null): string`
  - `emptyNurture(): OpenerNurture`
  - `normalizeOpener(input: Partial<OpenerRecord> & Pick<OpenerRecord, "id" | "email">): OpenerRecord`
  - `daysSittingMs(opener: Pick<OpenerRecord, "lastTouchAt" | "lastOpenedAt">, now?: Date): number`
  - `daysSitting(opener: Pick<OpenerRecord, "lastTouchAt" | "lastOpenedAt">, now?: Date): number` — whole days, floor
  - `mergeOpeners(keeper: OpenerRecord, incoming: OpenerRecord): OpenerRecord`
  - `applyOpenEvent(opener: OpenerRecord, at: string, extraOpens?: number): OpenerRecord`
  - `openerNurtureDraft(opener: OpenerRecord): { subject: string; html: string }`
  - `startNurture(opener: OpenerRecord, draft: { subject: string; html: string }, now?: Date): OpenerRecord`
  - `approveNurtureSend(opener: OpenerRecord, mailId: string, now?: Date): OpenerRecord`
  - `failNurtureSend(opener: OpenerRecord): OpenerRecord`
  - `skipNurtureStep(opener: OpenerRecord, now?: Date): OpenerRecord`
  - `stopNurture(opener: OpenerRecord, reason: NonNullable<OpenerNurture["stopReason"]>, now?: Date): OpenerRecord`
  - `completeTouch2(opener: OpenerRecord, channel: "whatsapp" | "call", now?: Date): OpenerRecord`
  - `isTouch2Due(opener: OpenerRecord, now?: Date): boolean`
  - `canPromoteOpener(opener: Pick<OpenerRecord, "companyNumber">): boolean`
  - `canDragOpenerTo(opener: OpenerRecord, column: OpenerStatus): boolean`
  - `openedMailEvents(items: OpenerMailLike[]): Array<{ email: string; at: string; openCount: number; subject?: string; dealId?: number; prospectId?: number; mailId: string }>`
  - `withDerivedNurture(opener: OpenerRecord, now?: Date): OpenerRecord` — if touch1 sent, touch2 idle, and delay elapsed, view `touch2Status` as `"due"` (do not persist `"due"`)

`OpenerRecord` fields must match the spec: `id`, `email`, `emails`, `companyNumber?`, `companyName?`, `dealId?`, `prospectId?`, `phone?`, CH snapshot fields, `status`, `notes`, `firstOpenedAt`, `lastOpenedAt`, `openCount`, `lastTouchAt?`, `createdAt`, `updatedAt`, `nurture`.

Stored `nurture.touch2Status` is `"idle" | "done" | "skipped"` only. `"due"` is derived.

Touch 1 copy must include `We do not lend.` and must not reuse `sme_1` / `sme_open` templates.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/shared/openers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  OPENER_TOUCH2_DELAY_MS,
  applyOpenEvent,
  approveNurtureSend,
  canDragOpenerTo,
  canPromoteOpener,
  completeTouch2,
  daysSitting,
  emptyNurture,
  failNurtureSend,
  isTouch2Due,
  mergeOpeners,
  normalizeCompanyNumber,
  normalizeEmail,
  normalizeOpener,
  openedMailEvents,
  openerNurtureDraft,
  skipNurtureStep,
  startNurture,
  stopNurture,
  withDerivedNurture,
  type OpenerRecord,
} from "@shared/openers";

function opener(over: Partial<OpenerRecord> = {}): OpenerRecord {
  return normalizeOpener({
    id: "op-1",
    email: "ops@northpeak.co.uk",
    firstOpenedAt: "2026-09-01T10:00:00.000Z",
    lastOpenedAt: "2026-09-01T10:00:00.000Z",
    openCount: 1,
    ...over,
  });
}

describe("identity", () => {
  it("normalises email and company numbers", () => {
    expect(normalizeEmail("  Ops@NorthPeak.co.uk ")).toBe("ops@northpeak.co.uk");
    expect(normalizeCompanyNumber("8765432")).toBe("08765432");
    expect(normalizeCompanyNumber("SC123456")).toBe("SC123456");
  });
});

describe("days sitting", () => {
  it("uses lastTouchAt when set, otherwise lastOpenedAt", () => {
    const now = new Date("2026-09-10T10:00:00.000Z");
    expect(daysSitting(opener(), now)).toBe(9);
    expect(daysSitting(opener({ lastTouchAt: "2026-09-08T10:00:00.000Z" }), now)).toBe(2);
  });
});

describe("opens and merge", () => {
  it("bumps lastOpenedAt and openCount on a later open", () => {
    const next = applyOpenEvent(opener(), "2026-09-03T12:00:00.000Z", 2);
    expect(next.firstOpenedAt).toBe("2026-09-01T10:00:00.000Z");
    expect(next.lastOpenedAt).toBe("2026-09-03T12:00:00.000Z");
    expect(next.openCount).toBe(3);
  });

  it("merges two emails with the same company number into one card", () => {
    const a = opener({ email: "ops@northpeak.co.uk", companyNumber: "08765432", openCount: 2 });
    const b = opener({
      id: "op-2",
      email: "james@northpeak.co.uk",
      companyNumber: "08765432",
      firstOpenedAt: "2026-08-20T10:00:00.000Z",
      openCount: 3,
      prospectId: 99,
      status: "promoted",
    });
    const merged = mergeOpeners(a, b);
    expect(merged.firstOpenedAt).toBe("2026-08-20T10:00:00.000Z");
    expect(merged.openCount).toBe(5);
    expect(merged.emails.sort()).toEqual(["james@northpeak.co.uk", "ops@northpeak.co.uk"]);
    expect(merged.prospectId).toBe(99);
    expect(merged.status).toBe("promoted");
  });
});

describe("nurture", () => {
  it("start only writes a pending draft; approve send is what sets nurturing", () => {
    const draft = openerNurtureDraft(opener({ companyName: "Northpeak Joinery Ltd" }));
    expect(draft.html).toMatch(/We do not lend/i);
    const pending = startNurture(opener(), draft, new Date("2026-09-04T10:00:00.000Z"));
    expect(pending.status).toBe("new");
    expect(pending.nurture.touch1Status).toBe("pending_approval");
    expect(pending.nurture.touch1Draft?.subject).toBe(draft.subject);

    const sent = approveNurtureSend(pending, "mail-1", new Date("2026-09-04T10:05:00.000Z"));
    expect(sent.status).toBe("nurturing");
    expect(sent.nurture.step).toBe(1);
    expect(sent.nurture.touch1MailId).toBe("mail-1");
    expect(sent.lastTouchAt).toBe("2026-09-04T10:05:00.000Z");

    const again = approveNurtureSend(sent, "mail-2", new Date("2026-09-04T11:00:00.000Z"));
    expect(again.nurture.touch1MailId).toBe("mail-1");
  });

  it("failed send does not become nurturing; retry is allowed", () => {
    const pending = startNurture(opener(), openerNurtureDraft(opener()));
    const failed = failNurtureSend(pending);
    expect(failed.status).toBe("new");
    expect(failed.nurture.touch1Status).toBe("failed");
  });

  it("touch 2 is due 3 days after touch 1 send", () => {
    const sent = approveNurtureSend(
      startNurture(opener(), openerNurtureDraft(opener()), new Date("2026-09-04T10:00:00.000Z")),
      "mail-1",
      new Date("2026-09-04T10:00:00.000Z")
    );
    expect(isTouch2Due(sent, new Date("2026-09-06T10:00:00.000Z"))).toBe(false);
    expect(isTouch2Due(sent, new Date("2026-09-07T10:00:00.000Z"))).toBe(true);
    expect(OPENER_TOUCH2_DELAY_MS).toBe(3 * 24 * 60 * 60 * 1000);
    expect(withDerivedNurture(sent, new Date("2026-09-07T10:00:00.000Z")).nurture.touch2Status).toBe("due");
    expect(sent.nurture.touch2Status).toBe("idle");
  });

  it("completing touch 2 stops the sequence", () => {
    const sent = approveNurtureSend(
      startNurture(opener(), openerNurtureDraft(opener())),
      "mail-1",
      new Date("2026-09-04T10:00:00.000Z")
    );
    const done = completeTouch2(sent, "whatsapp", new Date("2026-09-07T10:00:00.000Z"));
    expect(done.nurture.step).toBe(3);
    expect(done.nurture.touch2Status).toBe("done");
    expect(done.nurture.stopReason).toBe("completed");
    expect(done.status).toBe("nurturing");
  });

  it("reply, opt-out, and promote stop nurture", () => {
    const sent = approveNurtureSend(startNurture(opener(), openerNurtureDraft(opener())), "mail-1");
    expect(stopNurture(sent, "reply").nurture.stopReason).toBe("reply");
    expect(stopNurture(sent, "opt_out").nurture.step).toBe(3);
    expect(stopNurture(sent, "promoted").status).not.toBe("promoted");
  });

  it("skip on pending approval skips touch 1 and starts the 3-day clock", () => {
    const skipped = skipNurtureStep(
      startNurture(opener(), openerNurtureDraft(opener()), new Date("2026-09-04T10:00:00.000Z")),
      new Date("2026-09-04T10:00:00.000Z")
    );
    expect(skipped.nurture.touch1Status).toBe("skipped");
    expect(isTouch2Due(skipped, new Date("2026-09-07T10:00:00.000Z"))).toBe(true);
  });
});

describe("gates", () => {
  it("promote requires a company number", () => {
    expect(canPromoteOpener(opener())).toBe(false);
    expect(canPromoteOpener(opener({ companyNumber: "08765432" }))).toBe(true);
  });

  it("drag rules match the spec", () => {
    const fresh = opener();
    expect(canDragOpenerTo(fresh, "new")).toBe(true);
    expect(canDragOpenerTo(fresh, "nurturing")).toBe(false);
    expect(canDragOpenerTo(fresh, "not_now")).toBe(true);
    expect(canDragOpenerTo(fresh, "promoted")).toBe(false);

    const sent = approveNurtureSend(startNurture(fresh, openerNurtureDraft(fresh)), "mail-1");
    expect(canDragOpenerTo(sent, "new")).toBe(false);
    expect(canDragOpenerTo(sent, "nurturing")).toBe(true);
    expect(canDragOpenerTo(sent, "promoted")).toBe(false);
    expect(canDragOpenerTo({ ...sent, companyNumber: "08765432" }, "promoted")).toBe(true);
  });
});

describe("hydrate events", () => {
  it("emits one event per opened outbound, keyed by recipient", () => {
    const events = openedMailEvents([
      {
        id: "m1",
        direction: "outbound",
        to: "ops@northpeak.co.uk",
        subject: "Debt service",
        opens: ["2026-09-01T10:00:00.000Z", "2026-09-01T11:00:00.000Z"],
        dealId: 7,
      },
      { id: "m2", direction: "inbound", from: "ops@northpeak.co.uk", opens: ["x"] },
      { id: "m3", direction: "outbound", to: "ops@northpeak.co.uk", opens: [] },
    ]);
    expect(events).toEqual([
      {
        email: "ops@northpeak.co.uk",
        at: "2026-09-01T11:00:00.000Z",
        openCount: 2,
        subject: "Debt service",
        dealId: 7,
        prospectId: undefined,
        mailId: "m1",
      },
    ]);
  });
});

describe("empty nurture", () => {
  it("starts idle", () => {
    expect(emptyNurture()).toEqual({
      step: 0,
      touch1Status: "idle",
      touch2Status: "idle",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/openers.test.ts`

Expected: FAIL — cannot find `@shared/openers`

- [ ] **Step 3: Write minimal implementation**

Create `shared/openers.ts` implementing every export above.

Rules that must hold:

- `normalizeCompanyNumber`: trim, uppercase, strip spaces; if the remainder is all digits, pad to 8 with leading zeros
- `mergeOpeners`: earlier `firstOpenedAt`, later `lastOpenedAt`, sum `openCount`, union `emails` (unique, sorted later is fine), keep `promoted` / `prospectId` / CH snapshot / `phone` if either side has them, `status` prefers `promoted` then `nurturing` then `not_now` then `new`
- `approveNurtureSend`: if `touch1MailId` already set, return opener unchanged
- `stopNurture` sets `step = 3` and `stoppedAt`; does not by itself set `status` to `promoted`
- `canDragOpenerTo("promoted")` is true when `canPromoteOpener` is true (drawer/drag still calls the promote API)
- `canDragOpenerTo("nurturing")` true only when `nurture.step >= 1` and `stopReason` is not `"promoted"`
- `canDragOpenerTo("new")` true only when `nurture.step === 0`
- `openerNurtureDraft` subject like `Following up — {companyName or email}`; HTML includes `We do not lend.`
- `skipNurtureStep` on `pending_approval` or `failed`: `touch1Status = skipped`, `touch1At = now`, `step = 1` so the 3-day clock starts
- `openedMailEvents` uses `isOpenedOutboundMail` and `lastMailOpenAt`; `email` is `to`; `openCount` is `opens.length`

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/openers.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/openers.ts server/__tests__/shared/openers.test.ts
git commit -m "feat: add Openers record kernel"
```

---

### Task 2: JSON store, upsert, hydrate

**Files:**
- Create: `server/services/openers.ts` (store + upsert only in this task; enrich/promote added later in the same file)
- Create: `server/__tests__/services/openers.test.ts`
- Modify: `server/services/agentMailLog.ts` — after a successful `recordOpen` that appended an open, call `upsertOpenerFromMail(item)` inside a try/catch so a store failure never breaks the pixel

**Interfaces:**
- Consumes: Task 1 functions; `AgentMailItem` from `server/services/agentMailLog.ts`; `isOpenedOutboundMail` / `lastMailOpenAt`
- Produces:
  - `OPENERS_STORE` default `path.resolve(process.cwd(), "uploads", "openers.json")`
  - `setOpenersStorePathForTests(filePath: string | null): void`
  - `readOpeners(): OpenerRecord[]`
  - `writeOpeners(items: OpenerRecord[]): void`
  - `getOpener(id: string): OpenerRecord | undefined`
  - `patchOpener(id: string, updates: Partial<OpenerRecord>): OpenerRecord | undefined`
  - `type OpenerResolveHit = { companyNumber?: string; companyName?: string; dealId?: number; prospectId?: number; phone?: string }`
  - `type OpenerResolver = (email: string, mail: AgentMailItem) => OpenerResolveHit | Promise<OpenerResolveHit>`
  - `upsertOpenerFromMail(mail: AgentMailItem, resolve?: OpenerResolver): OpenerRecord | undefined`
  - `hydrateFromAgentMail(items: AgentMailItem[], resolve?: OpenerResolver): OpenerRecord[]`
  - `listOpeners(): OpenerRecord[]`

`upsertOpenerFromMail` returns `undefined` when `mail.direction !== "outbound"` or there is no `to` email. It does not check `shouldRecordMailTracking` (the route already did). If `opens` is empty, return undefined.

Find existing by normalised email in `emails`/`email`, else by resolved `companyNumber`. Create with `crypto.randomUUID()`. If a company-number match is a different id than the email match, `mergeOpeners` and delete the duplicate.

Do not run CH enrich in this task.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/services/openers.test.ts` using `os.tmpdir()` + a unique filename. `afterEach` unlink and `setOpenersStorePathForTests(null)`.

```ts
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentMailItem } from "../../services/agentMailLog";
import {
  hydrateFromAgentMail,
  setOpenersStorePathForTests,
  upsertOpenerFromMail,
} from "../../services/openers";

function tmpStore(): string {
  const file = path.join(os.tmpdir(), `openers-${process.pid}-${Date.now()}.json`);
  setOpenersStorePathForTests(file);
  return file;
}

afterEach(() => {
  setOpenersStorePathForTests(null);
});

function mail(over: Partial<AgentMailItem> = {}): AgentMailItem {
  return {
    id: "mail-1",
    direction: "outbound",
    from: "james@stratanexus.co.uk",
    to: "ops@northpeak.co.uk",
    subject: "Debt service",
    text: "hi",
    status: "sent",
    createdAt: "2026-09-01T09:00:00.000Z",
    opens: ["2026-09-01T10:00:00.000Z"],
    ...over,
  };
}

describe("upsertOpenerFromMail", () => {
  it("creates a new card on the first open", () => {
    tmpStore();
    const row = upsertOpenerFromMail(mail());
    expect(row?.email).toBe("ops@northpeak.co.uk");
    expect(row?.status).toBe("new");
    expect(row?.openCount).toBe(1);
    expect(row?.companyNumber).toBeUndefined();
  });

  it("bumps the same email instead of duplicating", () => {
    tmpStore();
    upsertOpenerFromMail(mail());
    const row = upsertOpenerFromMail(
      mail({ opens: ["2026-09-01T10:00:00.000Z", "2026-09-03T10:00:00.000Z"] })
    );
    expect(row?.openCount).toBe(2);
    expect(hydrateFromAgentMail([]).length).toBe(1);
  });

  it("merges two emails once the resolver returns the same company number", () => {
    tmpStore();
    upsertOpenerFromMail(mail());
    upsertOpenerFromMail(mail({ id: "mail-2", to: "james@northpeak.co.uk", opens: ["2026-09-02T10:00:00.000Z"] }));
    const resolve = (email: string) => ({ companyNumber: "08765432", companyName: "Northpeak Joinery Ltd" });
    upsertOpenerFromMail(mail({ opens: ["2026-09-01T10:00:00.000Z", "2026-09-04T10:00:00.000Z"] }), resolve);
    upsertOpenerFromMail(
      mail({ id: "mail-2", to: "james@northpeak.co.uk", opens: ["2026-09-02T10:00:00.000Z"] }),
      resolve
    );
    const all = hydrateFromAgentMail([]);
    expect(all.length).toBe(1);
    expect(all[0].companyNumber).toBe("08765432");
    expect(all[0].emails.sort()).toEqual(["james@northpeak.co.uk", "ops@northpeak.co.uk"]);
  });

  it("ignores inbound and unopened outbound", () => {
    tmpStore();
    expect(upsertOpenerFromMail(mail({ direction: "inbound", from: "ops@northpeak.co.uk", opens: undefined }))).toBeUndefined();
    expect(upsertOpenerFromMail(mail({ opens: [] }))).toBeUndefined();
  });
});

describe("hydrateFromAgentMail", () => {
  it("backfills unique companies from existing opened outbound", () => {
    tmpStore();
    const rows = hydrateFromAgentMail([
      mail(),
      mail({ id: "mail-2", to: "ops@northpeak.co.uk", opens: ["2026-09-03T10:00:00.000Z"] }),
      mail({ id: "mail-3", to: "other@hale.co.uk", opens: ["2026-09-02T10:00:00.000Z"] }),
    ]);
    expect(rows.length).toBe(2);
  });
});
```

Fix the bump test: first mail has 1 open so `openCount` 1; second call with 2 timestamps should set count from the event (`opens.length` of this mail) added to existing, **or** treat each `recordOpen` as +1.

Spec: `openCount` is pixel hits across merged mail. `recordOpen` appends one timestamp then upserts. The upsert should add **one** for this call (the newest open), not replace with `opens.length`.

Change `applyOpenEvent` usage in the store: always `extraOpens = 1` per `upsertOpenerFromMail` call. For hydrate, use each mail’s `opens.length` once per mail id.

Track applied mail ids on the opener as `mailIds?: string[]` **or** recompute `openCount` on hydrate as the sum of `opens.length` for matching emails.

Simplest spec-faithful approach:

- Persist `mailIds: string[]` on the opener (additive field; allowed)
- On upsert, if `mail.id` is new, add `opens.length`; if already seen, set openCount contribution for that mail to current `opens.length` (recompute from stored per-mail counts)

Even simpler for v1: **recompute on hydrate** from the mail log; upsert only creates/merges identity and bumps `lastOpenedAt`. `openCount` on GET is derived from joined mail.

The spec stored `openCount` on the record. Keep it stored:

- `upsertOpenerFromMail`: `applyOpenEvent(opener, lastOpenAt, 1)` on each call from `recordOpen` (one new pixel)
- `hydrateFromAgentMail`: for each opened mail not yet in `mailIds`, `applyOpenEvent(..., opens.length)` and push the mail id

Add `mailIds?: string[]` to `OpenerRecord` in Task 1 if not already there. If Task 1 already shipped without it, add it in this task and extend the kernel test.

If Task 1 `applyOpenEvent` third arg is extra opens, hydrate passes `opens.length` only when the mail id is new.

Update the bump test: two upserts of the same mail with growing `opens` — first creates count 1; second sees mail id already present and **sets lastOpenedAt** but does **not** add a second full `opens.length`. Pixel path calls upsert once per new open (count +1).

Adjust the test:

```ts
it("bumps the same email instead of duplicating", () => {
  tmpStore();
  upsertOpenerFromMail(mail());
  const row = upsertOpenerFromMail(mail({ opens: ["2026-09-01T10:00:00.000Z", "2026-09-03T10:00:00.000Z"] }));
  expect(row?.openCount).toBe(2); // second call is the second pixel (+1)
  expect(hydrateFromAgentMail([]).length).toBe(1);
});
```

Store implementation: if `mailIds` includes `mail.id`, still `applyOpenEvent(opener, lastOpen, 1)` because `recordOpen` just appended one pixel. Hydrate must not double-count: if mail id already recorded, skip.

Hydrate of two mails to the same email: first mail 2 opens + second mail 1 open = 3 if both new.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/openers.test.ts`

Expected: FAIL — `setOpenersStorePathForTests` not exported

- [ ] **Step 3: Write minimal implementation**

Implement store read/write (mkdir `uploads` as Agent Mail does). Wire `recordOpen` in `agentMailLog.ts`:

```ts
import { upsertOpenerFromMail } from "./openers";
// at end of recordOpen, after writeAll:
try {
  upsertOpenerFromMail(item);
} catch (error: any) {
  console.warn("[Openers] upsert after open failed:", error?.message || error);
}
```

Avoid a circular import: `openers.ts` must not import `recordOpen` from `agentMailLog.ts`. It may import the `AgentMailItem` **type** only. If a cycle appears, move `AgentMailItem` type usage to a structural type in `openers.ts` (`OpenerMailItem`) and do not import the service module from the store.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/openers.test.ts server/__tests__/services/openers.test.ts server/__tests__/shared/mailTracking.test.ts`

Expected: PASS (mail tracking still works; pixel path still writes opens)

- [ ] **Step 5: Commit**

```powershell
git add server/services/openers.ts server/__tests__/services/openers.test.ts server/services/agentMailLog.ts shared/openers.ts server/__tests__/shared/openers.test.ts
git commit -m "feat: persist Openers from Agent Mail opens"
```

---

### Task 3: Companies House identity + attach number

**Files:**
- Modify: `server/services/openers.ts`
- Modify: `server/__tests__/services/openers.test.ts`

**Interfaces:**
- Consumes: `companiesHouseClient.getCompanyProfile`, `getCompanyOfficers`, `getCompanyCharges`; `countLiveNonBankCharges`, `isLiveCharge` from `@shared/chargeClassifier`
- Produces:
  - `type OpenerChClient = { getCompanyProfile(n: string): Promise<any>; getCompanyOfficers(n: string): Promise<any>; getCompanyCharges(n: string): Promise<any> }`
  - `snapshotFromCompaniesHouse(profile: any, officers: any, charges: any): Partial<OpenerRecord>`
  - `enrichOpener(id: string, client?: OpenerChClient): Promise<OpenerRecord>`
  - `attachCompanyNumber(id: string, companyNumber: string, client?: OpenerChClient): Promise<OpenerRecord>`

`enrichOpener` no-ops (returns current) if no `companyNumber`. On success set `enrichedAt`, clear `enrichError`. On throw/null profile set `enrichError` and leave other fields. Never throw to the pixel path.

`attachCompanyNumber` sets the number, merges duplicates, then `enrichOpener`.

Default client is `companiesHouseClient`. Tests pass a fake.

Map:

- profile: `company_name` → `companyName`, `company_status` → `companyStatus`, `sic_codes` → `sicCodes`, `date_of_creation` → `dateOfCreation`, address snippet from `registered_office_address`
- officers: current (`resigned_on` missing) `{ name, role: officer_role }`
- charges: `items` where `isLiveCharge(status)` → `liveCharges[{ chargee: persons_entitled[0].name, status, createdOn: delivered_on || created_on }]`; `nonBankChargeCount = countLiveNonBankCharges(items mapped to { status, personsEntitled: names })`

- [ ] **Step 1: Write the failing test**

Append to `server/__tests__/services/openers.test.ts`:

```ts
import { attachCompanyNumber, enrichOpener, upsertOpenerFromMail } from "../../services/openers";

const fakeCh: OpenerChClient = {
  async getCompanyProfile() {
    return {
      company_name: "NORTHPEAK JOINERY LTD",
      company_status: "active",
      sic_codes: ["16230"],
      date_of_creation: "2018-04-01",
      registered_office_address: { address_line_1: "1 Mill Lane", locality: "Leeds", postal_code: "LS1 1AA" },
    };
  },
  async getCompanyOfficers() {
    return { items: [{ name: "PEAK, Nora", officer_role: "director" }, { name: "GONE, Ian", officer_role: "director", resigned_on: "2020-01-01" }] };
  },
  async getCompanyCharges() {
    return {
      items: [
        { status: "outstanding", delivered_on: "2026-01-01", persons_entitled: [{ name: "HIVE INVOICE FINANCE LTD" }] },
        { status: "satisfied", persons_entitled: [{ name: "HSBC UK BANK PLC" }] },
      ],
    };
  },
};

it("enriches CH identity once a number is attached", async () => {
  tmpStore();
  const created = upsertOpenerFromMail(mail())!;
  const attached = await attachCompanyNumber(created.id, "8765432", fakeCh);
  expect(attached.companyNumber).toBe("08765432");
  expect(attached.companyName).toBe("NORTHPEAK JOINERY LTD");
  expect(attached.directors.map((d) => d.name)).toEqual(["PEAK, Nora"]);
  expect(attached.nonBankChargeCount).toBe(1);
  expect(attached.enrichedAt).toBeTruthy();
  expect(attached.enrichError).toBeUndefined();
});

it("stores enrichError when CH fails and keeps the card", async () => {
  tmpStore();
  const created = upsertOpenerFromMail(mail())!;
  await attachCompanyNumber(created.id, "08765432", {
    async getCompanyProfile() { throw new Error("CH down"); },
    async getCompanyOfficers() { return { items: [] }; },
    async getCompanyCharges() { return { items: [] }; },
  });
  const row = await enrichOpener(created.id, {
    async getCompanyProfile() { throw new Error("CH down"); },
    async getCompanyOfficers() { return { items: [] }; },
    async getCompanyCharges() { return { items: [] }; },
  });
  expect(row.email).toBe("ops@northpeak.co.uk");
  expect(row.enrichError).toMatch(/CH down/);
});
```

Import `OpenerChClient` type in the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/openers.test.ts`

Expected: FAIL — `attachCompanyNumber` not exported

- [ ] **Step 3: Write minimal implementation**

Use `getCompanyOfficers` if it exists on `companiesHouseClient`; if the client has no officers method, add a thin `getCompanyOfficers` next to `getCompanyCharges` in `server/utils/companiesHouseClient.ts` (`/company/${number}/officers`). Tests inject a fake so CI never hits the network.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/services/openers.test.ts server/__tests__/shared/chargeClassifier.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add server/services/openers.ts server/__tests__/services/openers.test.ts server/utils/companiesHouseClient.ts
git commit -m "feat: enrich Openers from Companies House"
```

---

### Task 4: Nurture send + promote

**Files:**
- Modify: `server/services/openers.ts`
- Modify: `server/__tests__/services/openers.test.ts`

**Interfaces:**
- Consumes: `sendEmail` from `server/services/email.ts`; `wasEmailDelivered` from `@shared/outreachSend`; `storage.getCompanyByNumber`, `createCompany`, `listProspects`, `createProspect`, `createContact`; `resolvePipelineOwnerUserId` from `server/services/inboundPipeline.ts`; `whatsappService.sendMessage`
- Produces:
  - `runNurtureAction(id: string, action: "start" | "approve" | "skip" | "stop" | "touch2", opts?: { channel?: "whatsapp" | "call"; now?: Date; send?: typeof sendEmail }): Promise<OpenerRecord>`
  - `promoteOpener(id: string, userId: string, deps?: PromoteDeps): Promise<{ opener: OpenerRecord; prospectId: number; created: boolean }>`
  - `sendOpenerWhatsApp(id: string, message: string, send?: (phone: string, body: string) => Promise<string>): Promise<OpenerRecord>`
  - `logOpenerCall(id: string, note: string, now?: Date): Promise<OpenerRecord>`
  - `completeTouch2IfDue(opener: OpenerRecord, channel: "whatsapp" | "call", now?: Date): OpenerRecord` — if `isTouch2Due` or `nurture.step === 1`, call `completeTouch2`; always set `lastTouchAt`
  - `stopOpenerNurtureByEmail(email: string, reason: "reply" | "opt_out"): OpenerRecord | undefined`

`PromoteDeps` is an injectable subset of storage so tests never touch SQLite:

```ts
export type PromoteDeps = {
  getCompanyByNumber(n: string): Promise<{ id: number; companyNumber: string } | undefined>;
  createCompany(data: any): Promise<{ id: number }>;
  listProspects(userId: string): Promise<Array<{ id: number; companyId: number }>>;
  createProspect(data: any, userId: string): Promise<{ id: number }>;
  createContact(data: any, userId: string): Promise<any>;
};
```

Promote algorithm (spec):

1. Load opener; if `!canPromoteOpener` throw `Object.assign(new Error("Company number required"), { status: 400 })`
2. `getCompanyByNumber`; else `createCompany` from snapshot
3. `listProspects(userId)` find `companyId`; if hit: `stopNurture(..., "promoted")`, `status = promoted`, `prospectId`, return `{ created: false }`
4. Else `createProspect` `{ companyId, stage: "lead", referralSource: "Openers", notes: "Opened Agent Mail. Last open: {lastOpenedAt}. Email: {email}", directorsGuarantee: 0, ...same zero collateral flags as inboundPipeline, queueOrder: 0 }`
5. `createContact` if email/phone/director name
6. Persist promoted opener, return `{ created: true }`

`runNurtureAction("start")` uses `openerNurtureDraft`. `"approve"` calls `send` (default `sendEmail`) with `touchId: "opener_1"`, `agentId: "outreach-sales"`. If `!wasEmailDelivered` including `{ mock: true, success: false }`, `failNurtureSend`. Tests inject `send` that returns `{ success: true, mock: false }`.

`sendOpenerWhatsApp` 400-throws if no `phone`. On success `completeTouch2IfDue(..., "whatsapp")`.

`logOpenerCall` appends the note to `notes` (prefix a timestamped line) and `completeTouch2IfDue(..., "call")`.

- [ ] **Step 1: Write the failing test**

Append tests:

```ts
it("approve send marks nurturing only when delivered", async () => {
  tmpStore();
  const created = upsertOpenerFromMail(mail())!;
  await runNurtureAction(created.id, "start");
  const failed = await runNurtureAction(created.id, "approve", {
    send: async () => ({ success: false, mock: true }),
  });
  expect(failed.status).toBe("new");
  const sent = await runNurtureAction(created.id, "approve", {
    send: async () => ({ success: true }),
  });
  expect(sent.status).toBe("nurturing");
  expect(sent.nurture.touch1MailId).toBeTruthy();
});

it("promote creates once and jumps the second time", async () => {
  tmpStore();
  const created = upsertOpenerFromMail(mail())!;
  await attachCompanyNumber(created.id, "08765432", fakeCh);
  const companies = new Map<string, { id: number; companyNumber: string }>();
  const prospects: Array<{ id: number; companyId: number }> = [];
  const deps: PromoteDeps = {
    async getCompanyByNumber(n) { return companies.get(n); },
    async createCompany(data) {
      const row = { id: 1, companyNumber: data.companyNumber };
      companies.set(data.companyNumber, row);
      return row;
    },
    async listProspects() { return prospects; },
    async createProspect() {
      const row = { id: 55, companyId: 1 };
      prospects.push(row);
      return row;
    },
    async createContact() { return {}; },
  };
  const first = await promoteOpener(created.id, "user-1", deps);
  expect(first.created).toBe(true);
  expect(first.prospectId).toBe(55);
  expect(first.opener.status).toBe("promoted");
  const second = await promoteOpener(created.id, "user-1", deps);
  expect(second.created).toBe(false);
  expect(second.prospectId).toBe(55);
  expect(prospects.length).toBe(1);
});

it("promote without a company number is 400", async () => {
  tmpStore();
  const created = upsertOpenerFromMail(mail())!;
  await expect(promoteOpener(created.id, "user-1", {
    async getCompanyByNumber() { return undefined; },
    async createCompany() { return { id: 1 }; },
    async listProspects() { return []; },
    async createProspect() { return { id: 1 }; },
    async createContact() { return {}; },
  })).rejects.toMatchObject({ status: 400 });
});

it("whatsapp without phone is 400", async () => {
  tmpStore();
  const created = upsertOpenerFromMail(mail())!;
  await expect(sendOpenerWhatsApp(created.id, "hi", async () => "ok")).rejects.toMatchObject({ status: 400 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/openers.test.ts`

Expected: FAIL — `runNurtureAction` / `promoteOpener` not exported

- [ ] **Step 3: Write minimal implementation**

Default `promoteOpener` deps wrap `storage` + `resolvePipelineOwnerUserId` when `userId` is missing. Do not call `promoteInternalLeadToPipeline`.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/services/openers.test.ts server/__tests__/services/inboundPipeline.test.ts`

Expected: PASS (inbound promote helper unchanged)

- [ ] **Step 5: Commit**

```powershell
git add server/services/openers.ts server/__tests__/services/openers.test.ts
git commit -m "feat: Openers nurture and promote to pipeline"
```

---

### Task 5: HTTP routes and mail hooks

**Files:**
- Create: `server/routes/openers.ts`
- Create: `server/__tests__/routes/openers.test.ts`
- Modify: `server/routes.ts` — `import openersRouter from "./routes/openers"; app.use(openersRouter);` next to `app.use(agentMailRouter)`
- Modify: `server/routes/agentMail.ts` — after `recordInbound`, if body matches opt-out regex used there, `stopOpenerNurtureByEmail(fromEmail, "opt_out")` else `stopOpenerNurtureByEmail(fromEmail, "reply")` for inbound from a known opener (only when a matching opener exists; ignore errors)

**Interfaces:**
- Consumes: Task 2–4 service functions; `isAuthenticated`; `handleApiError`; `listAgentMail`
- Produces: Express router with:

| Method | Path |
|---|---|
| GET | `/api/openers` |
| GET | `/api/openers/:id` |
| PATCH | `/api/openers/:id` |
| POST | `/api/openers/:id/enrich` |
| POST | `/api/openers/:id/nurture` |
| POST | `/api/openers/:id/promote` |
| POST | `/api/openers/:id/whatsapp` |
| POST | `/api/openers/:id/call` |

Every route: `isAuthenticated` then `if ((req.user as any)?.role !== "super_admin") return res.status(403).json({ error: "Forbidden" })`.

GET `/api/openers`: `hydrateFromAgentMail(listAgentMail(2000))` then map `withDerivedNurture`. Join timeline summary from `listAgentMail(2000)` filtered to that email: `{ mailId, subject, lastOpenAt, openCount, clicks }`. `onPipeline: Boolean(prospectId)`.

PATCH body may include `status`, `notes`, `companyNumber`. If `status` is `promoted`, do not patch — return 400 telling the client to POST promote. If `status` set, enforce `canDragOpenerTo`. If `companyNumber` present, `attachCompanyNumber`.

Nurture body `{ action, channel? }`. Promote uses `req.user.id`. WhatsApp body `{ message }`. Call body `{ note }`.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/routes/openers.test.ts` inspecting the router stack (same pattern as `workforceJobs.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import openersRouter from "../../routes/openers";

describe("openers routes", () => {
  it("registers board, drawer, enrich, nurture, promote, whatsapp, and call", () => {
    const paths = openersRouter.stack
      .filter((layer) => Boolean(layer.route))
      .map((layer) => ({
        path: layer.route!.path,
        methods: Object.keys(layer.route!.methods).sort(),
      }));
    expect(paths).toContainEqual({ path: "/api/openers", methods: ["get"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id", methods: ["get", "patch"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/enrich", methods: ["post"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/nurture", methods: ["post"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/promote", methods: ["post"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/whatsapp", methods: ["post"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/call", methods: ["post"] });
  });
});
```

If Express merges GET+PATCH as two stack entries, assert with `expect(paths).toEqual(expect.arrayContaining([...]))` per method instead of a combined methods array. Match whatever `openersRouter.stack` actually emits — split routes are fine (`router.get` and `router.patch` separately). Prefer separate entries and test:

```ts
expect(paths).toContainEqual({ path: "/api/openers/:id", methods: ["get"] });
expect(paths).toContainEqual({ path: "/api/openers/:id", methods: ["patch"] });
```

Also add a unit test that `stopOpenerNurtureByEmail` is imported from the agentMail route file by reading `server/routes/agentMail.ts` as text:

```ts
import fs from "fs";
import path from "path";
it("inbound mail stops opener nurture", () => {
  const src = fs.readFileSync(path.resolve("server/routes/agentMail.ts"), "utf8");
  expect(src).toMatch(/stopOpenerNurtureByEmail/);
});
```

And `server/routes.ts` mounts the router:

```ts
it("mounts openersRouter next to agent mail", () => {
  const src = fs.readFileSync(path.resolve("server/routes.ts"), "utf8");
  expect(src).toMatch(/openersRouter/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/routes/openers.test.ts`

Expected: FAIL — cannot find `server/routes/openers`

- [ ] **Step 3: Write minimal implementation**

Implement the router. On GET, wrap hydrate in try/catch via `handleApiError`. Pixel `recordOpen` already upserts (Task 2); do not upsert again in the track route.

Staff pixel remains gated by `shouldRecordMailTracking` in `agentMail.ts` — no opener from staff opens.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/routes/openers.test.ts server/__tests__/shared/mailTracking.test.ts server/__tests__/services/openers.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add server/routes/openers.ts server/__tests__/routes/openers.test.ts server/routes.ts server/routes/agentMail.ts
git commit -m "feat: add Openers API routes"
```

---

### Task 6: Openers page, nav, Jobs off Clients

**Files:**
- Create: `client/src/pages/Openers.tsx`
- Create: `server/__tests__/routes/openersUi.test.ts`
- Modify: `client/src/App.tsx` — `const Openers = lazy(() => import("@/pages/Openers"));` and `<Route path="/openers">` immediately after `/agent-mail`
- Modify: `client/src/components/shell/navModel.ts` — destination after Agent mail
- Modify: `client/src/components/Sidebar.tsx` — item after Agent mail
- Modify: `shared/navLocks.ts` — add `"/openers"` next to `"/agent-mail"`
- Modify: `server/__tests__/shared/navLocks.test.ts` — `expect(isNavLocked("sales_admin", "/openers")).toBe(true)`
- Modify: `client/src/pages/GodModeCRM.tsx` — delete `import { AgentJobProgress ... }`, delete `<AgentJobProgress userId={user?.id} />`, leave job-completion toasts as they are

**Interfaces:**
- Consumes: `/api/openers` payload; `canPromoteOpener`, `canDragOpenerTo`, `withDerivedNurture` from `@shared/openers` if the client alias `@shared` works (it does via Vite); otherwise duplicate the four column ids as `["new","nurturing","not_now","promoted"]` and trust the API for gates
- Produces: page at `/openers`

UI requirements (spec):

- `usePageTitle("Openers", "Companies that opened Agent Mail")`
- Four columns labelled **New**, **Nurturing**, **Not now**, **Promoted** (`data-testid="column-new"` etc.)
- Cards show name or email, days sitting, open count, live-charge badge when `nonBankChargeCount > 0`, nurture hint (`Touch 2 due` / `On pipeline`)
- Filters: search input, checkboxes/toggles for has CH number, already on Pipeline, has live charges
- Default sort in a column: `daysSitting` descending
- Click card → `Sheet` (same primitive as `LeadDetailsSheet`) with timeline, CH block, notes textarea, Start nurture / Approve / Skip / Stop, WhatsApp, Log call, Promote
- Promote button `data-testid="button-promote-opener"` `disabled` when `!companyNumber`; label **Open on Deck** when `onPipeline` or `status === "promoted"`
- WhatsApp / Log call disabled when `!phone`
- Drag via `@hello-pangea/dnd` like `Pipeline.tsx`: `Droppable` droppableId = status; onDrop PATCH status, except Promoted → POST `/promote` then `setLocation("/pipeline")`
- Start nurture → POST `{ action: "start" }`; Approve → `{ action: "approve" }`
- Attach company: input + PATCH `{ companyNumber }`
- Retry enrich: POST enrich
- `super_admin` is enforced by API; page still renders for authenticated users who can see the nav item

Vitest does not run client tests. Lock UI with source assertions:

```ts
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Openers UI wiring", () => {
  it("has a status board, drawer promote gate, and nav entry after Agent mail", () => {
    const page = fs.readFileSync(path.resolve("client/src/pages/Openers.tsx"), "utf8");
    expect(page).toMatch(/data-testid="column-new"/);
    expect(page).toMatch(/data-testid="column-nurturing"/);
    expect(page).toMatch(/data-testid="column-not_now"/);
    expect(page).toMatch(/data-testid="column-promoted"/);
    expect(page).toMatch(/data-testid="button-promote-opener"/);
    expect(page).toMatch(/SheetContent/);
    expect(page).toMatch(/DragDropContext/);

    const nav = fs.readFileSync(path.resolve("client/src/components/shell/navModel.ts"), "utf8");
    expect(nav.indexOf("/openers")).toBeGreaterThan(nav.indexOf("/agent-mail"));
    expect(nav).toMatch(/label: "Openers"/);

    const app = fs.readFileSync(path.resolve("client/src/App.tsx"), "utf8");
    expect(app).toMatch(/path="\/openers"/);

    const crm = fs.readFileSync(path.resolve("client/src/pages/GodModeCRM.tsx"), "utf8");
    expect(crm).not.toMatch(/AgentJobProgress/);
  });
});
```

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/routes/openersUi.test.ts` as above. Extend `navLocks.test.ts` with `/openers`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/routes/openersUi.test.ts server/__tests__/shared/navLocks.test.ts`

Expected: FAIL — `Openers.tsx` missing; navLocks assertion fails

- [ ] **Step 3: Write minimal implementation**

Build `Openers.tsx` as a single page (board + sheet). Follow `Pipeline.tsx` dnd and `LeadDetailsSheet.tsx` sheet. Use `apiRequest` + `useQuery({ queryKey: ["/api/openers"] })`. Mutations invalidate that key.

Remove Jobs from GodModeCRM. Add nav/route/sidebar/navLocks.

Do not add Openers to `LENS_PATHS` (rail stays as-is).

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/openers.test.ts server/__tests__/services/openers.test.ts server/__tests__/routes/openers.test.ts server/__tests__/routes/openersUi.test.ts server/__tests__/shared/navLocks.test.ts server/__tests__/shared/mailTracking.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add client/src/pages/Openers.tsx client/src/App.tsx client/src/components/shell/navModel.ts client/src/components/Sidebar.tsx shared/navLocks.ts server/__tests__/shared/navLocks.test.ts client/src/pages/GodModeCRM.tsx server/__tests__/routes/openersUi.test.ts
git commit -m "feat: add Openers desk and remove Jobs from Clients"
```

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| One company per card / merge | 1, 2 |
| Every opened outbound, including historical | 2 hydrate, 5 GET |
| Activity stays in Agent Mail | 2, 5 join |
| CH identity once | 3 |
| Work queue days sitting | 1, 6 |
| 3-touch start → approve → WA/call → stop | 1, 4, 6 |
| Not a clone of sme_1 / sme_open | 1 draft copy, 4 touchId `opener_1` |
| Promote create-or-jump | 4, 5, 6 |
| Status board + drawer | 6 |
| super_admin `/openers` after Agent Mail | 5, 6 |
| JSON store | 2 |
| Jobs off Clients | 6 |
| Staff pixel does not create | 5 (existing gate) + 2 (only after recordOpen) |
| Unmatched email still a card; promote 400 | 2, 4 |
| Reply/opt-out stops nurture | 4, 5 |
| WhatsApp/call require phone | 4, 6 |
| No Places/Firecrawl/Creditsafe/new SQLite | respected |

## Placeholder scan

None: no TBD, no “handle edge cases”, no “similar to Task N” without code.
