# PECR / opt-out

Marketing send after opt-out is an ICO offence. Treat a STOP as the organisation, not one mailbox.

- Every outbound path must go through `sendEmail` / `mailIsSuppressed`. Do not add a new sender that skips that gate.
- `isSuppressed` matches exact email always. **Opt-out** also matches company number and every other mailbox at the same **corporate** domain. Personal domains (gmail, hotmail, …) stay address-only. **Hard bounce** is that mailbox only — not the company, not the domain.
- On inbound STOP, suppress every email on the opener card plus the company number.
- Hard-coded never-contact still applies to MUSIC INDUSTRY EDUCATION LLP (`admin@` / `accounts@` / `OC421480`).
- Suppression lives in `uploads/mail_suppression.json`. It must not be wiped with Agent Mail.
