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
  });
});
