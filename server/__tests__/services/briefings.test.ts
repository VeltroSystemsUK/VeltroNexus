import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import briefingsRouter from "../../routes/briefings";
import { helloHostMiddleware } from "../../helloHost";

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
import { setBriefingHttpGetForTests } from "@shared/briefingLinks";
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
  briefingPublicUrl,
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
  setBriefingSmtpReadyForTests,
  tickDirectOutreachBriefings,
} from "../../services/briefings";
import { setAgentMailStorePathForTests } from "../../services/agentMailLog";
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
  setAgentMailStorePathForTests(null);
  setBriefingHttpGetForTests(null);
  setBriefingSmtpReadyForTests(null);
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
    expect(html).toMatch(/noindex/);
    expect(html).not.toMatch(/Openers/);
    expect(html).toMatch(/briefing-pack/);
    expect(html).toMatch(/data-id="slide_1"/);
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
      sicCodes: ["43210"],
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
    setBriefingHttpGetForTests(async () => ({ status: 200 }));
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
    expect(blob).toMatch(/'dwell' on your site/);
    expect(blob).toMatch(/AI tracked your dwell/);
    expect(draft.packHtml).toMatch(/briefing-pack/);
    expect(draft.packHtml).toMatch(/data-company>North Peak Ltd/);
    expect(draft.packHtml).not.toMatch(/data-company>COMPANY NAME/);
    expect(draft.packHtml).not.toMatch(/data-company>\{\{/);
    expect(draft.generatedAt).toBeTruthy();
  });

  it("generate stamps live Veltro on filled Outreach href", async () => {
    writeOpeners([hotOpener()]);
    const draft = await generateOpenerBriefing("hot-id");
    const outreach = draft.filledSlides?.find((s) => s.slideId === "slide_6");
    expect(outreach?.links?.[0]?.href).toBe(`/veltro?b=${draft.token}`);
    expect(draft.slides.find((s) => s.title === "Outreach")?.veltroUrl).toBe(`/veltro?b=${draft.token}`);
    const preview = previewOpenerBriefingHtml("hot-id");
    expect(preview).toMatch(/veltro\.co\.uk\/#contact/);
    expect(preview).not.toMatch(/\{\{veltroUrl\}\}/);
  });

  it("generate returns the existing draft and refreshes the house pack", async () => {
    writeOpeners([hotOpener()]);
    const draft = await generateOpenerBriefing("hot-id");
    saveOpenerBriefingHtml("hot-id", "<html><body data-testid=\"briefing-pack\">stills only</body></html>");
    const again = await generateOpenerBriefing("hot-id");
    expect(again.id).toBe(draft.id);
    expect(again.token).toBe(draft.token);
    expect(again.filledSlides?.map((s) => s.slideId)).toEqual([
      "slide_1", "slide_2", "slide_3", "slide_4", "slide_5", "slide_6",
    ]);
    const stored = getBriefing(draft.id);
    expect(stored?.packHtml).toMatch(/data-id="slide_1"/);
    expect(stored?.packHtml).toMatch(/data-company>North Peak Ltd/);
    expect(stored?.packHtml).not.toMatch(/stills only/);
    expect(stored?.filledSlides).toHaveLength(6);
    expect(stored?.generatedAt).toBe(draft.generatedAt);
  });

  it("generate keeps staff edits on an existing house pack", async () => {
    writeOpeners([hotOpener()]);
    const draft = await generateOpenerBriefing("hot-id");
    const edited = String(draft.packHtml || "").replace(
      /data-company>North Peak Ltd/g,
      "data-company>Edited Peak Ltd"
    );
    saveOpenerBriefingHtml("hot-id", edited);
    const again = await generateOpenerBriefing("hot-id");
    expect(again.id).toBe(draft.id);
    expect(again.packHtml).toMatch(/data-company>Edited Peak Ltd/);
    expect(again.packHtml).not.toMatch(/data-company>North Peak Ltd/);
  });

  it("live fallback stamps Veltro on Outreach not Cashflow", async () => {
    writeOpeners([hotOpener()]);
    const draft = await generateOpenerBriefing("hot-id");
    const live = activateBriefing(draft.id);
    const cashflow = live.slides.find((s) => s.title === "Cashflow");
    const outreach = live.slides.find((s) => s.title === "Outreach");
    expect(cashflow?.enquiryUrl).toMatch(/#contact/);
    expect(cashflow?.veltroUrl).toBeUndefined();
    expect(outreach?.veltroUrl).toBe(`/veltro?b=${live.token}`);
    const html = renderBriefingHtml(live, { live: true });
    expect(html).toMatch(/veltro\.co\.uk\/#contact/);
    expect(html).not.toMatch(/\{\{veltroUrl\}\}/);
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

  it("generate fills the house pack so send does not wait on Convert", async () => {
    writeOpeners([hotOpener()]);
    const draft = await generateOpenerBriefing("hot-id");
    expect(draft.packHtml).toMatch(/briefing-pack/);
    const sent = await sendOpenerBriefing("hot-id");
    expect(sent.status).toBe("live");
    expect(sendEmail).toHaveBeenCalled();
  });

  it("send calls sendEmail and activates the token", async () => {
    writeOpeners([hotOpener()]);
    await generateOpenerBriefing("hot-id");
    saveOpenerBriefingHtml(
      "hot-id",
      "<html><body data-testid=\"briefing-pack\"><em data-industry>construction</em>North Peak Ltd</body></html>"
    );
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
    expect(String(html)).toMatch(new RegExp(`href="https://hello\\.stratanexus\\.co\\.uk/briefing/${sent.token}"`));
    expect(String(html)).not.toMatch(/href="https:\/\/leads\.stratanexus[^"]*\/briefing\//);
    expect(String(html)).not.toMatch(/https:\/\/[^"]+https:\/\//);
  });

  it("send preview shows signed cover and pack without activating or sending", async () => {
    writeOpeners([
      applyDirectOutreach(
        normalizeOpener({
          ...hotOpener(),
          directors: [{ name: "James Mint", role: "Director" }],
        })
      ),
    ]);
    await generateOpenerBriefing("hot-id");
    saveOpenerBriefingHtml(
      "hot-id",
      "<html><body data-testid=\"briefing-pack\">North Peak Ltd</body></html>"
    );
    const preview = previewOpenerBriefingSend("hot-id", { publicBaseUrl: "https://app.example" });
    expect(preview.subject).toMatch(/private note for the directors of North Peak Ltd/i);
    expect(preview.html).toMatch(/Hi James,/);
    expect(preview.html).toMatch(/margin:0 0 16px/);
    expect(preview.html).toMatch(/Shaun Tuhey/);
    expect(preview.html).toMatch(/07898 789 313/);
    expect(preview.html).toMatch(/href="https:\/\/app\.example\/briefing\/[^"]+"/);
    expect(preview.html).not.toMatch(/https:\/\/app\.examplehttps:/);
    expect(preview.html).toMatch(/target="_blank"/);
    expect(preview.packHtml).toContain("briefing-pack");
    const draft = getOpener("hot-id")!;
    expect(getLiveBriefingByToken(getBriefing(draft.briefingId!)!.token)).toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("send preview greets the director forename from Companies House SURNAME, Forename", async () => {
    writeOpeners([
      applyDirectOutreach(
        normalizeOpener({
          ...hotOpener(),
          directors: [{ name: "PEAK, Nora", role: "director" }],
        })
      ),
    ]);
    await generateOpenerBriefing("hot-id");
    const preview = previewOpenerBriefingSend("hot-id", { publicBaseUrl: "https://app.example" });
    expect(preview.html).toMatch(/Hi Nora,/);
    expect(preview.html).not.toMatch(/Hi PEAK/i);
  });

  it("send preview after generate shows the filled house pack", async () => {
    writeOpeners([hotOpener()]);
    await generateOpenerBriefing("hot-id");
    const preview = previewOpenerBriefingSend("hot-id", { publicBaseUrl: "https://app.example" });
    expect(preview.packHtml).toMatch(/data-company>North Peak Ltd/);
    expect(preview.packHtml).toMatch(/briefing-pack/);
    expect(sendEmail).not.toHaveBeenCalled();
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
    expect(html).toMatch(/briefing-pack/);
  });

  it("tools dwell path still generates the Gemini house script", () => {
    const draft = createDraftBriefing(
      sampleOpener({ lastDwellPath: "/#tools", nonBankChargeCount: 0, sicCodes: ["62012"] })
    );
    const blob = draft.slides.map((slide) => slide.body).join("\n");
    expect(blob).toMatch(/software space/);
    expect(blob).toMatch(/'dwell' on your site/);
    expect(draft.slides).toHaveLength(6);
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

  it("send preview without an override stamps the hello host, not leads", async () => {
    writeOpeners([hotOpener()]);
    await generateOpenerBriefing("hot-id");
    const preview = previewOpenerBriefingSend("hot-id");
    expect(preview.html).toMatch(/href="https:\/\/hello\.stratanexus\.co\.uk\/briefing\/[^"]+"/);
    expect(preview.html).not.toMatch(/href="https:\/\/leads\.stratanexus[^"]*\/briefing\//);
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

  it("leads host redirects briefing and Veltro to hello; hello 404s Nexus paths", async () => {
    const app = express();
    app.use(helloHostMiddleware);
    app.use(briefingsRouter);
    app.get("/veltro", (_req, res) => res.status(200).send("veltro-ok"));
    app.get("/pipeline", (_req, res) => res.status(200).send("nexus"));
    const live = activateBriefing(createDraftBriefing(sampleOpener()).id);

    const fromLeads = await request(app)
      .get(`/briefing/${live.token}`)
      .set("Host", "leads.stratanexus.co.uk");
    expect(fromLeads.status).toBe(301);
    expect(fromLeads.headers.location).toBe(
      `https://hello.stratanexus.co.uk/briefing/${live.token}`
    );

    const veltro = await request(app).get("/veltro").query({ b: live.token }).set("Host", "leads.stratanexus.co.uk");
    expect(veltro.status).toBe(301);
    expect(veltro.headers.location).toBe(
      `https://hello.stratanexus.co.uk/veltro?b=${live.token}`
    );

    const onHello = await request(app)
      .get(`/briefing/${live.token}`)
      .set("Host", "hello.stratanexus.co.uk");
    expect(onHello.status).toBe(200);
    expect(onHello.text).toMatch(/briefing-pack/);

    const nexus = await request(app).get("/pipeline").set("Host", "hello.stratanexus.co.uk");
    expect(nexus.status).toBe(404);
    expect(nexus.text).toMatch(/briefing-private-wall/);
    expect(nexus.text).not.toMatch(/nexus/i);
  });

  it("briefingPublicUrl defaults to hello.stratanexus.co.uk", () => {
    expect(briefingPublicUrl("tok")).toBe("https://hello.stratanexus.co.uk/briefing/tok");
    expect(briefingPublicUrl("tok", "https://app.example")).toBe("https://app.example/briefing/tok");
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

const INSIDE_WINDOW = new Date("2026-09-16T09:00:00.000Z");
const OUTSIDE_WINDOW = new Date("2026-09-16T20:00:00.000Z");

describe("SAL-3 Direct Outreach briefing tick", () => {
  beforeEach(() => {
    tmpStore();
    tmpOpenersStore();
    const mailFile = path.join(os.tmpdir(), `agent-mail-briefing-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
    setAgentMailStorePathForTests(mailFile);
    storeFiles.add(mailFile);
    vi.mocked(mailIsSuppressed).mockReturnValue(false);
    vi.mocked(sendEmail).mockResolvedValue({ success: true, id: "mail-1" } as never);
    setBriefingHttpGetForTests(async () => ({ status: 200 }));
    setBriefingSmtpReadyForTests(true);
  });

  it("does not send outside the Sales OS window", async () => {
    writeOpeners([hotOpener()]);
    expect(await tickDirectOutreachBriefings(OUTSIDE_WINDOW)).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(getOpener("hot-id")?.briefingId).toBeUndefined();
  });

  it("sends the director cover when industry maps and links are live", async () => {
    writeOpeners([hotOpener()]);
    const sent = await tickDirectOutreachBriefings(INSIDE_WINDOW);
    expect(sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [, , subject, html] = vi.mocked(sendEmail).mock.calls[0];
    expect(subject).toMatch(/private note for the directors of North Peak Ltd/i);
    expect(String(html)).toMatch(/hello\.stratanexus\.co\.uk\/briefing\//);
    expect(String(html)).toMatch(/Shaun Tuhey/);
    expect(getOpener("hot-id")?.briefingHold).toBeUndefined();
    const briefing = getBriefing(getOpener("hot-id")!.briefingId!);
    expect(briefing?.packHtml).toMatch(/data-industry>construction</);
    expect(briefing?.coverSentAt).toBeTruthy();
  });

  it("does not send twice in the same window", async () => {
    writeOpeners([hotOpener()]);
    await tickDirectOutreachBriefings(INSIDE_WINDOW);
    await tickDirectOutreachBriefings(INSIDE_WINDOW);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("holds when SIC cannot name a trade", async () => {
    writeOpeners([applyDirectOutreach(normalizeOpener({ ...hotOpener(), sicCodes: [] }))]);
    expect(await tickDirectOutreachBriefings(INSIDE_WINDOW)).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    const row = getOpener("hot-id")!;
    expect(row.status).toBe("direct_outreach");
    expect(row.briefingHold?.reason).toBe("industry_unknown");
  });

  it("sends after Shaun types an industry override", async () => {
    writeOpeners([
      applyDirectOutreach(normalizeOpener({ ...hotOpener(), sicCodes: [], industryOverride: "haulage" })),
    ]);
    expect(await tickDirectOutreachBriefings(INSIDE_WINDOW)).toBe(1);
    expect(getBriefing(getOpener("hot-id")!.briefingId!)?.packHtml).toMatch(/data-industry>haulage</);
  });

  it("does not send DNC and does not badge needs-you", async () => {
    vi.mocked(mailIsSuppressed).mockReturnValue(true);
    writeOpeners([hotOpener()]);
    expect(await tickDirectOutreachBriefings(INSIDE_WINDOW)).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(getOpener("hot-id")?.briefingHold).toBeUndefined();
    expect(getOpener("hot-id")?.status).toBe("not_now");
  });

  it("holds when a CTA is dead", async () => {
    setBriefingHttpGetForTests(async (url) => ({
      status: url.includes("stratafinance") ? 404 : 200,
    }));
    writeOpeners([hotOpener()]);
    expect(await tickDirectOutreachBriefings(INSIDE_WINDOW)).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(getOpener("hot-id")?.briefingHold?.reason).toBe("link_dead");
  });

  it("does not replace a Craft pack with the house template", async () => {
    writeOpeners([hotOpener()]);
    await generateOpenerBriefing("hot-id");
    saveOpenerBriefingHtml(
      "hot-id",
      `<html><body class="briefing-pack" data-testid="briefing-pack"><em data-industry>construction</em><a href="https://www.stratafinance.co.uk/#tools">finance</a><a href="https://veltro.co.uk/#contact">sales</a></body></html>`
    );
    await tickDirectOutreachBriefings(INSIDE_WINDOW);
    expect(getBriefing(getOpener("hot-id")!.briefingId!)?.packHtml).toMatch(/finance</);
    expect(getBriefing(getOpener("hot-id")!.briefingId!)?.packHtml).not.toMatch(/data-id="slide_1"/);
  });

  it("caps at 10 sends per tick and does not hold the rest", async () => {
    const rows = Array.from({ length: 11 }, (_, index) =>
      applyDirectOutreach(
        normalizeOpener({
          id: `hot-${index}`,
          email: `hot${index}@northpeak-briefing.test`,
          companyName: `North Peak ${index} Ltd`,
          sicCodes: ["43210"],
          dwellCount: 5,
          firstOpenedAt: "2026-09-01T10:00:00.000Z",
          lastOpenedAt: "2026-09-01T10:00:00.000Z",
        })
      )
    );
    writeOpeners(rows);
    expect(await tickDirectOutreachBriefings(INSIDE_WINDOW)).toBe(10);
    expect(sendEmail).toHaveBeenCalledTimes(10);
    expect(getOpener("hot-10")?.briefingHold).toBeUndefined();
  });

  it("revokes if sendEmail fails after activate", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ success: false, id: "mail-1" } as never);
    writeOpeners([hotOpener()]);
    expect(await tickDirectOutreachBriefings(INSIDE_WINDOW)).toBe(0);
    const opener = getOpener("hot-id")!;
    const briefing = opener.briefingId ? getBriefing(opener.briefingId) : undefined;
    expect(briefing?.status).not.toBe("live");
    expect(opener.briefingHold?.reason).toBe("smtp");
  });
});
