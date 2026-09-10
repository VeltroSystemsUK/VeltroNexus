import { describe, expect, it } from "vitest";
import { buildHuntQuality, qualityAlerts } from "@shared/smeQuality";

describe("hunt quality snapshot", () => {
  it("reports yield, director/role mix, and progress to 240", () => {
    const snap = buildHuntQuality({
      scanned: 40,
      deliverable: 10,
      director: 7,
      role: 3,
      sent: 8,
      opened: 3,
      replied: 1,
      rejected: { "no corporate mailbox": 25, "personal mailbox — PECR": 5 },
      budget: {
        total: { ch: 800, places: 400, firecrawl: 400, smtp: 150 },
        remaining: { ch: 760, places: 360, firecrawl: 390, smtp: 142 },
      },
      remainingSlots: 92,
    });
    expect(snap.yieldPct).toBe(25);
    expect(snap.director).toBe(7);
    expect(snap.role).toBe(3);
    expect(snap.deliverable).toBe(10);
    expect(snap.target).toBe(240);
  });

  it("warns before the day is lost", () => {
    const lowYield = qualityAlerts({
      scanned: 80,
      deliverable: 4,
      sent: 0,
      replied: 0,
      remainingSlots: 100,
      budget: {
        total: { ch: 800, places: 400, firecrawl: 400, smtp: 150 },
        remaining: { ch: 700, places: 70, firecrawl: 380, smtp: 150 },
      },
      chCooldown: false,
      smtpFailed: 2,
    });
    const messages = lowYield.map((item) => item.message).join(" ");
    expect(messages).toMatch(/yield/i);
    expect(messages).toMatch(/Places/i);
    expect(messages).toMatch(/SMTP/i);

    const blocked = qualityAlerts({
      scanned: 20,
      deliverable: 2,
      sent: 0,
      replied: 0,
      remainingSlots: 100,
      budget: {
        total: { ch: 800, places: 400, firecrawl: 400, smtp: 150 },
        remaining: { ch: 0, places: 400, firecrawl: 400, smtp: 150 },
      },
      chCooldown: true,
      smtpFailed: 0,
    });
    expect(blocked.some((item) => item.tone === "red" && /Companies House/i.test(item.message))).toBe(true);
  });

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
});

