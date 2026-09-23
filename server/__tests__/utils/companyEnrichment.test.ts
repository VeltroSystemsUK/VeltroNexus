import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  enrichCompanyProfile,
  fetchWebsiteText,
  htmlToText,
  normalizeWebsiteUrl,
} from "../../utils/companyEnrichment";

describe("normalizeWebsiteUrl", () => {
  it("adds https when the user omits the protocol", () => {
    expect(normalizeWebsiteUrl("homecrafters.co.uk")).toBe("https://homecrafters.co.uk");
  });

  it("keeps an existing http(s) URL", () => {
    expect(normalizeWebsiteUrl("https://www.homecrafters.co.uk/about")).toBe(
      "https://www.homecrafters.co.uk/about"
    );
  });
});

describe("htmlToText", () => {
  it("strips tags and scripts so the model sees page copy", () => {
    const text = htmlToText(
      "<html><head><script>alert(1)</script></head><body><h1>Home Crafters</h1><p>Kitchen fit-out.</p></body></html>"
    );
    expect(text).toContain("Home Crafters");
    expect(text).toContain("Kitchen fit-out.");
    expect(text).not.toContain("<h1>");
    expect(text).not.toContain("alert");
    expect(text).toMatch(/Home Crafters\n/);
  });
});

describe("fetchWebsiteText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads a live page over fetch when Firecrawl is off", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(String(url)).toBe("https://acme.test/");
        return {
          ok: true,
          text: async () => "<html><body><h1>Acme Joinery</h1></body></html>",
        } as Response;
      })
    );

    const text = await fetchWebsiteText("https://acme.test/", { FIRECRAWL_API_URL: "" });
    expect(text).toContain("Acme Joinery");
  });
});

describe("enrichCompanyProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks Grok on api.x.ai and returns the Company-page deep-research shape", async () => {
    const grokBody = JSON.stringify({
      businessProfile: "Fitted kitchen installer in Nottingham.",
      sourceCommentary: "Drawn from the company website.",
      keyPeople: [{ name: "Kirsty Bevan", role: "Director" }],
      companyDetails: { companyType: "Ltd" },
      sources: [],
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("api.x.ai")) {
        const payload = JSON.parse(String(init?.body || "{}"));
        expect(payload.model).toBe("grok-4.6");
        expect(payload.messages?.[1]?.content).toMatch(/fitted kitchens/i);
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: grokBody } }] }),
        } as Response;
      }
      return {
        ok: true,
        text: async () => "<html><body><p>We install fitted kitchens in Nottingham.</p></body></html>",
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await enrichCompanyProfile("THE HOME CRAFTERS LTD.", "homecrafters.co.uk", {
      FIRECRAWL_API_URL: "",
      XAI_API_KEY: "xai-test-key",
    });

    expect(result.businessProfile).toMatch(/Fitted kitchen/);
    expect(result.keyPeople).toEqual([{ name: "Kirsty Bevan", role: "Director" }]);
    expect(result.sources.some((source) => source.url.includes("homecrafters.co.uk"))).toBe(true);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("https://api.x.ai/v1/chat/completions"))).toBe(
      true
    );
  });

  it("refuses to run without an xAI key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => "<html><body><p>Widgets</p></body></html>",
      }) as Response)
    );
    await expect(
      enrichCompanyProfile("Acme Ltd", "https://acme.test", { FIRECRAWL_API_URL: "", XAI_API_KEY: "" })
    ).rejects.toThrow(/XAI_API_KEY/);
  });

  it("sends the xAI bearer and never calls Gemini", async () => {
    const grokBody = JSON.stringify({
      businessProfile: "Widget maker.",
      sourceCommentary: "Website.",
      keyPeople: [],
      companyDetails: {},
      sources: [],
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("api.x.ai")) {
        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer xai-console-key");
        expect(String(url)).not.toMatch(/generativelanguage|googleapis|gemini/i);
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: grokBody } }] }),
        } as Response;
      }
      return {
        ok: true,
        text: async () => "<html><body><p>Widgets</p></body></html>",
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await enrichCompanyProfile("Acme Ltd", "https://acme.test", {
      FIRECRAWL_API_URL: "",
      XAI_API_KEY: "xai-console-key",
    });

    const llmCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes("http"));
    expect(llmCalls.some((call) => String(call[0]).includes("https://api.x.ai/v1/chat/completions"))).toBe(true);
    expect(llmCalls.some((call) => /generativelanguage|gemini/i.test(String(call[0])))).toBe(false);
  });

  it("uses GROK_AUTH_FILE when XAI_API_KEY is an expired JWT", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "grok-auth-"));
    const authFile = join(dir, "auth.json");
    writeFileSync(
      authFile,
      JSON.stringify({
        "https://auth.x.ai::team": { key: "grok-session-from-file", auth_mode: "oidc" },
      })
    );
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ exp: 1 })).toString("base64url");
    const expired = `${header}.${payload}.sig`;
    const grokBody = JSON.stringify({
      businessProfile: "Joinery.",
      sourceCommentary: "Website.",
      keyPeople: [],
      companyDetails: {},
      sources: [],
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("api.x.ai")) {
        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer grok-session-from-file");
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: grokBody } }] }),
        } as Response;
      }
      return {
        ok: true,
        text: async () => "<html><body><p>Joinery</p></body></html>",
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await enrichCompanyProfile("Acme Ltd", "https://acme.test", {
      FIRECRAWL_API_URL: "",
      XAI_API_KEY: expired,
      GROK_AUTH_FILE: authFile,
    });

    expect(result.businessProfile).toMatch(/Joinery/);
  });
});
