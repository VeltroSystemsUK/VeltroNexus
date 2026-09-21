import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  setSiteTrafficStorePathForTests,
  snapshotSiteTraffic,
} from "../../services/siteTraffic";

const storeFiles = new Set<string>();

function tmpStore(): string {
  const file = path.join(os.tmpdir(), `site-traffic-${process.pid}-${Date.now()}.json`);
  setSiteTrafficStorePathForTests(file);
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
  setSiteTrafficStorePathForTests(null);
});

describe("snapshotSiteTraffic", () => {
  it("returns a 30-day window and keeps an older day after the mail log is empty", () => {
    tmpStore();
    const now = new Date("2026-09-21T12:00:00.000Z");
    const first = snapshotSiteTraffic(
      [
        {
          id: "mail-old",
          clicks: [{ at: "2026-09-10T10:00:00.000Z", url: "https://www.stratafinance.co.uk/?sf=n1#tools" }],
          dwells: [{ at: "2026-09-10T10:10:00.000Z" }],
        },
      ],
      now
    );
    expect(first).toHaveLength(30);
    expect(first.find((row) => row.day === "2026-09-10")).toEqual({
      day: "2026-09-10",
      clicks: 1,
      uniqueClickThroughs: 1,
      dwells: 1,
    });

    const afterRotate = snapshotSiteTraffic([], now);
    expect(afterRotate.find((row) => row.day === "2026-09-10")).toEqual({
      day: "2026-09-10",
      clicks: 1,
      uniqueClickThroughs: 1,
      dwells: 1,
    });
  });
});
