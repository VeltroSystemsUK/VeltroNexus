# Harvest Pattern Guess Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harper constructs one named-director mailbox per harvest pass from the company’s own officers and domain, James sends it, and a hard bounce is the ping that advances the format.

**Architecture:** Keep Harper’s `attachOne` waterfall. Published scrape still wins. After scrape misses, permute six formats from `directorNames[0]` + company domain. Mute MX (Google/Microsoft/Mimecast/Proofpoint) attaches the first unsuppressed guess with no SMTP. Honest SMTP keeps the catch-all gate and RCPT ping. Memory is the existing mailbox-only suppression list. A bounce-rate circuit breaker pauses guessing; published harvest continues.

**Tech Stack:** TypeScript, Vitest, existing `attachOne` / `AttachDeps` injection (no live CH, Places, Firecrawl, or SMTP in CI), Agent Mail JSON log, `uploads/harvest_guess.json`, Express Deal Files quality strip. No new npm packages.

**Spec:** `docs/superpowers/specs/2026-09-10-harvest-pattern-guess-design.md`

## Global Constraints

- Guessed locals come from **this company’s** current CH officers (`directorNames`) or a named site/Places contact for that company — never a dummy “John Smith”
- Never invent `info@` or any `ROLE_LOCALS` local
- Published mailto still wins over a guess
- One constructed address attached per harvest pass
- Six formats in order: `first.last` → `flast` → `first` → `firstlast` → `f.last` → `firstl`
- Guess walk is the **primary director only** (`directorNames[0]`)
- Mute MX: no SMTP (not even catch-all probes); attach first unsuppressed guess; `contactSource: "domain"`; confidence ≥ 75
- Honest SMTP (`mxFamily === "other"`): catch-all → do not guess; else ping and attach first `deliverable`
- Hard bounce suppresses that mailbox only; next pass takes the next format
- `SME_ATTACH_ATTEMPT_CAP = 6`; at cap, file is no longer a harvest candidate
- Circuit breaker: last 50 outbound `sent`/`mock` with `contactSource === "domain"`; ≥ 8 of those recipients hard-bounce-suppressed → pause guessing until Shaun resumes
- Do not call live CH, Places, Firecrawl, SMTP, or ZeroBounce in CI — inject fakes
- Do not wire ZeroBounce or Apollo
- Windows PowerShell: `git commit -m "message"` (no bash heredocs)
- Do not change PECR, STOP fan-out, Clients contacted derivation, or `HARVEST_PER_HOUR`

## File map

- Modify: `shared/companyMailbox.ts` — six patterns; primary-only guesses; `domainCandidatesFromCompanyName`
- Modify: `server/__tests__/shared/companyMailbox.test.ts`
- Modify: `shared/mailboxScore.ts` — mute-MX `source: "domain"` scores 75
- Modify: `server/__tests__/shared/mailboxScore.test.ts`
- Modify: `shared/smeHopper.ts` — `SME_ATTACH_ATTEMPT_CAP = 6`
- Modify: `server/services/smeLeadHopper.ts` — mute-MX guess; DNS domain; honour pause; cap
- Modify: `server/__tests__/services/smeLeadHopper.test.ts`
- Create: `shared/harvestGuess.ts` — sample/trip pure functions
- Create: `server/__tests__/shared/harvestGuess.test.ts`
- Create: `server/services/harvestGuessStore.ts` — `uploads/harvest_guess.json`
- Create: `server/__tests__/services/harvestGuessStore.test.ts`
- Modify: `shared/smeQuality.ts` — `id?: "guess_paused"` on alerts
- Modify: `server/__tests__/shared/smeQuality.test.ts`
- Modify: `server/services/agentMailLog.ts` — optional `contactSource` on `AgentMailItem`
- Modify: `server/services/email.ts` — stamp `credentials.contactSource` onto the log
- Modify: `server/__tests__/services/email.test.ts`
- Modify: `server/services/agenticWorkflow.ts` — pass `contactSource` into `sendEmail`; load pause into quality; trip pause
- Modify: `server/routes/agenticWorkflow.ts` — `POST /api/agentic/harvest/resume-guess`
- Modify: `client/src/components/agentic/DealFilesPanel.tsx` — Resume on the pause alert
- Modify: `docs/agentic-org/agents/RES-2.md` — one Harper line

---

### Task 1: Six director formats from the company’s own officer

**Files:**
- Modify: `shared/companyMailbox.ts`
- Test: `server/__tests__/shared/companyMailbox.test.ts`

**Interfaces:**
- Consumes: existing `contactMailboxGuesses(domain, directorNames, pattern?)`, `inferMailboxPattern`, `personTokens`
- Produces: `export type MailboxPattern = "first.last" | "flast" | "first" | "firstlast" | "f.last" | "firstl"`; `contactMailboxGuesses` emits six locals for `directorNames[0]` only; locked pattern emits that one format; never a role local

- [ ] **Step 1: Write the failing tests**

Replace the existing `"guesses first.last and first..."` case and add:

```ts
it("guesses six formats for the company's primary director only", () => {
  expect(contactMailboxGuesses("acme.co.uk", ["John Smith", "Jane Doe"])).toEqual([
    "john.smith@acme.co.uk",
    "jsmith@acme.co.uk",
    "john@acme.co.uk",
    "johnsmith@acme.co.uk",
    "j.smith@acme.co.uk",
    "johns@acme.co.uk",
  ]);
  expect(contactMailboxGuesses("ihsanpharma.co.uk", ["Jawad Moin MEHROOF"])[0]).toBe(
    "jawad.mehroof@ihsanpharma.co.uk"
  );
  expect(contactMailboxGuesses("petshop.co.uk", ["Adam Taylor"])).not.toContain("info@petshop.co.uk");
  expect(contactMailboxGuesses("o-i.com", ["O-I EUROPE SARL"])).toEqual([]);
});

it("locks a published first.last and still only uses the primary director", () => {
  expect(inferMailboxPattern(["jane.smith@petshop.co.uk", "info@petshop.co.uk"])).toBe("first.last");
  expect(inferMailboxPattern(["johns@petshop.co.uk"], ["John Smith"])).toBe("firstl");
  expect(contactMailboxGuesses("petshop.co.uk", ["Adam Taylor"], "first.last")).toEqual([
    "adam.taylor@petshop.co.uk",
  ]);
});
```

Keep the existing “learns first.last / flast / info-only → null” assertions.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/companyMailbox.test.ts`

Expected: FAIL — guesses still only three formats (`adam.taylor`, `ataylor`, `adam`)

- [ ] **Step 3: Write minimal implementation**

In `shared/companyMailbox.ts`:

- Extend `MailboxPattern` with `"firstlast" | "f.last" | "firstl"`.
- `localsForPerson` when `pattern` is set returns that one local; when unset returns, in order: `` `${first}.${last}` ``, `` `${first[0]}${last}` ``, `first`, `` `${first}${last}` ``, `` `${first[0]}.${last}` ``, `` `${first}${last[0]}` ``.
- `inferMailboxPattern`: after the existing three matches, detect `firstlast`, `f.last` (`/^[a-z]\.[a-z]{2,}$/`), `firstl` (`local === first + last[0]`). Role locals still return null.
- `contactMailboxGuesses`: iterate `directorNames.slice(0, 1)` only (not 2).

Do not emit `info` / any `ROLE_LOCALS` value.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/companyMailbox.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/companyMailbox.ts server/__tests__/shared/companyMailbox.test.ts
git commit -m "feat(harvest): six named-director mailbox formats"
```

---

### Task 2: DNS domain candidates from the legal name

**Files:**
- Modify: `shared/companyMailbox.ts`
- Test: `server/__tests__/shared/companyMailbox.test.ts`

**Interfaces:**
- Consumes: existing `CORP_TOKENS` / `personTokens`-style tokeniser in this file; `emailMatchesCompany` from `./pecrSend`
- Produces: `export function domainCandidatesFromCompanyName(companyName: string): string[]` — distinctive tokens joined, then hyphenated `.co.uk`, then joined `.com`. No MX here.

- [ ] **Step 1: Write the failing test**

```ts
import { domainCandidatesFromCompanyName } from "@shared/companyMailbox";

it("builds likely .co.uk / .com hosts from the legal name, not a registry page", () => {
  expect(domainCandidatesFromCompanyName("Acme Joinery Limited")).toEqual([
    "acmejoinery.co.uk",
    "acme-joinery.co.uk",
    "acmejoinery.com",
  ]);
  expect(domainCandidatesFromCompanyName("")).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/companyMailbox.test.ts`

Expected: FAIL — `domainCandidatesFromCompanyName` is not exported

- [ ] **Step 3: Write minimal implementation**

```ts
export function domainCandidatesFromCompanyName(companyName: string): string[] {
  const tokens = String(companyName || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((token) => token.length >= 2 && !CORP_TOKENS.has(token));
  if (!tokens.length) return [];
  const joined = tokens.join("");
  const hyphen = tokens.join("-");
  const hosts = [`${joined}.co.uk`, `${hyphen}.co.uk`, `${joined}.com`];
  return [...new Set(hosts)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/companyMailbox.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/companyMailbox.ts server/__tests__/shared/companyMailbox.test.ts
git commit -m "feat(harvest): domain candidates from legal name"
```

---

### Task 3: Mute-MX director guess hits the send floor

**Files:**
- Modify: `shared/mailboxScore.ts`
- Test: `server/__tests__/shared/mailboxScore.test.ts`

**Interfaces:**
- Consumes: existing `mailboxConfidence`, `smtpTrusted`, `MAILBOX_SEND_FLOOR`
- Produces: `mailboxConfidence({ source: "domain", mx: true, mxFamily: "google", smtp: "unknown", citedOnDomain: 0 }) === 75`; honest-MX unknown guess stays 50

- [ ] **Step 1: Write the failing test**

In the mailbox confidence describe:

```ts
it("scores a mute-MX director guess at the send floor without SMTP", () => {
  expect(
    mailboxConfidence({
      source: "domain",
      mx: true,
      smtp: "unknown",
      catchAll: "unknown",
      citedOnDomain: 0,
      mxFamily: "google",
    })
  ).toBe(75);
  expect(
    mailboxConfidence({
      source: "domain",
      mx: true,
      smtp: "unknown",
      catchAll: "unknown",
      citedOnDomain: 0,
      mxFamily: "microsoft",
    })
  ).toBeGreaterThanOrEqual(MAILBOX_SEND_FLOOR);
  expect(
    mailboxConfidence({
      source: "domain",
      mx: true,
      smtp: "unknown",
      catchAll: "unknown",
      citedOnDomain: 0,
    })
  ).toBe(50);
});
```

Keep the existing “95 only on SMTP 250 for a proven non-catch-all” cases (no `mxFamily`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/mailboxScore.test.ts`

Expected: FAIL — google family still scores 50

- [ ] **Step 3: Write minimal implementation**

In `mailboxConfidence`, after `if (!input.mx) return 0` and the cited-source 95:

```ts
const mute = Boolean(input.mxFamily && !smtpTrusted(input.mxFamily));
if (input.source === "domain" && mute) return 75;
```

Do not force `smtp`/`catchAll` to `"unknown"` before the mute-domain return (that is what pins guesses at 50 today). Cited (non-`domain`) sources still return 95 as now.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/shared/mailboxScore.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/mailboxScore.ts server/__tests__/shared/mailboxScore.test.ts
git commit -m "feat(harvest): mute-MX guessed mailbox meets send floor"
```

---

### Task 4: Attach cap 6 then stop harvesting

**Files:**
- Modify: `shared/smeHopper.ts` (`SME_ATTACH_ATTEMPT_CAP`)
- Modify: `server/services/smeLeadHopper.ts` (`isHarvestCandidate`)
- Test: `server/__tests__/services/smeLeadHopper.test.ts`

**Interfaces:**
- Consumes: `isHarvestCandidate(deal, now)`
- Produces: `SME_ATTACH_ATTEMPT_CAP === 6`; `isHarvestCandidate` is false when `(deal.attachAttempts || 0) >= 6`

- [ ] **Step 1: Write the failing test**

In `describe("Harvest agent loop")`:

```ts
it("stops harvesting after six attach misses", () => {
  expect(SME_ATTACH_ATTEMPT_CAP).toBe(6);
  expect(
    isHarvestCandidate(
      { source: "distress_scan", hopper: "quarantine", companyName: "Pet Shop Ltd", attachAttempts: 6 },
      now
    )
  ).toBe(false);
  expect(
    isHarvestCandidate(
      { source: "distress_scan", hopper: "quarantine", companyName: "Pet Shop Ltd", attachAttempts: 5 },
      now
    )
  ).toBe(true);
});
```

Import `SME_ATTACH_ATTEMPT_CAP` from `../../services/smeLeadHopper` (re-export it from that module from `@shared/smeHopper`, or import from `@shared/smeHopper` in the test). Prefer importing from `@shared/smeHopper` in the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/smeLeadHopper.test.ts -t "stops harvesting after six"`

Expected: FAIL — cap is 5 and/or candidate with 6 attempts is still true

- [ ] **Step 3: Write minimal implementation**

- `shared/smeHopper.ts`: `export const SME_ATTACH_ATTEMPT_CAP = 6;`
- `isHarvestCandidate` in `smeLeadHopper.ts`: after the noise/inbound/protected checks, `if ((deal.attachAttempts || 0) >= SME_ATTACH_ATTEMPT_CAP) return false;`
- Import `SME_ATTACH_ATTEMPT_CAP` in `smeLeadHopper.ts` from `@shared/smeHopper` if not already.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/services/smeLeadHopper.test.ts server/__tests__/shared/smeHopper.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/smeHopper.ts server/services/smeLeadHopper.ts server/__tests__/services/smeLeadHopper.test.ts
git commit -m "feat(harvest): stop attach after six misses"
```

---

### Task 5: Guess the named director on mute MX; bounce skips that format

**Files:**
- Modify: `server/services/smeLeadHopper.ts` (`attachOne`)
- Test: `server/__tests__/services/smeLeadHopper.test.ts`

**Interfaces:**
- Consumes: Task 1 `contactMailboxGuesses`; Task 3 `mailboxConfidence` + `mxFamily`; existing `inboundEmails` suppression skip; `AttachDeps.mxHosts?`
- Produces: Google MX + director + empty scrape → `adam.taylor@petshop.co.uk`, `contactSource: "domain"`, hopper `sendable`, confidence ≥ 75, **zero** `smtpProbe` calls. Same file with that address in `inboundEmails` → `ataylor@petshop.co.uk`. Honest SMTP catch-all still does not guess. `guessPaused` on deps (optional boolean, default false) skips constructing guesses.

- [ ] **Step 1: Write the failing tests**

```ts
it("attaches first.last for the file's director on Google MX with no SMTP", async () => {
  const smtpProbe = vi.fn(async () => "unknown" as const);
  const { dealPatch } = await attachOne(
    {
      attachAttempts: 0,
      hopper: "gated",
      companyName: "Pet Shop Ltd",
      companyNumber: "1",
      website: "https://petshop.co.uk",
      directorNames: ["Adam Taylor"],
    } as any,
    {
      officers: async () => [],
      places: async () => null,
      firecrawl: async () => [],
      mxValid: async () => true,
      mxHosts: async () => ["aspmx.l.google.com"],
      smtpProbe,
    },
    { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
  );
  expect(dealPatch.email).toBe("adam.taylor@petshop.co.uk");
  expect(dealPatch.contactSource).toBe("domain");
  expect(dealPatch.hopper).toBe("sendable");
  expect(dealPatch.mailboxGrade).toBe("director");
  expect(dealPatch.mailboxConfidence).toBeGreaterThanOrEqual(75);
  expect(smtpProbe).not.toHaveBeenCalled();
});

it("skips a bounced first.last and attaches flast on the next mute-MX pass", async () => {
  const { dealPatch } = await attachOne(
    {
      attachAttempts: 0,
      hopper: "hunt_contact",
      companyName: "Pet Shop Ltd",
      companyNumber: "1",
      website: "https://petshop.co.uk",
      directorNames: ["Adam Taylor"],
    } as any,
    {
      officers: async () => [],
      places: async () => null,
      firecrawl: async () => [],
      mxValid: async () => true,
      mxHosts: async () => ["aspmx.l.google.com"],
    },
    { ch: 10, places: 10, firecrawl: 10, smtp: 10 },
    new Date(),
    new Set(["adam.taylor@petshop.co.uk"])
  );
  expect(dealPatch.email).toBe("ataylor@petshop.co.uk");
  expect(dealPatch.email).not.toBe("adam.taylor@petshop.co.uk");
});

it("does not guess when guessing is paused", async () => {
  const { dealPatch } = await attachOne(
    {
      attachAttempts: 0,
      hopper: "gated",
      companyName: "Pet Shop Ltd",
      companyNumber: "1",
      website: "https://petshop.co.uk",
      directorNames: ["Adam Taylor"],
    } as any,
    {
      officers: async () => [],
      places: async () => null,
      firecrawl: async () => [],
      mxValid: async () => true,
      mxHosts: async () => ["aspmx.l.google.com"],
      guessPaused: true,
    },
    { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
  );
  expect(dealPatch.hopper).not.toBe("sendable");
  expect(dealPatch.email).toBeUndefined();
});
```

Keep existing catch-all / SMTP-fail / published-wins tests. They omit `mxHosts`, so family stays `"other"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/smeLeadHopper.test.ts -t "Google MX"`

Expected: FAIL — no guess on Google because `smtpTrusted` is false

- [ ] **Step 3: Write minimal implementation**

In `AttachDeps` add `guessPaused?: boolean`.

In `attachOne`, replace the block that only guesses when `smtpTrusted(family)`:

After published emails are domain-filtered, resolve `family` as now.

Then:

```ts
const guessPaused = Boolean(deps.guessPaused);
if (domain && directorNames.length && !guessPaused) {
  if (smtpTrusted(family) && next.smtp > 0) {
    // existing two nonsense-local probes + catchAllStatus
    if (catchAll === "not_catch_all") {
      const pattern = inferMailboxPattern(found.map((item) => item.email), directorNames);
      for (const email of contactMailboxGuesses(domain, directorNames, pattern)) {
        if (found.some((item) => item.email === email)) continue;
        found.push({ email, source: "domain" });
      }
    }
  } else if (!smtpTrusted(family)) {
    const pattern = inferMailboxPattern(found.map((item) => item.email), directorNames);
    for (const email of contactMailboxGuesses(domain, directorNames, pattern)) {
      if (found.some((item) => item.email === email)) continue;
      found.push({ email, source: "domain" });
    }
  }
}
```

In `tryGrade`, only SMTP-probe a `domain` source when `smtpTrusted(family)`:

```ts
const smtp =
  item.source === "domain" && smtpTrusted(family) && next.smtp > 0
    ? ((next.smtp -= 1), await probeSmtp(deps, item.email))
    : "unknown";
const score = mailboxConfidence({
  source: (item.source || "firecrawl") as MailboxEvidenceSource,
  mx: true,
  smtp,
  catchAll,
  citedOnDomain,
  mxFamily: family,
});
```

If every remaining `domain` candidate is in `inboundEmails` and nothing published attached, `failAttachPatch` as now. If guesses existed but all were suppressed, set `attachAttempts` to `SME_ATTACH_ATTEMPT_CAP` in that fail patch so the file does not spin.

Published `tryGrade("director")` / `tryGrade("role")` still run first — do not skip scrape hits.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/services/smeLeadHopper.test.ts`

Expected: PASS, including existing scrape/OSINT/Wayback/catch-all cases

- [ ] **Step 5: Commit**

```powershell
git add server/services/smeLeadHopper.ts server/__tests__/services/smeLeadHopper.test.ts
git commit -m "feat(harvest): guess named director on mute MX"
```

---

### Task 6: Resolve domain from legal-name DNS when Places/OSINT gave no site

**Files:**
- Modify: `server/services/smeLeadHopper.ts` (`attachOne`, `canAttachWithBudget`)
- Test: `server/__tests__/services/smeLeadHopper.test.ts`

**Interfaces:**
- Consumes: Task 2 `domainCandidatesFromCompanyName`; `emailMatchesCompany`; `AttachDeps.mxHosts` / `mxValid`
- Produces: no website + MX only on `acmejoinery.co.uk` + director → that host used; first guess `john.smith@acmejoinery.co.uk` on mute MX. Registry hosts never selected.

- [ ] **Step 1: Write the failing tests**

```ts
it("uses a legal-name domain with MX when Places and OSINT gave no website", async () => {
  const { dealPatch } = await attachOne(
    {
      attachAttempts: 0,
      hopper: "gated",
      companyName: "Acme Joinery Limited",
      companyNumber: "1",
      directorNames: ["John Smith"],
    } as any,
    {
      officers: async () => [],
      places: async () => null,
      firecrawl: async () => [],
      osint: async () => ({ emails: [] }),
      mxValid: async (email: string) => email.endsWith("@acmejoinery.co.uk") || email.endsWith("@acmejoinery.com") || email.endsWith("@acme-joinery.co.uk"),
      mxHosts: async (domain: string) =>
        domain === "acmejoinery.co.uk" ? ["aspmx.l.google.com"] : [],
    },
    { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
  );
  expect(dealPatch.website).toMatch(/acmejoinery\.co\.uk/);
  expect(dealPatch.email).toBe("john.smith@acmejoinery.co.uk");
  expect(dealPatch.contactSource).toBe("domain");
});

it("does not treat a registry host as the company domain", async () => {
  const { dealPatch } = await attachOne(
    {
      attachAttempts: 0,
      hopper: "gated",
      companyName: "Acme Joinery Limited",
      companyNumber: "1",
      website: "https://find-and-update.company-information.service.gov.uk/company/1",
      directorNames: ["John Smith"],
    } as any,
    {
      officers: async () => [],
      places: async () => null,
      firecrawl: async () => [],
      mxValid: async () => true,
      mxHosts: async () => ["aspmx.l.google.com"],
    },
    { ch: 10, places: 10, firecrawl: 10, smtp: 10 }
  );
  expect(String(dealPatch.email || "")).not.toMatch(/company-information\.service\.gov\.uk/);
});
```

The existing `"skips attach when Places and Firecrawl budgets cannot produce an email"` test has `places: 0`, no website, no names. After this task `canAttachWithBudget` may enter attach to try DNS/officers. Update that test: either pass `directorNames` empty and `mxHosts` returning `[]` and still expect no sendable email, or allow `officers` to be called and assert hopper is not sendable. Do not leave a failing leftover.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/smeLeadHopper.test.ts -t "legal-name domain"`

Expected: FAIL — no website means no domain, no guess

- [ ] **Step 3: Write minimal implementation**

After OSINT, if `!domain`:

```ts
import { domainCandidatesFromCompanyName } from "@shared/companyMailbox";
import { emailMatchesCompany } from "@shared/pecrSend";

for (const host of domainCandidatesFromCompanyName(deal.companyName)) {
  if (!emailMatchesCompany(`mailbox@${host}`, deal.companyName)) continue;
  let ok = false;
  if (deps.mxHosts) ok = (await deps.mxHosts(host)).length > 0;
  else ok = await deps.mxValid(`mailbox@${host}`);
  if (!ok) continue;
  domain = host;
  website = `https://${host}`;
  extra.website = website;
  break;
}
```

`canAttachWithBudget`: allow attach when there is no website if `hasNames || budget.ch > 0` (so officers + DNS can run).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/services/smeLeadHopper.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add server/services/smeLeadHopper.ts server/__tests__/services/smeLeadHopper.test.ts
git commit -m "feat(harvest): DNS domain from legal name"
```

---

### Task 7: Stamp `contactSource` on outbound Agent Mail

**Files:**
- Modify: `server/services/agentMailLog.ts` — `AgentMailItem.contactSource?: string`
- Modify: `server/services/email.ts`
- Modify: `server/services/agenticWorkflow.ts` (every `sendEmail(` that already passes `dealId`)
- Modify: `server/services/smeOpenFollowUp.ts` if it passes `dealId`
- Test: `server/__tests__/services/email.test.ts`

**Interfaces:**
- Consumes: `sendEmail(credentials, ...)`
- Produces: when `credentials.contactSource === "domain"`, every `logAgentMail` in `sendEmail` includes `contactSource: "domain"` (including mock and suppressed-fail). Other sends omit it.

- [ ] **Step 1: Write the failing test**

```ts
import { listAgentMail } from "../../services/agentMailLog";

it("stamps domain contactSource on the Agent Mail row", async () => {
  await sendEmail(
    { contactSource: "domain", dealId: 9, touchId: "sme_1" },
    "adam.taylor@petshop.co.uk",
    "Hi",
    "Please read"
  );
  const row = listAgentMail(10).find((item) => item.to === "adam.taylor@petshop.co.uk");
  expect(row?.contactSource).toBe("domain");
  expect(row?.status).toBe("mock");
});

it("does not stamp contactSource when the deal was not a guess", async () => {
  await sendEmail({}, "info@petshop.co.uk", "Hi", "Please read");
  const row = listAgentMail(10).find((item) => item.to === "info@petshop.co.uk");
  expect(row?.contactSource).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/email.test.ts`

Expected: FAIL — `contactSource` not on the log item

- [ ] **Step 3: Write minimal implementation**

- Add `contactSource?: string` to `AgentMailItem`.
- In each `logAgentMail({...})` inside `sendEmail`, set `contactSource: credentials?.contactSource` when it is a non-empty string.
- At each `sendEmail({ dealId: deal.id, ...})` site in `agenticWorkflow.ts` and `smeOpenFollowUp.ts`, pass `contactSource: deal.contactSource`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/__tests__/services/email.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add server/services/agentMailLog.ts server/services/email.ts server/services/agenticWorkflow.ts server/services/smeOpenFollowUp.ts server/__tests__/services/email.test.ts
git commit -m "feat(harvest): stamp guessed mailbox origin on Agent Mail"
```

---

### Task 8: Bounce-rate pause, quality alert, resume control, Harper line

**Files:**
- Create: `shared/harvestGuess.ts`
- Create: `server/__tests__/shared/harvestGuess.test.ts`
- Create: `server/services/harvestGuessStore.ts`
- Create: `server/__tests__/services/harvestGuessStore.test.ts`
- Modify: `shared/smeQuality.ts`
- Modify: `server/__tests__/shared/smeQuality.test.ts`
- Modify: `server/services/smeLeadHopper.ts` — `liveAttachDeps` / `refillSendableHopper` reads pause
- Modify: `server/services/agenticWorkflow.ts` — trip on quality/harvest; `resumeHarvestGuess`
- Modify: `server/routes/agenticWorkflow.ts`
- Modify: `client/src/components/agentic/DealFilesPanel.tsx`
- Modify: `docs/agentic-org/agents/RES-2.md`

**Interfaces:**
- Consumes: Task 7 stamped mail; `suppressionSets().emails`; Task 5 `guessPaused`
- Produces:
  - `HARVEST_GUESS_SAMPLE = 50`, `HARVEST_GUESS_BOUNCE_TRIP = 8`
  - `export function guessedSendSample(items: Array<{ to: string; status: string; contactSource?: string; createdAt?: string }>): same[]` — `contactSource === "domain"` and status `sent` or `mock`, newest 50
  - `export function shouldTripGuessPause(sample, suppressedEmails: Set<string>): boolean` — false if `sample.length < 50`; true if ≥ 8 sample recipients are in the set (lowercase)
  - `uploads/harvest_guess.json` `{ paused: boolean, at?: string, bounced?: number, sampled?: number }`
  - `qualityAlerts` includes `{ id: "guess_paused", tone: "amber", message: "Guessing paused — bounce rate on constructed mailboxes. Published harvest continues." }` when paused
  - `POST /api/agentic/harvest/resume-guess` sets `paused: false`
  - Deal Files Resume button `data-testid="btn-resume-harvest-guess"` on that alert only

- [ ] **Step 1: Write the failing tests**

`server/__tests__/shared/harvestGuess.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  HARVEST_GUESS_BOUNCE_TRIP,
  HARVEST_GUESS_SAMPLE,
  guessedSendSample,
  shouldTripGuessPause,
} from "@shared/harvestGuess";

function row(i: number, bounced = false) {
  return {
    to: `n${i}@acme.co.uk`,
    status: "sent" as const,
    contactSource: "domain" as const,
    createdAt: `2026-09-10T00:${String(i).padStart(2, "0")}:00.000Z`,
  };
}

describe("guess bounce circuit breaker", () => {
  it("trips at 8 hard bounces in 50 guessed sends and not before", () => {
    expect(HARVEST_GUESS_SAMPLE).toBe(50);
    expect(HARVEST_GUESS_BOUNCE_TRIP).toBe(8);
    const items = Array.from({ length: 50 }, (_, i) => row(i));
    const suppressed7 = new Set(items.slice(0, 7).map((item) => item.to));
    expect(shouldTripGuessPause(guessedSendSample(items), suppressed7)).toBe(false);
    const suppressed8 = new Set(items.slice(0, 8).map((item) => item.to));
    expect(shouldTripGuessPause(guessedSendSample(items), suppressed8)).toBe(true);
    expect(shouldTripGuessPause(guessedSendSample(items.slice(0, 49)), suppressed8)).toBe(false);
  });

  it("ignores published mail when sampling", () => {
    const items = [
      { to: "info@acme.co.uk", status: "sent" as const, createdAt: "2026-09-10T00:00:00.000Z" },
      { to: "adam.taylor@acme.co.uk", status: "sent" as const, contactSource: "domain", createdAt: "2026-09-10T00:01:00.000Z" },
    ];
    expect(guessedSendSample(items).map((item) => item.to)).toEqual(["adam.taylor@acme.co.uk"]);
  });
});
```

In `smeQuality.test.ts`:

```ts
it("alerts when constructed-mailbox guessing is paused", () => {
  const alerts = qualityAlerts({
    scanned: 10,
    deliverable: 4,
    sent: 0,
    replied: 0,
    remainingSlots: 100,
    budget: {
      total: { ch: 800, places: 400, firecrawl: 400, smtp: 150 },
      remaining: { ch: 800, places: 400, firecrawl: 400, smtp: 150 },
    },
    guessPaused: true,
  });
  expect(alerts.some((item) => item.id === "guess_paused" && item.tone === "amber")).toBe(true);
});
```

Store test: write tmp JSON via `setHarvestGuessStorePathForTests`, `tripGuessPause({ bounced: 8, sampled: 50 })` → `isGuessPaused() === true`; `resumeGuessPause()` → false.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/__tests__/shared/harvestGuess.test.ts server/__tests__/shared/smeQuality.test.ts`

Expected: FAIL — modules / `guessPaused` input missing

- [ ] **Step 3: Write minimal implementation**

`shared/harvestGuess.ts` — constants + `guessedSendSample` (filter, sort by `createdAt` desc, slice 50) + `shouldTripGuessPause`.

`server/services/harvestGuessStore.ts` — same fs pattern as `mailSuppression.ts`, path `uploads/harvest_guess.json`, test override setter.

`qualityAlerts`: if `input.guessPaused`, push the locked amber message with `id: "guess_paused"`. Extend `QualityAlert` with `id?: string`.

`loadHuntQuality`: `listAgentMail(5000)`, `guessedSendSample`, `shouldTripGuessPause` vs `suppressionSets().emails`. If trip and not already paused, `tripGuessPause`. Pass `guessPaused: isGuessPaused()` into `buildHuntQuality` / `qualityAlerts`. **Never auto-clear pause.**

`refillSendableHopper`: `deps = { ...opts.deps, guessPaused: opts.deps.guessPaused ?? isGuessPaused() }` — if that import makes hopper tests hit the real JSON file, then only `liveAttachDeps` / the harvest pass should read the store. Prefer: `runHarvestPass` / `liveAttachDeps` sets `guessPaused: isGuessPaused()`. Unit tests keep passing `guessPaused` explicitly. Default remains false when the store file is absent.

Route:

```ts
router.post("/api/agentic/harvest/resume-guess", isAuthenticated, async (_req, res) => {
  try {
    res.json(await agenticWorkflow.resumeHarvestGuess());
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});
```

`resumeHarvestGuess` calls `resumeGuessPause()` and returns `{ paused: false }`.

Deal Files `QualityStrip`: if `alert.id === "guess_paused"`, render the message plus:

```tsx
<Button
  size="sm"
  variant="ghost"
  className="h-7"
  data-testid="btn-resume-harvest-guess"
  disabled={busy}
  onClick={onResumeGuess}
>
  Resume guessing
</Button>
```

Wire `useMutation` → `POST /api/agentic/harvest/resume-guess` → invalidate `/api/agentic/quality`.

RES-2 Harper bullet — replace the harvest sentence with: harvest a company mailbox on every real SME file without an email (quarantine included). Published mailto first. Else guess the **named current director** formats on the company domain; hard bounce is the ping. Never invent `info@`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```
npx vitest run server/__tests__/shared/harvestGuess.test.ts server/__tests__/shared/smeQuality.test.ts server/__tests__/services/harvestGuessStore.test.ts server/__tests__/services/smeLeadHopper.test.ts server/__tests__/shared/companyMailbox.test.ts server/__tests__/shared/mailboxScore.test.ts server/__tests__/services/email.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add shared/harvestGuess.ts shared/smeQuality.ts server/services/harvestGuessStore.ts server/services/smeLeadHopper.ts server/services/agenticWorkflow.ts server/routes/agenticWorkflow.ts client/src/components/agentic/DealFilesPanel.tsx docs/agentic-org/agents/RES-2.md server/__tests__/shared/harvestGuess.test.ts server/__tests__/shared/smeQuality.test.ts server/__tests__/services/harvestGuessStore.test.ts
git commit -m "feat(harvest): pause guessing when constructed mail bounces too hard"
```

---

## Self-review (spec coverage)

| Spec requirement | Task |
|---|---|
| Six formats including `johns@` / `firstl`; primary director only; never dummy John Smith | 1 |
| Never `info@` from guesser | 1 |
| Pattern lock from published local | 1, 5 |
| DNS candidates from legal name | 2, 6 |
| Mute-MX confidence 75 | 3 |
| Cap 6 then not a harvest candidate | 4 |
| Google MX attaches `first.last` with no SMTP | 5 |
| Suppression skip → next format | 5 |
| Honest SMTP catch-all: no guess | 5 (existing test kept) |
| Pause skips guesses, published still attaches | 5 (`guessPaused`) + 8 |
| Registry host not a domain | 6 |
| Stamp `contactSource: domain` on Agent Mail | 7 |
| 8/50 trip, not 7, not before 50; no auto-resume | 8 |
| Resume POST + Deal Files button | 8 |
| RES-2 Harper line | 8 |
| No ZeroBounce/Apollo | honour Global Constraints — no task wires them |
