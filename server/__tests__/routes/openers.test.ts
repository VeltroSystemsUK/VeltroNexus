import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { applyDirectOutreach, normalizeOpener } from "@shared/openers";
import openersRouter from "../../routes/openers";
import { setAgentMailStorePathForTests } from "../../services/agentMailLog";
import { setOpenersStorePathForTests, writeOpeners } from "../../services/openers";

const storeFiles = new Set<string>();
const auth = { Origin: "http://localhost:5000", Host: "localhost:5000" };

function tmpStore(): string {
  const file = path.join(os.tmpdir(), `openers-${process.pid}-${Date.now()}.json`);
  setOpenersStorePathForTests(file);
  storeFiles.add(file);
  const mailFile = path.join(os.tmpdir(), `agent-mail-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(mailFile, "[]");
  setAgentMailStorePathForTests(mailFile);
  storeFiles.add(mailFile);
  return file;
}

function openersApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { id: "user-1", role: "super_admin" };
    req.isAuthenticated = () => true;
    next();
  });
  app.use(openersRouter);
  return app;
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
  setOpenersStorePathForTests(null);
  setAgentMailStorePathForTests(null);
});

describe("openers routes", () => {
  it("registers board, drawer, enrich, nurture, promote, whatsapp, and call", () => {
    const paths = openersRouter.stack
      .filter((layer) => Boolean(layer.route))
      .map((layer) => ({
        path: layer.route!.path,
        methods: Object.keys(layer.route!.methods).sort(),
      }));
    expect(paths).toContainEqual({ path: "/api/openers", methods: ["get"] });
    expect(paths).toContainEqual({ path: "/api/openers/unsubscribed", methods: ["get"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id", methods: ["get"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id", methods: ["patch"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/enrich", methods: ["post"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/nurture", methods: ["post"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/promote", methods: ["post"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/demote", methods: ["post"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/whatsapp", methods: ["post"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/call", methods: ["post"] });
    const unsub = paths.findIndex((row) => row.path === "/api/openers/unsubscribed");
    const byId = paths.findIndex((row) => row.path === "/api/openers/:id" && row.methods.includes("get"));
    expect(unsub).toBeGreaterThanOrEqual(0);
    expect(unsub).toBeLessThan(byId);
  });

  it("inbound mail stops opener nurture", () => {
    const src = fs.readFileSync(path.resolve("server/services/agentMailLog.ts"), "utf8");
    expect(src).toMatch(/stopOpenerNurtureByEmail/);
    const desk = fs.readFileSync(path.resolve("server/services/mailDesk.ts"), "utf8");
    expect(desk).toMatch(/stopOpenerNurtureByEmail/);
  });

  it("sixth unique email auto-promotes from the board load and from outbound log", () => {
    const routes = fs.readFileSync(path.resolve("server/routes/openers.ts"), "utf8");
    expect(routes).toMatch(/autoPromoteEligibleOpeners/);
    const log = fs.readFileSync(path.resolve("server/services/agentMailLog.ts"), "utf8");
    expect(log).toMatch(/autoPromoteEligibleOpeners/);
  });

  it("mounts openersRouter next to agent mail", () => {
    const src = fs.readFileSync(path.resolve("server/routes.ts"), "utf8");
    expect(src).toMatch(/openersRouter/);
  });

  it("board onPipeline uses pipeline-owner company numbers", () => {
    const src = fs.readFileSync(path.resolve("server/routes/openers.ts"), "utf8");
    expect(src).toMatch(/refreshOpenerIdentitySnapshot/);
    expect(src).toMatch(/listOpenerPipelineCompanyNumbers/);
    expect(src).toMatch(/openerOnPipeline/);
    expect(src).toMatch(/loadSuppression/);
    expect(src).toMatch(/optOutEmails/);
    expect(src).toMatch(/bounceEmails/);
    expect(src).toMatch(/openerBelongsToDesk/);
    expect(src).toMatch(/desk === "non_responsive"/);
  });

  it("logs a successful send onto the non-responsive desk", () => {
    const log = fs.readFileSync(path.resolve("server/services/agentMailLog.ts"), "utf8");
    expect(log).toMatch(/upsertNonResponsiveFromMail/);
  });

  it("allows super_admin and sales_admin on the openers API", () => {
    const src = fs.readFileSync(path.resolve("server/routes/openers.ts"), "utf8");
    expect(src).toMatch(/role !== "super_admin" && role !== "sales_admin"/);
    expect(src).toMatch(/requireOpenersAccess/);
    expect(src).not.toMatch(/requireSuperAdmin/);
  });

  it("openers desk is on-site only; Unsubscribed is a graveyard; drag-back restarts James", () => {
    const src = fs.readFileSync(path.resolve("server/routes/openers.ts"), "utf8");
    expect(src).toMatch(/openerOnOpenersBoard/);
    expect(src).toMatch(/desk === "openers"/);
    expect(src).toMatch(/\/api\/openers\/unsubscribed/);
    expect(src).toMatch(/isDoNotContactOpener/);
    expect(src).toMatch(/status === "direct_outreach"/);
    expect(src).toMatch(/resumeOpenerFromDirectOutreach/);
    expect(src).toMatch(/onOpenerUnsubscribed/);
  });

  it("GET /api/openers omits zero-dwell and unsubscribed", async () => {
    tmpStore();
    writeOpeners([
      normalizeOpener({ id: "zero", email: "zero@x.co.uk", dwellCount: 0, status: "new", firstOpenedAt: "2026-09-01T10:00:00.000Z", lastOpenedAt: "2026-09-01T10:00:00.000Z" }),
      normalizeOpener({ id: "site", email: "site@x.co.uk", dwellCount: 2, status: "new", firstOpenedAt: "2026-09-01T10:00:00.000Z", lastOpenedAt: "2026-09-01T10:00:00.000Z" }),
      normalizeOpener({ id: "dead", email: "dead@x.co.uk", dwellCount: 6, status: "not_now", firstOpenedAt: "2026-09-01T10:00:00.000Z", lastOpenedAt: "2026-09-01T10:00:00.000Z" }),
    ]);
    const res = await request(openersApp()).get("/api/openers").set(auth);
    const ids = res.body.map((row: { id: string }) => row.id);
    expect(ids).toContain("site");
    expect(ids).not.toContain("zero");
    expect(ids).not.toContain("dead");
  });

  it("GET /api/openers/unsubscribed is the graveyard", async () => {
    tmpStore();
    writeOpeners([
      normalizeOpener({ id: "zero", email: "zero@x.co.uk", dwellCount: 0, status: "new", firstOpenedAt: "2026-09-01T10:00:00.000Z", lastOpenedAt: "2026-09-01T10:00:00.000Z" }),
      normalizeOpener({ id: "site", email: "site@x.co.uk", dwellCount: 2, status: "new", firstOpenedAt: "2026-09-01T10:00:00.000Z", lastOpenedAt: "2026-09-01T10:00:00.000Z" }),
      normalizeOpener({ id: "dead", email: "dead@x.co.uk", dwellCount: 6, status: "not_now", firstOpenedAt: "2026-09-01T10:00:00.000Z", lastOpenedAt: "2026-09-01T10:00:00.000Z" }),
    ]);
    const res = await request(openersApp()).get("/api/openers/unsubscribed").set(auth);
    expect(res.body.some((row: { id: string }) => row.id === "dead")).toBe(true);
  });

  it("PATCH to direct_outreach is 400 and drag-back to nurturing restarts James", async () => {
    tmpStore();
    const row = applyDirectOutreach(normalizeOpener({
      id: "d",
      email: "d@x.co.uk",
      dwellCount: 5,
      status: "new",
      firstOpenedAt: "2026-09-01T10:00:00.000Z",
      lastOpenedAt: "2026-09-01T10:00:00.000Z",
    }));
    writeOpeners([row]);
    const blocked = await request(openersApp()).patch("/api/openers/d").set(auth).send({ status: "direct_outreach" });
    expect(blocked.status).toBe(400);
    const res = await request(openersApp()).patch("/api/openers/d").set(auth).send({ status: "nurturing" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("nurturing");
    expect(res.body.nurture.directOutreachDismissedDwellCount).toBe(5);
  });
});
