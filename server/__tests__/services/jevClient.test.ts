import { describe, expect, it, vi } from "vitest";
import { jevSystemOne } from "../../services/jevClient";

describe("jevSystemOne", () => {
  it("posts state and questions to System One and returns answers", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}"));
      expect(body.model).toBe("jev-latest");
      expect(body.state).toEqual({ companyName: "Acme Ltd" });
      expect(body.questions.is_sme.type).toBe("noul");
      return new Response(JSON.stringify({ answers: { is_sme: { type: "noul", noul: 0.9 } } }), { status: 200 });
    });
    const out = await jevSystemOne(
      { state: { companyName: "Acme Ltd" }, questions: { is_sme: { type: "noul", instructions: "Trading SME?" } } },
      { TYPESAFE_API_KEY: "k" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(out).toEqual({
      ok: true,
      answers: { is_sme: { type: "noul", noul: 0.9 } },
      httpStatus: 200,
      retried: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const headers = (fetchImpl.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer k");
  });

  it("returns null when the key is missing and does not call fetch", async () => {
    const fetchImpl = vi.fn();
    const out = await jevSystemOne({ state: {}, questions: {} }, {}, fetchImpl as unknown as typeof fetch);
    expect(out).toEqual({ ok: false, reason: "unavailable", retried: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("retries once on 5xx then returns a failed result without logging the key", async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args.join(" "));
    });
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 503 }));
    const out = await jevSystemOne(
      { state: {}, questions: { q: { type: "noul", instructions: "x" } } },
      { TYPESAFE_API_KEY: "secret-key-value" },
      fetchImpl as unknown as typeof fetch,
    );
    spy.mockRestore();
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("http");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(errors)).not.toMatch(/secret-key-value/);
  });

  it("does not retry 4xx", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad", { status: 422 }));
    const out = await jevSystemOne(
      { state: {}, questions: { q: { type: "noul", instructions: "x" } } },
      { TYPESAFE_API_KEY: "k" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(out.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("posts to TYPESAFE_BASE_URL with TYPESAFE_MODEL", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://example.test/v1/systemone");
      expect(JSON.parse(String(init?.body)).model).toBe("jev-custom");
      return new Response(JSON.stringify({ answers: { q: { noul: 1 } } }), { status: 200 });
    });
    const out = await jevSystemOne(
      { state: {}, questions: { q: { type: "noul", instructions: "x" } } },
      { TYPESAFE_API_KEY: "k", TYPESAFE_BASE_URL: "https://example.test", TYPESAFE_MODEL: "jev-custom" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(out.ok).toBe(true);
  });
});
