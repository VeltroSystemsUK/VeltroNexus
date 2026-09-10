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
