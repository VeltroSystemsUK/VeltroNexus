import { describe, expect, it } from "vitest";
import {
  fillSiteTrafficWindow,
  mergeSiteTrafficDays,
  siteTrafficFromMail,
} from "@shared/siteTraffic";

describe("siteTrafficFromMail", () => {
  it("buckets stratafinance clicks and dwells onto London days and ignores other hosts", () => {
    const days = siteTrafficFromMail(
      [
        {
          id: "mail-a",
          clicks: [
            { at: "2026-09-21T10:00:00.000Z", url: "https://www.stratafinance.co.uk/?sf=n1#tools" },
            { at: "2026-09-21T10:05:00.000Z", url: "https://stratafinance.co.uk/#contact" },
            { at: "2026-09-21T10:06:00.000Z", url: "https://veltro.co.uk/#contact" },
          ],
          dwells: [{ at: "2026-09-21T10:10:00.000Z", path: "/#tools" }],
        },
        {
          id: "mail-b",
          clicks: [{ at: "2026-09-21T11:00:00.000Z", url: "https://www.stratafinance.co.uk/?sf=n2#tools" }],
          dwells: [
            { at: "2026-09-21T11:10:00.000Z" },
            { at: "2026-09-21T11:20:00.000Z" },
          ],
        },
      ],
      new Date("2026-09-21T12:00:00.000Z")
    );

    expect(days).toEqual([
      { day: "2026-09-21", clicks: 3, uniqueClickThroughs: 2, dwells: 3 },
    ]);
  });

  it("splits a UTC evening click onto the next London calendar day", () => {
    const days = siteTrafficFromMail(
      [
        {
          id: "mail-a",
          clicks: [{ at: "2026-09-01T23:30:00.000Z", url: "https://www.stratafinance.co.uk/" }],
        },
      ],
      new Date("2026-09-02T12:00:00.000Z")
    );
    expect(days).toEqual([{ day: "2026-09-02", clicks: 1, uniqueClickThroughs: 1, dwells: 0 }]);
  });
});

describe("mergeSiteTrafficDays", () => {
  it("keeps the higher count so a rotated mail log cannot wipe an older day", () => {
    const merged = mergeSiteTrafficDays(
      [{ day: "2026-09-10", clicks: 226, uniqueClickThroughs: 100, dwells: 49 }],
      [{ day: "2026-09-10", clicks: 12, uniqueClickThroughs: 4, dwells: 2 }, { day: "2026-09-21", clicks: 244, uniqueClickThroughs: 106, dwells: 220 }]
    );
    expect(merged).toEqual([
      { day: "2026-09-10", clicks: 226, uniqueClickThroughs: 100, dwells: 49 },
      { day: "2026-09-21", clicks: 244, uniqueClickThroughs: 106, dwells: 220 },
    ]);
  });
});

describe("fillSiteTrafficWindow", () => {
  it("returns 30 London days ending today, with zeros for quiet days", () => {
    const filled = fillSiteTrafficWindow(
      [{ day: "2026-09-21", clicks: 244, uniqueClickThroughs: 106, dwells: 220 }],
      new Date("2026-09-21T12:00:00.000Z"),
      30
    );
    expect(filled).toHaveLength(30);
    expect(filled[0]).toEqual({ day: "2026-08-23", clicks: 0, uniqueClickThroughs: 0, dwells: 0 });
    expect(filled[filled.length - 1]).toEqual({
      day: "2026-09-21",
      clicks: 244,
      uniqueClickThroughs: 106,
      dwells: 220,
    });
  });
});
