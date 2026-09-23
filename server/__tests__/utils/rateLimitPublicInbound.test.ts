import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { rateLimitMiddleware, RATE_LIMIT_CONFIG } from "../../utils/rateLimit";

function app() {
  const a = express();
  a.use(rateLimitMiddleware());
  a.options("/api/inbound/healthcheck", (_req, res) => res.sendStatus(204));
  a.post("/api/inbound/healthcheck", (_req, res) => res.json({ ok: true }));
  return a;
}

describe("rate limit on public inbound forms", () => {
  it("does not count CORS preflights, and the 429 is readable cross-origin", async () => {
    const a = app();
    const limit = RATE_LIMIT_CONFIG.HEALTHCHECK_EMAIL_LIMIT;
    for (let i = 0; i < limit; i++) {
      expect((await request(a).options("/api/inbound/healthcheck")).status).toBe(204);
      expect((await request(a).post("/api/inbound/healthcheck")).status).toBe(200);
    }
    const blocked = await request(a).post("/api/inbound/healthcheck");
    expect(blocked.status).toBe(429);
    expect(blocked.headers["access-control-allow-origin"]).toBe("*");
    expect(blocked.body.error).toMatch(/Try again/);
  });
});
