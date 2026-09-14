import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalizeOpener } from "@shared/openers";
import {
  activateBriefing,
  createDraftBriefing,
  getLiveBriefingByToken,
  mintBriefingToken,
  privateWallHtml,
  renderBriefingHtml,
  revokeBriefingsForOpener,
  setBriefingsStorePathForTests,
} from "../../services/briefings";
import { onOpenerUnsubscribed } from "../../services/openers";

const storeFiles = new Set<string>();

function tmpStore(): string {
  const file = path.join(os.tmpdir(), `briefings-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  setBriefingsStorePathForTests(file);
  process.env.BRIEFINGS_PATH = file;
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
  setBriefingsStorePathForTests(null);
  delete process.env.BRIEFINGS_PATH;
});

function sampleOpener() {
  return normalizeOpener({
    id: "op-north-peak",
    email: "ops@northpeak.co.uk",
    companyName: "North Peak Ltd",
    dwellCount: 5,
    nonBankChargeCount: 2,
    firstOpenedAt: "2026-09-01T10:00:00.000Z",
    lastOpenedAt: "2026-09-01T10:00:00.000Z",
  });
}

describe("briefing store tokens", () => {
  beforeEach(() => {
    tmpStore();
  });

  it("draft tokens do not resolve as live", () => {
    const draft = createDraftBriefing(sampleOpener());
    expect(getLiveBriefingByToken(draft.token)).toBeUndefined();
    expect(privateWallHtml()).toMatch(/briefing-private-wall/);
    expect(privateWallHtml()).not.toMatch(/North Peak/);
  });

  it("activate then revoke", () => {
    const draft = createDraftBriefing(sampleOpener());
    const live = activateBriefing(draft.id);
    expect(getLiveBriefingByToken(live.token)?.status).toBe("live");
    revokeBriefingsForOpener(sampleOpener().id);
    expect(getLiveBriefingByToken(live.token)).toBeUndefined();
  });

  it("live html names the company; wall does not", () => {
    const live = activateBriefing(createDraftBriefing(sampleOpener()).id);
    const html = renderBriefingHtml(live, { live: true });
    expect(html).toMatch(/North Peak/);
    expect(html).toMatch(/Prepared for the directors/);
    expect(html).toMatch(/noindex/);
    expect(html).not.toMatch(/Openers/);
    expect(html).toMatch(/briefing-pack/);
    expect(html).toMatch(/briefing-slide-1/);
    expect(privateWallHtml()).not.toMatch(/North Peak/);
    expect(privateWallHtml()).not.toMatch(/briefing-pack/);
  });

  it("mints an unguessable url-safe token", () => {
    const token = mintBriefingToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("onOpenerUnsubscribed revokes live briefings", () => {
    const opener = sampleOpener();
    const live = activateBriefing(createDraftBriefing(opener).id);
    onOpenerUnsubscribed(opener.id);
    expect(getLiveBriefingByToken(live.token)).toBeUndefined();
  });
});
