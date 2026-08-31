import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { fromZodError } from "zod-validation-error";
import { insertMarketingContactSchema, insertWaitlistEntrySchema } from "@shared/schema";
import { caseyTextModel } from "@shared/craftScout";
import { generateText } from "../utils/geminiClient";
import { searchExa } from "../utils/exaClient";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// Marketing Contacts - List
router.get(
  "/marketing/contacts",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contacts = await storage.listMarketingContacts(req.user.id);
      res.json(contacts);
    } catch (err: any) {
      console.error("List Marketing Contacts Error:", err);
      res.status(500).json({ error: "Failed to list marketing contacts" });
    }
  }
);

// Marketing Contacts - Create/Update
router.post(
  "/marketing/contacts",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = insertMarketingContactSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: fromZodError(validated.error).message });
      }

      const contact = await storage.createOrUpdateMarketingContact(validated.data, req.user.id);
      res.status(201).json(contact);
    } catch (err: any) {
      console.error("Create Marketing Contact Error:", err);
      res.status(500).json({ error: "Failed to create marketing contact" });
    }
  }
);

// Marketing Content Generation
router.post(
  "/marketing/generate",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { prompt, systemInstruction, model, type, params } = req.body;

      let finalPrompt = prompt;
      let finalSystemInstruction =
        systemInstruction || "You are a professional marketing specialist for Veltro.";

      if (type === "email-draft") {
        const { topic, companyName: cName, contactName, tone } = params || {};
        finalPrompt = `Write a ${tone} B2B marketing email draft for a UK SME loan broker.
        Recipient Name: ${contactName}
        Recipient Company: ${cName}
        Topic: ${topic}
        Include a professional subject line. Ensure it sounds UK-market specific.
        Add merge tags like {{firstName}}, {{companyName}} appropriately.
        Do not include the footer as that is auto-generated.`;
        finalSystemInstruction =
          "You are a professional outreach specialist for Veltro, a commercial finance platform. Write highly engaging, professional cold emails.";
      } else if (type === "company-analysis") {
        const { companyName: cName, sicCodes } = params || {};
        finalPrompt = `Synthesize a high-level marketing overview for "${cName}" (SIC: ${sicCodes?.join(", ") || "N/A"}).
        Describe their probable business model, likely annual turnover range for this sector, and specific commercial finance products they might need (e.g. Asset Finance, Working Capital, or VAT loans).
        Keep the analysis crisp, professional, and under 120 words. Focus on actionable outreach signals.`;
        finalSystemInstruction =
          "You are a senior commercial finance analyst at Veltro. Provide expert synthesis for business outreach.";
      }

      if (!finalPrompt) return res.status(400).json({ error: "Prompt or type params required" });

      const engine = caseyTextModel(process.env);
      const text = await generateText(
        finalPrompt,
        model?.startsWith("claude-") || model?.startsWith("grok-") ? model : engine.model,
        finalSystemInstruction
      );
      res.json({ text });
    } catch (err: any) {
      console.error("Marketing Generation Error:", err);
      res.status(500).json({ error: err.message || "Failed to generate marketing content" });
    }
  }
);

// Social Profile Search
router.post(
  "/marketing/search-social",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    const { companyName } = req.body;
    const EXA_API_KEY = process.env.EXA_API_KEY || "5f958428-21f8-417d-8692-a16223758362";

    if (!companyName) return res.status(400).json({ error: "Company name is required" });

    try {
      const query = `LinkedIn profiles for key employees, directors and founders of ${companyName} UK`;
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "x-api-key": EXA_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: query,
          useAutoprompt: false,
          numResults: 10,
          type: "neural",
          includeDomains: ["linkedin.com"],
        }),
      });

      if (!response.ok) {
        throw new Error(`Exa API Error: ${response.status}`);
      }

      const data = await response.json();
      const profiles = (data.results || [])
        .filter((res: any) => res.url && res.url.includes("linkedin.com/in/"))
        .map((res: any) => ({
          name: (res.title || "LinkedIn Profile")
            .split(" | ")[0]
            .replace(" - LinkedIn", "")
            .replace(" | LinkedIn", "")
            .replace(/[^a-zA-Z\s]/g, "")
            .trim(),
          url: res.url,
          id: res.id || Math.random().toString(36).substr(2, 9),
        }));

      res.json({ profiles });
    } catch (err: any) {
      console.error("Exa Search Error:", err);
      res.status(500).json({ error: "Failed to search social profiles" });
    }
  }
);

// Compliance Chat
router.post(
  "/compliance/chat",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: "Query is required" });

      const searchContext = query.toLowerCase().includes("insurance")
        ? query
        : `${query} UK commercial finance lending regulation`;
      const exaResults = await searchExa(searchContext, 5, true);

      const context = exaResults
        .map(
          (r, i) =>
            `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nSummary: ${r.text || r.summary || "No summary available"}`
        )
        .join("\n\n");

      const prompt = `
        You are a strict Regulatory Compliance Assistant for the UK Commercial Finance and Lending sector (FCA).
        Your primary domain is commercial lending, asset finance, and consumer credit.
        Do NOT focus on insurance (GI/Life) regulations unless explicitly asked.

        USER QUESTION: "${query}"

        CONTEXT FROM RELIABLE SOURCES (Exa Search):
        ${context}

        INSTRUCTIONS:
        1. Answer the user's question using ONLY the facts provided in the CONTEXT above.
        2. Strict guardrails: Do NOT hallucinate, do NOT make assumptions not supported by the context.
        3. If the context relies heavily on insurance examples, reframe the answer to apply to lending/finance principles if possible, or state that the context is insurance-specific.
        4. If the context does not contain the answer, state clearly: "I cannot find specific regulatory information regarding your query for the finance sector in the current search results."
        5. Cite your sources inline using [1], [2] notation where appropriate.
        6. Format your response in clean Markdown.
      `;

      const answer = await generateText(prompt, caseyTextModel(process.env).model);

      res.json({
        answer,
        citations: exaResults.map((r, i) => ({
          id: (i + 1).toString(),
          title: r.title,
          source: r.url,
        })),
      });
    } catch (err: any) {
      console.error("Compliance Chat Error:", err);
      res.status(500).json({ error: "Failed to process compliance query" });
    }
  }
);

// --- Waitlist (public + admin) ---

// Public: submit to waiting list (no auth)
router.post("/marketing/waitlist", async (req: Request, res: Response) => {
  try {
    const validated = insertWaitlistEntrySchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ error: fromZodError(validated.error).message });
    }

    const existing = await storage.getWaitlistEntryByEmail(validated.data.email);
    if (existing) {
      return res.status(409).json({ error: "already_exists", message: "You're already on the waiting list!" });
    }

    const entry = await storage.createWaitlistEntry(validated.data);
    res.status(201).json(entry);
  } catch (err: any) {
    console.error("Waitlist Signup Error:", err);
    res.status(500).json({ error: "Failed to join waiting list" });
  }
});

// Admin: list all waitlist entries
router.get(
  "/marketing/waitlist",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const entries = await storage.listWaitlistEntries();
      res.json(entries);
    } catch (err: any) {
      console.error("List Waitlist Error:", err);
      res.status(500).json({ error: "Failed to list waitlist entries" });
    }
  }
);

// Admin: update waitlist entry status
router.patch(
  "/marketing/waitlist/:id/status",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = req.body;
      if (!["pending", "contacted", "converted"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      await storage.updateWaitlistEntryStatus(id, status);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Update Waitlist Status Error:", err);
      res.status(500).json({ error: "Failed to update waitlist entry" });
    }
  }
);

// Public: unsubscribe from waiting list (no auth)
router.post("/marketing/waitlist/unsubscribe", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }
    const found = await storage.unsubscribeWaitlistEntry(email);
    if (!found) {
      return res.status(404).json({ error: "not_found", message: "Email not found on the waiting list" });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error("Waitlist Unsubscribe Error:", err);
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

export default router;
