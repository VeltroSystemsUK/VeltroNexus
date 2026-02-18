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
import { researchLender } from "./services/lenderResearch";
import { lenderEnrichmentService, EnrichmentModule } from "./services/lenderEnrichmentService";
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
  generateRecommendations,
  getTopRecommendations,
} from "./services/lenderRecommendationEngine";
import {
  requireSubmissionReadAccess,
  requireSubmissionWriteAccess,
  requireUnderwritingAccess,
} from "./utils/underwritingAuth";
import { lenderNoteSchema, insertLenderNoteSchema } from "@shared/schema";
import { sendEmail } from "./services/email";
import { LocalStorageClient as ObjectStorageClient } from "./localStorage";
// import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient"; // REMOVED
// import { sql } from "drizzle-orm"; // REMOVED
// import { db } from "./db"; // REMOVED
const require = createRequire(import.meta.url);

// Extended Request interface for authenticated routes
interface AuthenticatedRequest extends Request {
  user?: any;
  requestId?: string;
  ctx?: any;
}

// import { stripeRoutes } from "./stripeRoutes"; // REMOVED
import godRouter from "./routes/god";
import crmRouter from "./routes/crm";
import adminRouter from "./routes/admin";
import leadFinderRouter from "./routes/lead_finder";
import brokersRouter from "./routes/brokers";
import brokerFinderRouter from "./routes/broker_finder";
import gmailRouter from "./routes/gmail.js";

import leadsRouter from "./routes/leads";
import campaignsRouter from "./routes/campaigns";
import inboundRouter from "./routes/inbound"; // Added inbound router

export async function registerRoutes(app: Application): Promise<Server> {
  // --- Multer Config for Document Uploads ---
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), "uploads", "prospects");
        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
          try {
            fs.mkdirSync(uploadPath, { recursive: true });
          } catch (e) {
            console.error("Failed to create upload directory", e);
          }
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, "doc-" + uniqueSuffix + ext);
      }
    }),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  });

  // --- Document Portal Routes ---

  // Gmail API
  app.use("/api/gmail", gmailRouter);

  // 1. Get Requirements & Status
  app.get("/api/prospects/:id/requirements", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.id);
      if (isNaN(prospectId)) return res.status(400).json({ error: "Invalid prospect ID" });

      const userId = (req.user as any)?.id;

      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) return res.status(404).json({ error: "Prospect not found" });

      // Determine requirements based on deal type
      let productType = "general";
      if (prospect.loanAllocation && Array.isArray(prospect.loanAllocation) && prospect.loanAllocation.length > 0) {
        productType = prospect.loanAllocation[0].type || "general";
      }

      const { getRequirementsForProduct } = await import("@shared/documentRequirements");
      const requirements = getRequirementsForProduct(productType);

      const existingDocs = await storage.listProspectDocuments(prospectId, userId);

      const checklist = requirements.map(req => {
        const match = existingDocs.find(d => d.category === req.id || (req.category && d.category === req.category));
        return {
          ...req,
          status: match ? "uploaded" : "pending",
          document: match || null
        };
      });

      const contacts = await storage.listContacts(prospectId, userId);
      const primaryContact = contacts.find(c => c.isPrimary) || contacts[0];

      res.json({
        dealType: productType,
        businessName: prospect.company.companyName || "Your Business",
        contactName: primaryContact ? primaryContact.name : "Valued Customer",
        referenceNumber: `REF-${prospect.id}`,
        checklist
      });
    } catch (err: any) {
      console.error("Error fetching requirements:", err);
      // Return basic list if advanced logic fails
      res.json({ dealType: "general", checklist: [] });
    }
  });

  // 2. Upload Document
  app.post("/api/prospects/:id/documents/upload", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const prospectId = parseInt(req.params.id);
      const category = req.body.category || "general";
      const userId = (req.user as any)?.id; // Assuming user is populated

      // 1. Upload to Google Drive (if user has connected Google)
      let storagePath = req.file.path;
      let driveLink = null;

      try {
        const { uploadFileToDrive } = await import("./services/googleServices");
        const { storage } = await import("./storage");

        const user = await storage.getUser(userId);
        if (user && user.googleAccessToken) {
          const driveFile = await uploadFileToDrive(
            user,
            req.file.path,
            `[${prospectId}] ${req.file.originalname}`,
            req.file.mimetype
          );
          storagePath = driveFile.webViewLink || driveFile.id || req.file.path; // Store link if available
          driveLink = driveFile.webViewLink;

          // Optional: delete local file after successful drive upload
          // fs.unlinkSync(req.file.path); 
        }
      } catch (driveErr) {
        console.error("Google Drive Upload Failed, falling back to local:", driveErr);
        // Continue with local path
      }

      const doc = await storage.createProspectDocument({
        prospectId,
        userId,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        storagePath,
        category,
        notes: req.body.notes || null,
        status: "pending"
      });

      // 2. Trigger Fulfilment Manager for Validation
      try {
        const { agentRunner } = await import("./services/agentRunner");
        // We fire and forget this so we don't block the upload response
        agentRunner.runInstruction(
          "fulfilment-manager",
          userId,
          `New document uploaded for Prospect ${prospectId}: "${req.file.originalname}" (Category: ${category}). Please validate this document against requirements and update its status.`,
          { documentId: doc.id, prospectId, driveLink: driveLink || storagePath }
        ).catch(err => console.error("Agent Validation Trigger Failed:", err));
      } catch (agentErr) {
        console.error("Failed to trigger agent:", agentErr);
      }

      res.json(doc);
    } catch (err: any) {
      console.error("Upload Error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // 3. List Documents
  app.get("/api/prospects/:id/documents", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      const docs = await storage.listProspectDocuments(prospectId, userId);
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: "Failed to list documents" });
    }
  });

  // 4. Delete Document
  app.delete("/api/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const docId = parseInt(req.params.id);
      const userId = (req.user as any)?.id;
      await storage.deleteProspectDocument(docId, userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Register Leads Router
  // Register Leads Router
  app.use("/api/scraped-leads", leadsRouter);

  // Register Campaigns Router
  app.use("/api/campaigns", campaignsRouter);

  // Register Admin Router
  app.use("/api/admin", adminRouter);

  // Register Inbound Router (Public Lead Gen)
  app.use("/api/inbound", inboundRouter);

  // Register Lead Finder Router (Agent)
  app.use("/api/lead-finder", leadFinderRouter);

  // Register Broker CRM Router
  app.use("/api/brokers", brokersRouter);

  // Register Broker Finder Router
  app.use("/api/broker-finder", brokerFinderRouter);

  // Logo Upload Endpoint
  app.post("/api/lenders/upload-logo", isAuthenticated, (req, res) => {
    const busboyInstance = busboy({ headers: req.headers });
    const logosDir = path.resolve("client/public/logos");

    // Ensure directory (should exist from migration, but be safe)
    if (!fs.existsSync(logosDir)) {
      fs.mkdirSync(logosDir, { recursive: true });
    }

    let fileUploaded = false;

    busboyInstance.on("file", (fieldname, file, info) => {
      const { filename, mimeType } = info;

      // Basic validation
      if (!mimeType.startsWith("image/")) {
        file.resume(); // discard
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      const ext = path.extname(filename) || ".png";
      const newFilename = `upload-${Date.now()}-${Math.round(Math.random() * 1000)}${ext}`;
      const saveTo = path.join(logosDir, newFilename);

      const writeStream = fs.createWriteStream(saveTo);
      file.pipe(writeStream);

      writeStream.on("finish", () => {
        fileUploaded = true;
        res.json({ logoUrl: `/logos/${newFilename}` });
      });

      writeStream.on("error", (err) => {
        console.error("Upload write error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Failed to save file" });
      });
    });

    busboyInstance.on("error", (err) => {
      console.error("Busboy error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Upload failed" });
    });

    busboyInstance.on("finish", () => {
      if (!fileUploaded && !res.headersSent) {
        res.status(400).json({ error: "No file uploaded" });
      }
    });

    req.pipe(busboyInstance);
  });

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

  // Email Validation Endpoint
  app.post("/api/email/validate", isAuthenticated, async (req, res) => {
    try {
      const { email, deepMode } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const { emailVerificationService } = await import("./services/emailVerificationService");
      const result = await emailVerificationService.verifyEmail(email, deepMode);
      res.json(result);
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ error: "Verification failed" });
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



  // --- AI WORKFORCE PLATFORM ROUTES ---

  // Get active workforce roster
  app.get("/api/workforce", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const roster = await storage.getAgents();
      res.json(roster);
    } catch (error) {
      handleApiError(res, error, "get-workforce");
    }
  });

  // Get recent mission deviations (Shadow Audit log)
  // IMPORTANT: This must be registered BEFORE /api/workforce/:id to avoid :id catching "deviations"
  app.get(
    "/api/workforce/deviations",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const logs = await storage.getMissionDeviations();
        const sorted = (logs || []).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        res.json(sorted.slice(0, 50));
      } catch (error) {
        handleApiError(res, error, "get-deviations");
      }
    }
  );

  // Get agent by ID
  app.get(
    "/api/workforce/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const agent = await storage.getAgentById(req.params.id);
        if (!agent) return res.status(404).json({ error: "Agent not found" });
        res.json(agent);
      } catch (error) {
        handleApiError(res, error, "get-agent");
      }
    }
  );

  // Run instruction with agent (Interaction Mode)
  app.post(
    "/api/workforce/:agentId/run",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { agentId } = req.params;
        const { instruction, context } = req.body;
        const userId = req.user.id;

        if (!instruction) {
          return res.status(400).json({ error: "Instruction is required" });
        }

        console.log(`[API] Triggering agent ${agentId} for user ${userId}`);

        // Save user message to chat history
        try {
          await storage.saveAgentChatMessage(agentId, userId, {
            role: "user",
            content: instruction,
            timestamp: new Date(),
          });
        } catch (chatError: any) {
          console.error(`[API] Failed to save user chat message: ${chatError.message}`);
          // Continue execution - don't fail the request if chat save fails
        }

        const response = await agentRunner.runInstruction(agentId, userId, instruction, context);

        // Save agent response to chat history
        try {
          await storage.saveAgentChatMessage(agentId, userId, {
            role: "agent",
            content: response,
            timestamp: new Date(),
          });
        } catch (chatError: any) {
          console.error(`[API] Failed to save agent chat message: ${chatError.message}`);
          // Continue execution - don't fail the request if chat save fails
        }

        res.json({ success: true, response });
      } catch (error: any) {
        console.error(`[API] Agent Run Error: ${error.message}`);
        console.error(`[API] Stack trace: ${error.stack}`);
        res.status(500).json({
          error: error.message || "Agent execution failed",
          code: "AGENT_FAILURE",
        });
      }
    }
  );

  // Update an agent (Edit)
  app.put(
    "/api/workforce/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        if (!updates || Object.keys(updates).length === 0) {
          return res.status(400).json({ error: "No updates provided" });
        }

        // Prevent overwriting the id
        delete updates.id;

        const agent = await storage.getAgentById(id);
        if (!agent) return res.status(404).json({ error: "Agent not found" });

        const updated = await storage.updateAgent(id, updates);
        res.json(updated);
      } catch (error) {
        handleApiError(res, error, "update-agent");
      }
    }
  );

  // Delete an agent
  app.delete(
    "/api/workforce/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { id } = req.params;

        const agent = await storage.getAgentById(id);
        if (!agent) return res.status(404).json({ error: "Agent not found" });

        await storage.deleteAgent(id);
        res.json({ success: true, message: `Agent ${id} deleted` });
      } catch (error) {
        handleApiError(res, error, "delete-agent");
      }
    }
  );

  // Get chat history for an agent
  app.get(
    "/api/workforce/:agentId/chats",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { agentId } = req.params;
        const userId = req.user.id;
        const limit = parseInt(req.query.limit as string) || 50;

        const messages = await storage.getAgentChatHistory(agentId, userId, limit);
        res.json(messages);
      } catch (error) {
        handleApiError(res, error, "get-agent-chats");
      }
    }
  );

  // Clear chat history for an agent
  app.delete(
    "/api/workforce/:agentId/chats",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { agentId } = req.params;
        const userId = req.user.id;

        await storage.clearAgentChatHistory(agentId, userId);
        res.json({ success: true, message: "Chat history cleared" });
      } catch (error) {
        handleApiError(res, error, "clear-agent-chats");
      }
    }
  );

  // Create a new agent
  app.post("/api/workforce", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const agentData = req.body;

      // Validate required fields
      if (!agentData.name || !agentData.role) {
        return res.status(400).json({ error: "Name and role are required" });
      }

      // Generate unique ID
      const agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create the agent object
      const newAgent: DigitalAssociate = {
        id: agentId,
        name: agentData.name,
        role: agentData.role,
        department: agentData.department || "Operations",
        status: agentData.status || "Available for Placement",
        avatar:
          agentData.avatar ||
          "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=400",
        expertise: agentData.expertise || [],
        tools: agentData.tools || [],
        description: agentData.description || "",
        hourlyRate: agentData.hourlyRate || 0,
        scores: agentData.scores || [
          { subject: "Accuracy", A: 85, fullMark: 100 },
          { subject: "Speed", A: 80, fullMark: 100 },
        ],
        voiceEnabled: agentData.voiceEnabled || false,
        aresCertification: {
          status: "pending",
          score: 0,
        },
      };

      // Save to storage
      await storage.updateAgent(agentId, newAgent);

      console.log(`[API] Created new agent: ${newAgent.name} (${agentId})`);
      res.status(201).json(newAgent);
    } catch (error) {
      handleApiError(res, error, "create-agent");
    }
  });

  // --- END WORKFORCE ROUTES ---

  // Agent Job Tracking API
  app.get("/api/agent-jobs", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { agentJobTracker } = await import("./services/agentJobTracker");
      const jobs = await agentJobTracker.getJobsForUser(req.user.id, 20);
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching agent jobs:", error);
      res.status(500).json({ error: "Failed to fetch agent jobs" });
    }
  });

  app.get(
    "/api/agent-jobs/running",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { agentJobTracker } = await import("./services/agentJobTracker");
        const jobs = await agentJobTracker.getRunningJobs(req.user.id);
        res.json(jobs);
      } catch (error) {
        console.error("Error fetching running jobs:", error);
        res.status(500).json({ error: "Failed to fetch running jobs" });
      }
    }
  );

  app.get(
    "/api/agent-jobs/:jobId",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { agentJobTracker } = await import("./services/agentJobTracker");
        const job = await agentJobTracker.getJob(req.params.jobId);
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
        // Verify user owns this job
        if (job.userId !== req.user.id) {
          return res.status(403).json({ error: "Access denied" });
        }
        res.json(job);
      } catch (error) {
        console.error("Error fetching agent job:", error);
        res.status(500).json({ error: "Failed to fetch agent job" });
      }
    }
  );

  app.delete(
    "/api/agent-jobs/:jobId",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { agentJobTracker } = await import("./services/agentJobTracker");
        const job = await agentJobTracker.getJob(req.params.jobId);
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
        // Verify user owns this job
        if (job.userId !== req.user.id) {
          return res.status(403).json({ error: "Access denied" });
        }
        await agentJobTracker.deleteJob(req.params.jobId);
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting agent job:", error);
        res.status(500).json({ error: "Failed to delete agent job" });
      }
    }
  );

  // AI Lender Research Endpoint
  app.post("/api/lenders/:id/research", isAuthenticated, async (req, res) => {
    try {
      const lenderId = parseInt(req.params.id);
      if (isNaN(lenderId)) return res.status(400).json({ error: "Invalid lender ID" });

      const { targetField } = req.body;
      const result = await researchLender(lenderId, (req as any).user.id, { targetField });
      res.json(result);
    } catch (err: any) {
      console.error("AI Research Error:", err);
      res.status(500).json({ error: err.message || "Financial intelligence gathering failed" });
    }
  });

  app.post("/api/lenders/research-prospect", isAuthenticated, async (req, res) => {
    try {
      const { name, website, targetField } = req.body;
      if (!name) return res.status(400).json({ error: "Lender name is required" });

      const result = await researchLender(null, (req as any).user.id, {
        name,
        website,
        targetField,
      });
      res.json(result);
    } catch (err: any) {
      console.error("AI Prospect Research Error:", err);
      res.status(500).json({ error: err.message || "Financial intelligence gathering failed" });
    }
  });

  // Modular Lender Enrichment Agent
  app.post(
    "/api/lenders/:id/enrich/:module",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const lenderId = parseInt(req.params.id);
        const module = req.params.module as EnrichmentModule;
        const userId = req.user.id;
        const { name, website } = req.body;

        const result = await lenderEnrichmentService.enrichLenderModule(lenderId, userId, module, {
          name,
          website,
        });

        // Return the proposed updates for Managed Autonomy (frontend review)
        res.json(result);
      } catch (error: any) {
        console.error(`[Lender Agent] Enrichment failed for ${req.params.module}:`, error);
        res.status(500).json({ message: error.message || "Enrichment failed" });
      }
    }
  );

  app.get(
    "/api/auth/google",
    passport.authenticate("google", {
      scope: [
        "profile",
        "email",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.compose",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.settings.basic",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/spreadsheets",
      ],
      accessType: "offline",
      prompt: "consent",
    })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/settings?error=google_auth_failed" }),
    (req, res) => {
      res.redirect("/settings?success=google_connected");
    }
  );

  app.post("/api/auth/google/disconnect", isAuthenticated, async (req, res) => {
    try {
      await storage.updateUser((req as any).user.id, {
        googleConnected: false,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to disconnect Google account" });
    }
  });

  app.post("/api/google/gmail/draft", isAuthenticated, async (req, res) => {
    try {
      const { to, subject, body } = req.body;
      const { sendEmail } = await import("./services/googleServices");
      await sendEmail((req as any).user, to, subject, body);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Gmail Draft Error:", err);
      res.status(500).json({ error: err.message || "Failed to draft email" });
    }
  });

  app.post("/api/google/docs/create", isAuthenticated, async (req, res) => {
    try {
      const { title, content } = req.body;
      const { createGoogleDoc } = await import("./services/googleServices");
      const result = await createGoogleDoc((req as any).user, title, content);
      res.json(result);
    } catch (err: any) {
      console.error("Google Doc Creation Error:", err);
      res.status(500).json({ error: err.message || "Failed to create Google Doc" });
    }
  });

  app.post("/api/lenders/bulk-upload", isAuthenticated, async (req, res) => {
    try {
      const { lenders } = req.body;
      if (!Array.isArray(lenders)) {
        return res.status(400).json({ error: "Expected an array of lenders" });
      }

      const results = [];
      const userId = (req as any).user.id;

      for (const lenderData of lenders) {
        // Basic validation and default values

        const lender = {

          ...lenderData,
          isFavourite: 0,
          introducerAgreementSigned: 0,
          isGlobal: 0,
          panelStatus: lenderData.panelStatus || "market",
          lenderType: lenderData.lenderType || "specialist_lender",
        };
        const created = await storage.createLender(lender, userId);
        results.push(created);
      }

      res.status(201).json({ count: results.length, lenders: results });
    } catch (err: any) {
      console.error("Bulk Upload Error:", err);
      res.status(500).json({ error: err.message || "Bulk upload failed" });
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
            console.log(`[Backfill] Updated user ${user.id} prospect count to ${currentCount}`);
          }
        }
      }
    } catch (err) {
      console.error("[Backfill] Failed to update prospect counts:", err);
    }
  })();
  */

  app.post("/api/email/validate", isAuthenticated, async (req, res) => {
    try {
      const { email, deepMode = false } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      const result = await emailVerificationService.verify(email, deepMode);
      res.json(result);
    } catch (err: any) {
      console.error("Email Validation Error:", err);
      res.status(500).json({ error: err.message || "Email validation failed" });
    }
  });

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

  // CSRF protection for all state-changing requests
  app.use(csrfProtection);

  // Rate limiting middleware (Redis-backed with memory fallback)
  // Applied after auth so req.user is available for user-keyed limits
  app.use(rateLimitMiddleware());

  // Get object storage client - memoized to avoid repeated initialization and logging
  let objectStorageClient: ObjectStorageClient | null = null;

  // Register Stripe routes after auth and rate limiting middleware
  // app.use("/api/stripe", stripeRoutes); // REMOVED

  // God Mode Routes (Must be after Auth)
  app.use("/api/god/crm", crmRouter);
  app.use("/api/god", godRouter);
  const getObjectStorage = () => {
    if (objectStorageClient) {
      return objectStorageClient;
    }
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      throw new Error("Object storage bucket not configured");
    }
    console.info("Object storage initialized with bucket:", bucketId);
    objectStorageClient = new ObjectStorageClient({ bucketId });
    return objectStorageClient;
  };

  // NOTE: Agent Workforce routes are registered earlier in this file (before CSRF middleware)
  // to avoid duplication. See "--- AI WORKFORCE PLATFORM ROUTES ---" section above.

  // Auth routes - Required for Replit Auth
  app.get("/api/auth/user", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      // Add no-store cache header for sensitive auth data
      res.setHeader("Cache-Control", "no-store");
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res
        .status(500)
        .json(createErrorResponse(error as Error, 500, req.requestId, "Failed to fetch user"));
    }
  });

  // Recursive schema for PDF sections
  const pdfSectionSchema: z.ZodType<any> = z.lazy(() =>
    z.object({
      id: z.string(),
      label: z.string(),
      enabled: z.boolean(),
      type: z.enum(["module", "structure", "container"]).optional(),
      subtype: z.enum(["pageBreak", "divider", "spacer", "2-column"]).optional(),
      columns: z.array(z.array(pdfSectionSchema)).optional(),
    })
  );

  // User settings API
  const updateUserSettingsSchema = z.object({
    currency: z.string().optional(),
    timezone: z.string().optional(),
    dateFormat: z.string().optional(),
    theme: z.string().optional(),
    pipelineStageNames: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          color: z.string(),
        })
      )
      .optional(),
    pdfLayoutPreferences: z
      .object({
        sections: z.array(pdfSectionSchema),
        header: z // Added header config validation if missing
          .object({
            title: z.string(),
            showDate: z.boolean(),
            showUser: z.boolean(),
          })
          .optional(),
      })
      .optional(),
    brandingPrimaryColor: z.string().optional().nullable(),
    brandingAccentColor: z.string().optional().nullable(),
    brandingLogoUrl: z.string().optional().nullable(),
    aiDataConsent: z.number().int().min(0).max(1).optional(),
  });

  app.patch(
    "/api/user/settings",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const result = updateUserSettingsSchema.safeParse(req.body);

        if (!result.success) {
          const humanError = fromZodError(result.error);
          return res.status(400).json({ error: humanError.message });
        }

        const updateData: any = { ...result.data };

        // Track consent timestamp when AI consent is granted
        if (result.data.aiDataConsent === 1) {
          const currentUser = await storage.getUser(userId);
          if (currentUser && (currentUser as any).aiDataConsent !== 1) {
            updateData.aiDataConsentAt = new Date();
            console.info(
              JSON.stringify({
                type: "ai_consent_granted",
                userId,
                timestamp: new Date().toISOString(),
              })
            );
          }
        }

        const updatedUser = await storage.updateUser(userId, updateData);
        if (!updatedUser) {
          return res.status(404).json(createErrorResponse("User not found", 404, req.requestId));
        }

        res.json(updatedUser);
      } catch (error: any) {
        console.error("Error updating user settings:", error);
        res
          .status(500)
          .json(createErrorResponse(error, 500, req.requestId, "Failed to update settings"));
      }
    }
  );

  // Upload branding logo - uses busboy + streaming upload to object storage
  // No RAM buffering: files stream directly to storage via uploadFromStream
  const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB limit

  app.post(
    "/api/user/branding/logo",
    isAuthenticated,
    (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user.id;

      const contentType = req.headers["content-type"];
      if (!contentType?.startsWith("multipart/form-data")) {
        return res.status(400).json({ error: "Content-Type must be multipart/form-data" });
      }

      let uploadPromise: Promise<string> | null = null;
      let validationError: string | null = null;

      try {
        const bb = busboy({
          headers: req.headers,
          limits: { fileSize: MAX_LOGO_SIZE, files: 1 },
        });

        bb.on("file", (fieldname, fileStream, info) => {
          const { filename, mimeType } = info;

          // SECURITY: Normalize MIME type (lowercase, strip parameters like charset)
          const normalizedMime = mimeType.toLowerCase().split(";")[0].trim();

          // SECURITY: Check file extension case-insensitively
          const extension = (filename.split(".").pop() || "").toLowerCase();
          const isSvgExtension = extension === "svg" || extension === "svgz";
          const isSvgMime = normalizedMime === "image/svg+xml";

          // Early MIME type validation - drain stream immediately if invalid
          // SECURITY: Block SVG uploads - SVG can contain embedded JavaScript (XSS vector)
          if (!normalizedMime.startsWith("image/") || isSvgMime || isSvgExtension) {
            validationError =
              isSvgMime || isSvgExtension
                ? "SVG files are not allowed for security reasons. Please use PNG, JPEG, or WebP."
                : "Only image files are allowed for logos";
            fileStream.resume();
            return;
          }

          // SECURITY: Only allow safe image extensions
          const allowedExtensions = ["png", "jpg", "jpeg", "gif", "webp"];
          if (!allowedExtensions.includes(extension)) {
            validationError = `File extension '.${extension}' is not allowed. Please use PNG, JPEG, GIF, or WebP.`;
            fileStream.resume();
            return;
          }

          const timestamp = Date.now();
          const logoFileName = `${userId}_logo_${timestamp}.${extension}`;
          const storagePath = `public/branding/${logoFileName}`;

          // Stream to storage with content validation
          uploadPromise = (async () => {
            // const { PassThrough, Transform } = await import("stream");
            // const { isSvgContent, hasValidImageMagicBytes } = await import("./utils/security");

            const passThrough = new PassThrough();
            let limitExceeded = false;
            let magicBytesValidated = false;
            let accumulatedBuffer: Buffer = Buffer.alloc(0);
            const MAX_VALIDATION_SIZE = 4096; // Accumulate up to 4KB for SVG pattern detection

            fileStream.on("limit", () => {
              limitExceeded = true;
              validationError = "Logo file must be under 2MB";
              passThrough.destroy(new Error("File size limit exceeded"));
            });

            // SECURITY: Create transform stream with robust validation
            // Strategy: Validate magic bytes immediately, then continue scanning for SVG patterns
            const validationTransform = new Transform({
              transform(chunk, encoding, callback) {
                // Always accumulate for ongoing SVG detection (up to limit)
                if (accumulatedBuffer.length < MAX_VALIDATION_SIZE) {
                  accumulatedBuffer = Buffer.concat([accumulatedBuffer, chunk]);
                }

                // SECURITY: Validate magic bytes FIRST (only needs first few bytes)
                if (!magicBytesValidated && accumulatedBuffer.length >= 12) {
                  if (!hasValidImageMagicBytes(accumulatedBuffer)) {
                    validationError =
                      "Invalid image file - content does not match a recognized image format (PNG, JPEG, GIF, or WebP).";
                    passThrough.destroy(new Error(validationError));
                    return;
                  }
                  magicBytesValidated = true;
                }

                // SECURITY: Continuously check for SVG patterns in accumulated buffer
                // This catches split-chunk SVG attacks
                if (isSvgContent(accumulatedBuffer)) {
                  validationError =
                    "File content appears to be SVG disguised as another format. SVG files are not allowed.";
                  passThrough.destroy(new Error(validationError));
                  return;
                }

                // Only pass through data after magic bytes validated
                if (magicBytesValidated) {
                  callback(null, chunk);
                } else {
                  callback();
                }
              },
              flush(callback) {
                // Final validation for small files
                if (!magicBytesValidated && accumulatedBuffer.length > 0) {
                  if (!hasValidImageMagicBytes(accumulatedBuffer)) {
                    validationError =
                      "Invalid image file - content does not match a recognized image format.";
                    passThrough.destroy(new Error(validationError));
                    return;
                  }
                  // Final SVG check
                  if (isSvgContent(accumulatedBuffer)) {
                    validationError = "File content appears to be SVG disguised as another format.";
                    passThrough.destroy(new Error(validationError));
                    return;
                  }
                  // Push buffered data for small files
                  this.push(accumulatedBuffer);
                }
                callback();
              },
            });

            fileStream.pipe(validationTransform).pipe(passThrough);

            try {
              await getObjectStorage().uploadFromStream(storagePath, passThrough);

              if (limitExceeded || validationError) {
                // Clean up partial upload
                try {
                  await getObjectStorage().delete(storagePath);
                } catch {
                  // Ignore cleanup errors
                }
                throw new Error(validationError || "File size limit exceeded");
              }

              const logoUrl = `/public-objects/branding/${logoFileName}`;
              await storage.updateUser(userId, { brandingLogoUrl: logoUrl });
              return logoUrl;
            } catch (err: any) {
              if (limitExceeded) throw new Error("Logo file must be under 2MB");
              if (validationError) throw new Error(validationError);
              throw err;
            }
          })();
        });

        bb.on("close", async () => {
          try {
            if (validationError) {
              return res.status(400).json({ error: validationError });
            }

            if (!uploadPromise) {
              return res.status(400).json({ error: "No logo file uploaded" });
            }

            const logoUrl = await uploadPromise;
            res.json({ logoUrl, message: "Logo uploaded successfully" });
          } catch (error: any) {
            console.error("Error completing logo upload:", error);
            if (!res.headersSent) {
              handleApiError(res, error, "api-error");
            }
          }
        });

        bb.on("error", (error: any) => {
          console.error("Busboy error:", error);
          if (!res.headersSent) {
            handleApiError(res, error, "api-error");
          }
        });

        req.pipe(bb);
      } catch (error: any) {
        console.error("Error uploading logo:", error);
        if (!res.headersSent) {
          handleApiError(res, error, "api-error");
        }
      }
    }
  );

  // Delete branding logo
  app.delete(
    "/api/user/branding/logo",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;

        // Clear the logo URL from user settings
        await storage.updateUser(userId, { brandingLogoUrl: null });

        res.json({ message: "Logo removed successfully" });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // =====================================
  // Onboarding API endpoints
  // =====================================

  // Get onboarding state
  app.get(
    "/api/user/onboarding",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(404).json(createErrorResponse("User not found", 404, req.requestId));
        }

        const enabled = (user as any).onboardingEnabled === 1;
        const progress = (user as any).onboardingProgress || {
          completed: [],
          currentStep: null,
          startedAt: null,
          completedAt: null,
        };

        res.json({ enabled, progress });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Update onboarding state
  const updateOnboardingSchema = z.object({
    enabled: z.boolean().optional(),
    progress: z
      .object({
        completed: z.array(z.string()).optional(),
        currentStep: z.string().nullable().optional(),
        startedAt: z.string().nullable().optional(),
        completedAt: z.string().nullable().optional(),
      })
      .optional(),
  });

  app.patch(
    "/api/user/onboarding",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const result = updateOnboardingSchema.safeParse(req.body);

        if (!result.success) {
          return res.status(400).json({ error: fromZodError(result.error).message });
        }

        const updateData: any = {};

        if (result.data.enabled !== undefined) {
          updateData.onboardingEnabled = result.data.enabled ? 1 : 0;
        }

        if (result.data.progress) {
          // Get current progress and merge with updates
          const user = await storage.getUser(userId);
          const currentProgress = (user as any)?.onboardingProgress || {
            completed: [],
            currentStep: null,
            startedAt: null,
            completedAt: null,
          };

          updateData.onboardingProgress = {
            ...currentProgress,
            ...result.data.progress,
          };
        }

        const updatedUser = await storage.updateUser(userId, updateData);
        if (!updatedUser) {
          return res.status(404).json(createErrorResponse("User not found", 404, req.requestId));
        }

        res.json({
          enabled: (updatedUser as any).onboardingEnabled === 1,
          progress: (updatedUser as any).onboardingProgress,
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Complete an onboarding step
  app.post(
    "/api/user/onboarding/complete-step",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const { stepId } = req.body;

        if (!stepId || typeof stepId !== "string") {
          return res.status(400).json({ error: "stepId is required" });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json(createErrorResponse("User not found", 404, req.requestId));
        }

        const currentProgress = (user as any).onboardingProgress || {
          completed: [],
          currentStep: null,
          startedAt: null,
          completedAt: null,
        };

        // Add step to completed list if not already there
        const completedSet = new Set(currentProgress.completed);
        completedSet.add(stepId);

        const newProgress = {
          ...currentProgress,
          completed: Array.from(completedSet),
        };

        // Check if all steps complete (5 total checklist items)
        if (completedSet.size >= 5 && !currentProgress.completedAt) {
          newProgress.completedAt = new Date().toISOString();
        }

        await storage.updateUser(userId, { onboardingProgress: newProgress });

        res.json({ success: true, progress: newProgress });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Reset onboarding
  app.post(
    "/api/user/onboarding/reset",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;

        const freshProgress = {
          completed: [],
          currentStep: null,
          startedAt: null,
          completedAt: null,
        };

        await storage.updateUser(userId, {
          onboardingEnabled: 1,
          onboardingProgress: freshProgress,
        });

        res.json({ success: true, enabled: true, progress: freshProgress });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

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

  // Prospects API - Protected routes
  app.get(
    "/api/prospects/count",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        // Return cumulative count
        res.json({ count: user.prospectsCreatedCount || 0 });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.get("/api/prospects", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const prospects = await storage.listProspects(userId);
      res.json(prospects);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  app.get(
    "/api/prospects/export/excel",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospects = await storage.listProspects(userId);
        const user = await storage.getUser(userId);

        const excelBuffer = await generatePipelineExcel(prospects, user);

        // SECURITY: Use sanitized filename to prevent header injection
        // const { encodeContentDisposition } = await import("./utils/security");
        const filename = `pipeline-export-${new Date().toISOString().split("T")[0]}.xlsx`;
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", encodeContentDisposition(filename));
        res.send(excelBuffer);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.get(
    "/api/prospects/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const id = parseInt(req.params.id);
        const prospect = await storage.getProspect(id, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }
        res.json(prospect);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.post("/api/prospects", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;

      // Check prospect limit based on subscription tier
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Use cumulative count for quota enforcement
      const prospectCount = user.prospectsCreatedCount || 0;

      if (prospectCount >= user.prospectLimit) {
        return res.status(403).json({
          error: `Prospect limit reached. You have used ${prospectCount} of your ${user.prospectLimit} allowed prospects on the ${user.subscriptionTier} plan. Deleting prospects does not restore your quota. Please upgrade your subscription to add more prospects.`,
          prospectCount,
          prospectLimit: user.prospectLimit,
          subscriptionTier: user.subscriptionTier,
        });
      }

      const result = insertProspectSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).toString() });
      }
      const prospect = await storage.createProspect(result.data, userId);

      // Trigger Zeus Autonomous Research asynchronously
      zeusService.performInstantResearch(prospect.id!, userId).catch((err) => {
        console.error("[Zeus Trigger] Background research failed:", err);
      });

      // Trigger Initial Zeus Document Gap Analysis
      zeusService.performDocumentGapAnalysis(prospect.id!, userId).catch((err) => {
        console.error("[Zeus Trigger] Initial gap analysis failed:", err);
      });

      res.json(prospect);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  app.patch(
    "/api/prospects/:id/stage",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.id);
        const result = updateProspectStageSchema.safeParse({
          prospectId,
          stage: req.body.stage,
        });
        if (!result.success) {
          return res.status(400).json({ error: fromZodError(result.error).toString() });
        }
        const prospect = await storage.updateProspectStage(prospectId, userId, result.data.stage);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }
        res.json(prospect);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.post(
    "/api/prospects/reorder",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const { stage, orderedIds } = req.body;

        if (!stage || !Array.isArray(orderedIds)) {
          return res.status(400).json({ error: "Stage and orderedIds array are required" });
        }

        await storage.reorderProspects(userId, stage, orderedIds);
        res.json({ success: true });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.patch(
    "/api/prospects/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const id = parseInt(req.params.id);

        const prospect = await storage.updateProspect(id, userId, req.body);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }
        res.json(prospect);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.delete(
    "/api/prospects/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const id = parseInt(req.params.id);

        await storage.deleteProspect(id, userId);
        res.status(204).send();
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.get(
    "/api/prospects/:id/report",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const id = parseInt(req.params.id);

        const prospect = await storage.getProspect(id, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const contacts = await storage.listContacts(id, userId);
        const activities = await storage.listActivities(id, userId);
        const dueDiligence = await storage.getDueDiligence(id, userId);

        const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
        let companiesHouseData = null;

        if (apiKey && prospect.company.companyNumber) {
          try {
            const trimmedApiKey = apiKey.trim();
            const authString = `${trimmedApiKey}:`;
            const base64Auth = Buffer.from(authString).toString("base64");
            const companyNumber = prospect.company.companyNumber;

            const [officersRes, pscRes, chargesRes] = await Promise.all([
              fetch(
                `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/officers`,
                {
                  headers: { Authorization: `Basic ${base64Auth}` },
                }
              ).catch(() => null),
              fetch(
                `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`,
                {
                  headers: { Authorization: `Basic ${base64Auth}` },
                }
              ).catch(() => null),
              fetch(
                `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/charges`,
                {
                  headers: { Authorization: `Basic ${base64Auth}` },
                }
              ).catch(() => null),
            ]);

            companiesHouseData = {
              officers: officersRes && officersRes.ok ? await officersRes.json() : null,
              psc: pscRes && pscRes.ok ? await pscRes.json() : null,
              charges: chargesRes && chargesRes.ok ? await chargesRes.json() : null,
            };
          } catch (error) {
            console.error("Error fetching Companies House data for report:", error);
          }
        }

        const user = await storage.getUser(userId);

        console.log(
          `[PDF Report] Generating report for prospect ${id}, company: ${prospect.company.companyName}`
        );

        const { createProspectReportDocument, renderProspectReport } =
          await import("./utils/pdfGenerator");

        console.log(
          `[PDF Report] Generating report for prospect ${id}, company: ${prospect.company.companyName}`
        );

        const reportData = {
          prospect,
          contacts,
          activities,
          dueDiligence,
          companiesHouseData,
          pdfLayoutPreferences: (user?.pdfLayoutPreferences as any) || null,
        };

        // Create doc
        const doc = createProspectReportDocument(reportData as any);

        // SECURITY: Use sanitized filename to prevent header injection
        // const { encodeContentDisposition } = await import("./utils/security");
        const filename = `${prospect.company.companyName.replace(/[^a-z0-9]/gi, "_")}_Report_${new Date().toISOString().split("T")[0]}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", encodeContentDisposition(filename));

        console.log(`[PDF Report] Streaming PDF response for: ${filename}`);

        // Pipe BEFORE rendering to capture all data
        doc.pipe(res);

        try {
          renderProspectReport(doc, reportData as any);
          doc.end();
        } catch (pdfError) {
          console.error("[PDF Report] Error generating PDF content:", pdfError);
          // If we already started the stream, we can't easily send a JSON error.
          // We could try to abort the stream or append an error text to the PDF if possible,
          // but mostly we just log it. The client will get a truncated/invalid PDF.
          if (!doc.closed) {
            doc.end();
          }
        }
      } catch (error) {
        console.error("[PDF Report] Route error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Business Overview API - AI-powered web search for company info
  app.get(
    "/api/prospects/:id/business-overview",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const id = parseInt(req.params.id);

        const prospect = await storage.getProspect(id, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        // const { searchBusinessOverview } = await import("./utils/tavilyClient");

        const companyName = prospect.company.companyName;
        const industry = prospect.company.sicDescription || prospect.company.sicCode || undefined;

        console.log(`[Business Overview] Searching for company: ${companyName}`);

        const result = await searchBusinessOverview(companyName, industry);

        res.json({
          companyName,
          industry: industry || null,
          bulletPoints: result.bulletPoints,
          sources: result.sources,
        });
      } catch (error) {
        console.error("[Business Overview] Error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  // UK Company Enrichment Agent
  app.post(
    "/api/companies/enrich",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { companyName, websiteUrl } = req.body;
        if (!companyName) {
          return res.status(400).json({ error: "Company name is required" });
        }

        console.log(
          `[Enrichment] Request received for: "${companyName}", Website: "${websiteUrl}"`
        );
        const result = await enrichCompanyProfile(companyName, websiteUrl);
        res.json(result);
      } catch (error) {
        console.error("[Enrichment] API Error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Contact Enrichment API - AI-powered contact search + internal context
  app.post(
    "/api/contacts/:id/enrich",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const contactId = parseInt(req.params.id);

        // 1. Get Contact
        const contact = await storage.getContact(contactId, userId);
        if (!contact) {
          return res.status(404).json({ error: "Contact not found" });
        }

        // 2. Get Prospect (for Company Name)
        // Note: contact.prospectId might be null if strictly typed, but schema usually enforces it.
        // Casting or check might be needed if contact.prospectId is optional.
        if (!contact.prospectId) {
          return res.status(400).json({ error: "Contact is not linked to a prospect" });
        }

        const prospect = await storage.getProspect(contact.prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Associated prospect not found" });
        }

        const companyName = prospect.company.companyName;

        // 3. Run Web Search (Tavily Helper)
        // We search for the person at the company
        console.log(`[Enrichment] Searching for ${contact.name} at ${companyName}`);
        const webResults = await searchContactInfo(contact.name, companyName);

        // 4. Run Internal Search (Email History)
        // fetch emails linked to this contact
        const emailMessages = await storage.getEmailMessagesForContact(contactId, userId);

        // Transform email messages to the expected frontend format
        const relatedEmails = emailMessages.map((msg) => ({
          subject: msg.subject || "(No Subject)",
          from: msg.fromAddress,
          to: msg.toAddresses || [],
          date: msg.sentAt ? new Date(msg.sentAt).toISOString() : new Date().toISOString(),
          snippet: msg.textBody ? msg.textBody.substring(0, 100) + "..." : "No content",
        }));

        // 5. Construct Response
        const response = {
          contact: {
            id: contact.id,
            name: contact.name,
            currentEmail: contact.email,
            currentPhone: contact.phone,
            currentProfilePicture: null, // Schema doesn't have profile pic on contact yet?
            currentNotes: contact.notes,
          },
          companyName: companyName,
          searchNotes: `Enrichment search performed on ${new Date().toLocaleDateString()}`,
          webSearch: {
            emails: webResults.emails,
            phones: webResults.phones,
            linkedinUrls: webResults.linkedinUrls,
            profileImages: webResults.profileImages,
            sources: webResults.sources,
          },
          emailSearch: {
            relatedEmails: relatedEmails, // Recently found emails
          },
        };

        res.json(response);
      } catch (error) {
        console.error("[Enrichment] Error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Enhanced PDF report with business overview
  app.get(
    "/api/prospects/:id/report-enhanced",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const id = parseInt(req.params.id);
        const includeBusinessOverview = req.query.includeBusinessOverview === "true";

        const prospect = await storage.getProspect(id, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const [contacts, activities, dueDiligence, user] = await Promise.all([
          storage.listContacts(id, userId),
          storage.listActivities(id, userId),
          storage.getDueDiligence(id, userId),
          storage.getUser(userId),
        ]);

        const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
        let companiesHouseData = null;

        if (apiKey && prospect.company.companyNumber) {
          try {
            const trimmedApiKey = apiKey.trim();
            const authString = `${trimmedApiKey}:`;
            const base64Auth = Buffer.from(authString).toString("base64");

            const [profileRes, officersRes, chargesRes, pscsRes] = await Promise.all([
              fetch(
                `https://api.company-information.service.gov.uk/company/${prospect.company.companyNumber}`,
                {
                  headers: { Authorization: `Basic ${base64Auth}` },
                }
              ),
              fetch(
                `https://api.company-information.service.gov.uk/company/${prospect.company.companyNumber}/officers`,
                {
                  headers: { Authorization: `Basic ${base64Auth}` },
                }
              ),
              fetch(
                `https://api.company-information.service.gov.uk/company/${prospect.company.companyNumber}/charges`,
                {
                  headers: { Authorization: `Basic ${base64Auth}` },
                }
              ),
              fetch(
                `https://api.company-information.service.gov.uk/company/${prospect.company.companyNumber}/persons-with-significant-control`,
                {
                  headers: { Authorization: `Basic ${base64Auth}` },
                }
              ),
            ]);

            companiesHouseData = {
              profile: profileRes.ok ? await profileRes.json() : null,
              officers: officersRes.ok ? await officersRes.json() : null,
              charges: chargesRes.ok ? await chargesRes.json() : null,
              pscs: pscsRes.ok ? await pscsRes.json() : null,
            };
          } catch (chError) {
            console.error("[PDF Report] Companies House fetch error:", chError);
          }
        }

        // Optionally fetch business overview
        let businessOverview: string[] | null = null;
        if (includeBusinessOverview) {
          try {
            // const { searchBusinessOverview } = await import("./utils/tavilyClient");
            const industry =
              prospect.company.sicDescription || prospect.company.sicCode || undefined;
            const result = await searchBusinessOverview(prospect.company.companyName, industry);
            businessOverview = result.bulletPoints;
          } catch (overviewError) {
            console.error("[PDF Report] Business overview fetch error:", overviewError);
          }
        }

        // Use dynamic import for PDF generator functions
        // const { searchBusinessOverview } = await import("./utils/tavilyClient");
        const { createProspectReportDocument, renderProspectReport } =
          await import("./utils/pdfGenerator");

        const doc = createProspectReportDocument({
          prospect,
          contacts,
          activities,
          dueDiligence,
          companiesHouseData: companiesHouseData as any,
          pdfLayoutPreferences: (user?.pdfLayoutPreferences || null) as any,
        } as any);

        // We still pass businessOverview in data incase we add support for it later,
        // though currently renderProspectReport signature might not use it explicitly.
        const reportData = {
          prospect,
          contacts,
          activities,
          dueDiligence,
          companiesHouseData: companiesHouseData as any,
          pdfLayoutPreferences: (user?.pdfLayoutPreferences || null) as any,
          businessOverview,
        };

        const { encodeContentDisposition } = await import("./utils/security");
        const filename = `${prospect.company.companyName.replace(/[^a-z0-9]/gi, "_")}_Report_${new Date().toISOString().split("T")[0]}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", encodeContentDisposition(filename));

        // CRITICAL FIX: Pipe before rendering to capture all data
        doc.pipe(res);

        try {
          renderProspectReport(doc, reportData as any);
          doc.end();
        } catch (pdfError) {
          console.error("[PDF Report Enhanced] Error generating PDF content:", pdfError);
          if (!doc.closed) {
            doc.end();
          }
        }
      } catch (error) {
        console.error("[PDF Report Enhanced] Route error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Companies House Search API - Protected route
  app.get("/api/companies-house/search", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100 per API
      const activeOnly = req.query.active_only === "true";

      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        console.error("COMPANIES_HOUSE_API_KEY environment variable not set");
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      // Trim any whitespace from API key
      const trimmedApiKey = apiKey.trim();

      // API key is used as username with empty password in Basic Auth
      const authString = `${trimmedApiKey}:`;
      const base64Auth = Buffer.from(authString).toString("base64");

      console.log(
        `Searching Companies House for: "${query}" (limit: ${limit}, activeOnly: ${activeOnly})`
      );

      const response = await fetch(
        `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(query)}&items_per_page=${limit}`,
        {
          headers: {
            Authorization: `Basic ${base64Auth}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        return res.status(response.status).json({
          error: `Companies House API returned ${response.status}: ${errorText || response.statusText}`,
        });
      }

      const data = await response.json();

      // Filter out dissolved companies if activeOnly is true
      if (activeOnly && data.items) {
        data.items = data.items.filter(
          (company: any) =>
            company.company_status !== "dissolved" &&
            company.company_status !== "removed" &&
            company.company_status !== "closed"
        );
      }

      console.log(`Found ${data.items?.length || 0} companies`);
      res.json(data);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Companies House Advanced Search API - Search by SIC, location, postcode
  app.get("/api/companies-house/advanced-search", isAuthenticated, async (req, res) => {
    try {
      const { sic_codes, location, postcode } = req.query;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const activeOnly = req.query.active_only === "true";

      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      const trimmedApiKey = apiKey.trim();
      const base64Auth = Buffer.from(`${trimmedApiKey}:`).toString("base64");

      // Use Advanced Search API which supports proper filtering
      // Documentation: https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/search/advanced-company-search
      const params = new URLSearchParams();
      params.append("size", limit.toString());

      // Build search parameters - can combine SIC codes with postcode filter
      if (sic_codes) {
        params.append("sic_codes", sic_codes as string);
        console.log(`Advanced search by SIC code: ${sic_codes}`);

        // Optional postcode filter with SIC code search
        if (postcode) {
          const formattedPostcode = (postcode as string).replace(/\s+/g, "").toUpperCase();
          params.append("location", formattedPostcode);
          console.log(`  + filtered by postcode: ${formattedPostcode}`);
        }
      } else if (location) {
        // Filter by location (town/city in registered address)
        params.append("location", location as string);
        console.log(`Advanced search by location: ${location}`);

        // Optional postcode filter with location search
        if (postcode) {
          const formattedPostcode = (postcode as string).replace(/\s+/g, "").toUpperCase();
          // Append postcode to location for more specific search
          params.set("location", `${location} ${formattedPostcode}`);
          console.log(`  + filtered by postcode: ${formattedPostcode}`);
        }
      } else if (postcode) {
        // Filter by postcode only (registered office address)
        const formattedPostcode = (postcode as string).replace(/\s+/g, "").toUpperCase();
        params.append("location", formattedPostcode);
        console.log(`Advanced search by postcode: ${formattedPostcode} (limit: ${limit})`);
      } else {
        return res.status(400).json({ error: "At least one search parameter required" });
      }
      console.log(`Search limit: ${limit}`);

      // Only search active companies if filter is enabled
      if (activeOnly) {
        params.append("company_status", "active");
      }

      const url = `https://api.company-information.service.gov.uk/advanced-search/companies?${params.toString()}`;
      console.log(`Advanced search URL: ${url}`);

      const response = await fetch(url, {
        headers: { Authorization: `Basic ${base64Auth}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House Advanced Search API error:", response.status, errorText);

        // If advanced search fails (e.g., not available on free tier), fall back to basic search
        if (response.status === 403 || response.status === 401) {
          console.log("Falling back to basic company search...");
          const fallbackQuery = postcode || location || sic_codes;
          const fallbackResponse = await fetch(
            `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(fallbackQuery as string)}&items_per_page=20`,
            {
              headers: { Authorization: `Basic ${base64Auth}` },
            }
          );

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            console.log(`Fallback search found ${fallbackData.items?.length || 0} companies`);
            return res.json(fallbackData);
          }
        }

        return res.status(response.status).json({
          error: `Companies House API returned ${response.status}`,
        });
      }

      const data = await response.json();
      // Advanced search returns slightly different format, normalize it
      const normalizedData = {
        items:
          data.items?.map((item: any) => {
            const addr = item.registered_office_address;
            return {
              title: item.company_name,
              company_number: item.company_number,
              company_status: item.company_status,
              company_type: item.company_type,
              address_snippet: addr
                ? [
                  addr.premises,
                  addr.address_line_1,
                  addr.address_line_2,
                  addr.locality,
                  addr.region,
                  addr.postal_code,
                  addr.country,
                ]
                  .filter(Boolean)
                  .join(", ")
                : undefined,
              address: addr,
              date_of_creation: item.date_of_creation,
              sic_codes: item.sic_codes,
            };
          }) || [],
        total_results: data.total_results || data.hits,
      };

      console.log(`Advanced search found ${normalizedData.items.length} companies`);
      res.json(normalizedData);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Companies House Officers Search API - Search for directors/officers
  app.get("/api/companies-house/search-officers", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }

      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      const trimmedApiKey = apiKey.trim();
      const base64Auth = Buffer.from(`${trimmedApiKey}:`).toString("base64");

      console.log(`Searching officers for: "${query}"`);

      const response = await fetch(
        `https://api.company-information.service.gov.uk/search/officers?q=${encodeURIComponent(query)}&items_per_page=20`,
        {
          headers: { Authorization: `Basic ${base64Auth}` },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        return res.status(response.status).json({
          error: `Companies House API returned ${response.status}`,
        });
      }

      const data = await response.json();
      console.log(`Found ${data.items?.length || 0} officers`);
      res.json(data);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Get officer appointments (companies they are a director of)
  app.get("/api/companies-house/officer-appointments", isAuthenticated, async (req, res) => {
    try {
      const officerId = req.query.officer_id as string;
      const redirectUrl = (req.query.redirect as string) || "/underwriting";
      if (!officerId) {
        return res.status(400).json({ error: "Officer ID is required" });
      }

      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      const trimmedApiKey = apiKey.trim();
      const base64Auth = Buffer.from(`${trimmedApiKey}:`).toString("base64");

      console.log(`Fetching appointments for officer: "${officerId}"`);

      const response = await fetch(
        `https://api.company-information.service.gov.uk/officers/${encodeURIComponent(officerId)}/appointments`,
        {
          headers: { Authorization: `Basic ${base64Auth}` },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        return res.status(response.status).json({
          error: `Companies House API returned ${response.status}`,
        });
      }

      const data = await response.json();
      console.log(`Found ${data.items?.length || 0} appointments`);
      res.json(data);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Companies House Company Profile API - Protected route
  app.get("/api/companies-house/company/:companyNumber", isAuthenticated, async (req, res) => {
    try {
      const companyNumber = req.params.companyNumber;
      if (!companyNumber || companyNumber.trim().length === 0) {
        return res.status(400).json({ error: "Company number is required" });
      }

      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        console.error("COMPANIES_HOUSE_API_KEY environment variable not set");
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      // Trim any whitespace from API key
      const trimmedApiKey = apiKey.trim();

      // API key is used as username with empty password in Basic Auth
      const authString = `${trimmedApiKey}:`;
      const base64Auth = Buffer.from(authString).toString("base64");

      console.log(`Fetching company profile for: "${companyNumber}"`);

      const response = await fetch(
        `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}`,
        {
          headers: {
            Authorization: `Basic ${base64Auth}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        if (response.status === 404) {
          return res.status(404).json({ error: "Company not found" });
        }
        return res.status(response.status).json({
          error: `Companies House API returned ${response.status}: ${errorText || response.statusText}`,
        });
      }

      const data = await response.json();
      console.log(`Retrieved company profile for ${companyNumber}`);
      res.json(data);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Companies House Officers API - Protected route
  app.get(
    "/api/companies-house/company/:companyNumber/officers",
    isAuthenticated,
    async (req, res) => {
      try {
        const companyNumber = req.params.companyNumber;
        const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
        if (!apiKey) {
          return res.status(500).json({ error: "Companies House API key not configured" });
        }

        const trimmedApiKey = apiKey.trim();
        const authString = `${trimmedApiKey}:`;
        const base64Auth = Buffer.from(authString).toString("base64");

        console.log(`Fetching officers for: "${companyNumber}"`);

        const response = await fetch(
          `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/officers`,
          {
            headers: {
              Authorization: `Basic ${base64Auth}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            return res.status(404).json({ error: "Officers not found" });
          }
          const errorText = await response.text();
          console.error("Companies House API error:", response.status, errorText);
          return res.status(response.status).json({
            error: `Companies House API returned ${response.status}: ${errorText || response.statusText}`,
          });
        }

        const data = await response.json();
        console.log(`Retrieved ${data.items?.length || 0} officers for ${companyNumber}`);
        res.json(data);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Companies House PSC API - Protected route
  app.get(
    "/api/companies-house/company/:companyNumber/persons-with-significant-control",
    isAuthenticated,
    async (req, res) => {
      try {
        const companyNumber = req.params.companyNumber;
        const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
        if (!apiKey) {
          return res.status(500).json({ error: "Companies House API key not configured" });
        }

        const trimmedApiKey = apiKey.trim();
        const authString = `${trimmedApiKey}:`;
        const base64Auth = Buffer.from(authString).toString("base64");

        console.log(`Fetching PSC for: "${companyNumber}"`);

        const response = await fetch(
          `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`,
          {
            headers: {
              Authorization: `Basic ${base64Auth}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            return res.status(404).json({ error: "PSC data not found" });
          }
          const errorText = await response.text();
          console.error("Companies House API error:", response.status, errorText);
          return res.status(response.status).json({
            error: `Companies House API returned ${response.status}: ${errorText || response.statusText}`,
          });
        }

        const data = await response.json();
        console.log(`Retrieved ${data.items?.length || 0} PSCs for ${companyNumber}`);
        res.json(data);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Companies House Charges API - Protected route
  app.get(
    "/api/companies-house/company/:companyNumber/charges",
    isAuthenticated,
    async (req, res) => {
      try {
        const companyNumber = req.params.companyNumber;
        const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
        if (!apiKey) {
          return res.status(500).json({ error: "Companies House API key not configured" });
        }

        const trimmedApiKey = apiKey.trim();
        const authString = `${trimmedApiKey}:`;
        const base64Auth = Buffer.from(authString).toString("base64");

        console.log(`Fetching charges for: "${companyNumber}"`);

        const response = await fetch(
          `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/charges`,
          {
            headers: {
              Authorization: `Basic ${base64Auth}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            // 404 means no charges, return empty data
            return res.json({ total_count: 0, items: [] });
          }
          const errorText = await response.text();
          console.error("Companies House API error:", response.status, errorText);
          return res.status(response.status).json({
            error: `Companies House API returned ${response.status}: ${errorText || response.statusText}`,
          });
        }

        const data = await response.json();
        console.log(`Retrieved ${data.total_count || 0} charges for ${companyNumber}`);
        res.json(data);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Associated companies search - Premium feature
  app.get(
    "/api/prospects/:prospectId/associated-companies",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);

        // Check user subscription - Premium only
        const user = await storage.getUser(userId);
        if (!user || user.subscriptionTier !== "premium") {
          return res
            .status(403)
            .json({ error: "This feature is only available for Premium users" });
        }

        // Get prospect and company info
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const companyNumber = prospect.company.companyNumber;
        if (!companyNumber) {
          return res.json({ officers: [], psc: [], sameAddress: [] });
        }

        const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
        if (!apiKey) {
          return res.status(500).json({ error: "Companies House API key not configured" });
        }

        const trimmedApiKey = apiKey.trim();
        const authString = `${trimmedApiKey}:`;
        const base64Auth = Buffer.from(authString).toString("base64");

        // Fetch officers and PSC for the company
        const [officersRes, pscRes] = await Promise.all([
          fetch(
            `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/officers`,
            {
              headers: { Authorization: `Basic ${base64Auth}` },
            }
          ).catch(() => null),
          fetch(
            `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`,
            {
              headers: { Authorization: `Basic ${base64Auth}` },
            }
          ).catch(() => null),
        ]);

        const officers = officersRes && officersRes.ok ? await officersRes.json() : { items: [] };
        const psc = pscRes && pscRes.ok ? await pscRes.json() : { items: [] };

        // Find companies with common officers
        const officerNames =
          officers.items?.filter((o: any) => !o.resigned_on).map((o: any) => o.name) || [];
        const companiesViaOfficers: any[] = [];

        for (const officerName of officerNames.slice(0, 5)) {
          // Limit to prevent too many API calls
          try {
            const searchRes = await fetch(
              `https://api.company-information.service.gov.uk/search/officers?q=${encodeURIComponent(officerName)}&items_per_page=5`,
              { headers: { Authorization: `Basic ${base64Auth}` } }
            );

            if (searchRes.ok) {
              const searchData = await searchRes.json();
              for (const item of searchData.items || []) {
                if (item.links?.officer?.appointments) {
                  const appointmentsRes = await fetch(
                    `https://api.company-information.service.gov.uk${item.links.officer.appointments}`,
                    { headers: { Authorization: `Basic ${base64Auth}` } }
                  );

                  if (appointmentsRes.ok) {
                    const appointments = await appointmentsRes.json();
                    for (const appointment of appointments.items || []) {
                      if (
                        appointment.appointed_to?.company_number !== companyNumber &&
                        !appointment.resigned_on
                      ) {
                        companiesViaOfficers.push({
                          company_number: appointment.appointed_to?.company_number,
                          company_name: appointment.appointed_to?.company_name,
                          company_status: appointment.appointed_to?.company_status,
                          officer_name: officerName,
                          officer_role: appointment.officer_role,
                          appointed_on: appointment.appointed_on,
                        });
                      }
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.error(`Error searching for officer ${officerName}:`, err);
          }
        }

        // Find companies with common PSC
        const pscNames = psc.items?.filter((p: any) => !p.ceased_on).map((p: any) => p.name) || [];
        const companiesViaPSC: any[] = [];

        for (const pscName of pscNames.slice(0, 3)) {
          try {
            const searchRes = await fetch(
              `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(pscName)}&items_per_page=10`,
              { headers: { Authorization: `Basic ${base64Auth}` } }
            );

            if (searchRes.ok) {
              const searchData = await searchRes.json();
              for (const company of searchData.items || []) {
                if (company.company_number !== companyNumber) {
                  companiesViaPSC.push({
                    company_number: company.company_number,
                    company_name: company.title,
                    company_status: company.company_status,
                    psc_name: pscName,
                    address_snippet: company.address_snippet,
                  });
                }
              }
            }
          } catch (err) {
            console.error(`Error searching for PSC ${pscName}:`, err);
          }
        }

        // Find companies at same registered address
        const companiesSameAddress: any[] = [];
        const address = prospect.company.registeredAddress;
        if (address) {
          try {
            const addressQuery = `${address}`.substring(0, 100);
            const searchRes = await fetch(
              `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(addressQuery)}&items_per_page=10`,
              { headers: { Authorization: `Basic ${base64Auth}` } }
            );

            if (searchRes.ok) {
              const searchData = await searchRes.json();
              for (const company of searchData.items || []) {
                if (
                  company.company_number !== companyNumber &&
                  company.address_snippet?.includes(addressQuery.substring(0, 20))
                ) {
                  companiesSameAddress.push({
                    company_number: company.company_number,
                    company_name: company.title,
                    company_status: company.company_status,
                    address_snippet: company.address_snippet,
                  });
                }
              }
            }
          } catch (err) {
            console.error("Error searching for companies at same address:", err);
          }
        }

        // Remove duplicates and limit results
        const uniqueOfficers = Array.from(
          new Map(companiesViaOfficers.map((c) => [c.company_number, c])).values()
        ).slice(0, 10);
        const uniquePSC = Array.from(
          new Map(companiesViaPSC.map((c) => [c.company_number, c])).values()
        ).slice(0, 10);
        const uniqueAddress = Array.from(
          new Map(companiesSameAddress.map((c) => [c.company_number, c])).values()
        ).slice(0, 10);

        res.json({
          officers: uniqueOfficers,
          psc: uniquePSC,
          sameAddress: uniqueAddress,
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // AI web search for company - Premium feature
  app.post(
    "/api/prospects/:prospectId/web-search",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);

        // Check user subscription - Premium only
        const user = await storage.getUser(userId);
        if (!user || user.subscriptionTier !== "premium") {
          return res
            .status(403)
            .json({ error: "This feature is only available for Premium users" });
        }

        // Get prospect and company info
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const tavilyApiKey = process.env.TAVILY_API_KEY;
        if (!tavilyApiKey) {
          return res.status(500).json({ error: "Tavily API key not configured" });
        }

        const companyName = prospect.company.companyName;
        const searchQuery = `${companyName} UK company news information`;

        console.log(`Searching web for company: ${companyName}`);

        const tavilyResponse = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            api_key: tavilyApiKey,
            query: searchQuery,
            search_depth: "basic",
            include_answer: true,
            include_raw_content: false,
            max_results: 10,
            include_domains: [],
            exclude_domains: [],
          }),
        });

        if (!tavilyResponse.ok) {
          const errorText = await tavilyResponse.text();
          console.error("Tavily API error:", tavilyResponse.status, errorText);
          return res.status(tavilyResponse.status).json({
            error: `Tavily API returned ${tavilyResponse.status}: ${errorText || tavilyResponse.statusText}`,
          });
        }

        const data = await tavilyResponse.json();
        console.log(`Found ${data.results?.length || 0} web results for ${companyName}`);

        res.json({
          answer: data.answer || "",
          results: data.results || [],
          query: searchQuery,
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Save selected associations
  app.post(
    "/api/prospects/:prospectId/save-associations",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);
        const { associations } = req.body;

        // Validate associations is an array
        if (!Array.isArray(associations)) {
          return res.status(400).json({ error: "Associations must be an array" });
        }

        // Limit to 50 associations maximum
        if (associations.length > 50) {
          return res.status(400).json({ error: "Maximum 50 associations allowed" });
        }

        // Verify prospect ownership
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        // Update prospect with saved associations
        const updated = await storage.updateProspect(prospectId, userId, {
          savedAssociations: associations,
        });

        res.json(updated);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Companies API - Protected routes

  // Specific route for fetching by numeric ID
  app.get("/api/companies/:id(\\d+)", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      console.log(`[API] Fetching company by ID: ${companyId}`);
      const company = await storage.getCompanyById(companyId);
      console.log(`[API] Company result:`, company ? "Found" : "Not Found");
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error(`[API] Error fetching company ${req.params.id}:`, error);
      handleApiError(res, error, "api-error");
    }
  });

  // Fallback for company number (string)
  app.get("/api/companies/:number", isAuthenticated, async (req, res) => {
    try {
      const company = await storage.getCompanyByNumber(req.params.number);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  app.post("/api/companies", isAuthenticated, async (req, res) => {
    try {
      const result = insertCompanySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).toString() });
      }

      const existingCompany = await storage.getCompanyByNumber(result.data.companyNumber);
      if (existingCompany) {
        return res.json(existingCompany);
      }

      // Add SIC description if sicCode is provided
      const companyData = {
        ...result.data,
        sicDescription: result.data.sicCode ? getSicDescription(result.data.sicCode) : null,
      };

      const company = await storage.createCompany(companyData);
      res.json(company);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Update company details (e.g., sync incorporation date from Companies House)
  app.patch("/api/companies/:id", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ error: "Invalid company ID" });
      }

      const {
        incorporationDate,
        companyStatus,
        registeredAddress,
        postcode,
        sicCode,
        sicDescription,
        website,
      } = req.body;

      // Build update object with only provided fields
      const updates: Partial<{
        incorporationDate: string;
        companyStatus: string;
        registeredAddress: string;
        postcode: string;
        sicCode: string;
        sicDescription: string;
        website: string;
      }> = {};
      if (incorporationDate !== undefined) updates.incorporationDate = incorporationDate;
      if (companyStatus !== undefined) updates.companyStatus = companyStatus;
      if (registeredAddress !== undefined) updates.registeredAddress = registeredAddress;
      if (postcode !== undefined) updates.postcode = postcode;
      if (sicCode !== undefined) updates.sicCode = sicCode;
      if (sicDescription !== undefined) updates.sicDescription = sicDescription;
      if (website !== undefined) updates.website = website;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      const company = await storage.updateCompany(companyId, updates);
      res.json(company);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Sync company data from Companies House (SIC codes, postcode, etc.)
  app.post("/api/companies/:id/sync-companies-house", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ error: "Invalid company ID" });
      }

      // Get the company to find the company number
      const companyRecord = await storage.getCompanyById(companyId);
      if (!companyRecord) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Skip non-registered companies
      if (companyRecord.companyNumber.startsWith("UNREG-")) {
        return res.status(400).json({ error: "Cannot sync unregistered companies" });
      }

      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      // Fetch company profile from Companies House
      const trimmedApiKey = apiKey.trim();
      const authString = `${trimmedApiKey}:`;
      const base64Auth = Buffer.from(authString).toString("base64");

      const response = await fetch(
        `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyRecord.companyNumber)}`,
        { headers: { Authorization: `Basic ${base64Auth}` } }
      );

      if (!response.ok) {
        return res
          .status(response.status)
          .json({ error: "Failed to fetch company data from Companies House" });
      }

      const chData = await response.json();

      // Build update object
      const updates: Partial<{
        sicCode: string;
        sicDescription: string;
        postcode: string;
        registeredAddress: string;
        companyStatus: string;
        incorporationDate: string;
      }> = {};

      // Extract SIC code
      if (chData.sic_codes && chData.sic_codes.length > 0) {
        updates.sicCode = chData.sic_codes[0];
        updates.sicDescription = getSicDescription(chData.sic_codes[0]);
      }

      // Extract postcode and address
      if (chData.registered_office_address) {
        const addr = chData.registered_office_address;
        if (addr.postal_code) {
          updates.postcode = addr.postal_code;
        }
        // Build full address
        const addressParts = [
          addr.premises,
          addr.address_line_1,
          addr.address_line_2,
          addr.locality,
          addr.region,
          addr.postal_code,
          addr.country,
        ].filter(Boolean);
        if (addressParts.length > 0) {
          updates.registeredAddress = addressParts.join(", ");
        }
      }

      // Extract status and incorporation date
      if (chData.company_status) {
        updates.companyStatus = chData.company_status;
      }
      if (chData.date_of_creation) {
        updates.incorporationDate = chData.date_of_creation;
      }

      if (Object.keys(updates).length === 0) {
        return res.json({ message: "No updates available", company: companyRecord });
      }

      const updatedCompany = await storage.updateCompany(companyId, updates);
      res.json(updatedCompany);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Contact enrichment - search web and email inbox for contact info
  app.get(
    "/api/prospects/:prospectId/contacts",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user) return res.status(401).send("Not authenticated");
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user.id;
        const contacts = await storage.listContacts(prospectId, userId);
        res.json(contacts);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Auto-sync officers from Companies House to contacts
  app.post("/api/prospects/:prospectId/sync-officers", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.prospectId);
      const userId = req.user!.id;

      // Get the prospect to find the company number
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }

      const companyNumber = prospect.company.companyNumber;
      if (!companyNumber) {
        return res.status(400).json({ error: "No company number available" });
      }

      // Fetch officers from Companies House
      const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      const officersResponse = await fetch(
        `https://api.company-information.service.gov.uk/company/${companyNumber}/officers`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
          },
        }
      );

      if (!officersResponse.ok) {
        return res.status(officersResponse.status).json({ error: "Failed to fetch officers" });
      }

      const officersData = await officersResponse.json();
      const activeOfficers = officersData.items?.filter((o: any) => !o.resigned_on) || [];

      // Get existing contacts
      const existingContacts = await storage.listContacts(prospectId, userId);
      const existingNames = new Set(existingContacts.map((c) => c.name.toLowerCase().trim()));

      // Create contacts for officers not already in contacts
      const newContacts = [];
      for (const officer of activeOfficers) {
        const formattedName = formatOfficerName(officer.name);
        if (!existingNames.has(formattedName.toLowerCase().trim())) {
          const role =
            officer.officer_role
              ?.replace(/-/g, " ")
              .replace(/\b\w/g, (l: string) => l.toUpperCase()) || "Officer";
          const contact = await storage.createContact(
            {
              prospectId: prospectId as number,
              name: formattedName,
              role,
            } as any,
            userId
          );
          if (contact) newContacts.push(contact);
        }
      }

      // Return all contacts
      const allContacts = await storage.listContacts(prospectId, userId);
      res.json({
        contacts: allContacts,
        synced: newContacts.length,
        message:
          newContacts.length > 0
            ? `Synced ${newContacts.length} officer(s)`
            : "All officers already synced",
      });
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  app.post(
    "/api/prospects/:prospectId/contacts",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user.id;
        const result = insertContactSchema.safeParse({ ...req.body, prospectId });
        if (!result.success) {
          return res.status(400).json({ error: fromZodError(result.error).toString() });
        }
        const contact = await storage.createContact(result.data, userId);
        if (!contact) {
          return res
            .status(403)
            .json({ error: "Access denied - prospect not found or not owned by user" });
        }
        res.json(contact);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.patch(
    "/api/contacts/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user.id;
        const contact = await storage.updateContact(id, userId, req.body);
        if (!contact) {
          return res.status(404).json({ error: "Contact not found or access denied" });
        }
        res.json(contact);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.delete(
    "/api/contacts/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user.id;
        const deleted = await storage.deleteContact(id, userId);
        if (!deleted) {
          return res.status(404).json({ error: "Contact not found or access denied" });
        }
        res.json({ success: true });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Contact enrichment - search web and email inbox for contact info
  app.post(
    "/api/contacts/:id/enrich",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const contactId = parseInt(req.params.id);
        const userId = req.user.id;

        // Get the contact (already user-scoped via prospect ownership)
        const contact = await storage.getContact(contactId, userId);
        if (!contact) {
          return res.status(404).json({ error: "Contact not found or access denied" });
        }

        // Get the prospect
        const prospect = await storage.getProspect(contact.prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        // Get company name for search context
        const company = await storage.getCompany(prospect.companyId!);
        const companyName = company?.companyName || "";

        // Search the web for contact info using Gemini
        const webResults = await searchCompanyInfo(contact.name, companyName);

        // Search email inbox for related emails
        let emailResults: any[] = [];
        try {
          const inbox = await storage.getEmailInbox(userId);
          if (inbox) {
            // Search for emails that mention the contact name or existing email
            const searchTerms = [contact.name];
            if (contact.email) {
              searchTerms.push(contact.email);
            }

            const messages = await storage.getEmailMessagesByInbox(inbox.id);
            emailResults = messages
              .filter((msg: any) => {
                const content =
                  `${msg.subject} ${msg.textBody || ""} ${msg.fromAddress} ${msg.toAddresses?.join(" ") || ""}`.toLowerCase();
                return searchTerms.some((term) => content.includes(term.toLowerCase()));
              })
              .map((msg: any) => ({
                subject: msg.subject,
                from: msg.fromAddress,
                to: msg.toAddresses,
                date: msg.sentAt,
                snippet: msg.textBody?.substring(0, 200) || "",
              }));
          }
        } catch (emailError) {
          console.log("Could not search email inbox:", emailError);
        }

        // Build search notes from all results
        const searchDate = new Date().toISOString().split("T")[0];
        let searchNotes = `--- Web Search Results (${searchDate}) ---\n`;
        searchNotes += `Search: "${contact.name}" at "${companyName}"\n\n`;

        if (webResults.emails.length > 0) {
          searchNotes += `Found Emails:\n${webResults.emails.map((e) => `  - ${e}`).join("\n")}\n\n`;
        }
        if (webResults.phones.length > 0) {
          searchNotes += `Found Phone Numbers:\n${webResults.phones.map((p) => `  - ${p}`).join("\n")}\n\n`;
        }
        if (webResults.linkedinUrls.length > 0) {
          searchNotes += `LinkedIn Profiles:\n${webResults.linkedinUrls.map((l) => `  - ${l}`).join("\n")}\n\n`;
        }
        if (webResults.sources.length > 0) {
          searchNotes += `Sources:\n${webResults.sources
            .slice(0, 5)
            .map((s) => `  - ${s.title}: ${s.url}`)
            .join("\n")}\n\n`;
        }
        if (emailResults.length > 0) {
          searchNotes += `Related Emails in Inbox:\n${emailResults
            .slice(0, 5)
            .map((e) => `  - ${e.subject} (from: ${e.from})`)
            .join("\n")}\n`;
        }

        res.json({
          contact: {
            id: contact.id,
            name: contact.name,
            currentEmail: contact.email,
            currentPhone: contact.phone,
            currentProfilePicture: contact.profilePicture,
            currentNotes: contact.notes,
          },
          companyName: companyName,
          searchNotes: searchNotes,
          webSearch: {
            emails: webResults.emails,
            phones: webResults.phones,
            linkedinUrls: webResults.linkedinUrls,
            profileImages: webResults.profileImages,
            sources: webResults.sources,
          },
          emailSearch: {
            relatedEmails: emailResults.slice(0, 10),
          },
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Activities API - Protected routes
  app.get("/api/activities", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const activities = await storage.listAllUserActivities(userId);
      res.json(activities);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  app.post("/api/activities", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      // SECURITY: Strip userId from request body to prevent injection attacks
      const { userId: _, ...safeBody } = req.body;
      const result = insertActivitySchema.safeParse(safeBody);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).toString() });
      }
      const activity = await storage.createActivity(result.data, userId);
      if (!activity) {
        return res
          .status(403)
          .json({ error: "Access denied - prospect not found or not owned by user" });
      }
      res.json(activity);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  app.get(
    "/api/prospects/:prospectId/activities",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user) return res.status(401).send("Not authenticated");
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user.id;
        const activities = await storage.listActivities(prospectId, userId);
        res.json(activities);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.post(
    "/api/prospects/:prospectId/activities",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);
        // SECURITY: Strip userId from request body to prevent injection attacks
        const { userId: _, ...safeBody } = req.body;
        const result = insertActivitySchema.safeParse({ ...safeBody, prospectId });
        if (!result.success) {
          return res.status(400).json({ error: fromZodError(result.error).toString() });
        }
        const activity = await storage.createActivity(result.data, userId);
        if (!activity) {
          return res
            .status(403)
            .json({ error: "Access denied - prospect not found or not owned by user" });
        }
        res.json(activity);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.patch(
    "/api/activities/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user.id;
        const activity = await storage.updateActivity(id, userId, req.body);
        if (!activity) {
          return res.status(404).json({ error: "Activity not found or access denied" });
        }
        res.json(activity);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.delete(
    "/api/activities/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user.id;
        await storage.deleteActivity(id, userId);
        res.json({ success: true });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Time Entries Routes
  app.get(
    "/api/prospects/:prospectId/time-entries",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user.id;
        const entries = await storage.listTimeEntries(prospectId, userId);
        res.json(entries);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.get(
    "/api/prospects/:prospectId/time-total",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user.id;
        const totalMinutes = await storage.getProspectTotalTime(prospectId, userId);
        res.json({ totalMinutes });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.post(
    "/api/prospects/:prospectId/time-entries",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user.id;

        const parsed = insertTimeEntrySchema.safeParse({ ...req.body, prospectId });
        if (!parsed.success) {
          return res.status(400).json({ error: fromZodError(parsed.error).message });
        }

        const entry = await storage.createTimeEntry(parsed.data, userId);
        res.status(201).json(entry);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.patch(
    "/api/time-entries/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user.id;
        const entry = await storage.updateTimeEntry(id, userId, req.body);
        if (!entry) {
          return res.status(404).json({ error: "Time entry not found or access denied" });
        }
        res.json(entry);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.delete(
    "/api/time-entries/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user.id;
        await storage.deleteTimeEntry(id, userId);
        res.json({ success: true });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get due diligence status summaries for all prospects (for pipeline cards)
  app.get(
    "/api/due-diligence/summaries",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const summaries = await storage.getAllDueDiligenceSummaries(userId);
        const statusMap: Record<number, string> = {};
        for (const summary of summaries) {
          statusMap[summary.prospectId] = summary.status;
        }
        res.json(statusMap);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.get(
    "/api/prospects/:prospectId/due-diligence",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user.id;
        const dueDiligenceData = await storage.getDueDiligence(prospectId, userId);
        res.json(dueDiligenceData || { prospectId, data: {} });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.patch(
    "/api/prospects/:prospectId/due-diligence",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user.id;
        const existing = await storage.getDueDiligence(prospectId, userId);
        const mergedData =
          existing && existing.data ? { ...(existing.data as object), ...req.body } : req.body;
        const dueDiligenceData = await storage.upsertDueDiligence(prospectId, userId, mergedData);
        if (!dueDiligenceData) {
          return res
            .status(403)
            .json({ error: "Access denied - prospect not found or not owned by user" });
        }
        res.json(dueDiligenceData);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Credit Underwriting Routes (Premium Only)
  // Note: These endpoints process financial documents via AI - requires user consent and audit logging
  // Size limits are now managed by AI_GOVERNANCE_CONFIG

  app.post(
    "/api/prospects/:prospectId/underwriting/analyze-csv",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);
        const { csvData, loanAmount, monthlyRepayment, consentToAiProcessing } = req.body;

        console.log("[CSV Analysis] Request received:", {
          prospectId,
          csvDataLength: csvData?.length || 0,
          csvDataPreview: csvData?.substring(0, 200) || "empty",
          loanAmount,
          monthlyRepayment,
          consentToAiProcessing,
        });

        if (!csvData || !loanAmount || !monthlyRepayment) {
          console.log("[CSV Analysis] Missing required fields");
          return res
            .status(400)
            .json({ error: "Missing required fields: csvData, loanAmount, monthlyRepayment" });
        }

        // Verify prospect belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        // Use governance wrapper for consent, redaction, size limits, and audit logging
        const { analyzeFinancials } = await import("./utils/geminiClient");

        console.log(
          "[CSV Analysis] Starting analysis with",
          csvData.length,
          "bytes (server-side pre-processing)..."
        );
        const result = await wrapAiRequest(
          {
            userId,
            prospectId,
            operation: "analyze_csv",
            dataType: "csv",
            consentToAiProcessing: !!consentToAiProcessing,
          },
          csvData,
          async (processedData) => {
            console.log(
              "[CSV Analysis] Calling Gemini with processed data length:",
              processedData.length
            );
            return analyzeFinancials(processedData, loanAmount, monthlyRepayment);
          },
          { maxSize: AI_GOVERNANCE_CONFIG.maxCsvSize }
        );
        console.log(
          "[CSV Analysis] AI analysis complete, result type:",
          "error" in result ? "error" : "success"
        );

        if ("error" in result) {
          console.log("[CSV Analysis] Error result:", result);
          return res.status(result.code).json({
            error: result.error,
            requiresConsent: result.code === 403,
          });
        }

        // Save to due diligence
        const existing = await storage.getDueDiligence(prospectId, userId);
        const existingData = (existing?.data || {}) as Record<string, any>;
        const mergedData = {
          ...existingData,
          underwriting: {
            ...(existingData.underwriting || {}),
            financialAnalysis: result.result,
            analyzedAt: new Date().toISOString(),
          },
        };
        await storage.upsertDueDiligence(prospectId, userId, mergedData as any);

        // Trigger Zeus Smart Underwriting Enhancement asynchronously
        zeusService.performSmartUnderwritingEnhancement(prospectId, userId).catch((err) => {
          console.error("[Zeus Trigger] Underwriting enhancement failed:", err);
        });

        res.json(result.result);
      } catch (error: any) {
        console.error("CSV analysis error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get due diligence data
  app.get(
    "/api/prospects/:prospectId/due-diligence",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);

        const dueDiligence = await storage.getDueDiligence(prospectId, userId);
        res.json(dueDiligence?.data || {});
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Save due diligence data
  app.post(
    "/api/prospects/:prospectId/due-diligence",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);

        const dueDiligence = await storage.upsertDueDiligence(prospectId, userId, req.body);
        res.json(dueDiligence);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Analyze bank statement PDFs (alternative to CSV)
  app.post(
    "/api/prospects/:prospectId/underwriting/analyze-bank-pdfs",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);
        const { pdfTexts, loanAmount, monthlyRepayment, consentToAiProcessing } = req.body;

        if (!pdfTexts || !Array.isArray(pdfTexts) || pdfTexts.length === 0) {
          return res.status(400).json({ error: "At least one bank statement PDF is required" });
        }

        if (pdfTexts.length > AI_GOVERNANCE_CONFIG.maxPdfFiles) {
          return res.status(400).json({
            error: `Maximum ${AI_GOVERNANCE_CONFIG.maxPdfFiles} bank statement PDFs allowed`,
          });
        }

        if (!loanAmount || !monthlyRepayment) {
          return res
            .status(400)
            .json({ error: "Missing required fields: loanAmount, monthlyRepayment" });
        }

        // Verify prospect belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        // Fetch existing accounts analysis to provide context for comparison
        const existingDD = await storage.getDueDiligence(prospectId, userId);
        const accountsAnalysis = (existingDD?.data as any)?.underwriting?.accountsAnalysis;

        // Validate size and apply redaction to each PDF text
        const processedPdfTexts: typeof pdfTexts = [];
        for (const pdfText of pdfTexts) {
          if (
            pdfText.text &&
            Buffer.byteLength(pdfText.text, "utf8") > AI_GOVERNANCE_CONFIG.maxPdfTextSize
          ) {
            return res.status(413).json({
              error: `PDF "${pdfText.fileName}" exceeds ${Math.round(AI_GOVERNANCE_CONFIG.maxPdfTextSize / 1024)}KB text limit.`,
            });
          }
          const { redacted } = redactSensitiveData(pdfText.text || "");
          processedPdfTexts.push({ ...pdfText, text: redacted });
        }

        // Combine all text for governance wrapper
        const combinedText = processedPdfTexts.map((p) => p.text).join("\n---\n");

        // Use governance wrapper for consent, audit logging
        const { analyzeFinancialsFromPdf } = await import("./utils/geminiClient");

        const result = await wrapAiRequest(
          {
            userId,
            prospectId,
            operation: "analyze_bank_pdfs",
            dataType: "pdf",
            consentToAiProcessing: !!consentToAiProcessing,
          },
          combinedText,
          async () =>
            analyzeFinancialsFromPdf(
              processedPdfTexts,
              loanAmount,
              monthlyRepayment,
              accountsAnalysis
            ),
          { skipRedaction: true } // Already redacted above
        );

        if ("error" in result) {
          return res.status(result.code).json({
            error: result.error,
            requiresConsent: result.code === 403,
          });
        }

        // Data Integrity Guard: Compare bank analysis with accounts analysis
        const bankDscr = result.result.dscr || 0;
        const accountsDscr = accountsAnalysis?.dscr?.average || 0;
        const hasCriticalVariance =
          accountsDscr > 0 && Math.abs(bankDscr - accountsDscr) > accountsDscr * 0.5;

        // Save to due diligence with bank PDF file metadata and data integrity info
        const existingData = (existingDD?.data || {}) as Record<string, any>;
        const mergedData = {
          ...existingData,
          underwriting: {
            ...(existingData.underwriting || {}),
            financialAnalysis: result.result,
            analyzedAt: new Date().toISOString(),
            bankPdfFiles: pdfTexts.map((p: { fileName: string; pages?: number }) => ({
              fileName: p.fileName,
              pages: p.pages || 0,
            })),
            analysisSource: "pdf",
            dataIntegrity: {
              hasCriticalVariance,
              accountsDscr,
              bankDscr,
              variancePercent:
                accountsDscr > 0
                  ? Math.abs(((bankDscr - accountsDscr) / accountsDscr) * 100).toFixed(1)
                  : null,
            },
          },
        };
        await storage.upsertDueDiligence(prospectId, userId, mergedData as any);

        // Trigger Zeus Smart Underwriting Enhancement asynchronously
        zeusService.performSmartUnderwritingEnhancement(prospectId, userId).catch((err) => {
          console.error("[Zeus Trigger] Underwriting enhancement failed:", err);
        });

        res.json(result.result);
      } catch (error: any) {
        console.error("Bank PDF analysis error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Analyze audited accounts PDFs
  app.post(
    "/api/prospects/:prospectId/underwriting/analyze-accounts",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);
        const { pdfTexts, loanAmount, monthlyRepayment, consentToAiProcessing } = req.body;

        if (!pdfTexts || !Array.isArray(pdfTexts) || pdfTexts.length === 0) {
          return res.status(400).json({ error: "At least one PDF text with year is required" });
        }

        if (!loanAmount || !monthlyRepayment) {
          return res
            .status(400)
            .json({ error: "Missing required fields: loanAmount, monthlyRepayment" });
        }

        // Verify prospect belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        // Validate size and apply redaction to each PDF text
        const processedPdfTexts: typeof pdfTexts = [];
        for (const pdfText of pdfTexts) {
          if (
            pdfText.text &&
            Buffer.byteLength(pdfText.text, "utf8") > AI_GOVERNANCE_CONFIG.maxPdfTextSize
          ) {
            return res.status(413).json({
              error: `Accounts PDF exceeds ${Math.round(AI_GOVERNANCE_CONFIG.maxPdfTextSize / 1024)}KB text limit.`,
            });
          }
          const { redacted } = redactSensitiveData(pdfText.text || "");
          processedPdfTexts.push({ ...pdfText, text: redacted });
        }

        // Combine all text for governance wrapper
        const combinedText = processedPdfTexts.map((p) => p.text).join("\n---\n");

        // Use governance wrapper for consent, audit logging
        const { analyzeAuditedAccounts } = await import("./utils/geminiClient");

        const result = await wrapAiRequest(
          {
            userId,
            prospectId,
            operation: "analyze_accounts",
            dataType: "pdf",
            consentToAiProcessing: !!consentToAiProcessing,
          },
          combinedText,
          async () => analyzeAuditedAccounts(processedPdfTexts, loanAmount, monthlyRepayment),
          { skipRedaction: true } // Already redacted above
        );

        if ("error" in result) {
          return res.status(result.code).json({
            error: result.error,
            requiresConsent: result.code === 403,
          });
        }

        // Save to due diligence
        const existing = await storage.getDueDiligence(prospectId, userId);
        const existingData = (existing?.data || {}) as Record<string, any>;
        const mergedData = {
          ...existingData,
          underwriting: {
            ...(existingData.underwriting || {}),
            accountsAnalysis: result.result,
            accountsAnalyzedAt: new Date().toISOString(),
          },
        };
        await storage.upsertDueDiligence(prospectId, userId, mergedData as any);

        res.json(result.result);
      } catch (error: any) {
        console.error("Accounts analysis error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Parse PDF file to text
  // Note: 7.5MB decoded limit (base64 encoded ~10MB represents ~7.5MB binary)
  const MAX_PDF_DECODED_SIZE = 7.5 * 1024 * 1024; // 7.5MB decoded binary limit

  app.post("/api/parse-pdf", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { pdfBase64 } = req.body;

      if (!pdfBase64) {
        return res.status(400).json({ error: "PDF data is required" });
      }

      // Import pdf-parse with correct default export handling
      const pdfImport = await import("pdf-parse");
      // @ts-ignore
      const pdfParse = pdfImport.default || pdfImport;

      // Convert base64 to buffer
      const pdfBuffer = Buffer.from(pdfBase64, "base64");

      // Enforce size limit on decoded buffer (not base64 string)
      if (pdfBuffer.length > MAX_PDF_DECODED_SIZE) {
        return res
          .status(413)
          .json({ error: "PDF exceeds 7.5MB limit. Please use a smaller file." });
      }

      // Parse PDF using standard API
      // @ts-ignore
      const result = await pdfParse(pdfBuffer);

      res.json({
        text: result.text,
        pages: result.numpages,
        info: result.info || {},
      });
    } catch (error: any) {
      console.error("PDF parsing error:", error);
      handleApiError(res, error, "api-error");
    }
  });

  // Analyze Management Accounts with AI commentary
  app.post(
    "/api/prospects/:prospectId/analyze-management-accounts",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);

        const { files, months, consentToAiProcessing } = req.body;

        if (!files || !Array.isArray(files) || files.length === 0) {
          return res.status(400).json({ error: "At least one file is required" });
        }

        // Verify prospect belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        // Combine all file texts for analysis
        const combinedText = files
          .map((f: { fileName: string; text: string }) => `--- ${f.fileName} ---\n${f.text || ""}`)
          .join("\n\n");

        if (combinedText.trim().length < 100) {
          return res
            .status(400)
            .json({ error: "Could not extract sufficient text from the uploaded files" });
        }

        // Build context for governance wrapper
        const contextData = JSON.stringify({
          companyName: prospect.company.companyName || "Unknown Company",
          periodMonths: months || 3,
          fileCount: files.length,
          textLength: combinedText.length,
        });

        // Use governance wrapper for AI processing
        const { analyzeManagementAccounts } = await import("./utils/geminiClient");

        const result = await wrapAiRequest(
          {
            userId,
            prospectId,
            operation: "management_accounts_analysis",
            dataType: "structured",
            consentToAiProcessing: !!consentToAiProcessing,
          },
          contextData,
          async () =>
            analyzeManagementAccounts(
              combinedText,
              prospect.company?.companyName || "Unknown Company",
              months || 3
            ),
          { skipRedaction: true }
        );

        if ("error" in result) {
          return res.status(result.code).json({
            error: result.error,
            requiresConsent: result.code === 403,
          });
        }

        // Save to due diligence
        const existing = await storage.getDueDiligence(prospectId, userId);
        const existingData = (existing?.data || {}) as Record<string, any>;
        const mergedData = {
          ...existingData,
          underwriting: {
            ...(existingData.underwriting || {}),
            managementAccounts: {
              ...(existingData.underwriting?.managementAccounts || {}),
              files: files.map((f: { fileName: string; pages?: number }) => ({
                fileName: f.fileName,
                pages: f.pages,
              })),
              months: months || 3,
              uploadedAt: new Date().toISOString(),
              analysisStatus: "completed",
              analyzedAt: new Date().toISOString(),
              analysis: result.result,
            },
          },
        };
        await storage.upsertDueDiligence(prospectId, userId, mergedData as any);

        res.json({
          success: true,
          analysis: result.result,
        });
      } catch (error: any) {
        console.error("Management accounts analysis error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Generate SWOT analysis
  app.post(
    "/api/prospects/:prospectId/underwriting/swot-analysis",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);

        const {
          companyName,
          sector,
          loanAmount,
          loanPurpose,
          financialSummary,
          companiesHouseData,
          bankAnalysisSummary,
          eligibilityNotes,
          consentToAiProcessing,
        } = req.body;

        if (!companyName || !loanAmount) {
          return res
            .status(400)
            .json({ error: "Missing required fields: companyName, loanAmount" });
        }

        // Verify prospect belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        // Build context string for governance wrapper (no sensitive raw data)
        const contextData = JSON.stringify({
          companyName,
          sector: sector || "",
          loanAmount,
          loanPurpose: loanPurpose || "",
          hasFinancialSummary: !!financialSummary,
          hasCompaniesHouseData: !!companiesHouseData,
          hasBankAnalysis: !!bankAnalysisSummary,
        });

        // Use governance wrapper for consent, audit logging
        const { generateSwotAnalysis } = await import("./utils/geminiClient");

        const result = await wrapAiRequest(
          {
            userId,
            prospectId,
            operation: "swot_analysis",
            dataType: "structured",
            consentToAiProcessing: !!consentToAiProcessing,
          },
          contextData,
          async () =>
            generateSwotAnalysis(
              companyName,
              sector || "",
              loanAmount,
              loanPurpose || "",
              financialSummary || "",
              companiesHouseData,
              bankAnalysisSummary,
              eligibilityNotes
            ),
          { skipRedaction: true } // Context data is already structured
        );

        if ("error" in result) {
          return res.status(result.code).json({
            error: result.error,
            requiresConsent: result.code === 403,
          });
        }

        // Save to due diligence
        const existing = await storage.getDueDiligence(prospectId, userId);
        const existingData = (existing?.data || {}) as Record<string, any>;
        const mergedData = {
          ...existingData,
          underwriting: {
            ...(existingData.underwriting || {}),
            swotAnalysis: result.result,
            swotAnalyzedAt: new Date().toISOString(),
          },
        };
        await storage.upsertDueDiligence(prospectId, userId, mergedData as any);

        res.json(result.result);
      } catch (error: any) {
        console.error("SWOT analysis error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  // CAMPARI section AI generation
  app.post(
    "/api/prospects/:prospectId/underwriting/campari-section",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);

        const {
          sectionKey,
          companyName,
          sector,
          loanAmount,
          loanPurpose,
          financialSummary,
          companiesHouseData,
          bankAnalysisSummary,
          accountsAnalysisSummary,
          consentToAiProcessing,
        } = req.body;

        if (!sectionKey || !companyName || !loanAmount) {
          return res
            .status(400)
            .json({ error: "Missing required fields: sectionKey, companyName, loanAmount" });
        }

        // Verify prospect belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        // Fetch uploaded documents for the prospect
        const documents = await storage.listProspectDocuments(prospectId);

        // Filter relevant document categories for CAMPARI analysis
        const relevantCategories = [
          "business",
          "financial",
          "legal",
          "identity",
          "correspondence",
          "general",
          "other",
        ];
        const relevantDocs = documents.filter((doc) =>
          relevantCategories.includes(doc.category || "general")
        );

        // Parse document contents with redaction
        const documentSummaries: { fileName: string; category: string; content: string }[] = [];
        const pdfImport = await import("pdf-parse");
        // @ts-ignore
        const pdfParse = pdfImport.default || pdfImport;

        for (const doc of relevantDocs.slice(0, AI_GOVERNANCE_CONFIG.maxDocuments)) {
          try {
            const { data } = await getObjectStorage().downloadAsBytes(doc.storagePath);

            if (doc.fileType === "application/pdf" || doc.fileName.toLowerCase().endsWith(".pdf")) {
              const pdfData = await pdfParse(Buffer.from(data));
              const textContent = pdfData.text?.trim() || "";
              if (textContent.length > 100) {
                const truncatedContent =
                  textContent.length > 15000
                    ? textContent.substring(0, 15000) + "\n[... Document truncated ...]"
                    : textContent;
                // Apply redaction to document content
                const { redacted } = redactSensitiveData(truncatedContent);
                documentSummaries.push({
                  fileName: doc.fileName,
                  category: doc.category || "general",
                  content: redacted,
                });
              }
            } else if (
              doc.fileType === "text/plain" ||
              doc.fileName.toLowerCase().endsWith(".txt")
            ) {
              const textContent = Buffer.from(data).toString("utf-8").trim();
              if (textContent.length > 50) {
                const truncatedContent =
                  textContent.length > 15000
                    ? textContent.substring(0, 15000) + "\n[... Document truncated ...]"
                    : textContent;
                // Apply redaction to document content
                const { redacted } = redactSensitiveData(truncatedContent);
                documentSummaries.push({
                  fileName: doc.fileName,
                  category: doc.category || "general",
                  content: redacted,
                });
              }
            }
          } catch (docError) {
            console.error(`Error parsing document ${doc.fileName}:`, docError);
          }
        }

        // Build context string for governance wrapper
        const contextData = JSON.stringify({
          sectionKey,
          companyName,
          sector: sector || "",
          loanAmount,
          loanPurpose: loanPurpose || "",
          documentCount: documentSummaries.length,
        });

        // Use governance wrapper for consent, audit logging
        const { generateCampariSection } = await import("./utils/geminiClient");

        const result = await wrapAiRequest(
          {
            userId,
            prospectId,
            operation: `campari_section_${sectionKey}`,
            dataType: "documents",
            consentToAiProcessing: !!consentToAiProcessing,
          },
          contextData,
          async () =>
            generateCampariSection(
              sectionKey,
              companyName,
              sector || "",
              loanAmount,
              loanPurpose || "",
              financialSummary || "",
              companiesHouseData,
              bankAnalysisSummary,
              accountsAnalysisSummary,
              documentSummaries.length > 0 ? documentSummaries : undefined
            ),
          { skipRedaction: true } // Already redacted document content above
        );

        if ("error" in result) {
          return res.status(result.code).json({
            error: result.error,
            requiresConsent: result.code === 403,
          });
        }

        // Save to due diligence
        const existing = await storage.getDueDiligence(prospectId, userId);
        const existingData = (existing?.data || {}) as Record<string, any>;
        const mergedData = {
          ...existingData,
          underwriting: {
            ...(existingData.underwriting || {}),
            adviserSummary: {
              ...(existingData.underwriting?.adviserSummary || {}),
              sections: {
                ...((existingData.underwriting?.adviserSummary?.sections as any) || {}),
                [sectionKey]: result.result,
              },
            },
          },
        };
        await storage.upsertDueDiligence(prospectId, userId, mergedData as any);

        res.json({ sectionKey, content: result.result });
      } catch (error: any) {
        console.error("CAMPARI section generation error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.post(
    "/api/prospects/:prospectId/underwriting/adverse-media",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);

        // Check if user is premium
        const user = await storage.getUser(userId);
        if (!user || user.subscriptionTier !== "premium") {
          return res
            .status(403)
            .json({ error: "Premium subscription required for Credit Underwriting" });
        }

        // Verify prospect belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const { companyName, companyNumber } = req.body;

        if (!companyName) {
          return res.status(400).json({ error: "Company name is required" });
        }

        // Use Gemini grounded search for adverse media
        const result = await searchAdverseMedia(companyName, companyNumber);

        // Save to due diligence
        const existing = await storage.getDueDiligence(prospectId, userId);
        const existingData = (existing?.data || {}) as Record<string, any>;
        const mergedData = {
          ...existingData,
          underwriting: {
            ...(existingData.underwriting || {}),
            adverseMedia: result,
            adverseMediaSearchedAt: new Date().toISOString(),
          },
        };
        await storage.upsertDueDiligence(prospectId, userId, mergedData as any);

        // Trigger Zeus Smart Underwriting Enhancement asynchronously
        zeusService.performSmartUnderwritingEnhancement(prospectId, userId).catch((err) => {
          console.error("[Zeus Trigger] Underwriting enhancement failed:", err);
        });

        res.json(result);
      } catch (error: any) {
        console.error("Adverse media search error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Add-On Products API - Marketplace for prospect packs and feature add-ons
  app.get("/api/add-ons", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const products = await storage.listAddOnProducts(true);
      res.json(products);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  app.get(
    "/api/add-ons/purchases",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const purchases = await storage.listUserAddOnPurchases(userId);
        res.json(purchases);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.get(
    "/api/add-ons/credits",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const credits = await storage.getUserProspectCredits(userId);
        res.json({ credits });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Purchase an add-on - payment processing temporarily unavailable
  app.post(
    "/api/add-ons/purchase",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      return res.status(503).json({
        error: "Payment processing is temporarily unavailable. Please contact support.",
        unavailable: true,
      });
    }
  );

  // Admin: Create add-on product (Super Admin only)
  app.post(
    "/api/add-ons/products",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);

        if (user?.role !== "super_admin") {
          return res.status(403).json({ error: "Super Admin access required" });
        }

        const {
          title,
          description,
          category,
          quantityIncluded,
          featureKey,
          priceInPence,
          currency,
        } = req.body;

        const product = await storage.createAddOnProduct({
          title,
          description,
          category: category || "prospects",
          quantityIncluded: quantityIncluded || 0,
          featureKey,
          priceInPence,
          currency: currency || "GBP",
          isActive: 1,
          displayOrder: 0,
        });

        res.status(201).json(product);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Lenders API - Protected routes
  app.get("/api/lenders", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lenders = await storage.listLenders({
        userId: req.user.id,
        includeGlobal: true,
      });
      res.json(lenders);
    } catch (error) {
      console.error("Error fetching lenders:", error);
      res.status(500).json({ message: "Failed to fetch lenders" });
    }
  });

  app.get("/api/lenders/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const lenderId = parseInt(req.params.id);
      const lender = await storage.getLender(lenderId);

      if (!lender) {
        return res.status(404).json({ message: "Lender not found" });
      }

      res.json(lender);
    } catch (error) {
      console.error("Error fetching lender:", error);
      res.status(500).json({ message: "Failed to fetch lender" });
    }
  });

  // Fetch a logo for a lender based on website or name
  app.post(
    "/api/lenders/lookup-logo",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { website, name } = req.body;
        const { findLogoUrl } = await import("./utils/logoFetcher");

        const result = await findLogoUrl({ website, name });

        res.json(result);
      } catch (error) {
        console.error("Error fetching logo:", error);
        res.status(500).json({ error: "Failed to fetch logo" });
      }
    }
  );

  app.post("/api/lenders", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const result = insertLenderSchema.safeParse(req.body);

      if (!result.success) {
        const validationError = fromZodError(result.error);
        return res.status(400).json({ message: validationError.toString() });
      }

      const lender = await storage.createLender(result.data, userId);
      res.status(201).json(lender);
    } catch (error) {
      console.error("Error creating lender:", error);
      res.status(500).json({ message: "Failed to create lender" });
    }
  });

  app.patch(
    "/api/lenders/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const lenderId = parseInt(req.params.id);
        const action = req.query.action as string;
        const redirect = req.query.redirect as string | undefined;
        const message = req.query.message as string | undefined;
        const result = insertLenderSchema.partial().safeParse(req.body);

        if (!result.success) {
          const validationError = fromZodError(result.error);
          return res.status(400).json({ message: validationError.toString() });
        }

        const isAdmin = req.user.role === "super_admin";
        const lender = await storage.updateLender(lenderId, userId, result.data, isAdmin);

        if (!lender) {
          return res.status(404).json({ message: "Lender not found" });
        }

        res.json(lender);
      } catch (error) {
        console.error("Error updating lender:", error);
        res.status(500).json({ message: "Failed to update lender" });
      }
    }
  );

  app.delete(
    "/api/lenders/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const lenderId = parseInt(req.params.id);
        const isAdmin = req.user.role === "super_admin";

        await storage.deleteLender(lenderId, userId, isAdmin);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting lender:", error);
        res.status(500).json({ message: "Failed to delete lender" });
      }
    }
  );

  // Lender Search with filters
  app.get(
    "/api/lenders/search",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const filters = {
          search: req.query.search as string,
          lenderType: req.query.lenderType as string,
          productType: req.query.productType as string,
          minLoanAmount: req.query.minLoanAmount
            ? parseInt(req.query.minLoanAmount as string)
            : undefined,
          maxLoanAmount: req.query.maxLoanAmount
            ? parseInt(req.query.maxLoanAmount as string)
            : undefined,
          sector: req.query.sector as string,
          region: req.query.region as string,
          panelStatus: req.query.panelStatus as string,
        };
        const lenders = await storage.listLenders({ ...filters });
        res.json(lenders);
      } catch (error) {
        console.error("Error searching lenders:", error);
        res.status(500).json({ message: "Failed to search lenders" });
      }
    }
  );

  // Lender Recommendations for a Prospect
  app.get(
    "/api/prospects/:prospectId/recommendations",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
        const includeDisqualified = req.query.includeDisqualified === "true";

        if (isNaN(prospectId)) {
          return res.status(400).json({ message: "Invalid prospect ID" });
        }

        let result;
        if (includeDisqualified) {
          result = await generateRecommendations(userId, prospectId);
        } else {
          result = await getTopRecommendations(userId, prospectId, limit);
        }

        res.json(result);
      } catch (error: any) {
        console.error("Error generating lender recommendations:", error);
        if (error.message === "Prospect not found") {
          return res.status(404).json({ message: "Prospect not found" });
        }
        res.status(500).json({ message: "Failed to generate lender recommendations" });
      }
    }
  );

  // Get lender with products
  app.get(
    "/api/lenders/:id/full",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const lenderId = parseInt(req.params.id);
        const lender = await storage.getLenderWithProducts(lenderId);

        if (!lender) {
          return res.status(404).json({ message: "Lender not found" });
        }

        // Also get interactions (user-scoped)
        const interactions = await storage.listLenderInteractions(lenderId, userId);

        res.json({ ...lender, interactions });
      } catch (error) {
        console.error("Error fetching lender details:", error);
        res.status(500).json({ message: "Failed to fetch lender details" });
      }
    }
  );

  // Lender Products API (user-scoped via lender ownership)
  app.get(
    "/api/lenders/:lenderId/products",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const lenderId = parseInt(req.params.lenderId);
        const userId = req.user.id;
        const products = await storage.listLenderProducts(lenderId);
        res.json(products);
      } catch (error) {
        console.error("Error fetching lender products:", error);
        res.status(500).json({ message: "Failed to fetch lender products" });
      }
    }
  );

  app.post(
    "/api/lenders/:lenderId/products",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const lenderId = parseInt(req.params.lenderId);
        const userId = req.user.id;
        const productData = { ...req.body, lenderId };
        const product = await storage.createLenderProduct(productData);
        if (!product) {
          return res
            .status(403)
            .json({ message: "Access denied - lender not found or not owned by user" });
        }
        res.status(201).json(product);
      } catch (error) {
        console.error("Error creating lender product:", error);
        res.status(500).json({ message: "Failed to create lender product" });
      }
    }
  );

  app.patch(
    "/api/lender-products/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const productId = parseInt(req.params.id);
        const userId = req.user.id;
        const product = await storage.updateLenderProduct(productId, userId, req.body);

        if (!product) {
          return res.status(404).json({ message: "Product not found or access denied" });
        }

        res.json(product);
      } catch (error) {
        console.error("Error updating lender product:", error);
        res.status(500).json({ message: "Failed to update lender product" });
      }
    }
  );

  app.delete(
    "/api/lender-products/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const productId = parseInt(req.params.id);
        const userId = req.user.id;
        const deleted = await storage.deleteLenderProduct(productId, userId);
        if (!deleted) {
          return res.status(404).json({ message: "Product not found or access denied" });
        }
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting lender product:", error);
        res.status(500).json({ message: "Failed to delete lender product" });
      }
    }
  );

  // Lender Interactions API (user-scoped via lender ownership)
  app.get(
    "/api/lenders/:lenderId/interactions",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const lenderId = parseInt(req.params.lenderId);
        const userId = req.user.id;
        const interactions = await storage.listLenderInteractions(lenderId, userId);
        res.json(interactions);
      } catch (error) {
        console.error("Error fetching lender interactions:", error);
        res.status(500).json({ message: "Failed to fetch lender interactions" });
      }
    }
  );

  app.get(
    "/api/lender-interactions",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const interactions = await storage.listUserLenderInteractions(userId);
        res.json(interactions);
      } catch (error) {
        console.error("Error fetching user lender interactions:", error);
        res.status(500).json({ message: "Failed to fetch lender interactions" });
      }
    }
  );

  app.post(
    "/api/lender-interactions",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const { sentAt, respondedAt, ...rest } = req.body;
        const interactionData = {
          ...rest,
          sentAt: sentAt ? new Date(sentAt) : new Date(),
          respondedAt: respondedAt ? new Date(respondedAt) : undefined,
        };
        const interaction = await storage.createLenderInteraction(interactionData, userId);
        if (!interaction) {
          return res
            .status(403)
            .json({ message: "Access denied - lender not found or not owned by user" });
        }

        // Update lender's lastContactedAt
        if (interaction.lenderId) {
          await storage.updateLender(interaction.lenderId, userId, {
            lastContactedAt: new Date(),
          } as any);
        }

        res.status(201).json(interaction);
      } catch (error) {
        console.error("Error creating lender interaction:", error);
        res.status(500).json({ message: "Failed to create lender interaction" });
      }
    }
  );

  app.patch(
    "/api/lender-interactions/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const interactionId = parseInt(req.params.id);
        const userId = req.user.id;
        const interaction = await storage.updateLenderInteraction(interactionId, userId, req.body);

        if (!interaction) {
          return res.status(404).json({ message: "Interaction not found or access denied" });
        }

        res.json(interaction);
      } catch (error) {
        console.error("Error updating lender interaction:", error);
        res.status(500).json({ message: "Failed to update lender interaction" });
      }
    }
  );

  app.delete(
    "/api/lender-interactions/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const interactionId = parseInt(req.params.id);
        const userId = req.user.id;
        const deleted = await storage.deleteLenderInteraction(interactionId, userId);
        if (!deleted) {
          return res.status(404).json({ message: "Interaction not found or access denied" });
        }
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting lender interaction:", error);
        res.status(500).json({ message: "Failed to delete lender interaction" });
      }
    }
  );

  // Application Submissions API - Protected routes
  app.get("/api/submissions", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const submissions = await storage.listApplicationSubmissions(userId);

      // Enrich submissions with prospect and lender details
      const enrichedSubmissions = await Promise.all(
        submissions.map(async (submission) => {
          const [prospect, lender] = await Promise.all([
            storage.getProspect(submission.prospectId, userId),
            storage.getLender(submission.lenderId),
          ]);

          return {
            ...submission,
            prospect,
            lender,
          };
        })
      );

      res.json(enrichedSubmissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  // Generate and download PDF report
  app.get(
    "/api/prospects/:prospectId/report",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);

        // Verify prospect belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ message: "Prospect not found" });
        }

        const user = await storage.getUser(userId);

        // Fetch related data
        const [contacts, activities, dueDiligence] = await Promise.all([
          storage.listContacts(prospectId, userId),
          storage.listActivities(prospectId, userId),
          storage.getDueDiligence(prospectId, userId).catch(() => null),
        ]);

        // Fetch Companies House data if available
        let companiesHouseData: any = null;
        const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
        if (apiKey && prospect.company.companyNumber) {
          try {
            const trimmedApiKey = apiKey.trim();
            const authString = `${trimmedApiKey}:`;
            const base64Auth = Buffer.from(authString).toString("base64");
            const companyNumber = prospect.company.companyNumber;

            const [officersRes, pscRes, chargesRes] = await Promise.all([
              fetch(
                `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/officers`,
                {
                  headers: { Authorization: `Basic ${base64Auth}` },
                }
              ).catch(() => null),
              fetch(
                `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`,
                {
                  headers: { Authorization: `Basic ${base64Auth}` },
                }
              ).catch(() => null),
              fetch(
                `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/charges`,
                {
                  headers: { Authorization: `Basic ${base64Auth}` },
                }
              ).catch(() => null),
            ]);

            companiesHouseData = {
              officers: officersRes && officersRes.ok ? await officersRes.json() : null,
              psc: pscRes && pscRes.ok ? await pscRes.json() : null,
              charges: chargesRes && chargesRes.ok ? await chargesRes.json() : null,
            };
          } catch (error) {
            console.error("Error fetching Companies House data for report");
          }
        }

        const { createProspectReportDocument, renderProspectReport } =
          await import("./utils/pdfGenerator");

        // Create document
        const doc = createProspectReportDocument({
          prospect,
          contacts,
          activities,
          dueDiligence: dueDiligence || undefined,
          companiesHouseData: companiesHouseData || undefined,
          pdfLayoutPreferences: user?.pdfLayoutPreferences as any,
          user: user as any,
        });

        // Set response headers
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="Credit_Assessment_${prospect.company.companyName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf"`
        );

        // Pipe to response
        doc.pipe(res);

        // Render content
        renderProspectReport(doc, {
          prospect,
          contacts,
          activities,
          dueDiligence: dueDiligence || undefined,
          companiesHouseData: companiesHouseData || undefined,
          pdfLayoutPreferences: user?.pdfLayoutPreferences as any,
          user: user as any,
        });

        // Finalize PDF
        doc.end();
      } catch (error) {
        console.error("Error generating report:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.post(
    "/api/submissions",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const result = insertApplicationSubmissionSchema.safeParse(req.body);

        if (!result.success) {
          const validationError = fromZodError(result.error);
          return res.status(400).json({ message: validationError.toString() });
        }

        // Type-narrow the parsed data
        const submissionInput: InsertApplicationSubmission = result.data;

        // Validate that the prospect belongs to the user
        const prospect = await storage.getProspect(submissionInput.prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ message: "Prospect not found" });
        }

        // Validate that the lender belongs to the user
        const lender = await storage.getLender(submissionInput.lenderId);
        if (!lender) {
          console.error("Lender not found");
          return res.status(404).json({ message: "Lender not found" });
        }

        // Validate lender email before proceeding
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!lender.email || !emailRegex.test(lender.email)) {
          console.error("Invalid lender email");
          return res.status(400).json({ message: "Lender has invalid email address" });
        }

        // Generate PDF report before creating submission
        let pdfBuffer: Buffer;
        try {
          const [contacts, activities, dueDiligence, user] = await Promise.all([
            storage.listContacts(submissionInput.prospectId, userId),
            storage.listActivities(submissionInput.prospectId, userId),
            storage.getDueDiligence(submissionInput.prospectId, userId).catch(() => null),
            storage.getUser(userId),
          ]);

          // Fetch Companies House data (officers, PSC, charges) if available
          let companiesHouseData: any = null;
          const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
          if (apiKey && prospect.company.companyNumber) {
            try {
              const trimmedApiKey = apiKey.trim();
              const authString = `${trimmedApiKey}:`;
              const base64Auth = Buffer.from(authString).toString("base64");
              const companyNumber = prospect.company.companyNumber;

              const [officersRes, pscRes, chargesRes] = await Promise.all([
                fetch(
                  `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/officers`,
                  {
                    headers: { Authorization: `Basic ${base64Auth}` },
                  }
                ).catch(() => null),
                fetch(
                  `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`,
                  {
                    headers: { Authorization: `Basic ${base64Auth}` },
                  }
                ).catch(() => null),
                fetch(
                  `https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/charges`,
                  {
                    headers: { Authorization: `Basic ${base64Auth}` },
                  }
                ).catch(() => null),
              ]);

              companiesHouseData = {
                officers: officersRes && officersRes.ok ? await officersRes.json() : null,
                psc: pscRes && pscRes.ok ? await pscRes.json() : null,
                charges: chargesRes && chargesRes.ok ? await chargesRes.json() : null,
              };
            } catch (error) {
              console.error("Error fetching Companies House data for submission report");
            }
          }

          const { createProspectReportDocument, renderProspectReport } =
            await import("./utils/pdfGenerator");

          const reportDoc = createProspectReportDocument({
            prospect,
            contacts,
            activities,
            dueDiligence: dueDiligence || undefined,
            companiesHouseData: companiesHouseData || undefined,
            pdfLayoutPreferences: user?.pdfLayoutPreferences as any,
            user: user as any,
          });

          const chunks: Buffer[] = [];
          reportDoc.on("data", (chunk: Buffer) => chunks.push(chunk));

          // Render the report content
          renderProspectReport(reportDoc, {
            prospect,
            contacts,
            activities,
            dueDiligence: dueDiligence || undefined,
            companiesHouseData: companiesHouseData || undefined,
            pdfLayoutPreferences: user?.pdfLayoutPreferences as any,
            user: user as any,
          });

          await new Promise<void>((resolve, reject) => {
            reportDoc.on("end", () => resolve());
            reportDoc.on("error", reject);
          });
          pdfBuffer = Buffer.concat(chunks);
        } catch (pdfError: any) {
          const errMessage = (pdfError as Error)?.message || "Unknown error";
          console.error("PDF generation error");
          return res.status(500).json({ message: `Failed to generate PDF report: ${errMessage}` });
        }

        // Send email with PDF attachment - MOCKED (Resend removed)
        let emailSent = true;
        let emailError: string | null = null;
        console.log("Email sending is disabled (Resend removed). Simulating success.");

        // Create the submission only after successful PDF generation
        const submission = await storage.createApplicationSubmission(submissionInput, userId);

        // Update submission status based on email result
        if (emailSent) {
          await storage.updateApplicationSubmission(submission.id!, userId, {
            emailSent: 1,
            status: "sent",
          });
        }

        // Create an activity task to log this submission
        const activity = await storage.createActivity(
          {
            activityType: "task",
            title: `Application ${emailSent ? "sent" : "submitted"} to ${lender.institutionName}`,
            description: `Loan application for ${prospect.company.companyName} ${emailSent ? "emailed" : "submitted"} to ${lender.institutionName}${emailSent ? "" : emailError ? ` (email failed: ${emailError})` : " (email failed)"}`,
            prospectId: submissionInput.prospectId,
            priority: "high",
            dueDate: null,
            completed: 1,
          },
          userId
        );

        res.status(201).json({
          submission: {
            ...submission,
            emailSent: emailSent ? 1 : 0,
            status: emailSent ? "sent" : "pending",
          },
          activity,
          emailSent,
          emailError: emailError || undefined,
        });
      } catch (error) {
        console.error("Error creating submission:", error);
        res.status(500).json({ message: "Failed to create submission" });
      }
    }
  );

  app.delete(
    "/api/submissions/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const submissionId = parseInt(req.params.id);

        if (isNaN(submissionId)) {
          return res.status(400).json({ message: "Invalid submission ID" });
        }

        // Verify submission exists and belongs to user before deleting
        const submission = await storage.getApplicationSubmission(submissionId, userId);
        if (!submission) {
          return res.status(404).json({ message: "Submission not found" });
        }

        await storage.deleteApplicationSubmission(submissionId, userId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting submission:", error);
        res.status(500).json({ message: "Failed to delete submission" });
      }
    }
  );

  // ====== EMAIL INBOX API (AgentMail Integration) ======

  // Get or create user's email inbox
  app.get("/api/email/inbox", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      let inbox = await storage.getEmailInbox(userId);

      if (!inbox) {
        // Create or retrieve inbox for this user using AgentMail
        try {
          const { getAgentMailClient } = await import("./agentmail");
          const client = await getAgentMailClient();

          const user = await storage.getUser(userId);
          const displayName = user?.firstName
            ? `${user.firstName} ${user.lastName || ""}`.trim()
            : "Veltro User";

          let agentMailInbox: any = null;

          // First try to list existing inboxes
          try {
            // @ts-ignore
            const listResponse = await client.inboxes.list();
            // The response is pageable - get the data from the body
            const listData = (listResponse as any).body || listResponse;

            // Check if it has a data array (paginated response)
            const inboxes =
              listData.data || listData.items || (Array.isArray(listData) ? listData : []);

            if (inboxes.length > 0) {
              // Use the first available inbox
              agentMailInbox = inboxes[0];
              console.log(
                JSON.stringify({ type: "agentmail_inbox_reused", inboxId: agentMailInbox.id })
              );
            }
          } catch (listError) {
            console.log("Could not list inboxes, will try to create:", listError);
          }

          // If no existing inbox, try to create one
          if (!agentMailInbox) {
            try {
              // @ts-ignore
              const createResponse = await client.inboxes.create({
                name: displayName,
              } as any);
              agentMailInbox = (createResponse as any).body || createResponse;
              console.log(
                JSON.stringify({ type: "agentmail_inbox_created", inboxId: agentMailInbox?.id })
              );
            } catch (createError: any) {
              // If limit exceeded, we already checked for existing inboxes
              console.error("Error creating inbox:", createError);
              return res.status(500).json({
                error: "Failed to create email inbox. AgentMail inbox limit may be exceeded.",
              });
            }
          }

          // Validate we have the required fields
          if (!agentMailInbox?.id) {
            console.error("AgentMail inbox missing id:", agentMailInbox);
            return res.status(500).json({ error: "Failed to get inbox details from AgentMail." });
          }

          // Save inbox to our database
          inbox = await storage.createEmailInbox({
            userId,
            inboxId: agentMailInbox.id,
            emailAddress: agentMailInbox.emailAddress || agentMailInbox.email_address,
            displayName,
          });
        } catch (error) {
          console.error("Error setting up AgentMail inbox:", error);
          return res.status(500).json({
            error: "Failed to set up email inbox. Please ensure AgentMail is configured.",
          });
        }
      }

      res.json(inbox);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Check if AgentMail is configured
  app.get(
    "/api/email/status",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { isAgentMailConfigured } = await import("./agentmail");
        const configured = await isAgentMailConfigured();
        res.json({ configured });
      } catch (error: any) {
        res.json({ configured: false });
      }
    }
  );

  // Sync messages from AgentMail to local database
  app.post("/api/email/sync", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const inbox = await storage.getEmailInbox(userId);

      if (!inbox) {
        return res.status(404).json({ error: "No inbox found. Create one first." });
      }

      const { getAgentMailClient } = await import("./agentmail");
      const client = await getAgentMailClient();

      // Fetch messages from AgentMail
      // @ts-ignore
      const messagesResponse = await client.inboxes.messages.list(inbox.inboxId);
      const messages = (messagesResponse as any).body || messagesResponse;

      // Sync each message to our database
      let syncedCount = 0;
      for (const message of messages.data || []) {
        // Check if we already have this message
        const existing = await storage.getEmailMessageByMessageId(message.id);
        if (!existing) {
          await storage.createEmailMessage({
            inboxId: inbox.id,
            messageId: message.id,
            threadId: message.threadId || null,
            fromAddress: message.from?.address || "unknown",
            toAddresses: message.to?.map((t: any) => t.address) || [],
            ccAddresses: message.cc?.map((c: any) => c.address) || [],
            subject: message.subject || "",
            textBody: message.bodyText || null,
            htmlBody: message.bodyHtml || null,
            direction: message.direction || "inbound",
            isRead: 0,
            attachments: message.attachments || [],
            sentAt: new Date(message.createdAt),
          });
          syncedCount++;
        }
      }

      res.json({ synced: syncedCount, total: messages.data?.length || 0 });
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Get all messages for user's inbox
  app.get(
    "/api/email/messages",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const inbox = await storage.getEmailInbox(userId);

        if (!inbox) {
          return res.json([]);
        }

        const messages = await storage.listEmailMessages(inbox.id);
        res.json(messages);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get a single message
  app.get(
    "/api/email/messages/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const messageId = parseInt(req.params.id);

        const inbox = await storage.getEmailInbox(userId);
        if (!inbox) {
          return res.status(404).json({ error: "No inbox found" });
        }

        const message = await storage.getEmailMessage(messageId);
        if (!message || message.inboxId !== inbox.id) {
          return res.status(404).json({ error: "Message not found" });
        }

        // Mark as read
        if (!message.isRead) {
          await storage.markEmailAsRead(messageId);
        }

        res.json(message);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Send an email
  app.post("/api/email/send", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const { to, cc, subject, body, contactId, prospectId, replyToMessageId } = req.body;

      if (!to || !subject) {
        return res.status(400).json({ error: "To address and subject are required" });
      }

      const inbox = await storage.getEmailInbox(userId);
      if (!inbox) {
        return res.status(404).json({ error: "No inbox found. Create one first." });
      }

      const { getAgentMailClient } = await import("./agentmail");
      const client = await getAgentMailClient();

      // Prepare recipients
      const toAddresses = Array.isArray(to) ? to : [to];
      const ccAddresses = cc ? (Array.isArray(cc) ? cc : [cc]) : [];

      // Send the email via AgentMail
      // @ts-ignore
      const sendResponse = await client.inboxes.messages.create(inbox.inboxId, {
        to: toAddresses.map((addr: string) => ({ address: addr })),
        cc: ccAddresses.map((addr: string) => ({ address: addr })),
        subject,
        body: {
          text: body,
          html: null,
        },
        replyToMessageId: replyToMessageId || undefined,
      });
      const sentMessage = (sendResponse as any).body || sendResponse;

      // Save to our database
      const savedMessage = await storage.createEmailMessage({
        inboxId: inbox.id,
        messageId: sentMessage.id,
        threadId: sentMessage.threadId || null,
        contactId: contactId ? parseInt(contactId) : null,
        prospectId: prospectId ? parseInt(prospectId) : null,
        fromAddress: inbox.emailAddress,
        toAddresses,
        ccAddresses,
        subject,
        textBody: body,
        htmlBody: null,
        direction: "outbound",
        isRead: 1,
        attachments: [],
        sentAt: new Date(),
      });

      res.status(201).json(savedMessage);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Link a message to a contact/prospect
  app.patch(
    "/api/email/messages/:id/link",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const messageId = parseInt(req.params.id);
        const { contactId, prospectId } = req.body;

        const inbox = await storage.getEmailInbox(userId);
        if (!inbox) {
          return res.status(404).json({ error: "No inbox found" });
        }

        const message = await storage.getEmailMessage(messageId);
        if (!message || message.inboxId !== inbox.id) {
          return res.status(404).json({ error: "Message not found" });
        }

        const updated = await storage.updateEmailMessageLink(
          messageId,
          prospectId ? parseInt(prospectId) : null,
          contactId ? parseInt(contactId) : null,
          userId
        );

        res.json(updated);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get messages for a specific contact
  app.get(
    "/api/email/contact/:contactId/messages",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const contactId = parseInt(req.params.contactId);

        const inbox = await storage.getEmailInbox(userId);
        if (!inbox) {
          return res.json([]);
        }

        const messages = await storage.getEmailMessagesForContact(contactId, userId);
        res.json(messages);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get messages for a specific prospect
  app.get(
    "/api/email/prospect/:prospectId/messages",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);

        const inbox = await storage.getEmailInbox(userId);
        if (!inbox) {
          return res.json([]);
        }

        const messages = await storage.getEmailMessagesForProspect(prospectId, userId);
        res.json(messages);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

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

  // --- Lender Notes API ---

  app.get(
    "/api/lenders/:id/notes",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const lenderId = parseInt(req.params.id);
        if (isNaN(lenderId)) return res.status(400).json({ error: "Invalid lender ID" });
        const notes = await storage.listLenderNotes(lenderId);
        res.json(notes);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.post(
    "/api/lenders/:id/notes",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const lenderId = parseInt(req.params.id);
        const userId = req.user!.id;
        if (isNaN(lenderId)) return res.status(400).json({ error: "Invalid lender ID" });

        const result = insertLenderNoteSchema.safeParse({ ...req.body, lenderId, userId });
        if (!result.success) {
          return res.status(400).json({ error: fromZodError(result.error).message });
        }

        const note = await storage.createLenderNote(result.data);
        res.status(201).json(note);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  app.delete(
    "/api/lenders/notes/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user!.id;
        if (isNaN(id)) return res.status(400).json({ error: "Invalid note ID" });

        const success = await storage.deleteLenderNote(id, userId);
        if (!success) return res.status(404).json({ error: "Note not found or unauthorized" });
        res.sendStatus(200);
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

  // ============= UNDERWRITING SUBMISSIONS =============

  // Middleware to check if user is an underwriter
  const isUnderwriter = async (req: any, res: any, next: any) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const user = await storage.getUser(req.user.id);
    if (!user || user.role !== "underwriter") {
      return res.status(403).json({ error: "Access denied. Underwriter role required." });
    }
    next();
  };

  // Helper to enrich submissions with prospect and company details (batch loaded)
  async function enrichSubmissions(submissions: any[]) {
    if (submissions.length === 0) return [];

    // Collect unique IDs for batch loading
    const prospectIds = Array.from(new Set(submissions.map((s) => s.prospectId).filter(Boolean)));
    const brokerIds = Array.from(new Set(submissions.map((s) => s.brokerId).filter(Boolean)));

    // Batch load all prospects and brokers in single queries
    const [prospectsArr, brokersArr] = await Promise.all([
      storage.getProspectsByIds(prospectIds),
      storage.getUsersByIds(brokerIds),
    ]);

    // Create lookup maps
    const prospectsMap = new Map(prospectsArr.map((p) => [p.id, p]));
    const brokersMap = new Map(brokersArr.map((b) => [b.id, b]));

    // Enrich submissions using maps
    return submissions.map((submission) => {
      const prospect = prospectsMap.get(submission.prospectId) || null;
      const broker = brokersMap.get(submission.brokerId);
      return {
        ...submission,
        prospect,
        broker: broker
          ? {
            firstName: broker.firstName,
            lastName: broker.lastName,
            email: broker.email,
          }
          : null,
      };
    });
  }

  // Get underwriting submissions (scoped by role)
  app.get(
    "/api/underwriting/submissions",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);

        let submissions;
        if (user?.role === "super_admin" || user?.role === "sales_admin") {
          // Admin roles see all submissions
          const { status, assigned } = req.query;
          const filters: { status?: string; assignedUnderwriterId?: string } = {};
          if (status) filters.status = status as string;
          if (assigned === "me") filters.assignedUnderwriterId = userId;
          submissions = await storage.listUnderwritingSubmissions(filters);
        } else if (user?.role === "underwriter" || user?.hasUnderwritingAccess) {
          // Underwriter (or user with add-on) sees: queue (submitted + unassigned) + their assigned
          submissions = await storage.listUnderwriterScopedSubmissions(userId);
        } else {
          // No access
          return res.status(403).json({ error: "Access denied" });
        }

        const enrichedSubmissions = await enrichSubmissions(submissions);
        res.json(enrichedSubmissions);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get broker's own underwriting submissions
  app.get(
    "/api/underwriting/my-submissions",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const submissions = await storage.listBrokerUnderwritingSubmissions(userId);
        const enrichedSubmissions = await enrichSubmissions(submissions);
        res.json(enrichedSubmissions);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get underwriting status for all user's prospects (for pipeline view)
  app.get(
    "/api/underwriting/status",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const submissions = await storage.listBrokerUnderwritingSubmissions(userId);

        // Return a map of prospectId -> status
        const statusMap: Record<number, { status: string; submittedAt: Date | null }> = {};
        for (const submission of submissions) {
          statusMap[submission.prospectId] = {
            status: submission.status,
            submittedAt: submission.submittedAt,
          };
        }
        res.json(statusMap);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get single underwriting submission
  app.get(
    "/api/underwriting/submissions/:id",
    isAuthenticated,
    requireSubmissionReadAccess({ storage, allowTriage: true }),
    async (req: AuthenticatedRequest, res: Response) => {
      const { submission } = req.ctx || {};
      res.json(submission);
    }
  );

  // Create underwriting submission (broker submits prospect for review)
  app.post(
    "/api/underwriting/submissions",
    isAuthenticated,
    requireUnderwritingAccess,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const { prospectId, priority, brokerComments } = req.body;

        if (!prospectId) {
          return res.status(400).json({ error: "prospectId is required" });
        }

        // Check if prospect exists and belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        // Check if there's already an active submission for this prospect
        const existingSubmission = await storage.getUnderwritingSubmissionByProspect(prospectId);
        if (
          existingSubmission &&
          !["approved", "declined", "withdrawn"].includes(existingSubmission.status)
        ) {
          return res
            .status(409)
            .json({ error: "This prospect already has an active underwriting submission" });
        }

        // Create the submission
        const submission = await storage.createUnderwritingSubmission(
          {
            prospectId,
            priority: (priority as any) || "normal",
            status: "submitted",
            brokerComments,
          },
          userId
        );

        // Create activity record
        await storage.createUnderwritingActivity(
          {
            submissionId: submission.id,
            activityType: "submitted",
            content: brokerComments || "Submitted for underwriting review",
          },
          userId
        );

        // Update prospect stage to submission
        await storage.updateProspectStage(prospectId, userId, "submission");

        res.status(201).json(submission);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Claim a submission (underwriter takes ownership) - atomic to prevent race conditions
  app.post(
    "/api/underwriting/submissions/:id/claim",
    isAuthenticated,
    isUnderwriter,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user.id;

        // Atomic claim: only succeeds if status='submitted' AND assignedUnderwriterId IS NULL
        const updated = await storage.claimUnderwritingSubmission(id, userId);

        if (!updated) {
          return res.status(409).json({ error: "Submission already claimed or not available" });
        }

        // Create activity record
        await storage.createUnderwritingActivity(
          {
            submissionId: id,
            activityType: "claimed",
            content: "Claimed for review",
          },
          userId
        );

        const user = await storage.getUser(userId);
        logUnderwritingAudit({
          action: "claim",
          submissionId: id,
          userId,
          role: user?.role,
          fromStatus: "submitted",
          toStatus: "in_review",
          sourceIp: req.ip,
        });

        res.json(updated);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Update submission (underwriter actions OR broker-withdraw)
  app.patch(
    "/api/underwriting/submissions/:id",
    isAuthenticated,
    async (req: any, res, next) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);
        const id = Number(req.params.id);

        // Broker-withdraw path (owner only)
        if (user?.role === "broker") {
          const submission = await storage.getUnderwritingSubmission(id);
          if (!submission) return res.status(404).json({ error: "Submission not found" });
          if (submission.brokerId !== userId)
            return res.status(403).json({ error: "Access denied" });

          const { status } = req.body;
          if (status && status !== "withdrawn") {
            return res.status(403).json({ error: "Brokers can only withdraw submissions" });
          }

          const fromStatus = submission.status;
          const updated = await storage.updateUnderwritingSubmission(id, { status: "withdrawn" });

          await storage.createUnderwritingActivity(
            {
              submissionId: id,
              activityType: "withdrawn",
              content: "Submission withdrawn by broker",
            },
            userId
          );

          await storage.updateProspectStage(submission.prospectId, userId, "due-diligence");

          logUnderwritingAudit({
            action: "withdraw",
            submissionId: id,
            userId,
            role: "broker",
            fromStatus,
            toStatus: "withdrawn",
            sourceIp: req.ip,
          });

          return res.json(updated);
        }

        // Underwriter/admin path must be assignment-scoped
        return requireSubmissionWriteAccess({ storage })(req, res, next);
      } catch (e) {
        next(e);
      }
    },
    async (req: any, res, next) => {
      try {
        const { submission, user } = req.ctx;
        const { status, underwriterNotes, decisionReason } = req.body;

        const updates: any = {};
        if (status) updates.status = status;
        if (underwriterNotes) updates.underwriterNotes = underwriterNotes;
        if (decisionReason) updates.decisionReason = decisionReason;

        const fromStatus = submission.status;
        const updated = await storage.updateUnderwritingSubmission(submission.id, updates);

        if (status) {
          await storage.createUnderwritingActivity(
            {
              submissionId: submission.id,
              activityType: status,
              content: decisionReason || `Status changed to ${status}`,
            },
            user.id
          );

          // Update prospect stage based on decision
          if (status === "approved") {
            await storage.updateProspectStage(
              submission.prospectId,
              submission.brokerId,
              "approved"
            );
          } else if (status === "declined") {
            await storage.updateProspectStage(
              submission.prospectId,
              submission.brokerId,
              "declined"
            );
          }

          logUnderwritingAudit({
            action: status,
            submissionId: submission.id,
            userId: user.id,
            role: user.role,
            fromStatus,
            toStatus: status,
            sourceIp: req.ip,
            details: decisionReason ? { decisionReason } : undefined,
          });
        }

        res.json(updated);
      } catch (e) {
        next(e);
      }
    }
  );

  // Add comment to submission
  app.post(
    "/api/underwriting/submissions/:id/comments",
    isAuthenticated,
    requireSubmissionReadAccess({ storage, allowTriage: false }),
    async (req: any, res, next) => {
      try {
        const { submission, user } = req.ctx;
        const { content } = req.body;

        if (!content) {
          return res.status(400).json({ error: "Content is required" });
        }

        // Determine if this is a response to a query
        const activityType =
          user.role === "broker" && submission.status === "queried" ? "responded" : "comment";

        const activity = await storage.createUnderwritingActivity(
          {
            submissionId: submission.id,
            activityType,
            content,
          },
          user.id
        );

        // If broker responded to query, update status back to in_review
        if (activityType === "responded") {
          await storage.updateUnderwritingSubmission(submission.id, { status: "in_review" });
        }

        res.status(201).json(activity);
      } catch (error: any) {
        next(error);
      }
    }
  );

  // Get submission activities
  app.get(
    "/api/underwriting/submissions/:id/activities",
    isAuthenticated,
    requireSubmissionReadAccess({ storage, allowTriage: false }),
    async (req: any, res, next) => {
      try {
        const { submission } = req.ctx;
        const activities = await storage.listUnderwritingActivities(submission.id);

        // Enrich activities with user info
        const enrichedActivities = await Promise.all(
          activities.map(async (activity) => {
            const activityUser = await storage.getUser(activity.userId);
            return {
              ...activity,
              user: activityUser
                ? {
                  firstName: activityUser.firstName,
                  lastName: activityUser.lastName,
                  email: activityUser.email,
                  role: activityUser.role,
                }
                : null,
            };
          })
        );

        res.json(enrichedActivities);
      } catch (error: any) {
        next(error);
      }
    }
  );

  // Get underwriting submission for a specific prospect
  app.get(
    "/api/underwriting/prospects/:prospectId/submission",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user.id;
        const user = await storage.getUser(userId);

        const submission = await storage.getUnderwritingSubmissionByProspect(prospectId);
        if (!submission) {
          if (userId === MOCK_DEV_ADMIN_ID) {
            return res.json(null);
          }
          return res.status(404).json({ error: "No submission found for this prospect" });
        }

        // Apply same access control as requireSubmissionReadAccess
        const isBrokerOwner = submission.brokerId === userId;
        const isAssignedUnderwriter = submission.assignedUnderwriterId === userId;
        const isSuperAdmin = user?.role === "super_admin";
        const isUnderwriterViewingQueue =
          user?.role === "underwriter" &&
          submission.status === "submitted" &&
          !submission.assignedUnderwriterId;

        if (
          !isBrokerOwner &&
          !isAssignedUnderwriter &&
          !isSuperAdmin &&
          !isUnderwriterViewingQueue
        ) {
          return res.status(403).json({ error: "Access denied" });
        }

        res.json(submission);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get current user role
  app.get("/api/auth/role", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      // No-store cache for sensitive auth data
      res.setHeader("Cache-Control", "no-store");
      res.json({ role: user?.role || "broker" });
    } catch (error: any) {
      console.error("Error getting user role:", error);
      res
        .status(500)
        .json(createErrorResponse(error, 500, req.requestId, "Failed to get user role"));
    }
  });

  // Update current user role
  // SECURITY: In production (NODE_ENV !== 'development'), only super_admin can change roles
  // DEVELOPMENT: Self role switching is allowed for testing when NODE_ENV === 'development'
  app.post("/api/auth/role", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const { role, targetUserId } = req.body;
      const currentUser = await storage.getUser(userId);

      const validRoles = ["super_admin", "sales_admin", "broker", "underwriter"];
      if (!role || !validRoles.includes(role)) {
        return res
          .status(400)
          .json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
      }

      // Check if testing mode is enabled
      const testingModeEnabled = process.env.NODE_ENV === "development";

      // If changing another user's role, must be super_admin
      if (targetUserId && targetUserId !== userId) {
        if (currentUser?.role !== "super_admin") {
          return res.status(403).json({ error: "Only Super Admin can change other users' roles" });
        }
        await storage.updateUser(targetUserId, { role });
        return res.json({ role, message: `User role updated to ${role}` });
      }

      // Self role switching - only allowed for super_admin OR in testing mode
      if (currentUser?.role !== "super_admin") {
        if (!testingModeEnabled) {
          return res.status(403).json({ error: "Only Super Admin can change roles" });
        }
        // In development mode, allow self-switching with a warning
        console.warn(
          `[DEV MODE] User ${userId} switching own role to ${role} - disabled in production`
        );
      }

      await storage.updateUser(userId, { role });
      res.json({ role, message: `Role updated to ${role}` });
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // ============ TEAM MANAGEMENT ============

  // Get all users (super_admin only)
  app.get("/api/admin/users", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);

      if (!currentUser || currentUser.role !== "super_admin") {
        return res.status(403).json({ error: "Only super admins can access this endpoint" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Get all teams (super_admin and sales_admin only)
  app.get("/api/teams", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || !["super_admin", "sales_admin"].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }

      const teams = await storage.getTeams(user.role === "super_admin" ? undefined : userId);
      res.json(teams);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Create a new team (super_admin and sales_admin only)
  app.post("/api/teams", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || !["super_admin", "sales_admin"].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }

      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Team name is required" });
      }

      const team = await storage.createTeam({ name, description }, userId);
      res.status(201).json(team);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Get team by ID with members
  app.get("/api/teams/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const teamId = parseInt(req.params.id);

      if (!user || !["super_admin", "sales_admin"].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }

      const team = await storage.getTeamWithMembers(teamId);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }

      // Sales admin can only access teams they created or are admin of
      if (user.role === "sales_admin") {
        const isOwner = team.createdBy === userId;
        const isTeamAdmin = team.members.some(
          (m) => m.userId === userId && m.memberRole === "admin"
        );
        if (!isOwner && !isTeamAdmin) {
          return res.status(403).json({ error: "You don't have permission to view this team" });
        }
      }

      res.json(team);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Add member to team
  app.post(
    "/api/teams/:id/members",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);
        const teamId = parseInt(req.params.id);

        if (!user || !["super_admin", "sales_admin"].includes(user.role)) {
          return res.status(403).json({ error: "Access denied. Admin role required." });
        }

        // Verify team ownership for sales_admin
        if (user.role === "sales_admin") {
          const team = await storage.getTeamWithMembers(teamId);
          if (!team) {
            return res.status(404).json({ error: "Team not found" });
          }
          const isOwner = team.createdBy === userId;
          const isTeamAdmin = team.members.some(
            (m) => m.userId === userId && m.memberRole === "admin"
          );
          if (!isOwner && !isTeamAdmin) {
            return res.status(403).json({ error: "You don't have permission to modify this team" });
          }
        }

        const { userId: memberUserId, memberRole } = req.body;
        if (!memberUserId) {
          return res.status(400).json({ error: "User ID is required" });
        }

        const member = await storage.addTeamMember({
          teamId,
          userId: memberUserId,
          memberRole: memberRole || "member",
        });
        res.status(201).json(member);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Remove member from team
  app.delete(
    "/api/teams/:teamId/members/:userId",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const currentUserId = req.user.id;
        const user = await storage.getUser(currentUserId);
        const teamId = parseInt(req.params.teamId);
        const memberUserId = req.params.userId;

        if (!user || !["super_admin", "sales_admin"].includes(user.role)) {
          return res.status(403).json({ error: "Access denied. Admin role required." });
        }

        // Verify team ownership for sales_admin
        if (user.role === "sales_admin") {
          const team = await storage.getTeamWithMembers(teamId);
          if (!team) {
            return res.status(404).json({ error: "Team not found" });
          }
          const isOwner = team.createdBy === currentUserId;
          const isTeamAdmin = team.members.some(
            (m) => m.userId === currentUserId && m.memberRole === "admin"
          );
          if (!isOwner && !isTeamAdmin) {
            return res.status(403).json({ error: "You don't have permission to modify this team" });
          }
        }

        await storage.removeTeamMember(teamId, memberUserId);
        res.json({ message: "Member removed from team" });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get user's teams
  app.get("/api/my-teams", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const teams = await storage.getUserTeams(userId);
      res.json(teams);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Get all users for team management (super_admin and sales_admin only)
  app.get("/api/users", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || !["super_admin", "sales_admin"].includes(user.role)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Update user role (super_admin only)
  app.patch(
    "/api/users/:id/role",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const currentUserId = req.user.id;
        const currentUser = await storage.getUser(currentUserId);

        if (!currentUser || currentUser.role !== "super_admin") {
          return res.status(403).json({ error: "Access denied. Super Admin role required." });
        }

        const targetUserId = req.params.id;
        const { role } = req.body;

        const validRoles = ["super_admin", "sales_admin", "broker", "underwriter"];
        if (!role || !validRoles.includes(role)) {
          return res
            .status(400)
            .json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
        }

        await storage.updateUser(targetUserId, { role });
        res.json({ message: `User role updated to ${role}` });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // File upload endpoint for underwriting attachments - uses busboy streaming parser
  const MAX_UNDERWRITING_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
  const MAX_UNDERWRITING_FILES = 10; // Maximum 10 files per request

  app.post(
    "/api/underwriting/upload/:submissionId",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user.id;
      const submissionId = parseInt(req.params.submissionId);

      if (isNaN(submissionId)) {
        return res.status(400).json({ error: "Invalid submission ID" });
      }

      try {
        // Verify user role (must be broker or underwriter)
        const user = await storage.getUser(userId);
        if (!user || !["broker", "underwriter", "sales_admin", "super_admin"].includes(user.role)) {
          return res
            .status(403)
            .json({ error: "Access denied. Broker or Underwriter role required." });
        }

        // Verify submission exists and user has access
        const submission = await storage.getUnderwritingSubmission(submissionId);
        if (!submission) {
          return res.status(404).json({ error: "Submission not found" });
        }

        // Only the broker who created it, assigned underwriter, or admins can upload
        const isOwner = submission.brokerId === userId;
        const isAssignedUnderwriter = submission.assignedUnderwriterId === userId;
        const isAdmin = ["sales_admin", "super_admin"].includes(user.role);

        if (!isOwner && !isAssignedUnderwriter && !isAdmin) {
          return res
            .status(403)
            .json({ error: "Access denied. You don't have permission for this submission." });
        }

        const contentType = req.headers["content-type"];
        if (!contentType?.startsWith("multipart/form-data")) {
          return res.status(400).json({ error: "Content-Type must be multipart/form-data" });
        }

        const uploadedFiles: UnderwritingAttachment[] = [];
        const uploadPromises: Promise<UnderwritingAttachment>[] = [];
        let validationError: string | null = null;

        const bb = busboy({
          headers: req.headers,
          limits: { fileSize: MAX_UNDERWRITING_FILE_SIZE, files: MAX_UNDERWRITING_FILES },
        });

        bb.on("file", (fieldname, fileStream, info) => {
          const { filename, mimeType } = info;

          if (!filename) {
            fileStream.resume();
            return;
          }

          const timestamp = Date.now();
          const sanitizedFileName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
          const storagePath = `.private/underwriting/${submissionId}/${userId}/${timestamp}_${sanitizedFileName}`;

          // Stream directly to storage - no RAM buffering
          const uploadPromise = (async (): Promise<UnderwritingAttachment> => {
            const { PassThrough } = await import("stream");
            const passThrough = new PassThrough();
            let limitExceeded = false;
            let bytesWritten = 0;

            fileStream.on("limit", () => {
              limitExceeded = true;
              validationError = `File "${filename}" exceeds 5MB limit`;
              passThrough.destroy(new Error("File size limit exceeded"));
            });

            fileStream.on("data", (chunk: Buffer) => {
              bytesWritten += chunk.length;
            });

            fileStream.pipe(passThrough);

            try {
              await getObjectStorage().uploadFromStream(storagePath, passThrough);

              if (limitExceeded) {
                try {
                  await getObjectStorage().delete(storagePath);
                } catch {
                  // Ignore cleanup errors
                }
                throw new Error(`File "${filename}" exceeds 5MB limit`);
              }

              return {
                fileName: filename,
                fileType: mimeType || "application/octet-stream",
                fileSize: bytesWritten,
                storagePath,
                uploadedAt: new Date().toISOString(),
              };
            } catch (err: any) {
              if (limitExceeded) throw new Error(`File "${filename}" exceeds 5MB limit`);
              throw err;
            }
          })();

          uploadPromises.push(uploadPromise);
        });

        bb.on("close", async () => {
          try {
            if (validationError) {
              return res.status(413).json({ error: validationError });
            }

            if (uploadPromises.length === 0) {
              return res.status(400).json({ error: "No files uploaded" });
            }

            const results = await Promise.all(uploadPromises);
            res.json({ files: results });
          } catch (error: any) {
            console.error("Error completing underwriting upload:", error);
            if (!res.headersSent) {
              handleApiError(res, error, "api-error");
            }
          }
        });

        bb.on("error", (error: any) => {
          console.error("Busboy error in underwriting upload:", error);
          if (!res.headersSent) {
            handleApiError(res, error, "api-error");
          }
        });

        req.pipe(bb);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Download attachment endpoint (SECURITY: requires assigned underwriter or submitting broker)
  app.get(
    "/api/underwriting/download/:submissionId/:activityId/:fileIndex",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const submissionId = parseInt(req.params.submissionId);
        const activityId = parseInt(req.params.activityId);
        const fileIndex = parseInt(req.params.fileIndex);

        // Check submission access
        const submission = await storage.getUnderwritingSubmission(submissionId);
        if (!submission) {
          return res.status(404).json({ error: "Submission not found" });
        }

        // SECURITY: Only allow the submitting broker OR the assigned underwriter
        // Not just any user with role 'underwriter'
        const user = await storage.getUser(userId);
        const isSubmittingBroker = submission.brokerId === userId;
        const isAssignedUnderwriter = submission.assignedUnderwriterId === userId;
        const isSuperAdmin = user?.role === "super_admin";

        if (!isSubmittingBroker && !isAssignedUnderwriter && !isSuperAdmin) {
          return res.status(403).json({
            error: "Access denied - you must be the submitting broker or assigned underwriter",
          });
        }

        // Get the activity and extract attachment
        const activities = await storage.listUnderwritingActivities(submissionId);
        const activity = activities.find((a) => a.id === activityId);

        if (!activity || !activity.attachments) {
          return res.status(404).json({ error: "Activity not found" });
        }

        const attachments = activity.attachments as UnderwritingAttachment[];
        if (fileIndex < 0 || fileIndex >= attachments.length) {
          return res.status(404).json({ error: "File not found" });
        }

        const attachment = attachments[fileIndex];

        // Download from object storage
        const { data } = await getObjectStorage().downloadAsBytes(attachment.storagePath);

        // SECURITY: Use sanitized filename to prevent header injection
        const { encodeContentDisposition } = await import("./utils/security");
        res.setHeader("Content-Type", attachment.fileType);
        res.setHeader("Content-Disposition", encodeContentDisposition(attachment.fileName));
        res.send(Buffer.from(data));
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Broker responds to underwriter query with message and attachments
  app.post(
    "/api/underwriting/submissions/:id/respond",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user.id;

        const submission = await storage.getUnderwritingSubmission(id);
        if (!submission) {
          return res.status(404).json({ error: "Submission not found" });
        }

        // Only the broker who submitted can respond
        if (submission.brokerId !== userId) {
          return res
            .status(403)
            .json({ error: "Only the submitting broker can respond to queries" });
        }

        // Can only respond to queries
        if (submission.status !== "queried") {
          return res
            .status(400)
            .json({ error: "Can only respond to submissions with 'queried' status" });
        }

        const { message, attachments } = req.body;

        if (!message || message.trim().length === 0) {
          return res.status(400).json({ error: "Response message is required" });
        }

        // Create activity record with response and attachments
        const activity = await storage.createUnderwritingActivity(
          {
            submissionId: id,
            activityType: "responded",
            content: message,
            attachments: attachments || [],
          },
          userId
        );

        // Update submission status back to in_review
        await storage.updateUnderwritingSubmission(id, { status: "in_review" });

        res.status(201).json({
          activity,
          message: "Response submitted successfully. The underwriter will review your response.",
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Underwriter sends message to broker
  app.post(
    "/api/underwriting/submissions/:id/message",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user.id;

        const user = await storage.getUser(userId);
        if (user?.role !== "underwriter") {
          return res
            .status(403)
            .json({ error: "Only underwriters can send messages through this endpoint" });
        }

        const submission = await storage.getUnderwritingSubmission(id);
        if (!submission) {
          return res.status(404).json({ error: "Submission not found" });
        }

        // Only assigned underwriter can message
        if (submission.assignedUnderwriterId !== userId) {
          return res.status(403).json({ error: "Only the assigned underwriter can send messages" });
        }

        const { message, setStatus } = req.body;

        if (!message || message.trim().length === 0) {
          return res.status(400).json({ error: "Message is required" });
        }

        // Create activity record
        const activityType = setStatus === "queried" ? "queried" : "comment";
        const activity = await storage.createUnderwritingActivity(
          {
            submissionId: id,
            activityType,
            content: message,
            attachments: [],
          },
          userId
        );

        // Update status if requesting a query
        if (setStatus === "queried") {
          await storage.updateUnderwritingSubmission(id, {
            status: "queried",
            decisionReason: message,
          });
        }

        res.status(201).json({
          activity,
          message:
            activityType === "queried"
              ? "Query sent to broker. They will be notified to respond."
              : "Message sent successfully.",
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Broker sends a message on their submission
  app.post(
    "/api/underwriting/submissions/:id/broker-message",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user.id;

        const submission = await storage.getUnderwritingSubmission(id);
        if (!submission) {
          return res.status(404).json({ error: "Submission not found" });
        }

        // Only the broker who submitted can send messages
        if (submission.brokerId !== userId) {
          return res.status(403).json({ error: "Only the submitting broker can send messages" });
        }

        const { message } = req.body;

        if (!message || message.trim().length === 0) {
          return res.status(400).json({ error: "Message is required" });
        }

        // Create activity record as a comment from broker
        const activity = await storage.createUnderwritingActivity(
          {
            submissionId: id,
            activityType: "comment",
            content: message,
            attachments: [],
          },
          userId
        );

        res.status(201).json({
          activity,
          message: "Message sent to underwriter.",
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // PATCH /api/prospects/:id - Update prospect details (including background)
  app.patch(
    "/api/prospects/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.id);
        const updates = req.body;

        if (isNaN(prospectId)) {
          return res.status(400).json({ error: "Invalid prospect ID" });
        }

        // Verify ownership and update
        // Helper function storage.updateProspect usually verifies ownership via userId or we rely on getProspect check inside
        // Let's assume updateProspect handles it or we check existence first
        const existing = await storage.getProspect(prospectId, userId);
        if (!existing) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const updated = await storage.updateProspect(prospectId, userId, updates);
        res.json(updated);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

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

  // Prospect Documents - List all documents for a prospect
  app.get(
    "/api/prospects/:prospectId/documents",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);

        // Verify prospect belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const documents = await storage.listProspectDocuments(prospectId);
        res.json(documents);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Upload document for a prospect - uses busboy streaming parser
  const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024; // 10MB per document

  app.post(
    "/api/prospects/:prospectId/documents",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user.id;
      const prospectId = parseInt(req.params.prospectId);

      try {
        // Verify prospect belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const contentType = req.headers["content-type"];
        if (!contentType?.startsWith("multipart/form-data")) {
          return res.status(400).json({ error: "Content-Type must be multipart/form-data" });
        }

        let category = "general";
        let notes = "";
        let uploadPromise: Promise<any> | null = null;
        let validationError: string | null = null;

        const bb = busboy({
          headers: req.headers,
          limits: { fileSize: MAX_DOCUMENT_FILE_SIZE, files: 1 },
        });

        bb.on("field", (fieldname, value) => {
          if (fieldname === "category") {
            category = value.trim() || "general";
          } else if (fieldname === "notes") {
            notes = value.trim();
          }
        });

        bb.on("file", (fieldname, fileStream, info) => {
          const { filename, mimeType } = info;

          if (!filename) {
            fileStream.resume();
            return;
          }

          const timestamp = Date.now();
          const sanitizedFileName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
          const storagePath = `.private/documents/${prospectId}/${timestamp}_${sanitizedFileName}`;

          // Stream directly to storage - no RAM buffering
          uploadPromise = (async () => {
            const { PassThrough } = await import("stream");
            const passThrough = new PassThrough();
            let limitExceeded = false;
            let bytesWritten = 0;

            fileStream.on("limit", () => {
              limitExceeded = true;
              validationError = `File "${filename}" exceeds 10MB limit`;
              passThrough.destroy(new Error("File size limit exceeded"));
            });

            fileStream.on("data", (chunk: Buffer) => {
              bytesWritten += chunk.length;
            });

            fileStream.pipe(passThrough);

            try {
              await getObjectStorage().uploadFromStream(storagePath, passThrough);

              if (limitExceeded) {
                try {
                  await getObjectStorage().delete(storagePath);
                } catch {
                  // Ignore cleanup errors
                }
                throw new Error(`File "${filename}" exceeds 10MB limit`);
              }

              const document = await storage.createProspectDocument({
                prospectId,
                userId,
                fileName: filename,
                fileType: mimeType || "application/octet-stream",
                fileSize: bytesWritten,
                storagePath,
                category,
                notes: notes || null,
                status: "pending"
              });

              // Trigger Zeus Document Gap Analysis asynchronously
              zeusService.performDocumentGapAnalysis(prospectId, userId).catch((err) => {
                console.error("[Zeus Trigger] Document gap analysis failed:", err);
              });

              return document;
            } catch (err: any) {
              if (limitExceeded) throw new Error(`File "${filename}" exceeds 10MB limit`);
              throw err;
            }
          })();
        });

        bb.on("close", async () => {
          try {
            if (validationError) {
              return res.status(413).json({ error: validationError });
            }

            if (!uploadPromise) {
              return res.status(400).json({ error: "No file uploaded" });
            }

            const document = await uploadPromise;
            res.status(201).json(document);
          } catch (error: any) {
            console.error("Error completing document upload:", error);
            if (!res.headersSent) {
              handleApiError(res, error, "api-error");
            }
          }
        });

        bb.on("error", (error: any) => {
          console.error("Busboy error in document upload:", error);
          if (!res.headersSent) {
            handleApiError(res, error, "api-error");
          }
        });

        req.pipe(bb);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Download a prospect document
  app.get(
    "/api/prospects/:prospectId/documents/:id/download",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);
        const documentId = parseInt(req.params.id);

        // Verify prospect belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const document = await storage.getProspectDocument(documentId);
        if (!document || document.prospectId !== prospectId) {
          return res.status(404).json({ error: "Document not found" });
        }

        const { data } = await getObjectStorage().downloadAsBytes(document.storagePath);

        // SECURITY: Use sanitized filename to prevent header injection
        const { encodeContentDisposition } = await import("./utils/security");
        res.setHeader("Content-Type", document.fileType);
        res.setHeader("Content-Disposition", encodeContentDisposition(document.fileName));
        res.send(Buffer.from(data));
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Delete a prospect document
  app.delete(
    "/api/prospects/:prospectId/documents/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const prospectId = parseInt(req.params.prospectId);
        const documentId = parseInt(req.params.id);

        // Verify prospect belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const document = await storage.getProspectDocument(documentId);
        if (!document || document.prospectId !== prospectId) {
          return res.status(404).json({ error: "Document not found" });
        }

        // Delete from object storage
        try {
          await getObjectStorage().delete(document.storagePath);
        } catch (storageError) {
          console.error("Error deleting from storage (continuing):", storageError);
        }

        // Delete from database
        await storage.deleteProspectDocument(documentId);

        res.json({ message: "Document deleted successfully" });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Sync officers from Companies House
  app.post(
    "/api/prospects/:id/sync-officers",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: "User not authenticated" });
        }
        const prospectId = parseInt(req.params.id);
        const userId = req.user.id;

        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect || !prospect.company.companyNumber) {
          return res.status(404).json({ error: "Prospect or Company Number not found" });
        }

        const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
        if (!apiKey) {
          // If no API key, return pseudo-success or empty to avoid crashing UI if optional
          console.warn("Companies House API Key missing. Skipping sync.");
          return res.json({ synced: 0, message: "Companies House integration not configured." });
        }

        const response = await fetch(
          `https://api.company-information.service.gov.uk/company/${prospect.company.companyNumber}/officers`,
          {
            headers: {
              Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            return res.json({ synced: 0, message: "No officers found for this company." });
          }
          throw new Error(`Companies House API Error: ${response.statusText}`);
        }

        const data = await response.json();
        const officers: any[] = data.items || [];
        let syncedCount = 0;

        // Get existing contacts to avoid duplicates (basic check by name)
        const existingContacts = await storage.listContacts(prospectId, userId);
        const existingNames = new Set(existingContacts.map((c) => c.name.toLowerCase()));

        for (const officer of officers) {
          if (officer.resigned_on) continue; // Skip resigned officers

          const name = officer.name;
          if (!name || existingNames.has(name.toLowerCase())) continue;

          await storage.createContact(
            {
              prospectId,
              name: name,
              role: officer.officer_role || "Officer",
              isPrimary: 0,
              email: null,
              phone: null,
            },
            userId
          );
          syncedCount++;
        }

        res.json({ synced: syncedCount, message: `Synced ${syncedCount} new officer(s).` });
      } catch (error) {
        handleApiError(res, error, "sync-officers-error");
      }
    }
  );

  // ============================================
  // WEBHOOK API ENDPOINTS
  // ============================================

  // Generate or regenerate webhook API key for authenticated user
  app.post(
    "/api/user/webhook-key",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const apiKey = await storage.generateWebhookApiKey(userId);
        res.json({
          apiKey,
          message: "API key generated successfully. Store this securely - it won't be shown again.",
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Get webhook API key status (not the actual key, only suffix for identification)
  app.get(
    "/api/user/webhook-key",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        res.json({
          hasApiKey: !!user.webhookApiKeyHash,
          suffix: user.webhookApiKeySuffix || null,
          createdAt: user.webhookApiKeyCreatedAt,
          lastUsedAt: user.webhookApiKeyLastUsedAt,
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Webhook endpoint to receive prospects from external applications
  app.post("/api/webhooks/prospects", async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Authenticate via API key header using hash comparison
      const apiKey = req.headers["x-flowloan-api-key"];
      if (!apiKey || typeof apiKey !== "string") {
        return res.status(401).json({ error: "Missing API key" });
      }

      // Hash the provided key and look up by hash
      const { hashWebhookApiKey } = await import("./utils/webhookKeyHash");
      const keyHash = hashWebhookApiKey(apiKey);
      const webhookUser = await storage.getUserByWebhookApiKeyHash(keyHash);
      if (!webhookUser) {
        return res.status(401).json({ error: "Invalid API key" });
      }

      // Update last used timestamp
      await storage.updateWebhookApiKeyLastUsed(webhookUser.id);

      // Validate payload
      const validationResult = webhookProspectPayloadSchema.safeParse(req.body);
      if (!validationResult.success) {
        const humanError = fromZodError(validationResult.error);
        return res.status(422).json({
          error: "Validation failed",
          details: humanError.message,
        });
      }

      const payload = validationResult.data;

      // Check prospect limits
      const prospectCount = await storage.countProspects(webhookUser.id);
      const prospectCredits = await storage.getUserProspectCredits(webhookUser.id);
      const totalAllowedProspects = webhookUser.prospectLimit + prospectCredits;

      if (prospectCount >= totalAllowedProspects) {
        return res.status(403).json({
          error: "Prospect limit reached",
          message: "Upgrade your plan or purchase additional prospect credits.",
        });
      }

      // Create or find company
      let company;
      if (payload.company.companyNumber) {
        company = await storage.getCompanyByNumber(payload.company.companyNumber);
      }

      if (!company) {
        company = await storage.createCompany({
          companyName: payload.company.companyName,
          companyNumber: payload.company.companyNumber || `WEBHOOK-${Date.now()}`,
          registeredAddress: payload.company.registeredAddress || null,
          incorporationDate: payload.company.incorporationDate || null,
          companyStatus: payload.company.companyStatus || null,
          companyType: payload.company.companyType || null,
        });
      }

      // Create prospect
      const prospectData: Partial<WebhookProspect> = payload.prospect || {};
      const prospect = await storage.createProspect(
        {
          companyId: company.id!,
          stage: (prospectData.stage as string) || "lead",
          loanAmount: prospectData.loanAmount || null,
          term: prospectData.term || null,
          interestRate: prospectData.interestRate || null,
          priority: (prospectData.priority as any) || null,
          notes: prospectData.notes || null,
          directorsGuarantee: prospectData.directorsGuarantee || 0,
          commercialProperty: prospectData.commercialProperty || 0,
          homeEquity: prospectData.homeEquity || 0,
          propertyOther: prospectData.propertyOther || 0,
          debenture: prospectData.debenture || 0,
          parentCompanyGuarantee: prospectData.parentCompanyGuarantee || 0,
          collateral: prospectData.collateral || 0,
          crossCompanyGuarantee: prospectData.crossCompanyGuarantee || 0,
          loanRequirementNotes: prospectData.loanRequirementNotes || null,
          queueOrder: 0,
        },
        webhookUser.id
      );

      // Create contacts
      if (payload.contacts && payload.contacts.length > 0) {
        for (const contact of payload.contacts) {
          await storage.createContact(
            {
              prospectId: prospect.id!,
              name: contact.name,
              email: contact.email || null,
              phone: contact.phone || null,
              role: contact.role || null,
              isPrimary: contact.isPrimary ? 1 : 0,
              notes: contact.notes || null,
            },
            webhookUser.id
          );
        }
      }

      // Create due diligence if provided
      if (payload.dueDiligence) {
        const dueDiligenceData: DueDiligenceData = {
          checklist: payload.dueDiligence.checklist || [],
          loanCalculator: payload.dueDiligence.loanCalculator,
          dscr: payload.dueDiligence.dscr,
          affordability: payload.dueDiligence.affordability,
          financialRatios: payload.dueDiligence.financialRatios,
          character: payload.dueDiligence.character,
        };
        await storage.upsertDueDiligence(prospect.id!, webhookUser.id, dueDiligenceData);
      }

      // Log the webhook activity
      await storage.createActivity(
        {
          prospectId: prospect.id!,
          title: "Prospect created via webhook",
          description: payload.metadata?.sourceApp
            ? `Created from external app: ${payload.metadata.sourceApp}${payload.metadata.externalId ? ` (ID: ${payload.metadata.externalId})` : ""}`
            : "Created via webhook API",
          activityType: "note",
          priority: "low",
          completed: 0,
        },
        webhookUser.id
      );

      res.status(201).json({
        success: true,
        prospectId: prospect.id,
        companyId: company.id,
        message: "Prospect created successfully",
      });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============= STRIPE BILLING ROUTES =============

  // Get Stripe publishable key for frontend
  app.get("/api/billing/config", isAuthenticated, async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      handleApiError(res, error, "Failed to get billing config", (req as any).requestId);
    }
  });

  // List subscription products with prices via Stripe API
  app.get("/api/billing/products", isAuthenticated, async (req, res) => {
    try {
      const stripe = await getUncachableStripeClient();
      const prices = await stripe.prices.list({
        active: true,
        limit: 100,
        expand: ["data.product"],
      });

      const productsMap = new Map();

      for (const price of prices.data) {
        const product = price.product as any; // Expanded
        if (!product || typeof product === "string") continue; // Should be expanded object

        if (!productsMap.has(product.id)) {
          productsMap.set(product.id, {
            id: product.id,
            name: product.name,
            description: product.description,
            metadata: product.metadata,
            prices: [],
          });
        }

        productsMap.get(product.id).prices.push({
          id: price.id,
          unit_amount: price.unit_amount,
          currency: price.currency,
          recurring: price.recurring,
          metadata: price.metadata,
        });
      }

      res.json({ products: Array.from(productsMap.values()) });
    } catch (error) {
      handleApiError(res, error, "Failed to list products", (req as any).requestId);
    }
  });

  // Get current user subscription status
  app.get(
    "/api/billing/subscription",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);

        if (!user?.stripeSubscriptionId) {
          return res.json({
            subscription: null,
            tier: user?.subscriptionTier || "free",
            prospectLimit: user?.prospectLimit || 10,
          });
        }

        const stripe = await getUncachableStripeClient();
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ["items.data.price.product"],
        });

        // Transform to match expected format if needed, or return raw
        // The frontend expects: { subscription: ... }
        // result.rows[0] had product_name etc joined.
        // We might need to manually decorate it if the frontend relies on simplified fields.
        // For now, return the stripe object which is richer.
        res.json({
          subscription: sub,
          tier: user.subscriptionTier,
          prospectLimit: user.prospectLimit,
        });
      } catch (error) {
        handleApiError(res, error, "Failed to get subscription", (req as any).requestId);
      }
    }
  );

  // Create checkout session for subscription
  app.post(
    "/api/billing/checkout",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);
        const { priceId, tier, interval } = req.body;

        // Map tier/interval to price ID if not provided directly
        let finalPriceId = priceId;
        if (!finalPriceId && tier && interval) {
          // Price ID mapping from environment variables
          // Format: STRIPE_PRICE_<TIER>_<INTERVAL> e.g., STRIPE_PRICE_BROKER_MONTHLY
          const envKey = `STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}`;
          finalPriceId = process.env[envKey];

          // Fallback mapping for common tiers if env vars not set
          if (!finalPriceId) {
            const priceMap: Record<string, Record<string, string>> = {
              broker: {
                monthly: process.env.STRIPE_PRICE_BROKER_MONTHLY || "",
                annual: process.env.STRIPE_PRICE_BROKER_ANNUAL || "",
              },
              team: {
                monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY || "",
                annual: process.env.STRIPE_PRICE_TEAM_ANNUAL || "",
              },
              lender: {
                monthly: process.env.STRIPE_PRICE_LENDER_MONTHLY || "",
                annual: process.env.STRIPE_PRICE_LENDER_ANNUAL || "",
              },
            };
            finalPriceId = priceMap[tier]?.[interval];
          }
        }

        if (!finalPriceId) {
          return res.status(400).json({
            error: "Price ID required. Please configure Stripe price IDs in environment variables.",
            hint: `Set STRIPE_PRICE_${tier?.toUpperCase() || "TIER"}_${interval?.toUpperCase() || "INTERVAL"}`,
          });
        }

        const stripe = await getUncachableStripeClient();

        // Create or get Stripe customer
        let customerId = user?.stripeCustomerId;
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user?.email || undefined,
            metadata: { userId },
          });
          await storage.updateUser(userId, { stripeCustomerId: customer.id });
          customerId = customer.id;
        }

        // Create checkout session
        const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          payment_method_types: ["card"],
          line_items: [{ price: finalPriceId, quantity: 1 }],
          mode: "subscription",
          success_url: `${baseUrl}/settings?tab=billing&success=true`,
          cancel_url: `${baseUrl}/settings?tab=billing&canceled=true`,
          metadata: { userId, tier: tier || "unknown", interval: interval || "unknown" },
        });

        res.json({ url: session.url });
      } catch (error) {
        handleApiError(res, error, "Failed to create checkout session", (req as any).requestId);
      }
    }
  );

  // Create customer portal session for managing subscription
  app.post(
    "/api/billing/portal",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);

        if (!user?.stripeCustomerId) {
          return res.status(400).json({ error: "No billing account found" });
        }

        const stripe = await getUncachableStripeClient();
        const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

        const session = await stripe.billingPortal.sessions.create({
          customer: user.stripeCustomerId,
          return_url: `${baseUrl}/settings?tab=billing`,
        });

        res.json({ url: session.url });
      } catch (error) {
        handleApiError(res, error, "Failed to create portal session", (req as any).requestId);
      }
    }
  );

  // Create one-time purchase (for add-ons like prospect packs)
  app.post(
    "/api/billing/purchase",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);
        const { priceId, quantity = 1 } = req.body;

        if (!priceId) {
          return res.status(400).json({ error: "Price ID required" });
        }

        const stripe = await getUncachableStripeClient();

        // Create or get Stripe customer
        let customerId = user?.stripeCustomerId;
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user?.email || undefined,
            metadata: { userId },
          });
          await storage.updateUser(userId, { stripeCustomerId: customer.id });
          customerId = customer.id;
        }

        // Create checkout session for one-time payment
        const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          payment_method_types: ["card"],
          line_items: [{ price: priceId, quantity }],
          mode: "payment",
          success_url: `${baseUrl}/settings?tab=billing&purchase=success`,
          cancel_url: `${baseUrl}/settings?tab=billing&purchase=canceled`,
          metadata: { userId, type: "addon" },
        });

        res.json({ url: session.url });
      } catch (error) {
        handleApiError(res, error, "Failed to create purchase session", (req as any).requestId);
      }
    }
  );

  // ===========================================
  // LENDER ENQUIRY FORM SUBMISSION
  // ===========================================
  app.post("/api/lender-enquiry", async (req, res) => {
    try {
      const data = req.body;

      // Validate required fields
      if (!data.entity_name || !data.contact_name || !data.contact_email) {
        return res.status(400).json({
          error: "Missing required fields: entity_name, contact_name, contact_email",
        });
      }

      // Import lenderEnquiries dynamically to avoid circular dependencies
      const { lenderEnquiries } = await import("@shared/schema");

      // Store in database using storage
      const enquiry = await storage.createLenderEnquiry({
        entityName: data.entity_name,
        sponsor: data.sponsor || "",
        goLiveDate: data.go_live_date,
        objective: data.objective,
        loanTypes: data.loan_types,
        stages: data.stages,
        internalRoles: data.internal_roles || [],
        externalRoles: data.external_roles || [],
        userCount: data.user_count ? parseInt(data.user_count) : null,
        creditIntegration: data.credit_integration,
        openBanking: data.open_banking ? "true" : "false",
        decisioning: data.decisioning,
        documents: data.documents || [],
        dataSubjects: data.data_subjects || [],
        dataResidency: data.data_residency,
        dataResidencyDetails: data.data_residency_details,
        contactName: data.contact_name,
        contactEmail: data.contact_email,
        contactPhone: data.contact_phone,
        additionalNotes: data.additional_notes,
        formData: data, // Store full form as JSON backup
        status: "new",
      });

      console.log(
        `[Lender Enquiry] New enquiry from ${data.contact_email} for ${data.entity_name}`
      );

      // Send email notification (non-blocking)
      const notificationEmail = process.env.LENDER_ENQUIRY_EMAIL || "sales@veltro.io";

      // Email sending using nodemailer or your configured email service
      // For now, we'll log it - you can integrate with your email service
      console.log(`[Lender Enquiry] Email notification would be sent to: ${notificationEmail}`);
      console.log(`[Lender Enquiry] Subject: New Lender Platform Enquiry from ${data.entity_name}`);
      console.log(`[Lender Enquiry] Body: Contact: ${data.contact_name} <${data.contact_email}>`);

      // If you have an email service configured, uncomment and adapt:
      // try {
      //   await sendEmail({
      //     to: notificationEmail,
      //     subject: `New Lender Platform Enquiry: ${data.entity_name}`,
      //     html: `
      //       <h2>New Lender Enquiry</h2>
      //       <p><strong>Company:</strong> ${data.entity_name}</p>
      //       <p><strong>Contact:</strong> ${data.contact_name}</p>
      //       <p><strong>Email:</strong> ${data.contact_email}</p>
      //       <p><strong>Phone:</strong> ${data.contact_phone || 'Not provided'}</p>
      //       <hr>
      //       <p><strong>Target Go-Live:</strong> ${data.go_live_date || 'Not specified'}</p>
      //       <p><strong>Objective:</strong> ${data.objective || 'Not specified'}</p>
      //       <p><strong>User Count:</strong> ${data.user_count || 'Not specified'}</p>
      //       <hr>
      //       <p><strong>Additional Notes:</strong></p>
      //       <p>${data.additional_notes || 'None'}</p>
      //     `,
      //   });
      // } catch (emailError) {
      //   console.error("[Lender Enquiry] Failed to send email:", emailError);
      // }

      res.status(201).json({
        success: true,
        message: "Enquiry submitted successfully",
        id: enquiry.id,
      });
    } catch (error) {
      console.error("[Lender Enquiry] Error:", error);
      res.status(500).json({ error: "Failed to submit enquiry" });
    }
  });

  // --- Communication Module Routes ---

  // 1. Settings (Integrations)
  app.get(
    "/api/communications/settings",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const integrations = await storage.getCommunicationIntegrations(req.user.id);
        // Return decrypted/safe version (don't expose raw API keys blindly if not needed, but for 'edit' we might need them or just mask them)
        // For now returning as is, frontend should handle masking if showing.
        res.json(integrations);
      } catch (error) {
        handleApiError(res, error, "communication-error");
      }
    }
  );

  app.post(
    "/api/communications/settings",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const result = insertCommunicationIntegrationSchema.safeParse({
          ...req.body,
          userId: req.user.id,
        });
        if (!result.success) {
          return res.status(400).json({ error: fromZodError(result.error).toString() });
        }
        const integration = await storage.saveCommunicationIntegration(result.data);
        res.json(integration);
      } catch (error) {
        handleApiError(res, error, "communication-error");
      }
    }
  );

  // 2. Templates
  app.get(
    "/api/communications/templates",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const templates = await storage.getCommunicationTemplates(req.user.id);
        res.json(templates);
      } catch (error) {
        handleApiError(res, error, "communication-error");
      }
    }
  );

  app.post(
    "/api/communications/templates",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const result = insertCommunicationTemplateSchema.safeParse({
          ...req.body,
          userId: req.user.id,
        });
        if (!result.success) {
          return res.status(400).json({ error: fromZodError(result.error).toString() });
        }
        const template = await storage.createCommunicationTemplate(result.data);
        res.json(template);
      } catch (error) {
        handleApiError(res, error, "communication-error");
      }
    }
  );

  app.put(
    "/api/communications/templates/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const result = insertCommunicationTemplateSchema.partial().safeParse(req.body); // Allow partial update? Schema says Insert is all required mostly.
        // Let's assume full update or partial.
        if (!result.success) {
          return res.status(400).json({ error: fromZodError(result.error).toString() });
        }
        // Verify ownership
        const templates = await storage.getCommunicationTemplates(req.user.id);
        if (!templates.find((t) => t.id === id)) {
          return res.status(404).json({ error: "Template not found" });
        }

        const updated = await storage.updateCommunicationTemplate(id, result.data);
        res.json(updated);
      } catch (error) {
        handleApiError(res, error, "communication-error");
      }
    }
  );

  // 3. Send
  app.post(
    "/api/communications/send",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { prospectId, channel, templateId, content, subject, contactId } = req.body;
        const userId = req.user.id;

        // 1. Get Integration
        const integrations = await storage.getCommunicationIntegrations(userId);
        const integration = integrations.find((i) => i.provider === "sendgrid" && i.isEnabled); // Hardcoded 'sendgrid' for Phase 1

        if (!integration) {
          return res.status(400).json({
            error: "No active email integration found. Please configure SendGrid in Settings.",
          });
        }

        // 2. Get Recipient (Contact or Prospect Main)
        let recipientEmail;
        let recipientName;
        let recipientVariables = {};

        // Fetch Prospect
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) return res.status(404).json({ error: "Prospect not found" });

        if (contactId) {
          // Fetch Specific Contact
          // assuming we have a getContact method or listContacts.
          // Reuse listContacts for now.
          const contacts = await storage.listContacts(prospectId, userId); // Assuming listContacts exists on storage, check schema/storage
          const contact = contacts.find((c) => c.id === contactId);
          if (!contact || !contact.email)
            return res.status(400).json({ error: "Contact has no email" });
          recipientEmail = contact.email;
          recipientName = contact.name;
          recipientVariables = {
            firstName: contact.name.split(" ")[0],
            name: contact.name,
            company: prospect.company.companyName,
          };
        } else {
          // Fallback to Prospect Contact info? Prospect table doesn't have email directly, relies on Contacts/Lead info.
          // Or maybe 'ContactName' in Company table?
          // Let's assume user MUST select a contact for now if prospect email is ambiguous.
          // Or verify if Linked Lead has email.
          return res.status(400).json({ error: "Contact ID required" });
        }

        // 3. Send
        await sendEmail(
          integration.credentials,
          recipientEmail,
          subject,
          content,
          recipientVariables
        );

        // 4. Log
        const log = await storage.logCommunication({
          userId,
          prospectId,
          contactId: contactId || null,
          channel: "email",
          direction: "outbound",
          status: "sent",
          subject: subject,
          content: content,
          metadata: { provider: "sendgrid" },
        });

        res.json(log);
      } catch (error: any) {
        console.error("Send Error:", error);
        res.status(500).json({ error: error.message || "Failed to send message" });
      }
    }
  );

  // 4. Logs
  app.get(
    "/api/prospects/:id/communications",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const prospectId = parseInt(req.params.id);
        // Verify access
        const prospect = await storage.getProspect(prospectId, req.user.id);
        if (!prospect) return res.status(404).json({ error: "Prospect not found" });

        const logs = await storage.getCommunicationHistory(prospectId);
        res.json(logs);
      } catch (error) {
        handleApiError(res, error, "communication-error");
      }
    }
  );

  // --- Chat Routes ---

  // List user's channels
  app.get(
    "/api/chat/channels",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const channels = await storage.getChannelsForUser(req.user.id);
        // Enrich with members or last message sender info if needed
        res.json(channels);
      } catch (error) {
        handleApiError(res, error, "chat-error");
      }
    }
  );

  // Create a channel (DM or Group)
  app.post(
    "/api/chat/channels",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        // Logic:
        // If type=direct and 'targetUserId' provided:
        //   Check if DM already exists with these 2 users.
        //   If yes, return it.
        //   If no, create new channel + 2 members.
        // If type=group/prospect:
        //   Create channel + members.

        const { type, name, contextId, targetUserId, memberIds } = req.body;
        const myId = req.user.id;

        if (type === "direct" && targetUserId) {
          // Naive check for existing DM (optimization: storage method getDirectChannel(u1, u2))
          // For now, create new or let client handle duplicates?
          // Let's implement a simple check via gathering my channels
          const myChannels = await storage.getChannelsForUser(myId);
          // Filter for direct channels
          const directChannels = myChannels.filter((c) => c.type === "direct");
          // Check members of each (expensive without optimized schema/query)
          for (const c of directChannels) {
            const members = await storage.listChannelMembers(c.id!);
            if (members.length === 2 && members.some((m) => m.userId === targetUserId)) {
              return res.json(c);
            }
          }

          // Create new DM
          const channel = await storage.createChannel({
            type: "direct",
            name: null,
            contextId: null,
          });
          await storage.addChannelMember({
            channelId: channel.id!,
            userId: myId,
            lastReadAt: new Date(),
          });
          await storage.addChannelMember({
            channelId: channel.id!,
            userId: targetUserId,
            lastReadAt: new Date(),
          });
          return res.json(channel);
        }

        // Group / Prospect Logic
        const channel = await storage.createChannel({
          type: type || "group",
          name: name || (type === "prospect" ? `Prospect ${contextId}` : "New Group"),
          contextId: contextId || null,
        });

        // Add self
        await storage.addChannelMember({
          channelId: channel.id!,
          userId: myId,
          lastReadAt: new Date(),
        });

        // Add others
        if (Array.isArray(memberIds)) {
          for (const uid of memberIds) {
            await storage.addChannelMember({
              channelId: channel.id!,
              userId: uid,
              lastReadAt: new Date(),
            });
          }
        }

        res.json(channel);
      } catch (error) {
        handleApiError(res, error, "chat-error");
      }
    }
  );

  // Get Channel Details
  app.get(
    "/api/chat/channels/:id",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const channelId = parseInt(req.params.id);
        const channel = await storage.getChannel(channelId);
        if (!channel) return res.status(404).json({ error: "Channel not found" });

        // Membership check
        const members = await storage.listChannelMembers(channelId);
        if (!members.some((m) => m.userId === req.user.id)) {
          return res.status(403).json({ error: "Access denied" });
        }

        res.json({ ...channel, members });
      } catch (error) {
        handleApiError(res, error, "chat-error");
      }
    }
  );

  // Get Messages
  app.get(
    "/api/chat/channels/:id/messages",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const channelId = parseInt(req.params.id);
        // Membership check
        const members = await storage.listChannelMembers(channelId);
        if (!members.some((m) => m.userId === req.user.id)) {
          return res.status(403).json({ error: "Access denied" });
        }

        const messages = await storage.getMessages(channelId);
        res.json(messages);
      } catch (error) {
        handleApiError(res, error, "chat-error");
      }
    }
  );

  // Send Message
  app.post(
    "/api/chat/channels/:id/messages",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const channelId = parseInt(req.params.id);
        const { content, attachments } = req.body;

        // Membership verification
        const members = await storage.listChannelMembers(channelId);
        if (!members.some((m) => m.userId === req.user.id)) {
          return res.status(403).json({ error: "Access denied" });
        }

        const message = await storage.createMessage({
          channelId,
          senderId: req.user.id,
          content,
          attachments: attachments || [],
        });

        res.json(message);
      } catch (error) {
        handleApiError(res, error, "chat-error");
      }
    }
  );

  // Search Users meant for chat
  app.get("/api/chat/users", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      // Return minimal info
      const safeUsers = users.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        profileImageUrl: u.profileImageUrl,
      }));
      res.json(safeUsers);
    } catch (error) {
      handleApiError(res, error, "chat-error");
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
  // Email Outreach Queue
  // ==================
  app.get(
    "/api/outreach/pending",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        // Return emails from global storage (temporary for testing)
        const emails = (global as any).pendingEmails || [];
        res.json(emails);
      } catch (error) {
        handleApiError(res, error, "outreach-error");
      }
    }
  );

  app.post(
    "/api/outreach/:emailId/approve",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { createGmailDraft } = await import("./utils/gmailClient");
        const emails = (global as any).pendingEmails || [];
        const email = emails.find((e: any) => e.id === req.params.emailId);

        if (!email) {
          return res.status(404).json({ error: "Email not found" });
        }

        // TODO: Get actual prospect email - for now using placeholder
        const prospectEmail = `${email.prospectName.toLowerCase().replace(/\s+/g, ".")}@example.com`;

        // Create draft in Gmail (shaun@veltro.co.uk)
        const draft = await createGmailDraft(
          prospectEmail,
          email.subject,
          email.body,
          req.user.id
        );

        // Update status
        email.status = "approved";
        email.approvedAt = new Date().toISOString();
        email.draftUrl = draft.url;

        console.log(`[Outreach] Created draft: ${draft.url}`);

        res.json({ success: true, draftUrl: draft.url });
      } catch (error) {
        handleApiError(res, error, "outreach-error");
      }
    }
  );

  app.post(
    "/api/outreach/:emailId/reject",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { emailOutreach } = await import("./services/emailOutreach");
        await emailOutreach.rejectEmail(
          req.params.emailId,
          req.body.reason || "Manual rejection",
          req.user.id
        );
        res.json({ success: true });
      } catch (error) {
        handleApiError(res, error, "outreach-error");
      }
    }
  );

  // Test endpoint: Generate sample emails
  app.post(
    "/api/outreach/generate-test",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { emailOutreach } = await import("./services/emailOutreach");

        const testProspects = [
          {
            id: "test_1",
            name: "Sarah Mitchell",
            company: "TechFlow Solutions Ltd",
            turnover: "£12.5M",
            sector: "Technology",
            needs: ["Working capital", "Equipment finance"],
          },
          {
            id: "test_2",
            name: "James Robertson",
            company: "Highland Manufacturing Co",
            turnover: "£8.2M",
            sector: "Manufacturing",
            needs: ["Business expansion", "Invoice finance"],
          },
          {
            id: "test_3",
            name: "Emma Williams",
            company: "Green Energy Consultants",
            turnover: "£5.7M",
            sector: "Renewable Energy",
            needs: ["Growth capital", "Property finance"],
          },
        ];

        const emails = [];
        for (const prospect of testProspects) {
          const email = await emailOutreach.generateOutreachEmail(
            prospect.id,
            prospect,
            req.user.id
          );
          emails.push(email);
        }

        res.json({ success: true, emails });
      } catch (error) {
        handleApiError(res, error, "outreach-error");
      }
    }
  );

  // Mock test endpoint: Generate sample emails without AI
  app.post(
    "/api/outreach/generate-mock-test",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const mockEmails = [
          {
            id: `email_${Date.now()}_1`,
            prospectId: "test_1",
            prospectName: "Sarah Mitchell",
            prospectCompany: "TechFlow Solutions Ltd",
            subject: "Flexible Finance Solutions for Your Growing Tech Business",
            body: "Dear Sarah,\n\nI hope this message finds you well. I'm reaching out from Veltro to introduce our specialized lending platform designed for technology companies like TechFlow Solutions Ltd.\n\nWith your turnover of £12.5M, you're at an exciting growth stage. We offer tailored working capital and equipment finance solutions with competitive rates and flexible terms that adapt to your business cycle.\n\nI'd love to discuss how we can support your expansion plans. Would you be available for a brief call next week?\n\nBest regards,\nThe Veltro Team",
            status: "pending",
            createdAt: new Date().toISOString(),
          },
          {
            id: `email_${Date.now()}_2`,
            prospectId: "test_2",
            prospectName: "James Robertson",
            prospectCompany: "Highland Manufacturing Co",
            subject: "Manufacturing Finance Solutions Tailored to Your Needs",
            body: "Dear James,\n\nI noticed Highland Manufacturing Co's strong performance in the manufacturing sector. Congratulations on building such a solid business.\n\nAt Veltro, we specialize in supporting manufacturers with business expansion loans and invoice finance. Our platform streamlines the application process while offering competitive rates designed for your industry.\n\nGiven your £8.2M turnover, we have several options that could help accelerate your growth plans. I'd be delighted to explore these with you.\n\nCould we schedule a quick conversation this week?\n\nWarm regards,\nThe Veltro Team",
            status: "pending",
            createdAt: new Date().toISOString(),
          },
          {
            id: `email_${Date.now()}_3`,
            prospectId: "test_3",
            prospectName: "Emma Williams",
            prospectCompany: "Green Energy Consultants",
            subject: "Sustainable Finance for Your Green Energy Mission",
            body: "Dear Emma,\n\nIt's inspiring to see Green Energy Consultants making such positive impact in renewable energy. We'd love to support your continued growth.\n\nVeltro offers specialized finance solutions for sustainable businesses, including growth capital and property finance options. With your £5.7M turnover, you qualify for our most competitive rates.\n\nWe understand the unique needs of the renewable sector and can structure financing that aligns with your project timelines and cash flow.\n\nWould you be interested in learning more? I'm happy to share details at your convenience.\n\nBest wishes,\nThe Veltro Team",
            status: "pending",
            createdAt: new Date().toISOString(),
          },
        ];

        // Store in global state for testing
        (global as any).pendingEmails = mockEmails;

        res.json({ success: true, emails: mockEmails });
      } catch (error) {
        handleApiError(res, error, "outreach-error");
      }
    }
  );

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
