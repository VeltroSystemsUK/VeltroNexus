import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  evaluateGuessPause,
  isGuessPaused,
  resumeGuessPause,
  setHarvestGuessStorePathForTests,
  tripGuessPause,
} from "../../services/harvestGuessStore";
import { liveAttachDeps } from "../../services/smeLeadHopper";

const storeFiles = new Set<string>();

function tmpStore(): string {
  const file = path.join(os.tmpdir(), `harvest-guess-${process.pid}-${Date.now()}.json`);
  setHarvestGuessStorePathForTests(file);
  storeFiles.add(file);
  return file;
}

afterEach(() => {
  for (const file of storeFiles) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      // ignore tmp cleanup
    }
  }
  storeFiles.clear();
  setHarvestGuessStorePathForTests(null);
});

describe("harvest guess pause store", () => {
  it("trips then resumes without auto-clear", () => {
    tmpStore();
    expect(isGuessPaused()).toBe(false);
    tripGuessPause({ bounced: 8, sampled: 50 });
    expect(isGuessPaused()).toBe(true);
    resumeGuessPause();
    expect(isGuessPaused()).toBe(false);
  });

  it("resume sticks through quality evaluation and the next harvest attach", () => {
    tmpStore();
    const items = Array.from({ length: 50 }, (_, i) => ({
      to: `n${i}@acme.co.uk`,
      status: "sent" as const,
      contactSource: "domain" as const,
      createdAt: `2020-01-01T00:${String(i).padStart(2, "0")}:00.000Z`,
    }));
    const suppressed = new Set(items.slice(0, 8).map((item) => item.to));
    tripGuessPause({ bounced: 8, sampled: 50 });
    resumeGuessPause();
    evaluateGuessPause(items, suppressed);
    expect(isGuessPaused()).toBe(false);
    expect(liveAttachDeps().guessPaused).toBe(false);
  });
});

