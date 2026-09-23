import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { cheapHealth } from "../../routes/health";

describe("cheap /api/health", () => {
  it("returns healthy without touching storage", () => {
    const body = cheapHealth();
    expect(body.status).toBe("healthy");
    expect(typeof body.uptime).toBe("number");
    expect(body.timestamp).toMatch(/T/);
  });

  it("does not probe SQLite on GET /api/health", () => {
    const routes = fs.readFileSync(path.resolve("server/routes.ts"), "utf8");
    const health = fs.readFileSync(path.resolve("server/routes/health.ts"), "utf8");
    const healthHandler = routes.slice(routes.indexOf('app.get("/api/health"'));
    expect(healthHandler.slice(0, 400)).not.toMatch(/getUser/);
    const cheap = health.slice(health.indexOf('router.get("/api/health"'), health.indexOf('router.get("/healthz"'));
    expect(cheap).not.toMatch(/getUser/);
    expect(health).toMatch(/router.get\("\/healthz"[\s\S]*getUser/);
  });
});
