import { afterEach, describe, expect, it, vi } from "vitest";
import { researchCompany, searchCompanyInfo } from "../../utils/geminiClient";

describe("Prospects company research via geminiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("searchCompanyInfo asks Grok on api.x.ai with XAI_API_KEY, not Gemini", async () => {
    vi.stubEnv("XAI_API_KEY", "xai-console-key");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.x.ai/v1/chat/completions");
      expect(String(url)).not.toMatch(/generativelanguage|gemini/i);
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer xai-console-key");
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  businessOverview: "Fitted kitchens in Nottingham.",
                  emails: [],
                  phones: [],
                  linkedinUrls: [],
                  profileImages: [],
                  contacts: [],
                  sources: [],
                }),
              },
            },
          ],
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchCompanyInfo("THE HOME CRAFTERS LTD.", "https://homecrafters.co.uk");

    expect(result.businessOverview).toMatch(/Fitted kitchens/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("researchCompany asks Grok on api.x.ai with XAI_API_KEY, not Gemini", async () => {
    vi.stubEnv("XAI_API_KEY", "xai-console-key");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.x.ai/v1/chat/completions");
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer xai-console-key");
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  businessProfile: "Kitchen installer.",
                  sourceCommentary: "From the website.",
                  sources: [],
                }),
              },
            },
          ],
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await researchCompany("THE HOME CRAFTERS LTD.", "https://homecrafters.co.uk");

    expect(result.businessProfile).toMatch(/Kitchen installer/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
