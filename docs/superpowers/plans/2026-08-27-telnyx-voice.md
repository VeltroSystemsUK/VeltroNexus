# Telnyx Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NEXUS can receive Telnyx Voice AI webhooks and tool calls for inbound Sophie on +44 115 661 1616, log outcomes, transfer to Shaun, and honour opt-out — with click-to-call and warm auto-dial compiled in but flagged off.

**Architecture:** Pure gates and copy live in `shared/telnyxVoice.ts`. Telnyx owns audio. NEXUS verifies signed webhooks, answers five tools, and writes to the agentic deal file. No Vapi. No media streaming.

**Tech Stack:** TypeScript, Vitest, Express, existing `storage` agentic deals, Telnyx Voice AI (portal-configured).

**Spec:** `docs/superpowers/specs/2026-08-27-telnyx-voice-design.md`

## Global Constraints

- Inbound opener exactly: `Thank you for calling Strata. How can I help you today? This call is recorded for training and compliance purposes.`
- Outbound opener exactly: `Hello, it’s [Sophie/James] calling from Strata. Is now a convenient time?` — no recording sentence
- Never speak “I am AI”
- Transfer number `+447898789313`; unanswered → log and queue Shaun, no voicemail script
- Sophie inbound / pack chase / warm; James click-to-call Stream A/B first-touch only
- Warm auto-dial only `source === "strata_inbound"`; Stream A/B never auto-dialled
- Flags default: inbound on when DID Active; click-to-call, WhatsApp, warm auto-dial off
- Never invent figures or promise lending
- DID may still be pending Telnyx docs — live PSTN proof waits on Active
- Do not commit secrets; rotate `TELNYX_API_KEY` if the current key cannot see this account

## File map

- Create: `shared/telnyxVoice.ts`
- Create: `server/services/telnyxSignature.ts`
- Create: `server/services/telnyxVoice.ts`
- Create: `server/routes/telnyxVoice.ts`
- Create: `server/__tests__/shared/telnyxVoice.test.ts`
- Create: `server/__tests__/services/telnyxSignature.test.ts`
- Create: `server/__tests__/services/telnyxVoice.test.ts`
- Modify: `server/routes.ts` (mount router)
- Modify: `docs/ENV.md`

---

### Task 1: Shared copy, flags, eligibility, assistant pick

**Files:**
- Create: `shared/telnyxVoice.ts`
- Test: `server/__tests__/shared/telnyxVoice.test.ts`

**Interfaces:**
- Consumes: `AgenticSource` from `shared/agenticWorkflow.ts`
- Produces:
  - `TELNYX_DID = "+441156611616"`
  - `TELNYX_TRANSFER_NUMBER = "+447898789313"`
  - `INBOUND_OPENER`, `outboundOpener(name: "Sophie" | "James"): string`
  - `telnyxFlags(env: NodeJS.Dict<string>): { inbound: boolean; clickToCall: boolean; whatsapp: boolean; warmAutodial: boolean }`
  - `pickAssistant(input: { direction: "inbound" | "outbound"; source?: string }): "sophie" | "james"`
  - `outboundGate(input: OutboundGateInput): { ok: true } | { ok: false; reason: string }`
  - `warmAutodialGate(input: OutboundGateInput): { ok: true } | { ok: false; reason: string }`
  - `type CallOutcome = "connected" | "no_answer" | "amd" | "callback" | "opt_out" | "transferred" | "pack_promised"`
  - `type OutboundGateInput = { phone?: string | null; e164?: boolean; stopListed?: boolean; tpsClear?: boolean; ctpsClear?: boolean; sig06?: boolean; consumerOrSoleTrader?: boolean; optedOut?: boolean; complaint?: boolean; vulnerability?: boolean; solicitor?: boolean; now?: Date; timeZone?: string; source?: string }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  INBOUND_OPENER,
  outboundOpener,
  telnyxFlags,
  pickAssistant,
  outboundGate,
  warmAutodialGate,
} from "@shared/telnyxVoice";

describe("telnyxVoice copy", () => {
  it("inbound opener includes recording notice", () => {
    expect(INBOUND_OPENER).toBe(
      "Thank you for calling Strata. How can I help you today? This call is recorded for training and compliance purposes."
    );
  });

  it("outbound opener has no recording sentence", () => {
    expect(outboundOpener("Sophie")).toBe(
      "Hello, it’s Sophie calling from Strata. Is now a convenient time?"
    );
    expect(outboundOpener("James")).not.toMatch(/recorded/i);
  });
});

describe("telnyxFlags", () => {
  it("defaults click-to-call, whatsapp, and autodial off", () => {
    expect(telnyxFlags({})).toEqual({
      inbound: false,
      clickToCall: false,
      whatsapp: false,
      warmAutodial: false,
    });
  });

  it("enables inbound only when TELNYX_INBOUND_ENABLED is true", () => {
    expect(telnyxFlags({ TELNYX_INBOUND_ENABLED: "true" }).inbound).toBe(true);
  });
});

describe("pickAssistant", () => {
  it("uses sophie for inbound", () => {
    expect(pickAssistant({ direction: "inbound" })).toBe("sophie");
  });

  it("uses sophie for outbound inbound-source files", () => {
    expect(pickAssistant({ direction: "outbound", source: "strata_inbound" })).toBe("sophie");
  });

  it("uses james for outbound distress_scan", () => {
    expect(pickAssistant({ direction: "outbound", source: "distress_scan" })).toBe("james");
  });
});

describe("outboundGate", () => {
  const okBase = {
    phone: "+441156611616",
    e164: true,
    stopListed: false,
    tpsClear: true,
    ctpsClear: true,
    sig06: false,
    consumerOrSoleTrader: false,
    optedOut: false,
    complaint: false,
    vulnerability: false,
    solicitor: false,
    now: new Date("2026-08-27T10:00:00+01:00"),
  };

  it("allows a weekday morning UK call", () => {
    expect(outboundGate(okBase)).toEqual({ ok: true });
  });

  it("blocks outside 09:00-17:00 Europe/London", () => {
    expect(outboundGate({ ...okBase, now: new Date("2026-08-27T18:30:00+01:00") }).ok).toBe(false);
  });

  it("blocks weekend", () => {
    expect(outboundGate({ ...okBase, now: new Date("2026-08-29T10:00:00+01:00") }).ok).toBe(false);
  });

  it("blocks TPS, stop list, SIG-06, sole trader, opt-out", () => {
    expect(outboundGate({ ...okBase, tpsClear: false }).ok).toBe(false);
    expect(outboundGate({ ...okBase, stopListed: true }).ok).toBe(false);
    expect(outboundGate({ ...okBase, sig06: true }).ok).toBe(false);
    expect(outboundGate({ ...okBase, consumerOrSoleTrader: true }).ok).toBe(false);
    expect(outboundGate({ ...okBase, optedOut: true }).ok).toBe(false);
  });
});

describe("warmAutodialGate", () => {
  const okBase = {
    phone: "+441234567890",
    e164: true,
    stopListed: false,
    tpsClear: true,
    ctpsClear: true,
    sig06: false,
    consumerOrSoleTrader: false,
    optedOut: false,
    complaint: false,
    vulnerability: false,
    solicitor: false,
    now: new Date("2026-08-27T10:00:00+01:00"),
    source: "strata_inbound",
  };

  it("allows inbound source", () => {
    expect(warmAutodialGate(okBase)).toEqual({ ok: true });
  });

  it("never auto-dials distress_scan / Stream A", () => {
    expect(warmAutodialGate({ ...okBase, source: "distress_scan" }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/shared/telnyxVoice.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`shared/telnyxVoice.ts`:

```ts
export const TELNYX_DID = "+441156611616";
export const TELNYX_TRANSFER_NUMBER = "+447898789313";

export const INBOUND_OPENER =
  "Thank you for calling Strata. How can I help you today? This call is recorded for training and compliance purposes.";

export function outboundOpener(name: "Sophie" | "James"): string {
  return `Hello, it’s ${name} calling from Strata. Is now a convenient time?`;
}

export type CallOutcome =
  | "connected"
  | "no_answer"
  | "amd"
  | "callback"
  | "opt_out"
  | "transferred"
  | "pack_promised";

function truthy(v: string | undefined): boolean {
  return v === "true" || v === "1" || v === "yes";
}

export function telnyxFlags(env: NodeJS.Dict<string> = process.env) {
  return {
    inbound: truthy(env.TELNYX_INBOUND_ENABLED),
    clickToCall: truthy(env.TELNYX_CLICK_TO_CALL_ENABLED),
    whatsapp: truthy(env.TELNYX_WHATSAPP_ENABLED),
    warmAutodial: truthy(env.TELNYX_WARM_AUTODIAL_ENABLED),
  };
}

export function pickAssistant(input: {
  direction: "inbound" | "outbound";
  source?: string;
}): "sophie" | "james" {
  if (input.direction === "inbound") return "sophie";
  if (input.source === "strata_inbound") return "sophie";
  return "james";
}

export type OutboundGateInput = {
  phone?: string | null;
  e164?: boolean;
  stopListed?: boolean;
  tpsClear?: boolean;
  ctpsClear?: boolean;
  sig06?: boolean;
  consumerOrSoleTrader?: boolean;
  optedOut?: boolean;
  complaint?: boolean;
  vulnerability?: boolean;
  solicitor?: boolean;
  now?: Date;
  source?: string;
};

function londonParts(now: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function outboundGate(input: OutboundGateInput): { ok: true } | { ok: false; reason: string } {
  if (!input.phone) return { ok: false, reason: "no phone" };
  if (input.e164 === false) return { ok: false, reason: "not e164" };
  if (input.stopListed) return { ok: false, reason: "stop list" };
  if (input.tpsClear === false) return { ok: false, reason: "tps" };
  if (input.ctpsClear === false) return { ok: false, reason: "ctps" };
  if (input.sig06) return { ok: false, reason: "sig-06" };
  if (input.consumerOrSoleTrader) return { ok: false, reason: "consumer" };
  if (input.optedOut) return { ok: false, reason: "opt-out" };
  if (input.complaint) return { ok: false, reason: "complaint" };
  if (input.vulnerability) return { ok: false, reason: "vulnerability" };
  if (input.solicitor) return { ok: false, reason: "solicitor" };
  const { weekday, hour } = londonParts(input.now ?? new Date());
  if (weekday === "Sat" || weekday === "Sun") return { ok: false, reason: "weekend" };
  if (hour < 9 || hour >= 17) return { ok: false, reason: "outside hours" };
  return { ok: true };
}

export function warmAutodialGate(input: OutboundGateInput) {
  if (input.source !== "strata_inbound") return { ok: false as const, reason: "not warm inbound" };
  return outboundGate(input);
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run server/__tests__/shared/telnyxVoice.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add shared/telnyxVoice.ts server/__tests__/shared/telnyxVoice.test.ts
git commit -m "feat: Telnyx voice copy, flags, and outbound gates"
```

---

### Task 2: Telnyx webhook signature

**Files:**
- Create: `server/services/telnyxSignature.ts`
- Test: `server/__tests__/services/telnyxSignature.test.ts`

**Interfaces:**
- Consumes: Node `crypto`
- Produces: `verifyTelnyxSignature(input: { publicKeyPem: string; timestamp: string; signatureB64: string; rawBody: string }): boolean`

Telnyx signs `${timestamp}|${rawBody}` with Ed25519. Header names: `telnyx-timestamp`, `telnyx-signature-ed25519`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { generateKeyPairSync, sign } from "crypto";
import { verifyTelnyxSignature } from "../../services/telnyxSignature";

describe("verifyTelnyxSignature", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const timestamp = "1690000000";
  const rawBody = `{"data":{"event_type":"call.hangup"}}`;
  const signatureB64 = sign(null, Buffer.from(`${timestamp}|${rawBody}`), privateKey).toString("base64");

  it("accepts a valid Ed25519 signature", () => {
    expect(
      verifyTelnyxSignature({ publicKeyPem, timestamp, signatureB64, rawBody })
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(
      verifyTelnyxSignature({
        publicKeyPem,
        timestamp,
        signatureB64,
        rawBody: rawBody + "x",
      })
    ).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(
      verifyTelnyxSignature({ publicKeyPem, timestamp: "", signatureB64, rawBody })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/telnyxSignature.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import { verify, createPublicKey } from "crypto";

export function verifyTelnyxSignature(input: {
  publicKeyPem: string;
  timestamp: string;
  signatureB64: string;
  rawBody: string;
}): boolean {
  if (!input.publicKeyPem || !input.timestamp || !input.signatureB64) return false;
  try {
    const key = createPublicKey(input.publicKeyPem);
    return verify(
      null,
      Buffer.from(`${input.timestamp}|${input.rawBody}`),
      key,
      Buffer.from(input.signatureB64, "base64")
    );
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run server/__tests__/services/telnyxSignature.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add server/services/telnyxSignature.ts server/__tests__/services/telnyxSignature.test.ts
git commit -m "feat: verify Telnyx Ed25519 webhook signatures"
```

---

### Task 3: Voice tools (lookup, pack, log, opt-out, transfer payload)

**Files:**
- Create: `server/services/telnyxVoice.ts`
- Test: `server/__tests__/services/telnyxVoice.test.ts`

**Interfaces:**
- Consumes: `storage.listAgenticDeals`, `storage.getAgenticDeal`, `storage.updateAgenticDeal` (or whatever update helper already exists — if none, append to `events` via the same path `agenticWorkflow` uses). `TELNYX_TRANSFER_NUMBER` from shared. `CallOutcome` from shared.
- Produces:
  - `normaliseUkCli(input: string): string` — digits to E.164 `+44...`
  - `lookupDealByCli(cli: string): Promise<LookupResult | null>`
  - `packStatusForDeal(deal): { missing: string[] }` — names only, from deal pack docs vs required list already on the file (use `deal.events` / existing missing-pack fields; if none, `missing: []` and `note: "no pack checklist on file"`)
  - `appendCallEvent(dealId: number, event: CallLogEvent): Promise<void>`
  - `optOutDeal(dealId: number): Promise<void>` — set a stop flag in events (`telnyx_opt_out`)
  - `transferInstruction(): { destination: "+447898789313" }`
  - `type LookupResult = { id: number; companyName: string; stage: string; source: string; contactName?: string; missing: string[] }`
  - `type CallLogEvent = { at: string; callControlId?: string; assistant: "sophie" | "james"; outcome: CallOutcome; recordingUrl?: string; transcript?: string }`

If `storage` has no `updateAgenticDeal`, add the smallest patch to `sqliteStorage.ts` / `storage.ts` that writes `events` and optional `phone`. Do not refactor the deal store.

- [ ] **Step 1: Write the failing test**

Use an in-memory fake, not SQLite:

```ts
import { describe, expect, it } from "vitest";
import { normaliseUkCli } from "../../services/telnyxVoice";

describe("normaliseUkCli", () => {
  it("turns 0115 661 1616 into +441156611616", () => {
    expect(normaliseUkCli("0115 661 1616")).toBe("+441156611616");
  });
  it("keeps E.164", () => {
    expect(normaliseUkCli("+441156611616")).toBe("+441156611616");
  });
  it("maps 07 mobiles to +447", () => {
    expect(normaliseUkCli("07898789313")).toBe("+447898789313");
  });
});
```

Add a second describe that injects a deal list via exporting `setDealStoreForTests` **only if** the service cannot take a `deps` argument. Prefer:

```ts
export function createTelnyxVoiceService(deps: {
  listDeals: () => Promise<AgenticDealFile[]>;
  getDeal: (id: number) => Promise<AgenticDealFile | undefined>;
  saveDeal: (deal: AgenticDealFile) => Promise<void>;
})
```

Test `lookupDealByCli` finds by normalised phone; misses return null. `optOutDeal` appends an event with message `telnyx_opt_out`. `appendCallEvent` appends `outcome`. `transferInstruction().destination` is `+447898789313`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/telnyxVoice.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation** matching the tests. `lookupDealByCli` compares `normaliseUkCli(deal.phone)` to `normaliseUkCli(cli)`. Never invent pack items.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run server/__tests__/services/telnyxVoice.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add server/services/telnyxVoice.ts server/__tests__/services/telnyxVoice.test.ts
git commit -m "feat: Telnyx voice deal lookup, log, opt-out, transfer target"
```

---

### Task 4: HTTP webhook + tools + click-to-call 403

**Files:**
- Create: `server/routes/telnyxVoice.ts`
- Modify: `server/routes.ts` — `app.use(telnyxVoiceRouter)` next to other `/api` mounts. The router owns full paths `/api/telnyx/voice`, `/api/telnyx/tools/:name`, `/api/agentic/deals/:id/call`.
- Test: extend `server/__tests__/services/telnyxVoice.test.ts` **or** add `server/__tests__/services/telnyxVoice.routes.test.ts` using the existing `appFactory` if it is cheap. If `appFactory` is heavy, unit-test a `handleTelnyxTool(name, body)` function exported from the route file instead of a full HTTP listen.

**Interfaces:**
- Consumes: `verifyTelnyxSignature`, `createTelnyxVoiceService`, `telnyxFlags`, `pickAssistant`, `outboundGate`, `warmAutodialGate`
- Produces:
  - `POST /api/telnyx/voice` — 401 if signature fails; 204 on hangup/recording after `appendCallEvent`
  - `POST /api/telnyx/tools/:name` — names `lookupDeal` | `packStatus` | `logOutcome` | `transferToShaun` | `optOut`; 404 unknown name
  - `POST /api/agentic/deals/:id/call` — `isAuthenticated`; **403** `{ error: "click-to-call disabled" }` when `telnyxFlags().clickToCall` is false (this is the required spec test). When flag is true (later), would call Telnyx — do **not** implement the Telnyx dial HTTP client in this task beyond a stub `placeOutboundCall` that throws `disabled` unless flag on.

Webhook uses `req.rawBody` already captured in `server/index.ts`. Headers: `telnyx-timestamp`, `telnyx-signature-ed25519`. Public key `process.env.TELNYX_PUBLIC_KEY` (PEM, newlines allowed as `\n`).

If `TELNYX_PUBLIC_KEY` is unset, webhook returns 503 `{ error: "telnyx public key missing" }` — do not skip verification.

Tool `lookupDeal` body: `{ from?: string; companyName?: string }`. Response JSON the assistant can read: `{ found: boolean, deal?: LookupResult }`.

Tool `transferToShaun` response: `{ destination: "+447898789313" }`.

- [ ] **Step 1: Write the failing test** for click-to-call 403 and invalid signature reject. Prefer invoking exported handlers:

```ts
it("rejects click-to-call when flag off", async () => {
  const { clickToCall } = await import("../../routes/telnyxVoice");
  const res = await clickToCall({ flags: { clickToCall: false } });
  expect(res.status).toBe(403);
});
```

If that shape is awkward, test a `clickToCallStatus(flags)` helper that returns 403 | 200.

Also: `warmAutodialCandidates(deals)` from Task 1/3 — Stream A `distress_scan` never included. Can live in `shared/telnyxVoice.ts` as:

```ts
export function isWarmAutodialDeal(deal: { source?: string }): boolean {
  return deal.source === "strata_inbound";
}
```

already covered by `warmAutodialGate`. Add one test that a mixed list filters to inbound only.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/services/telnyxVoice.routes.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement router + mount in `server/routes.ts`**

Import pattern already used:

```ts
import telnyxVoiceRouter from "./routes/telnyxVoice";
app.use(telnyxVoiceRouter);
```

`telnyxVoice.ts` router: `isAuthenticated` only on `/api/agentic/deals/:id/call`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run server/__tests__/shared/telnyxVoice.test.ts server/__tests__/services/telnyxSignature.test.ts server/__tests__/services/telnyxVoice.test.ts server/__tests__/services/telnyxVoice.routes.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```
git add server/routes/telnyxVoice.ts server/routes.ts server/__tests__/services/telnyxVoice.routes.test.ts
git commit -m "feat: Telnyx voice webhook, tools, and click-to-call flag"
```

---

### Task 5: Env docs and Sophie prompt (portal paste)

**Files:**
- Modify: `docs/ENV.md` — add a `### Telnyx Voice` table. No real keys.
- Create: `docs/superpowers/specs/telnyx-sophie-prompt.md` — the exact system prompt to paste into Telnyx Voice AI for Sophie (inbound). Include opener verbatim, transfer rules, never invent figures, never impersonate Shaun/David, tools list.

Env table rows:

| Variable | Description | Example |
|---|---|---|
| `TELNYX_API_KEY` | API key that can see this account (rotate if the old key returns empty numbers) | `KEY...` |
| `TELNYX_PUBLIC_KEY` | Ed25519 public key PEM for webhooks | `-----BEGIN PUBLIC KEY-----...` |
| `TELNYX_CONNECTION_ID` | Voice connection id | |
| `TELNYX_VOICE_APP_ID` | Call control / Voice AI app id | |
| `TELNYX_DID` | `+441156611616` | |
| `TELNYX_SOPHIE_ASSISTANT_ID` | Sophie assistant id | |
| `TELNYX_JAMES_ASSISTANT_ID` | James assistant id | |
| `TELNYX_TRANSFER_NUMBER` | `+447898789313` | |
| `TELNYX_INBOUND_ENABLED` | `true` only when DID is Active | `false` |
| `TELNYX_CLICK_TO_CALL_ENABLED` | keep `false` this slice | `false` |
| `TELNYX_WHATSAPP_ENABLED` | keep `false` | `false` |
| `TELNYX_WARM_AUTODIAL_ENABLED` | keep `false` | `false` |

Sophie prompt must contain the inbound opener **exactly** and: transfer to Shaun when they ask for a person / object / vulnerable / opt-out / terms or pricing; call `transferToShaun`; if transfer fails, end call and say Shaun will call back.

James prompt is not required for this slice (flag off).

Portal checklist (do in Telnyx Mission Control, not code): add **GB** to outbound profile Shaun; assign Sophie to the DID when Active; webhook URL `https://<host>/api/telnyx/voice`; recording on.

- [ ] **Step 1: Write the prompt file and ENV rows**
- [ ] **Step 2: Grep the prompt file for the inbound opener string — it must match `INBOUND_OPENER`**
- [ ] **Step 3: Commit**

```
git add docs/ENV.md docs/superpowers/specs/telnyx-sophie-prompt.md
git commit -m "docs: Telnyx env vars and Sophie inbound prompt"
```

Live inbound proof (call 0115, hear opener, transfer) is **blocked** until Telnyx marks the number Active. Do not claim inbound works without that call.

---

## Spec coverage

| Spec item | Task |
|---|---|
| Openers / no AI / recording inbound only | 1, 5 |
| Flags default off except inbound when Active | 1, 5 |
| GB profile / DID / Sophie / recording | 5 (portal) |
| Webhook signature | 2, 4 |
| Tools lookup/pack/log/transfer/optOut | 3, 4 |
| Click-to-call 403 when flag off | 4 |
| Warm autodial never Stream A | 1 |
| Transfer number / no voicemail script | 3, 5 |
| WhatsApp later | not built (flag false) |
| DID pending | 5 note |

No placeholders. Type names: `CallOutcome`, `OutboundGateInput`, `LookupResult`, `CallLogEvent`, `verifyTelnyxSignature`, `createTelnyxVoiceService`, `pickAssistant`, `warmAutodialGate`.
