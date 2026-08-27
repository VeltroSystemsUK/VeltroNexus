# Telnyx voice for Strata / NEXUS

Date: 2026-08-27  
Status: draft for review  
Repo: Nexus

## Goal

Strata’s Nottingham number answers and places calls through Telnyx Voice AI. NEXUS owns who may be called, the deal file, and the outcome. Sophie handles inbound and warm files. James handles click-to-call first-touch. WhatsApp on the same number is a later slice.

## Locked decisions

- Carrier and voice: **Telnyx Voice AI** on **+44 115 661 1616**. No Vapi. No custom media streaming in NEXUS.
- Transfer mobile: **+44 7898 789313**. If unanswered: stop, log, queue Shaun in NEXUS. No rambling voicemail.
- Assistants: **Sophie Reed** inbound, pack chase, warm auto-dial. **James Hale** click-to-call first-touch Stream A/B only.
- Opener inbound: `Thank you for calling Strata. How can I help you today? This call is recorded for training and compliance purposes.`
- Opener outbound: `Hello, it’s [Sophie/James] calling from Strata. Is now a convenient time?` No recording sentence on outbound. Calls are still recorded.
- No spoken “I am AI.” Name-and-company only. CMA misleading-omission risk accepted.
- Auto-dial ceiling: **warm only** — `source = strata_inbound` or inbound pack-chase (`queueCall` on the inbound cadence). Stream A day-14 and Stream B partner calls stay click-to-call.
- Transfer when: they ask for a person; object; sound vulnerable; opt out; ask for terms, pricing, or a lending promise.
- Hours: outbound Mon–Fri 09:00–17:00 UK. Inbound always on (once the DID is Active).
- Flags, default off except inbound once Active: (1) inbound AI (2) click-to-call (3) WhatsApp (4) warm auto-dial.
- House rules still apply: never impersonate Shaun or David; never invent figures; never say a facility is approved; SIG-06 / consumer / sole trader never contacted; opt-out is immediate and permanent.
- The 0115 order is **pending Telnyx documentation**. Nothing places or receives a live PSTN call until the number is **Active**.

## Non-goals (this spec)

- WhatsApp Business signup, templates, or messaging (flag 3, later).
- Stream A / Stream B auto-dial.
- Cloning Shaun’s voice.
- Reviving the unofficial WhatsApp QR integration.

## Architecture

```
Caller / SME
    ⇅  PSTN (+44 115 661 1616)
Telnyx Voice AI  (Sophie inbound+warm, James click-to-call)
    ⇅  tools + webhooks
NEXUS  (eligibility, deal context, pack status, log, queue Shaun)
    ⇅  SIP transfer
Shaun  +44 7898 789313
```

NEXUS never streams audio. Telnyx owns the call, TTS, STT, and recording. NEXUS answers tool calls and hangup webhooks.

## Telnyx objects

- DID **+44 115 661 1616** assigned to one Voice AI / Call Control application.
- Outbound voice profile **Shaun**: add **GB** to allowed destinations (today US+CA only). Traffic type conversational. Attach the Voice connection.
- Application webhook: `POST /api/telnyx/voice` with Ed25519/public-key signature verification (`TELNYX_PUBLIC_KEY`).
- Assistants `sophie` and `james`. Inbound DID assignment is Sophie. Outbound passes `assistant_id` from NEXUS.
- Call recording on. Transcript + recording URL posted to NEXUS on hangup.
- Answering-machine detection on outbound: hang up, log `amd`, do not play the script.

## NEXUS

Env (never commit secrets): `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `TELNYX_CONNECTION_ID`, `TELNYX_VOICE_APP_ID`, `TELNYX_DID=+441156611616`, `TELNYX_SOPHIE_ASSISTANT_ID`, `TELNYX_JAMES_ASSISTANT_ID`, `TELNYX_TRANSFER_NUMBER=+447898789313`.

Feature flags (env or settings): `TELNYX_INBOUND_ENABLED`, `TELNYX_CLICK_TO_CALL_ENABLED`, `TELNYX_WHATSAPP_ENABLED`, `TELNYX_WARM_AUTODIAL_ENABLED`.

Routes:

- `POST /api/telnyx/voice` — Telnyx webhook (unauthenticated except signature). Events: call.initiated (inbound), hangup, recording.saved, conversation.ended.
- `POST /api/telnyx/tools/:name` — assistant tools, authenticated by Telnyx tool secret or signed JWT from the call.
- `POST /api/agentic/deals/:id/call` — authenticated user; click-to-call. Requires flag 2 and a phone on the file.

Tools the assistant may call:

| Tool | Does |
|---|---|
| `lookupDeal` | Match CLI or spoken company name to a deal. Return stage, contact, missing pack items. |
| `packStatus` | Named missing documents only. No invented figures. |
| `logOutcome` | Write transcript snippet + structured outcome on the deal (`connected`, `no_answer`, `amd`, `callback`, `opt_out`, `transferred`, `pack_promised`). |
| `transferToShaun` | Warm transfer to +44 7898 789313. |
| `optOut` | Stop list + halt cadence. |

Call Centre UI: **Call** on a queued file starts Telnyx outbound with the correct assistant. Timeline on the deal shows recording link, transcript, assistant, outcome.

Warm auto-dial job (flag 4): select deals that pass the eligibility list below; one attempt per file per day; AMD hangup.

## Eligibility (every outbound)

Must all pass:

- Phone in E.164.
- Not on internal stop list.
- TPS and CTPS screen within 28 days.
- Not SIG-06; not consumer / sole trader / unincorporated partnership.
- No prior opt-out, complaint, solicitor, or vulnerability flag.
- Mon–Fri 09:00–17:00 Europe/London.

Warm auto-dial additionally requires `source = strata_inbound` or inbound cadence `queueCall`. Click-to-call may place Stream A/B files; auto-dial may not.

## Call behaviour

Inbound: Sophie. Match CLI. No match: name, number, need; open/queue file; offer Shaun. Match: pack chase or help. Never invent figures or terms.

Click-to-call: James if Stream A/B first-touch; Sophie if inbound/pack chase.

Hard stop → `transferToShaun`. If transfer fails: log, queue Shaun, end call.

Opt-out language on outbound if they object: stop immediately, confirm they will not be called again, `optOut`.

## First implementation slice

1. Telnyx: GB on outbound profile, Voice app, Sophie assigned to DID, webhook URL, recording.
2. NEXUS: env, signature-checked webhook, `lookupDeal` + `logOutcome` + `transferToShaun` + `optOut`.
3. Inbound flag on when DID is Active. Prove with a call to 0115 that Sophie answers, records, and can transfer.
4. Click-to-call and warm auto-dial stay off until inbound is proven.

## Test

- Inbound to 0115: opener exact, recording sentence present, transfer to +44 7898 789313 on “put Shaun on”.
- Inbound no-match: file queued, no invented figures.
- Click-to-call with flag off: 403.
- Warm auto-dial with flag off: no dial.
- Outbound (when flag 2 on): no recording sentence; AMD hangup logged.
- Stop list / TPS: no dial.
- Stream A file never selected by auto-dial job.

## Risks

- DID pending docs: blocked on Telnyx numbering, not on code.
- Outbound recording without spoken notice: ICO transparency gap, accepted.
- No “AI” disclosure: CMA misleading-omission gap, accepted.
- Env `TELNYX_API_KEY` in `.env.local` currently returns $0/no numbers via API; after upgrade, rotate and use a key that sees this account.
