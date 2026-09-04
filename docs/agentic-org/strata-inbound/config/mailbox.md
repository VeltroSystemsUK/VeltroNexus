# Mailbox — SAL-1

Credentials live in env, never in this file.

- Address: `enquiries@stratafinance.co.uk`
- Host: IONOS IMAP (same house IONOS as Agent Mail)
- Read: INBOX, Sent, existing threads
- Write: Drafts only
- SMTP send: **not provisioned to this agent**
- Polling: session start, then as Shaun asks. Working window London 08:00–18:00 weekdays
- Signature: `templates/signature.md`
- From display: James Hale · Business Consultant
- Reply-To: `enquiries@stratafinance.co.uk`

IMAP host, folder names, and app password: same as Agent Mail (`IMAP_HOST` / `IMAP_USER` / `IMAP_PASS`, falling back to `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` for the IONOS login). Drafts are written with IMAP APPEND (`\\Draft`). SMTP send is never called from SAL-1. If login is missing, skip Drafts and still write the packet.
