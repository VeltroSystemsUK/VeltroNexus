# Direct Outreach — per-company Craft session

Date: 2026-09-14  
Status: approved to build  
Related: `docs/superpowers/specs/2026-09-14-direct-outreach-design.md`

## Goal

Generate on a Direct Outreach card opens Craft **for that company**. Shaun art-directs a personalised pack, converts it to HTML, then Create page mints a private link to send.

## Loop

1. Generate → `/craft/briefing/:openerId` (creates draft briefing if needed).
2. Canvas loads five pages already filled with their name, dwell line, filings, hypothesis, mechanism.
3. URL field fetches readable site copy into a well; drop onto the board.
4. Convert to HTML fills leftover `{{merge}}` tags from this opener, snapshots each page, stores `packHtml`.
5. Create page activates `/briefing/:token` and shows the link. Does not send.
6. Send remains Shaun via `enquiries@` with that link. Preview still required.

## Non-goals

- House template signed off once (this is per-company).
- Live motion in the public player (stills of the art).
- A new Marketing studio page.
