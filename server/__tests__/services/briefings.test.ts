import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import briefingsRouter from "../../routes/briefings";

vi.mock("../../services/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("../../utils/companyEnrichment", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/companyEnrichment")>();
  return {
    ...actual,
    fetchWebsiteText: vi.fn(),
  };
});

vi.mock("../../services/mailDesk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/mailDesk")>();
  return {
    ...actual,
    mailIsSuppressed: vi.fn((email?: string | null, companyNumber?: string | null) =>
      actual.mailIsSuppressed(email, companyNumber)
    ),
  };
});

vi.mock("../../services/openers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/openers")>();
  return {
    ...actual,
    promoteOpener: vi.fn(async () => ({ opener: {}, prospectId: 1, created: true })),
  };
});

import { applyDirectOutreach, normalizeOpener } from "@shared/openers";
import { packHtmlFromPageImages } from "@shared/briefingCraft";
import { MAIL_DWELL_MS } from "@shared/mailTracking";
import { sendEmail } from "../../services/email";
import { mailIsSuppressed } from "../../services/mailDesk";
import { fetchWebsiteText } from "../../utils/companyEnrichment";
import {
  activateBriefing,
  briefingHtmlForToken,
  createDraftBriefing,
  fetchOpenerBriefingSite,
  generateOpenerBriefing,
  getBriefing,
  getLiveBriefingByToken,
  openerBriefingBind,
  publishOpenerBriefingPage,
  saveOpenerBriefingHtml,
  mintBriefingToken,
  previewOpenerBriefingHtml,
  privateWallHtml,
  recordBriefingDwell,
  recordBriefingDwellAndPromote,
  recordVeltroInterest,
  renderBriefingHtml,
  revokeBriefingsForOpener,
  sendOpenerBriefing,
  previewOpenerBriefingSend,
  setBriefingsStorePathForTests,
} from "../../services/briefings";
import {
  getOpener,
  hydrateFromAgentMail,
  onOpenerUnsubscribed,
  promoteOpener,
  setOpenersStorePathForTests,
  stopOpenerNurtureByEmail,
  writeOpeners,
} from "../../services/openers";

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
  setOpenersStorePathForTests(null);
  delete process.env.BRIEFINGS_PATH;
  vi.mocked(sendEmail).mockReset();
  vi.mocked(mailIsSuppressed).mockReset();
  vi.mocked(mailIsSuppressed).mockReturnValue(false);
  vi.mocked(fetchWebsiteText).mockReset();
});

function sampleOpener(overrides: Record<string, unknown> = {}) {
  return normalizeOpener({
    id: "op-north-peak",
    email: "ops@northpeak.co.uk",
    companyName: "North Peak Ltd",
    dwellCount: 5,
    nonBankChargeCount: 2,
    firstOpenedAt: "2026-09-01T10:00:00.000Z",
    lastOpenedAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
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

function tmpOpenersStore(): string {
  const file = path.join(os.tmpdir(), `openers-briefing-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  setOpenersStorePathForTests(file);
  storeFiles.add(file);
  return file;
}

function warmOpener() {
  return normalizeOpener({
    id: "warm-id",
    email: "warm@northpeak-briefing.test",
    companyName: "Warm Ltd",
    dwellCount: 2,
    firstOpenedAt: "2026-09-01T10:00:00.000Z",
    lastOpenedAt: "2026-09-01T10:00:00.000Z",
  });
}

function hotOpener() {
  return applyDirectOutreach(
    normalizeOpener({
      id: "hot-id",
      email: "hot@northpeak-briefing.test",
      companyName: "North Peak Ltd",
      dwellCount: 5,
      nonBankChargeCount: 2,
      firstOpenedAt: "2026-09-01T10:00:00.000Z",
      lastOpenedAt: "2026-09-01T10:00:00.000Z",
    })
  );
}

describe("generate and send opener briefing", () => {
  beforeEach(() => {
    tmpStore();
    tmpOpenersStore();
    vi.mocked(mailIsSuppressed).mockReturnValue(false);
    vi.mocked(sendEmail).mockResolvedValue({ success: true, id: "mail-1" } as never);
  });

  it("generate refuses non Direct Outreach", async () => {
    writeOpeners([warmOpener()]);
    await expect(generateOpenerBriefing("warm-id")).rejects.toMatchObject({ status: 409 });
  });

  it("generate freezes six filled mirror_portal slides", async () => {
    writeOpeners([hotOpener()]);
    const draft = await generateOpenerBriefing("hot-id");
    expect(draft.trackId).toBe("mirror_portal");
    expect(draft.filledSlides?.map((s) => s.slideId)).toEqual([
      "slide_1", "slide_2", "slide_3", "slide_4", "slide_5", "slide_6",
    ]);
    expect(draft.slides).toHaveLength(6);
    const blob = (draft.filledSlides || []).map((s) => s.body).join("\n");
    expect(blob).toMatch(/North Peak Ltd/);
    expect(blob.toLowerCase()).not.toMatch(/dwell on your site/);
    expect(draft.generatedAt).toBeTruthy();
  });

  it("send is blocked when suppressed", async () => {
    writeOpeners([hotOpener()]);
    const draft = await generateOpenerBriefing("hot-id");
    expect(draft.status).toBe("draft");
    saveOpenerBriefingHtml("hot-id", "<html><body data-testid=\"briefing-pack\">North Peak Ltd</body></html>");
    const current = getOpener("hot-id")!;
    writeOpeners([
      {
        ...current,
        nurture: { ...current.nurture, stopReason: "opt_out" },
      },
    ]);
    vi.mocked(mailIsSuppressed).mockReturnValue(true);
    await expect(sendOpenerBriefing("hot-id")).rejects.toMatchObject({ status: 403 });
    expect(getBriefing(draft.id)?.status).toBe("draft");
    expect(getLiveBriefingByToken(draft.token)).toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("send without a designed pack is 409", async () => {
    writeOpeners([hotOpener()]);
    await generateOpenerBriefing("hot-id");
    await expect(sendOpenerBriefing("hot-id")).rejects.toMatchObject({ status: 409 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("send calls sendEmail and activates the token", async () => {
    writeOpeners([hotOpener()]);
    await generateOpenerBriefing("hot-id");
    saveOpenerBriefingHtml("hot-id", "<html><body data-testid=\"briefing-pack\">North Peak Ltd</body></html>");
    const sent = await sendOpenerBriefing("hot-id");
    expect(sent.status).toBe("live");
    expect(getLiveBriefingByToken(sent.token)).toBeTruthy();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "director",
        fromEmail: "enquiries@stratafinance.co.uk",
        touchId: "direct_outreach",
      }),
      "hot@northpeak-briefing.test",
      expect.stringMatching(/private note for the directors of North Peak Ltd/i),
      expect.stringContaining(`/briefing/${sent.token}`)
    );
    const [, , subject, html] = vi.mocked(sendEmail).mock.calls[0];
    expect(subject).not.toMatch(/veltro/i);
    expect(String(html)).toMatch(/Shaun Tuhey/);
    expect(String(html)).toMatch(/07898 789 313/);
    expect(String(html)).toMatch(/Director/);
  });

  it("send preview shows signed cover and pack without activating or sending", async () => {
    writeOpeners([hotOpener()]);
    await generateOpenerBriefing("hot-id");
    saveOpenerBriefingHtml(
      "hot-id",
      "<html><body data-testid=\"briefing-pack\">North Peak Ltd</body></html>"
    );
    const preview = previewOpenerBriefingSend("hot-id", { publicBaseUrl: "https://app.example" });
    expect(preview.subject).toMatch(/private note for the directors of North Peak Ltd/i);
    expect(preview.html).toMatch(/Shaun Tuhey/);
    expect(preview.html).toMatch(/07898 789 313/);
    expect(preview.html).toMatch(/https:\/\/app\.example\/briefing\//);
    expect(preview.packHtml).toContain("briefing-pack");
    const draft = getOpener("hot-id")!;
    expect(getLiveBriefingByToken(getBriefing(draft.briefingId!)!.token)).toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("send preview without a designed pack is 409", async () => {
    writeOpeners([hotOpener()]);
    await generateOpenerBriefing("hot-id");
    expect(() => previewOpenerBriefingSend("hot-id")).toThrow(/convert to HTML/i);
  });

  it("send without a draft is 409", async () => {
    writeOpeners([hotOpener()]);
    await expect(sendOpenerBriefing("hot-id")).rejects.toMatchObject({ status: 409 });
  });

  it("bind payload names this company", () => {
    const opener = hotOpener();
    writeOpeners([opener]);
    const bind = openerBriefingBind(opener);
    expect(bind.companyName).toBe("North Peak Ltd");
    expect(bind.dwellLine).toMatch(/several times/);
    expect(bind.hypothesis.id).toBe("stacked_debt");
  });

  it("site fetch returns capped bullets from the company URL", async () => {
    writeOpeners([hotOpener()]);
    await generateOpenerBriefing("hot-id");
    vi.mocked(fetchWebsiteText).mockResolvedValue(
      "We fit commercial kitchens across the South West for hotels.\nHi\nTrading since 2014 with forty staff on live contracts."
    );
    const site = await fetchOpenerBriefingSite("hot-id", "https://northpeak.example");
    expect(site.url).toMatch(/^https:\/\/northpeak\.example/);
    expect(site.bullets[0]).toMatch(/commercial kitchens/);
    expect(fetchWebsiteText).toHaveBeenCalled();
  });

  it("saves raster pack HTML even when CSS contains 100%", async () => {
    writeOpeners([hotOpener()]);
    await generateOpenerBriefing("hot-id");
    const html = packHtmlFromPageImages({
      companyName: "North Peak Ltd",
      images: ["data:image/jpeg;base64,/9j/aaaa"],
    });
    expect(html).toMatch(/100%/);
    const saved = saveOpenerBriefingHtml("hot-id", html);
    expect(saved.packHtml).toContain("briefing-pack");
    expect(saved.packHtml).toContain("North Peak Ltd");
  });

  it("saving pack HTML and create page mints a live link without sending", async () => {
    writeOpeners([hotOpener()]);
    await generateOpenerBriefing("hot-id");
    const html = "<html><body data-testid=\"briefing-pack\">North Peak Ltd</body></html>";
    const saved = saveOpenerBriefingHtml("hot-id", html);
    expect(saved.packHtml).toContain("North Peak Ltd");
    const page = publishOpenerBriefingPage("hot-id", { publicBaseUrl: "https://app.example" });
    expect(page.briefing.status).toBe("live");
    expect(page.pageUrl).toMatch(/https:\/\/app\.example\/briefing\//);
    expect(getLiveBriefingByToken(page.briefing.token)?.packHtml).toContain("North Peak Ltd");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("staff preview is html without tracking", async () => {
    writeOpeners([hotOpener()]);
    await generateOpenerBriefing("hot-id");
    const html = previewOpenerBriefingHtml("hot-id");
    expect(html).toMatch(/North Peak/);
    expect(html).not.toMatch(/dwell\.gif/);
    expect(html).not.toMatch(/briefing-pack/);
  });

  it("tools dwell path picks working_capital", () => {
    const draft = createDraftBriefing(
      sampleOpener({ lastDwellPath: "/#tools", nonBankChargeCount: 0, sicCodes: ["62012"] })
    );
    const blob = draft.slides.map((slide) => `${slide.title}\n${slide.body}`).join("\n");
    expect(blob.toLowerCase()).toMatch(/working capital|spent time on the tools/);
  });
});

describe("public pack dwell and auto-promote", () => {
  beforeEach(() => {
    tmpStore();
    tmpOpenersStore();
    vi.mocked(promoteOpener).mockClear();
    vi.mocked(promoteOpener).mockResolvedValue({ opener: {}, prospectId: 1, created: true } as never);
  });

  it("unknown token is a wall without the company name", () => {
    const html = briefingHtmlForToken("nope");
    expect(html).toMatch(/briefing-private-wall/);
    expect(html).not.toMatch(/North Peak/);
  });

  it("first dwell promotes; staff session does not", async () => {
    const opener = sampleOpener({ companyNumber: "08765432" });
    writeOpeners([opener]);
    const live = activateBriefing(createDraftBriefing(opener).id);
    const ignored = recordBriefingDwell(live.token, { staffSession: true });
    expect(ignored.recorded).toBe(false);
    const first = await recordBriefingDwellAndPromote(live.token, { staffSession: false });
    expect(first.recorded).toBe(true);
    expect(first.promoted).toBe(true);
    const second = await recordBriefingDwellAndPromote(live.token, { staffSession: false });
    expect(second.promoted).toBe(false);
  });

  it("live pack html waits MAIL_DWELL_MS then requests dwell.gif", () => {
    const live = activateBriefing(createDraftBriefing(sampleOpener()).id);
    const html = briefingHtmlForToken(live.token);
    expect(html).toMatch(/North Peak/);
    expect(html).toMatch(/briefing-pack/);
    expect(html).toMatch(/dwell\.gif/);
    expect(html).toMatch(String(MAIL_DWELL_MS));
    expect(html).toMatch(/setTimeout/);
    expect(html).not.toMatch(/Openers/);
  });

  it("draft and revoked tokens are walls without the company name", () => {
    const draft = createDraftBriefing(sampleOpener());
    expect(briefingHtmlForToken(draft.token)).toMatch(/briefing-private-wall/);
    expect(briefingHtmlForToken(draft.token)).not.toMatch(/North Peak/);
    const live = activateBriefing(draft.id);
    revokeBriefingsForOpener(sampleOpener().id);
    expect(briefingHtmlForToken(live.token)).toMatch(/briefing-private-wall/);
    expect(briefingHtmlForToken(live.token)).not.toMatch(/North Peak/);
  });

  it("Nexus referer does not record dwell or promote", async () => {
    const live = activateBriefing(createDraftBriefing(sampleOpener({ companyNumber: "08765432" })).id);
    const ignored = await recordBriefingDwellAndPromote(live.token, {
      staffSession: false,
      referer: "https://leads.stratanexus.co.uk/agent-mail",
    });
    expect(ignored.recorded).toBe(false);
    expect(ignored.promoted).toBe(false);
    expect(promoteOpener).not.toHaveBeenCalled();
  });

  it("dwell without a company number records and does not promote", async () => {
    writeOpeners([sampleOpener()]);
    const live = activateBriefing(createDraftBriefing(sampleOpener()).id);
    const result = await recordBriefingDwellAndPromote(live.token, { staffSession: false });
    expect(result.recorded).toBe(true);
    expect(result.promoted).toBe(false);
    expect(promoteOpener).not.toHaveBeenCalled();
  });

  it("DNC pack dwell records and does not promote", async () => {
    const opener = sampleOpener({
      companyNumber: "08765432",
      status: "not_now",
      nurture: {
        step: 3,
        touch1Status: "idle",
        touch2Status: "idle",
        stopReason: "opt_out",
        stream: "opener_3touch",
        closerStatus: "idle",
      },
    });
    writeOpeners([opener]);
    const live = activateBriefing(createDraftBriefing(opener).id);
    const result = await recordBriefingDwellAndPromote(live.token, { staffSession: false });
    expect(result.recorded).toBe(true);
    expect(result.promoted).toBe(false);
    expect(promoteOpener).not.toHaveBeenCalled();
  });

  it("GET /briefing/:token is 200 pack or wall with X-Robots-Tag", async () => {
    const app = express();
    app.use(briefingsRouter);
    const wall = await request(app).get("/briefing/nope");
    expect(wall.status).toBe(200);
    expect(wall.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(wall.text).toMatch(/briefing-private-wall/);
    expect(wall.text).not.toMatch(/North Peak/);
    const live = activateBriefing(createDraftBriefing(sampleOpener()).id);
    const pack = await request(app).get(`/briefing/${live.token}`);
    expect(pack.status).toBe(200);
    expect(pack.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(pack.text).toMatch(/briefing-pack/);
    expect(pack.text).toMatch(/North Peak/);
    expect(pack.text).toMatch(/dwell\.gif/);
  });
});

describe("Veltro interest and STOP revoke", () => {
  beforeEach(() => {
    tmpStore();
    tmpOpenersStore();
    vi.mocked(promoteOpener).mockClear();
  });

  it("Veltro interest flags the opener and does not promote", async () => {
    const openerRow = sampleOpener({ companyNumber: "08765432", status: "direct_outreach" });
    writeOpeners([openerRow]);
    const live = activateBriefing(createDraftBriefing(openerRow).id);
    const result = recordVeltroInterest(live.token);
    expect(result.flagged).toBe(true);
    expect(getOpener(openerRow.id)?.veltroInterestAt).toBeTruthy();
    expect(getOpener(openerRow.id)?.status).toBe("direct_outreach");
    expect(promoteOpener).not.toHaveBeenCalled();
  });

  it("STOP revokes the briefing", () => {
    const openerRow = sampleOpener({ status: "direct_outreach", dwellCount: 5 });
    writeOpeners([openerRow]);
    const live = activateBriefing(createDraftBriefing(openerRow).id);
    stopOpenerNurtureByEmail(openerRow.email, "opt_out");
    expect(getLiveBriefingByToken(live.token)).toBeUndefined();
    expect(getOpener(openerRow.id)?.status).toBe("not_now");
  });

  it("hydrate DNC revokes the pack", () => {
    const openerRow = sampleOpener({ status: "direct_outreach", dwellCount: 5 });
    writeOpeners([openerRow]);
    const live = activateBriefing(createDraftBriefing(openerRow).id);
    expect(getLiveBriefingByToken(live.token)?.status).toBe("live");
    hydrateFromAgentMail([], undefined, { optOutEmails: [openerRow.email] });
    expect(getLiveBriefingByToken(live.token)).toBeUndefined();
    expect(getOpener(openerRow.id)?.status).toBe("not_now");
  });
});
