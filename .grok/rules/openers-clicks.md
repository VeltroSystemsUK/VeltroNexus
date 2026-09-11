# Openers clicks

Clicks on Agent Mail are first-class Openers data. Do not leave them only on the mail timeline.

- `recordClick` must upsert the opener the same way `recordOpen` upserts opens. Store `clickCount` on `OpenerRecord`.
- Hydrate from Agent Mail must set `clickCount` from outbound `clicks` (sum, no double-count).
- A click is enough to put a company on the Openers board (`new`), even without an open pixel.
- Board cards show a dedicated clicks badge when `clickCount > 0` (`data-testid="badge-opener-clicks"`). Do not bury clicks inside the opens badge.
- Rank inside a column: clicks desc, then opens desc, then company name (email if unnamed) A–Z.
