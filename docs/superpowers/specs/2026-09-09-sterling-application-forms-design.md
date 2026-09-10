# Sterling application forms (Word + customer e-sign)

Date: 2026-09-09
Status: agreed in conversation
Owner: Shaun Tuhey

## Flow

1. David completes his part on the prospect (Company + Contact application fields) and the Sterling recommendation.
2. He sends the application to the customer (`/apply/:token`). Known fields are pre-filled; blanks stay blank.
3. The customer completes the blanks and e-signs.
4. Once signed, David can send the lender pack. The pack includes the filled Word application for the chosen lender.

No AI invents identity, consents, or NI numbers.

## Artefacts

Word is the sendable form. BCRS (PDF) and CWRT (Excel) are recreated as Word with the same section structure and lender colours. FFE and First Enterprise stay Word. Originals remain in `server/templates/sterling/` as reference.

## Store

`dueDiligence.data.applicationData` (`ApplicationDataState`), including `token`, `sentAt`, `signedAt`, `signedName`.
