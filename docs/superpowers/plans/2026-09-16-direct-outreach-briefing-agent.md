# Direct Outreach SAL-3 Briefing Auto-Send Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-send Shaun’s existing Direct Outreach cover email in the Sales OS window when the pack names a real SIC trade and every web link works; otherwise hold the card for Shaun.

**Architecture:** Shared industry map + link checker feed `tickDirectOutreachBriefings()` from ORC-1’s existing 60s tick. Generate uses the house pack already in `createDraftBriefing`. Send still goes through `sendOpenerBriefing` → `sendEmail`. Holds live on `OpenerRecord` in `openers.json`.

**Tech Stack:** TypeScript, Vitest, Express, existing Openers/briefings JSON stores, `sendEmail`, `helloPublicOrigin`.

**Spec:** `docs/superpowers/specs/2026-09-16-direct-outreach-briefing-agent-design.md`

## Global Constraints

- Cover copy, director mailbox, `touchId: "direct_outreach"`, dwell gate, Promote, and PECR are unchanged.
- `sendEmail` / `mailIsSuppressed` only. STOP is org-wide. Hard bounce is mailbox-only.
- `"your trade"` / leftover `{{industry}}` never auto-sends. Dead links never send.
- Sales OS window only: Mon–Fri 08:30–16:30 Europe/London (`nextConvertSendWindow` / `inConvertSendWindow`).
- No new SQLite tables. No second SMTP stack. Do not overwrite a Craft `packHtml`.
- Per-tick cap 10. SMTP mock holds `smtp`.

---

### Task 1: SIC industry map + sendableIndustry

**Files:**
- Modify: `shared/briefingTracks/mirrorPortal.ts`
- Modify: `shared/openers.ts` (`industryOverride`, `sendableIndustry`)
- Test: `server/__tests__/shared/mirrorPortal.test.ts`, `server/__tests__/shared/openers.test.ts`

**Interfaces:**
- Produces: `industryFromSic(sicCodes: string[]): string | null`
- Produces: `isForbiddenIndustry(value: string): boolean`
- Produces: `sendableIndustry(opener: Pick<OpenerRecord, "sicCodes" | "industryOverride">): string | null`

### Task 2: Link collect + HTTP check

**Files:**
- Create: `shared/briefingLinks.ts`
- Test: `server/__tests__/shared/briefingLinks.test.ts`

**Interfaces:**
- Produces: `collectBriefingLinks(html: string): { hrefs: string[]; dataGo: string[] }`
- Produces: `assertBriefingPackLinks(html: string): { ok: boolean; failures: { href: string; reason: string }[] }`
- Produces: `checkBriefingHttpLinks(hrefs: string[], opts: { origin: string; get?: BriefingHttpGet; cache?: Map<string, { ok: boolean; reason?: string }> }): Promise<{ ok: boolean; failures: { href: string; reason: string }[] }>`
- Produces: `setBriefingHttpGetForTests(fn: BriefingHttpGet | null): void`

### Task 3: Hold fields, rank, bind fallback

**Files:**
- Modify: `shared/openers.ts`
- Modify: `server/services/briefings.ts` (`bindFromOpener` uses `sendableIndustry || "your trade"`)
- Test: `server/__tests__/shared/openers.test.ts`

**Interfaces:**
- Produces: `BriefingHoldReason`, `BRIEFING_HOLD_COPY`, `asBriefingHold`
- Produces: `compareOpenersByOpenCount` prefers `briefingHold` inside Direct Outreach after dwell/click rank
- `normalizeOpener` / `mergeOpeners` copy `industryOverride` and `briefingHold`

### Task 4: tickDirectOutreachBriefings + send gates

**Files:**
- Modify: `server/services/briefings.ts`
- Modify: `shared/smeConvert.ts` (`inConvertSendWindow`)
- Modify: `server/services/agenticWorkflow.ts` (call tick after due-loop)
- Test: `server/__tests__/services/briefings.test.ts`

**Interfaces:**
- Produces: `tickDirectOutreachBriefings(now?: Date): Promise<number>`
- `sendOpenerBriefing` refuses missing sendable industry (409) and dead links (409)
- Auto path: OS window, SMTP live, daily cap, tick cap 10, ensure draft without clobbering Craft pack, refill industry, hold on fail, clear hold on send

### Task 5: Openers UI + PATCH industry

**Files:**
- Modify: `server/routes/openers.ts`
- Modify: `client/src/pages/Openers.tsx`
- Test: `server/__tests__/routes/openersUi.test.ts`, `server/__tests__/routes/openers.test.ts` if present

### Task 6: Org roster

**Files:**
- Modify: `docs/agentic-org/corporate_structure.md`, `agents.mmd`, `CLAUDE.md`, `delegation_matrix.csv`
- Existing: `docs/agentic-org/agents/SAL-3.md`
