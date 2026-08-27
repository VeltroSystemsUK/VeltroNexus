# Strata Launch Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. This session already chose inline execution.

**Goal:** Make the Deal Files stage machine honour the launch contract: real send, complete pack, ingest on files, Shaun-only gates, Sterling zip only when nothing required is missing.

**Architecture:** Pure shared gates (`pecrSend`, `sterlingCompleteness`, `sfp`) first, then wire `email.ts`, `agenticWorkflow.ts`, pack portal, and Sterling zip. No new agent personas.

**Tech Stack:** TypeScript, Vitest, Express, existing Gemini/Anthropic analysers, nodemailer.

**Spec:** `docs/agentic-org/launch_readiness.md`

## Global Constraints

- Never invent financial figures
- No agent makes a final credit decision
- Mock/failed/PECR-blocked email must not advance as sent
- Completeness blocks Sterling send
- Workforce costume is labelled, not the factory

---

### Task 1: SMTP / PECR / send outcome

**Files:**
- Create: `shared/pecrSend.ts`, `shared/outreachSend.ts`
- Modify: `server/services/email.ts`, `server/services/agenticWorkflow.ts`
- Test: `server/__tests__/shared/outreachSend.test.ts`

### Task 2: Completeness gate + SFP

**Files:**
- Create: `shared/sterlingCompleteness.ts`, `shared/sfp.ts`
- Modify: `server/services/sterlingPack.ts`
- Test: `server/__tests__/shared/sterlingCompleteness.test.ts`

### Task 3: Pack portal + wake ingest

**Files:**
- Modify: `server/services/packUpload.ts`, `client/src/pages/PackUpload.tsx`, `shared/strataOutreach.ts`, `server/services/agenticWorkflow.ts`
- Test: `server/__tests__/services/packUpload.test.ts`, `server/__tests__/services/strataOutreach.test.ts`

### Task 4: Processing uses SFP; approve opens handoff; LinkedIn wait; costume UI
