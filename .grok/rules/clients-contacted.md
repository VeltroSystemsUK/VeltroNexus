# Clients contacted

Every successful send to a sourced lead must show on Clients. Do not leave contact only on Agent Mail or Campaigns.

- `GET /api/god/crm/leads` must run `annotateCrmLeads`. Do not return raw internal leads without `contacted` and `doNotContact`.
- Contacted = Agent Mail outbound `sent` or `mock` to the lead email or a contact email, **or** a campaign recipient in `sent` / `delivered` / `opened` / `clicked` / `unsubscribed` / `bounced`. `pending` and `failed` do not count.
- Do not contact = opt-out / never-contact / campaign `unsubscribed`. DNC wins on the card (`data-testid="badge-do-not-contact"`). Hard bounce is **not** org DNC — Clients shows `data-testid="badge-lead-bounced"` on that mailbox only, and Harper hunts a director address on the next tick.
- Every outbound path that contacts a CRM lead must go through `sendEmail` in `server/services/email.ts` (which `logAgentMail`s) or campaign recipients. Do not add a sender that skips those logs.
- Do not store a separate contacted flag on `InternalLead` that can drift. Clients is derived from the send logs on GET.
- Board: Contacted `data-testid="badge-lead-contacted"`, Not sent `data-testid="badge-lead-not-sent"`. Filter All / Not sent / Contacted / Do not contact.
