import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isGuessPaused,
  resumeGuessPause,
  setHarvestGuessStorePathForTests,
  tripGuessPause,
} from "../../services/harvestGuessStore";

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
});
