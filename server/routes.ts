// Static imports added at the top
import { getRateLimitStatus } from "./utils/rateLimit";
import { PassThrough, Transform } from "stream";
import { isSvgContent, hasValidImageMagicBytes, encodeContentDisposition } from "./utils/security";
import {
  groundedSearch,
  searchCompanyInfo,
  researchCompany,
  searchAdverseMedia
} from "./utils/geminiClient";
import { searchExa } from "./utils/exaClient";

// ... existing code ...

import { createServer, type Server } from "http";
import type { Request, Response, NextFunction, Application } from "express";
import passport from "passport";
import busboy from "busboy";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { storage, MOCK_DEV_ADMIN_ID } from "./storage";
import { zeusService } from "./services/zeusService";
import { generateText, DEFAULT_GEMINI_MODEL } from "./utils/geminiClient";
import { setupAuth, isAuthenticated, csrfProtection } from "./auth";
import { formatOfficerName } from "./utils/formatters";
import { emailVerificationService } from "./services/emailVerification";
import { agentService } from "./services/agentService";
import { agentRunner } from "./services/agentRunner";
import { DigitalAssociate } from "@shared/agents";
import {
  insertCompanySchema,
  insertProspectSchema,
  updateProspectStageSchema,
  insertContactSchema,
  insertActivitySchema,
  insertTimeEntrySchema,
  insertLenderSchema,
  insertApplicationSubmissionSchema,
  insertUserSchema,
  queryResponseSchema,
  webhookProspectPayloadSchema,
  type User,
  type InsertApplicationSubmission,
  type UnderwritingAttachment,
  type DueDiligenceData,
  type WebhookProspect,
  insertChannelSchema,
  insertMessageSchema,
  insertChannelMemberSchema,
  insertCommunicationIntegrationSchema,
  insertCommunicationTemplateSchema,
  insertCommunicationLogSchema,
  insertMarketingContactSchema,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";
import { createRequire } from "module";
import { generatePipelineExcel } from "./utils/excelExporter";
import { getSicDescription } from "./utils/sicCodeLookup";
import { createErrorResponse } from "./utils/errorResponse";
import { handleApiError, logUnderwritingAudit } from "./utils/errorHandler";
import { rateLimitMiddleware } from "./utils/rateLimit";
import {
  wrapAiRequest,
  requirePremiumAndConsent,
  AI_GOVERNANCE_CONFIG,
  redactSensitiveData,
} from "./utils/aiGovernance";
import {
  requireSubmissionReadAccess,
  requireSubmissionWriteAccess,
  requireUnderwritingAccess,
} from "./utils/underwritingAuth";
import { sendEmail } from "./services/email";
import { LocalStorageClient as ObjectStorageClient } from "./localStorage";
const require = createRequire(import.meta.url);

// Extended Request interface for authenticated routes
// TODO: user is guaranteed by isAuthenticated middleware — future refactor to add non-null assertion helper
interface AuthenticatedRequest extends Request {
  user?: any;
  requestId?: string;
}

import godRouter from "./routes/god";
import crmRouter from "./routes/crm";
import adminRouter from "./routes/admin";
import { ipAllowlist } from "./utils/ipAllowlist";
import leadFinderRouter from "./routes/lead_finder";
import brokersRouter from "./routes/brokers";
import brokerFinderRouter from "./routes/broker_finder";

import leadsRouter from "./routes/leads";
import campaignsRouter from "./routes/campaigns";
import inboundRouter from "./routes/inbound"; // Added inbound router
import activitiesRouter from "./routes/activities";
import addonsRouter from "./routes/addons";
import communicationsRouter from "./routes/communications";
import webhooksRouter from "./routes/webhooks";
import emailRouter from "./routes/email";
import usersRouter from "./routes/users";
import lendersRouter from "./routes/lenders";
import cdfiRouter from "./routes/cdfis";
import workforceRouter from "./routes/workforce";
import companiesRouter from "./routes/companies";
import submissionsRouter from "./routes/submissions";
import brokerPortalRouter from "./routes/brokerPortal";
import exceptionsRouter from "./routes/exceptions";
import prospectsRouter from "./routes/prospects";
import forecastsRouter from "./routes/forecasts";
import invoicesRouter from "./routes/invoices";
import incomeRouter from "./routes/income";
import cashflowRouter from "./routes/cashflow";
import expensesRouter from "./routes/expenses";
import emailTemplatesRouter from "./routes/emailTemplates";
import emailCampaignsRouter from "./routes/emailCampaigns";
import mediaRouter from "./routes/media";
import { getObjectStorage } from "./utils/routerHelpers";

export async function registerRoutes(app: Application): Promise<Server> {



  // 1. Get Requirements & Status

  // Register Leads Router
  // Register Leads Router
  app.use("/api/scraped-leads", leadsRouter);

  // Register Campaigns Router
  app.use("/api/campaigns", campaignsRouter);

  // Register Admin Router
  app.use("/api/admin", ipAllowlist(), adminRouter);

  // Register Inbound Router (Public Lead Gen)
  app.use("/api/inbound", inboundRouter);

  // Register Lead Finder Router (Agent)
  app.use("/api/lead-finder", leadFinderRouter);

  // Register Broker CRM Router
  app.use("/api/brokers", brokersRouter);

  // Register Broker Finder Router
  app.use("/api/broker-finder", brokerFinderRouter);

  // Marketing Contacts Endpoint (Sync from Verification)
  app.post("/api/marketing/contacts", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertMarketingContactSchema.safeParse({
        ...req.body,
        userId: (req.user as any).id
      });

      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error });
      }

      const contact = await storage.createOrUpdateMarketingContact(parsed.data, (req.user as any).id);
      res.status(201).json(contact);
    } catch (error) {
      console.error("Failed to create marketing contact:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Local Domain Contacts Scraper
  app.post("/api/crm/scrape-domain", isAuthenticated, async (req, res) => {
    try {
      const { domain, contactName } = req.body;
      if (!domain) return res.status(400).json({ error: "domain is required" });

      const { findEmail } = await import("./utils/scraperUtils");
      console.log(`[Local Scraper] Scraping domain: ${domain} with contactName: ${contactName || "none"}`);

      const emailResult = await findEmail(domain, contactName);
      
      const emailsList = emailResult ? [
        {
          email: emailResult.email,
          source: "homepage",
          context: `Found email with confidence: ${emailResult.confidence}`,
          isGeneric: ["info", "hello", "contact", "support", "sales", "enquiries", "office", "admin"].includes(emailResult.email.split("@")[0].toLowerCase()),
        }
      ] : [];

      const result = {
        domain,
        scrapedAt: new Date().toISOString(),
        emails: emailsList,
        phones: [],
        names: contactName ? [contactName] : [],
        linkedInUrl: null,
        pagesScraped: ["/"],
        pageResults: [
          {
            url: `https://${domain}/`,
            status: "ok" as const,
            emailsFound: emailsList.length,
            phonesFound: 0
          }
        ],
        status: emailsList.length > 0 ? ("success" as const) : ("partial" as const),
      };

      res.json(result);
    } catch (err: any) {
      console.error("Local Scraper Error:", err);
      res.status(500).json({ error: err.message || "Failed to scrape domain" });
    }
  });

  // Automation Triggers (For Testing/Scheduler)
  app.post("/api/automation/chase", isAuthenticated, async (req, res) => {
    try {
      const { fulfilmentAutomation } = await import("./services/fulfilmentAutomation");
      // Run asynchronously
      fulfilmentAutomation.runDailyChase().catch(err => console.error("Chase Routine Background Error:", err));
      res.json({ message: "Daily Chase Routine Triggered" });
    } catch (err) {
      console.error("Failed to trigger automation:", err);
      res.status(500).json({ error: "Failed to trigger automation" });
    }
  });




  // God Mode Routes moved to after auth setup

  // Backfill: Disabled for mock dev session to avoid DB errors
  /*
  (async () => {
    try {
      const users = await storage.getAllUsers();
      for (const user of users) {
        if (user.prospectsCreatedCount === 0) {
          const currentCount = await storage.countProspects(user.id);
          if (currentCount > 0) {
            await storage.updateUser(user.id, { prospectsCreatedCount: currentCount });
            console.log(`[Backfill] Updated user prospect count`);
          }
        }
      }
    } catch (err) {
      console.error("[Backfill] Failed to update prospect counts:", err);
    }
  })();
  */

  // Marketing Contacts
  app.get(
    "/api/marketing/contacts",
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

  app.post(
    "/api/marketing/contacts",
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

  app.post(
    "/api/marketing/generate",
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

        const text = await generateText(
          finalPrompt,
          model || DEFAULT_GEMINI_MODEL,
          finalSystemInstruction
        );
        res.json({ text });
      } catch (err: any) {
        console.error("Marketing Generation Error:", err);
        res.status(500).json({ error: err.message || "Failed to generate marketing content" });
      }
    }
  );

  app.post(
    "/api/marketing/search-social",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      const { companyName } = req.body;
      const EXA_API_KEY = process.env.EXA_API_KEY || "5f958428-21f8-417d-8692-a16223758362";

      if (!companyName) return res.status(400).json({ error: "Company name is required" });

      try {
        // Broadened query to capture more LinkedIn profiles (directors and employees)
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

  app.post(
    "/api/compliance/chat",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: "Query is required" });

        // 1. Search Exa for facts (append "UK finance" context to steer Exa)
        const searchContext = query.toLowerCase().includes("insurance")
          ? query
          : `${query} UK commercial finance lending regulation`;
        const exaResults = await searchExa(searchContext, 5, true);

        // 2. Format context
        const context = exaResults
          .map(
            (r, i) =>
              `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nSummary: ${r.text || r.summary || "No summary available"}`
          )
          .join("\n\n");

        // 3. Prompt Gemini
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

        const answer = await generateText(prompt, DEFAULT_GEMINI_MODEL);

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

  // Simple health check endpoint for load balancers
  app.get("/api/health", async (req, res) => {
    try {
      await storage.getUser("health-check-probe");
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    } catch {
      res.status(503).json({
        status: "unhealthy",
        error: "Database unavailable",
      });
    }
  });

  // Detailed health check endpoint - checks DB, Redis, and object storage
  // Must be registered BEFORE auth middleware so it's always accessible
  app.get("/healthz", async (req, res) => {
    const checks: Record<string, { status: "ok" | "error"; latency?: number; error?: string }> = {};
    let allHealthy = true;

    // Check database
    const dbStart = Date.now();
    try {
      await storage.getUser("health-check-probe");
      checks.database = { status: "ok", latency: Date.now() - dbStart };
    } catch (error: any) {
      checks.database = { status: "error", error: error.message, latency: Date.now() - dbStart };
      allHealthy = false;
    }

    // Check Redis (if configured)
    // const { getRateLimitStatus } = await import("./utils/rateLimit");
    const rateLimitStatus = getRateLimitStatus();
    if (rateLimitStatus.backend === "redis") {
      checks.redis = { status: "ok" };
    } else if (process.env.NODE_ENV === "production" && process.env.REDIS_URL) {
      checks.redis = { status: "error", error: "Redis configured but not connected" };
      allHealthy = false;
    } else {
      checks.redis = { status: "ok" }; // Memory fallback acceptable in dev
    }

    // Check object storage
    const storageStart = Date.now();
    try {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (bucketId) {
        const client = new ObjectStorageClient({ bucketId });
        await client.list({ prefix: "health-check/" });
        checks.objectStorage = { status: "ok", latency: Date.now() - storageStart };
      } else {
        checks.objectStorage = { status: "error", error: "Bucket not configured" };
        allHealthy = false;
      }
    } catch (error: any) {
      checks.objectStorage = {
        status: "error",
        error: error.message,
        latency: Date.now() - storageStart,
      };
      allHealthy = false;
    }

    const status = allHealthy ? 200 : 503;
    res.status(status).json({
      status: allHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  // Workforce routes must be registered BEFORE CSRF (SSE streaming incompatible with CSRF tokens)
  app.use("/api", workforceRouter);

  // CSRF protection for all state-changing requests
  app.use(csrfProtection);

  // Rate limiting middleware (Redis-backed with memory fallback)
  // Applied after auth so req.user is available for user-keyed limits
  app.use(rateLimitMiddleware());

  // God Mode Routes (Must be after Auth)
  app.use("/api/god/crm", crmRouter);
  app.use("/api/god", godRouter);

  // Domain routers (extracted from this file)
  app.use("/api", activitiesRouter);
  app.use("/api/add-ons", addonsRouter);
  app.use("/api", communicationsRouter);
  app.use("/api", webhooksRouter);
  app.use("/api/email", emailRouter);
  app.use("/api", usersRouter);
  app.use("/api", lendersRouter);
  app.use("/api/cdfis", cdfiRouter);
  app.use("/api", companiesRouter);
  app.use(submissionsRouter);
  app.use(brokerPortalRouter);
  app.use(exceptionsRouter);
  app.use("/api", prospectsRouter);
  app.use("/api", forecastsRouter);
  app.use("/api", invoicesRouter);
  app.use("/api", incomeRouter);
  app.use("/api", cashflowRouter);
  app.use("/api", expensesRouter);
  app.use("/api", emailTemplatesRouter);
  app.use("/api", emailCampaignsRouter);
  app.use("/api", mediaRouter);

  // NOTE: Agent Workforce routes are registered earlier in this file (before CSRF middleware)
  // to avoid duplication. See "--- AI WORKFORCE PLATFORM ROUTES ---" section above.

  // Serve public objects from object storage - restricted to allowed prefixes only
  // Security: Only serve from allowlisted directories to prevent arbitrary file access
  const ALLOWED_PUBLIC_PREFIXES = ["branding/"];

  app.get("/public-objects/*", async (req, res) => {
    try {
      const filePath = (req.params as any)[0];

      // Security: Validate path is within allowed prefixes
      const isAllowed = ALLOWED_PUBLIC_PREFIXES.some((prefix) => filePath.startsWith(prefix));
      if (!isAllowed) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Security: Prevent path traversal attacks
      if (filePath.includes("..") || filePath.includes("//")) {
        return res.status(400).json({ error: "Invalid path" });
      }

      const storagePath = `public/${filePath}`;

      const objectStorage = getObjectStorage();
      const { data } = await objectStorage.downloadAsBytes(storagePath);

      // Set appropriate content type based on file extension
      // SECURITY: SVG removed - can contain embedded JavaScript (XSS vector)
      const ext = filePath.split(".").pop()?.toLowerCase() || "";
      const contentTypes: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
      };

      // SECURITY: Block serving SVG files (case-insensitive, including svgz)
      if (ext === "svg" || ext === "svgz") {
        return res.status(403).json({ error: "SVG files are not allowed for security reasons" });
      }

      // SECURITY: Only serve files with known safe extensions (allowlist)
      if (!contentTypes[ext]) {
        return res.status(403).json({ error: "File type not allowed" });
      }

      const contentType = contentTypes[ext];

      // Set response headers for serving public objects
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Allow cross-origin embedding of images (important for logo display)
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(Buffer.from(data));
    } catch (error: any) {
      console.error("Error serving public object:", error);
      res.status(404).json({ error: "File not found" });
    }
  });



  // Application Submissions API - Protected routes

  // ============= LEADS API =============

  // Get all lead uploads for the user
  app.get(
    "/api/leads/uploads",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const uploads = await storage.listLeadUploads(userId);
        res.json(uploads);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Upload CSV and parse leads
  app.post(
    "/api/leads/uploads",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const { fileName, csvData } = req.body;

        if (!fileName || !csvData) {
          return res.status(400).json({ error: "fileName and csvData are required" });
        }

        // Size limit: 5MB max
        const maxSize = 5 * 1024 * 1024;
        if (csvData.length > maxSize) {
          return res.status(400).json({ error: "CSV file too large. Maximum size is 5MB." });
        }

        // Row limit: 10,000 max
        const lineCount = (csvData.match(/\n/g) || []).length + 1;
        if (lineCount > 10001) {
          return res
            .status(400)
            .json({ error: "CSV file has too many rows. Maximum is 10,000 rows." });
        }

        // Create the upload record
        const upload = await storage.createLeadUpload({
          userId,
          fileName,
          status: "processing",
          totalRows: 0,
          successRows: 0,
          errorRows: 0,
          errors: [],
        });

        // Parse CSV data
        const lines = csvData.split("\n").filter((line: string) => line.trim());
        if (lines.length < 2) {
          await storage.updateLeadUpload(upload.id, userId, {
            status: "failed",
            errors: [{ row: 0, message: "CSV must have a header row and at least one data row" }],
          });
          return res
            .status(400)
            .json({ error: "CSV must have a header row and at least one data row" });
        }

        // Parse headers
        const headerLine = lines[0];
        const headers = parseCSVLine(headerLine).map((h: string) =>
          h
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9_]/g, "_")
        );

        // Map common column names to our schema
        const columnMapping: Record<string, string> = {
          company_name: "companyName",
          companyname: "companyName",
          company: "companyName",
          name: "companyName",
          business_name: "companyName",
          businessname: "companyName",
          company_number: "companyNumber",
          companynumber: "companyNumber",
          crn: "companyNumber",
          registration_number: "companyNumber",
          trading_name: "tradingName",
          tradingname: "tradingName",
          trading_as: "tradingName",
          website: "website",
          url: "website",
          web: "website",
          email: "email",
          company_email: "email",
          phone: "phone",
          telephone: "phone",
          tel: "phone",
          contact_phone: "phone",
          address: "address",
          registered_address: "address",
          postcode: "postcode",
          post_code: "postcode",
          zip: "postcode",
          zipcode: "postcode",
          sic_code: "sicCode",
          siccode: "sicCode",
          sic: "sicCode",
          contact_name: "contactName",
          contactname: "contactName",
          contact: "contactName",
          contact_person: "contactName",
          contact_email: "contactEmail",
          contactemail: "contactEmail",
          contactphone: "contactPhone",
          contact_tel: "contactPhone",
          notes: "notes",
          note: "notes",
          comments: "notes",
        };

        const leadsToCreate: any[] = [];
        const errors: { row: number; message: string }[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const rawData: Record<string, any> = {};
          const leadData: Record<string, any> = { uploadId: upload.id };

          // Map values to columns
          for (let j = 0; j < headers.length && j < values.length; j++) {
            const header = headers[j];
            const value = values[j]?.trim() || "";
            rawData[header] = value;

            const mappedKey = columnMapping[header];
            if (mappedKey && value) {
              leadData[mappedKey] = value;
            }
          }

          leadData.rawData = rawData;

          // Validate required field
          if (!leadData.companyName) {
            errors.push({ row: i + 1, message: "Missing company name" });
            continue;
          }

          // Clean up company number (remove spaces, uppercase)
          if (leadData.companyNumber) {
            leadData.companyNumber = leadData.companyNumber
              .toString()
              .replace(/\s/g, "")
              .toUpperCase();
          }

          leadsToCreate.push(leadData);
        }

        // Bulk create leads
        if (leadsToCreate.length > 0) {
          await storage.createLeadsBulk(leadsToCreate, userId);
        }

        // Update upload record with results
        await storage.updateLeadUpload(upload.id, userId, {
          status: errors.length > 0 && leadsToCreate.length === 0 ? "failed" : "completed",
          totalRows: lines.length - 1,
          successRows: leadsToCreate.length,
          errorRows: errors.length,
          errors,
        });

        const updatedUpload = await storage.getLeadUpload(upload.id, userId);
        res.status(201).json(updatedUpload);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Helper function to parse CSV line (handles quoted values)
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  // Get all leads for the user
  app.get("/api/leads", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const { uploadId, matchStatus, search } = req.query as {
        uploadId?: string;
        matchStatus?: string;
        search?: string;
      };

      const filters: { uploadId?: number; matchStatus?: string; search?: string } = {};
      if (uploadId) filters.uploadId = parseInt(uploadId as string);
      if (matchStatus) filters.matchStatus = matchStatus as string;
      if (search) filters.search = search as string;

      const leads = await storage.listLeads(userId, filters);
      res.json(leads);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Get single lead
  app.get("/api/leads/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);

      const lead = await storage.getLead(id, userId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      res.json(lead);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Update lead
  app.patch("/api/leads/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);

      const lead = await storage.updateLead(id, userId, req.body);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      res.json(lead);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Delete lead
  // Delete lead
  app.delete(
    "/api/leads/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const id = parseInt(req.params.id);

        await storage.deleteLead(id, userId);
        res.status(204).send();
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Delete all leads from an upload
  app.delete(
    "/api/leads/uploads/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const id = parseInt(req.params.id);

        // First delete all leads from this upload
        await storage.deleteLeadsByUpload(id, userId);

        res.status(204).send();
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Create prospect from lead
  app.post(
    "/api/leads/:id/prospects",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const leadId = parseInt(req.params.id);
        const { companyNumber, companyName, companyData } = req.body;

        const lead = await storage.getLead(leadId, userId);
        if (!lead) {
          return res.status(404).json({ error: "Lead not found" });
        }

        // Check prospect limit
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ error: "User not found" });
        }

        const prospectCount = await storage.countProspects(userId);
        if (prospectCount >= user.prospectLimit) {
          return res.status(403).json({
            error: `Prospect limit reached. Your ${user.subscriptionTier} plan allows ${user.prospectLimit} prospects.`,
          });
        }

        // Check if company already exists
        let company = await storage.getCompanyByNumber(companyNumber);

        if (!company && companyData) {
          // Create new company from Companies House data
          const sicCode = companyData.sic_codes?.[0] || null;
          const sicDescription = sicCode ? getSicDescription(sicCode) : null;
          company = await storage.createCompany({
            companyName: companyData.company_name || companyName,
            companyNumber: companyNumber,
            registeredAddress: companyData.registered_office_address
              ? formatAddress(companyData.registered_office_address)
              : null,
            incorporationDate: companyData.date_of_creation || null,
            companyStatus: companyData.company_status || null,
            companyType: companyData.type || null,
            sicCode: sicCode,
            sicDescription: sicDescription,
          });
        } else if (!company) {
          // Create company with minimal info from lead
          company = await storage.createCompany({
            companyName: companyName || lead.companyName,
            companyNumber: companyNumber,
            registeredAddress: lead.address || null,
            incorporationDate: null,
            companyStatus: null,
            companyType: null,
          });
        }

        // Create prospect
        const prospect = await storage.createProspect(
          {
            companyId: company.id!,
            stage: "lead",
            queueOrder: 0,
            directorsGuarantee: 0,
            commercialProperty: 0,
            homeEquity: 0,
            propertyOther: 0,
            debenture: 0,
            parentCompanyGuarantee: 0,
            collateral: 0,
            crossCompanyGuarantee: 0,
          },
          userId
        );

        // Update lead with linked prospect
        await storage.updateLead(leadId, userId, {
          matchStatus: "prospect_created",
          matchedCompanyNumber: companyNumber,
          linkedProspectId: prospect.id,
        });

        // Trigger Zeus Autonomous Research asynchronously
        zeusService.performInstantResearch(prospect.id!, userId).catch((err) => {
          console.error("[Zeus Trigger] Background research failed:", err);
        });

        // Trigger Initial Zeus Document Gap Analysis
        zeusService.performDocumentGapAnalysis(prospect.id!, userId).catch((err) => {
          console.error("[Zeus Trigger] Initial gap analysis failed:", err);
        });

        res.status(201).json({ prospect, company });
      } catch (error: any) {
        console.error("Error creating prospect from lead:", error);
        if (error.message?.includes("unique constraint")) {
          return res.status(409).json({ error: "A prospect for this company already exists" });
        }
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Helper to format address
  function formatAddress(address: any): string {
    if (!address) return "";
    const parts = [
      address.premises,
      address.address_line_1,
      address.address_line_2,
      address.locality,
      address.region,
      address.postal_code,
      address.country,
    ].filter(Boolean);
    return parts.join(", ");
  }



  // AI Rewrite Endpoint
  app.post("/api/ai/rewrite", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { text, context } = req.body;
      console.log("Processing AI rewrite request, text length:", text?.length);
      if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: "Text is required" });
      }

      const { generateText } = await import("./utils/geminiClient");
      const prompt = `Rewrite the following text to be clear, concise, and factual. Ensure there is no duplication or unnecessary information. Structure the output in a professional, no-nonsense style.\n\nInput Text:\n${text}`;

      const rewritten = await generateText(prompt);
      res.json({ text: rewritten });
    } catch (error: any) {
      console.error("AI Rewrite CRITICAL error:", error);
      console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      // Fallback for demo if generic AI fails/not configured, though gemini should work
      res
        .status(500)
        .json({ error: "Failed to rewrite text: " + (error.message || "Unknown error") });
    }
  });


  const httpServer = createServer(app);

  // --- Admin Settings Routes ---

  app.get(
    "/api/admin/settings/sla",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        // Allow any authenticated user to read SLA settings (needed for timers)
        // or restrict to admin/underwriter if preferred, but timers need it.
        const settings = await storage.getSystemSetting("underwriting_sla");
        // Default if not set
        res.json(settings || { green: 4, amber: 24, red: 48 });
      } catch (error) {
        handleApiError(res, error, "settings-error");
      }
    }
  );

  app.post(
    "/api/admin/settings/sla",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (
          req.user.role !== "super_admin" &&
          req.user.role !== "sales_admin" &&
          !req.user.hasUnderwritingAccess
        ) {
          // Broaden access for "Underwriting Admin" logic if needed, but safe to keep strictly high-level for now
          if (req.user.role !== "super_admin" && req.user.role !== "sales_admin") {
            return res.status(403).json({ error: "Admin access required" });
          }
        }

        const green = Number(req.body.green);
        const amber = Number(req.body.amber);
        const red = Number(req.body.red);

        // Validate
        if (isNaN(green) || isNaN(amber) || isNaN(red)) {
          return res.status(400).json({ error: "Invalid SLA values" });
        }

        const result = await storage.updateSystemSetting(
          "underwriting_sla",
          { green, amber, red },
          req.user.id
        );
        res.json(result);
      } catch (error) {
        handleApiError(res, error, "settings-error");
      }
    }
  );

  // ==================
  // ARES Control Center - Autonomous Orchestration
  // ==================
  app.post(
    "/api/ares/run",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { aresControlCenter } = await import("./services/aresControlCenter");
        await aresControlCenter.runAutonomousLoop(req.user.id);
        res.json({ success: true, message: "Autonomous loop complete" });
      } catch (error) {
        handleApiError(res, error, "ares-error");
      }
    }
  );

  app.get(
    "/api/ares/metrics",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { aresControlCenter } = await import("./services/aresControlCenter");
        const metrics = await aresControlCenter.getAgentMetrics(req.user.id);
        res.json(metrics);
      } catch (error) {
        handleApiError(res, error, "ares-error");
      }
    }
  );

  // ARES Scheduler Control
  app.get(
    "/api/ares/schedule",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { aresScheduler } = await import("./services/aresScheduler");
        const status = aresScheduler.getStatus();
        res.json(status);
      } catch (error) {
        handleApiError(res, error, "ares-error");
      }
    }
  );

  app.post(
    "/api/ares/schedule",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { aresScheduler } = await import("./services/aresScheduler");
        aresScheduler.updateConfig(req.body);
        const status = aresScheduler.getStatus();
        res.json(status);
      } catch (error) {
        handleApiError(res, error, "ares-error");
      }
    }
  );

  // ==================
  // --- LEAD FINDER AGENT ROUTES ---

  app.post("/api/lead-finder/run", isAuthenticated, async (req, res) => {
    try {
      const { instruction } = req.body;
      if (!instruction) return res.status(400).json({ error: "Instruction required" });

      const { leadFinderService } = await import("./services/leadFinderService");

      // Run in background (do NOT await completion)
      leadFinderService.runAgent(instruction, (data) => {
        process.stdout.write(data);
      }).catch(err => {
        console.error(`[LeadFinder] Background Agent Error: ${err.message}`);
      });

      res.json({ success: true, message: "Agent mission started in background" });
    } catch (err: any) {
      console.error("Lead Finder Run Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/lead-finder/status", isAuthenticated, async (req, res) => {
    try {
      const { leadFinderService } = await import("./services/leadFinderService");
      const status = await leadFinderService.getStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  app.get("/api/lead-finder/results", isAuthenticated, async (req, res) => {
    try {
      const { leadFinderService } = await import("./services/leadFinderService");
      const limit = parseInt(req.query.limit as string) || 100;
      const results = await leadFinderService.getResults(limit);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to get results" });
    }
  });

  return httpServer;
}
