import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import openersRouter from "../../routes/openers";

describe("openers routes", () => {
  it("registers board, drawer, enrich, nurture, promote, whatsapp, and call", () => {
    const paths = openersRouter.stack
      .filter((layer) => Boolean(layer.route))
      .map((layer) => ({
        path: layer.route!.path,
        methods: Object.keys(layer.route!.methods).sort(),
      }));
    expect(paths).toContainEqual({ path: "/api/openers", methods: ["get"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id", methods: ["get"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id", methods: ["patch"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/enrich", methods: ["post"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/nurture", methods: ["post"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/promote", methods: ["post"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/whatsapp", methods: ["post"] });
    expect(paths).toContainEqual({ path: "/api/openers/:id/call", methods: ["post"] });
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
});
