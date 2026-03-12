import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { fromZodError } from "zod-validation-error";
import { insertEmailTemplateSchema } from "@shared/schema";
import { generateText, DEFAULT_GEMINI_MODEL } from "../utils/geminiClient";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// List all templates
router.get(
  "/email-templates",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const templates = await storage.listEmailTemplates(req.user.id);
      res.json(templates);
    } catch (err: any) {
      handleApiError(res, err, "list-email-templates");
    }
  }
);

// Get single template
router.get(
  "/email-templates/:id",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const template = await storage.getEmailTemplate(
        parseInt(req.params.id),
        req.user.id
      );
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (err: any) {
      handleApiError(res, err, "get-email-template");
    }
  }
);

// Create template
router.post(
  "/email-templates",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("[EmailTemplates] Create request body:", JSON.stringify(req.body).slice(0, 500));
      const validated = insertEmailTemplateSchema.safeParse(req.body);
      if (!validated.success) {
        console.error("[EmailTemplates] Validation error:", fromZodError(validated.error).message);
        return res.status(400).json({ error: fromZodError(validated.error).message });
      }
      const template = await storage.createEmailTemplate(validated.data, req.user.id);
      console.log("[EmailTemplates] Created template:", template.id);
      res.status(201).json(template);
    } catch (err: any) {
      console.error("[EmailTemplates] Create error:", err);
      handleApiError(res, err, "create-email-template");
    }
  }
);

// Update template
router.patch(
  "/email-templates/:id",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const template = await storage.updateEmailTemplate(
        parseInt(req.params.id),
        req.user.id,
        req.body
      );
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (err: any) {
      handleApiError(res, err, "update-email-template");
    }
  }
);

// Delete template
router.delete(
  "/email-templates/:id",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await storage.deleteEmailTemplate(parseInt(req.params.id), req.user.id);
      res.json({ success: true });
    } catch (err: any) {
      handleApiError(res, err, "delete-email-template");
    }
  }
);

// Duplicate template
router.post(
  "/email-templates/:id/duplicate",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const template = await storage.duplicateEmailTemplate(
        parseInt(req.params.id),
        req.user.id
      );
      res.status(201).json(template);
    } catch (err: any) {
      handleApiError(res, err, "duplicate-email-template");
    }
  }
);

// AI-generate template content
router.post(
  "/email-templates/generate",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { purpose, tone, topic, industry } = req.body;

      if (!purpose && !topic) {
        return res.status(400).json({ error: "Purpose or topic is required" });
      }

      const prompt = `Write a professional B2B email template for a UK commercial finance broker platform.

Purpose: ${purpose || "general outreach"}
Tone: ${tone || "professional"}
Topic: ${topic || "commercial finance solutions"}
Industry: ${industry || "general business"}

Requirements:
- Write a compelling subject line on the first line prefixed with "Subject: "
- Write professional HTML email body content after a blank line
- Include merge tags: {{firstName}}, {{companyName}}, {{senderName}} where appropriate
- Keep the tone ${tone || "professional"} and UK-market specific
- Include a clear call-to-action
- Do not include unsubscribe footer (auto-generated)
- Use clean semantic HTML (p, strong, em, ul/li, br tags only)
- Keep it concise — 150-250 words maximum`;

      const systemInstruction =
        "You are an expert email marketing copywriter for Veltro, a UK commercial finance platform. Write highly engaging, professional email templates that convert.";

      const text = await generateText(prompt, DEFAULT_GEMINI_MODEL, systemInstruction);

      // Parse subject and body from the response
      const lines = text.split("\n");
      let subject = "";
      let body = "";
      let bodyStarted = false;

      for (const line of lines) {
        if (line.toLowerCase().startsWith("subject:")) {
          subject = line.replace(/^subject:\s*/i, "").trim();
        } else if (subject && (line.trim() === "" || bodyStarted)) {
          bodyStarted = true;
          body += line + "\n";
        }
      }

      res.json({
        subject: subject || "Generated Email Template",
        content: body.trim() || text,
      });
    } catch (err: any) {
      handleApiError(res, err, "generate-email-template");
    }
  }
);

export default router;
