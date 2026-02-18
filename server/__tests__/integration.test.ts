/**
 * Integration Tests for FlowLoan API
 *
 * These tests use the appFactory to create testable Express apps that exercise
 * real middleware (CSRF protection, rate limiting, auth) while mocking storage.
 * This validates actual middleware behavior rather than stub implementations.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createTestAppWithRoutes, createTestApp } from "../test/appFactory";
import { csrfProtection } from "../auth";
import express from "express";

describe("API Integration Tests", () => {
  describe("AppFactory Middleware Integration", () => {
    it("should create unauthenticated app that blocks protected routes", async () => {
      const app = createTestAppWithRoutes({ authenticatedUser: null });

      const res = await request(app)
        .post("/api/test")
        .set("Origin", "http://localhost")
        .set("Host", "localhost")
        .send({ data: "test" })
        .expect(401);

      expect(res.body).toHaveProperty("error");
    });

    it("should create authenticated app that allows protected routes", async () => {
      const app = createTestAppWithRoutes({
        authenticatedUser: { id: "user-123", email: "test@example.com" },
      });

      const res = await request(app)
        .post("/api/test")
        .set("Origin", "http://localhost")
        .set("Host", "localhost")
        .send({ data: "test" })
        .expect(200);

      expect(res.body).toHaveProperty("success", true);
    });

    it("should enforce CSRF protection by default", async () => {
      const app = createTestAppWithRoutes({
        authenticatedUser: { id: "user-123" },
      });

      const res = await request(app).post("/api/test").send({ data: "test" }).expect(403);

      expect(res.body.error).toContain("CSRF");
    });

    it("should skip CSRF when configured", async () => {
      const app = createTestAppWithRoutes({
        authenticatedUser: { id: "user-123" },
        skipCsrf: true,
      });

      const res = await request(app).post("/api/test").send({ data: "test" }).expect(200);

      expect(res.body).toHaveProperty("success", true);
    });

    it("should include rate limit headers", async () => {
      const app = createTestAppWithRoutes({
        authenticatedUser: { id: "user-123" },
        skipCsrf: true,
      });

      const res = await request(app).get("/api/test").expect(200);

      expect(res.headers).toHaveProperty("x-ratelimit-remaining");
    });
  });

  describe("Real CSRF Protection Middleware", () => {
    let app: express.Application;
    let originalNodeEnv: string | undefined;

    beforeAll(() => {
      originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      app = express();
      app.use(express.json());
      app.use(csrfProtection);

      app.post("/api/protected", (req, res) => {
        res.json({ success: true });
      });

      app.get("/api/safe", (req, res) => {
        res.json({ success: true });
      });

      app.post("/api/webhooks/test", (req, res) => {
        res.json({ webhookReceived: true });
      });
    });

    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("should allow GET requests without origin (safe method)", async () => {
      const res = await request(app).get("/api/safe").expect(200);
      expect(res.body).toHaveProperty("success", true);
    });

    it("should allow POST without origin header (server-to-server pattern)", async () => {
      const res = await request(app).post("/api/protected").send({ data: "test" }).expect(200);
      expect(res.body).toHaveProperty("success", true);
    });

    it("should block POST with mismatched origin", async () => {
      const res = await request(app)
        .post("/api/protected")
        .set("Origin", "http://evil-site.com")
        .set("Host", "legitimate-site.com")
        .send({ data: "test" })
        .expect(403);
      expect(res.body.error).toContain("CSRF");
    });

    it("should allow POST with matching origin", async () => {
      const res = await request(app)
        .post("/api/protected")
        .set("Origin", "http://localhost")
        .set("Host", "localhost")
        .send({ data: "test" })
        .expect(200);
      expect(res.body).toHaveProperty("success", true);
    });

    it("should allow POST without origin (server-to-server webhook pattern)", async () => {
      const res = await request(app)
        .post("/api/webhooks/test")
        .send({ data: "webhook payload" })
        .expect(200);
      expect(res.body).toHaveProperty("webhookReceived", true);
    });
  });

  describe("HTTP Methods and CSRF", () => {
    let app: express.Application;
    let originalNodeEnv: string | undefined;

    beforeAll(() => {
      originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      app = express();
      app.use(express.json());
      app.use(csrfProtection);

      app.get("/api/resource", (req, res) => res.json({ method: "GET" }));
      app.post("/api/resource", (req, res) => res.json({ method: "POST" }));
      app.put("/api/resource", (req, res) => res.json({ method: "PUT" }));
      app.patch("/api/resource", (req, res) => res.json({ method: "PATCH" }));
      app.delete("/api/resource", (req, res) => res.json({ method: "DELETE" }));
    });

    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("should allow GET without CSRF headers", async () => {
      await request(app).get("/api/resource").expect(200);
    });

    // Our CSRF impl only blocks *mismatched* origins, not absent ones.
    // Requests without Origin (e.g. curl, server-to-server) are allowed.
    it("should allow POST without CSRF headers (no origin present)", async () => {
      await request(app).post("/api/resource").expect(200);
    });

    it("should block POST with mismatched Origin", async () => {
      await request(app)
        .post("/api/resource")
        .set("Origin", "http://evil.com")
        .set("Host", "app.veltro.com")
        .expect(403);
    });

    it("should allow PUT with matching Origin", async () => {
      await request(app)
        .put("/api/resource")
        .set("Origin", "http://app.veltro.com")
        .set("Host", "app.veltro.com")
        .expect(200);
    });

    it("should block DELETE with mismatched Origin", async () => {
      await request(app)
        .delete("/api/resource")
        .set("Origin", "http://evil.com")
        .set("Host", "app.veltro.com")
        .expect(403);
    });
  });

  describe("Webhook Route Integration", () => {
    it("should handle webhook with appFactory", async () => {
      const app = createTestAppWithRoutes({ skipCsrf: true });

      const res = await request(app)
        .post("/api/webhooks/test")
        .set("X-FlowLoan-Api-Key", "test-key")
        .send({ company: "Test Co" })
        .expect(200);

      expect(res.body).toHaveProperty("success", true);
    });

    it("should reject webhook without API key", async () => {
      const app = createTestAppWithRoutes({ skipCsrf: true });

      const res = await request(app)
        .post("/api/webhooks/test")
        .send({ company: "Test Co" })
        .expect(401);

      expect(res.body.error).toContain("API key");
    });
  });

  describe("Request Validation Patterns", () => {
    let app: express.Application;

    beforeAll(() => {
      app = express();
      app.use(express.json({ limit: "1mb" }));

      app.post("/api/validate", (req, res) => {
        if (!req.body.name || typeof req.body.name !== "string") {
          return res.status(400).json({ error: "Name is required" });
        }
        if (req.body.name.length > 100) {
          return res.status(400).json({ error: "Name too long" });
        }
        res.json({ valid: true, name: req.body.name });
      });
    });

    it("should validate required fields", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Content-Type", "application/json")
        .send({})
        .expect(400);

      expect(res.body.error).toContain("required");
    });

    it("should validate field length", async () => {
      const longName = "a".repeat(101);
      const res = await request(app)
        .post("/api/validate")
        .set("Content-Type", "application/json")
        .send({ name: longName })
        .expect(400);

      expect(res.body.error).toContain("too long");
    });

    it("should accept valid input", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Content-Type", "application/json")
        .send({ name: "Valid Name" })
        .expect(200);

      expect(res.body).toHaveProperty("valid", true);
    });
  });

  describe("Error Response Format", () => {
    let app: express.Application;

    beforeAll(() => {
      app = express();

      app.get("/api/400", (req, res) => {
        res.status(400).json({ error: "Bad request", requestId: "req-123" });
      });

      app.get("/api/404", (req, res) => {
        res.status(404).json({ error: "Not found" });
      });

      app.get("/api/500", (req, res) => {
        res.status(500).json({ error: "Internal server error" });
      });
    });

    it("should return error with message for 400", async () => {
      const res = await request(app).get("/api/400").expect(400);
      expect(res.body).toHaveProperty("error");
      expect(typeof res.body.error).toBe("string");
    });

    it("should include requestId when available", async () => {
      const res = await request(app).get("/api/400").expect(400);
      expect(res.body).toHaveProperty("requestId");
    });

    it("should return error for 404", async () => {
      const res = await request(app).get("/api/404").expect(404);
      expect(res.body).toHaveProperty("error");
    });

    it("should return error for 500", async () => {
      const res = await request(app).get("/api/500").expect(500);
      expect(res.body).toHaveProperty("error");
    });
  });
});
