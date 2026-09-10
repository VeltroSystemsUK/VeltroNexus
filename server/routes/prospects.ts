import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { fromZodError } from "zod-validation-error";
import {
  ProposalNotReadyError,
  SLOT_CAPS,
  emptySlots,
  hydrateBulletsFromMarkdown,
  validateSlot,
} from "@shared/proposalFacts";
import {
    insertProspectSchema,
    insertContactSchema,
    updateProspectStageSchema,
    type DueDiligenceData,
} from "@shared/schema";
import { zeusService } from "../services/zeusService";
import { generateText, DEFAULT_GEMINI_MODEL, searchCompanyInfo, groundedSearch, searchAdverseMedia } from "../utils/geminiClient";
import { searchExa } from "../utils/exaClient";
import { encodeContentDisposition } from "../utils/security";
import { getObjectStorage } from "../utils/routerHelpers";
import busboy from "busboy";
import { wrapAiRequest, requirePremiumAndConsent, AI_GOVERNANCE_CONFIG, redactSensitiveData } from "../utils/aiGovernance";
import { resultWithin } from "../utils/resultWithin";
import { createErrorResponse } from "../utils/errorResponse";
import { getSicDescription } from "../utils/sicCodeLookup";
import { generatePipelineExcel } from "../utils/excelExporter";
import { formatOfficerName } from "../utils/formatters";
import { getReadableProspect } from "../utils/prospectAccess";
import { generateBbbBusinessPlan, pdfToStream } from "../utils/bbbBusinessPlan";
import { parsePdfBuffer } from "../utils/pdfText";
import { accountPdfsFromDocuments, pdfTextsFromDocuments, spreadsheetTextsFromDocuments } from "../utils/prospectDocumentText";
import { extractSpreadsheetText, isSpreadsheetFile } from "../utils/spreadsheetText";
import { buildAccountsAnalysis, parseCreditsafeStatements, yearsFromAccountsText } from "@shared/accountsAnalysisBuild";
import { analyseBankStatements } from "@shared/bankStatementSweep";
import { xaiBearer } from "@shared/craftYaffle";
import {
  buildCreditFileContext,
  loanAmountPounds,
} from "../utils/creditFileContext";
import { applyLoanAmountToRequirementData, applyLoanAmountToUnderwriting } from "@shared/loanAmountEdit";
import { joinAiBullets, toAiBullets } from "@shared/aiBullets";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";

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

const router = Router();

  router.get("/prospects/:id/requirements", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.id);
      if (isNaN(prospectId)) return res.status(400).json({ error: "Invalid prospect ID" });

      const prospect = await getReadableProspect(req, prospectId);
      if (!prospect) return res.status(404).json({ error: "Prospect not found" });
      const userId = prospect.userId;

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
  router.post("/prospects/:id/documents/upload", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const prospectId = parseInt(req.params.id);
      if (isNaN(prospectId)) {
        try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
        return res.status(400).json({ error: "Invalid prospect ID" });
      }
      const prospect = await getReadableProspect(req, prospectId);
      if (!prospect) {
        try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
        return res.status(404).json({ error: "Prospect not found" });
      }
      const category = req.body.category || "general";
      const userId = req.user!.id;

      // 1. Upload to Google Drive (if user has connected Google)
      let storagePath = req.file.path;
      let driveLink = null;

      try {
        const { uploadFileToDrive } = await import("../services/googleServices");
        const { storage } = await import("../storage");

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
        const { agentRunner } = await import("../services/agentRunner");
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
  router.get("/prospects/:id/documents", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.id);
      const prospect = await getReadableProspect(req, prospectId);
      if (!prospect) return res.status(404).json({ error: "Prospect not found" });
      const docs = await storage.listProspectDocuments(prospectId, prospect.userId);
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: "Failed to list documents" });
    }
  });

  // 4. Delete Document
  router.delete("/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const docId = parseInt(req.params.id);
      const userId = req.user!.id;
      await storage.deleteProspectDocument(docId, userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Prospects API - Protected routes
  router.get(
    "/prospects/count",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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

  router.get("/prospects", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const prospects = await storage.listProspects(userId);
      res.json(prospects);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  router.get(
    "/prospects/export/excel",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospects = await storage.listProspects(userId);
        const user = await storage.getUser(userId);

        const excelBuffer = await generatePipelineExcel(prospects, user);

        // SECURITY: Use sanitized filename to prevent header injection
        // const { encodeContentDisposition } = await import("../utils/security");
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

  router.get(
    "/prospects/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const prospect = await getReadableProspect(req, id);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }
        res.json(prospect);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  router.post("/prospects", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

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

  router.patch(
    "/prospects/:id/stage",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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

  router.post(
    "/prospects/reorder",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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

  router.patch(
    "/prospects/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const id = parseInt(req.params.id);
        const updates = { ...(req.body || {}) };

        if (Object.prototype.hasOwnProperty.call(updates, "loanAmount")) {
          const existing = await storage.getProspect(id, userId);
          if (!existing) return res.status(404).json({ error: "Prospect not found" });
          const pence = Number(updates.loanAmount);
          const pounds = Number.isFinite(pence) && pence > 0 ? pence / 100 : 0;
          if (!updates.loanRequirementData) {
            const nextReq = applyLoanAmountToRequirementData(existing.loanRequirementData, pounds);
            if (nextReq) updates.loanRequirementData = nextReq;
          }
          const due = await storage.getDueDiligence(id, userId);
          const data = (due?.data || {}) as Record<string, any>;
          await storage.upsertDueDiligence(id, existing.userId, {
            ...data,
            underwriting: applyLoanAmountToUnderwriting(data.underwriting, pounds),
          } as any);
        }

        const prospect = await storage.updateProspect(id, userId, updates);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }
        res.json(prospect);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  router.delete(
    "/prospects/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);

        const prospect = await getReadableProspect(req, id);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        await storage.deleteProspect(id, prospect.userId);
        res.status(204).send();
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  router.get(
    "/prospects/:id/report",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const prospect = await getReadableProspect(req, id);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const { buildProspectReportData, reportFilename, streamProspectReport } =
          await import("../utils/prospectReport");
        const reportData = await buildProspectReportData(prospect, { layoutUserId: req.user!.id });
        await streamProspectReport(res, reportData, reportFilename(prospect.company.companyName));
      } catch (error) {
        if (error instanceof ProposalNotReadyError) {
          return res.status(409).json({
            message: error.message,
            conflicts: error.conflicts,
            missing: error.missing,
          });
        }
        console.error("[PDF Report] Route error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Business Overview API - AI-powered web search for company info
  router.get(
    "/prospects/:id/business-overview",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const prospect = await getReadableProspect(req, id);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const companyName = prospect.company.companyName;
        const industry = prospect.company.sicDescription || prospect.company.sicCode || undefined;

        const result = await groundedSearch(
          `${companyName} UK business overview${industry ? ` ${industry} industry` : ''}`
        );

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


  // Contact Enrichment API - AI-powered contact search + internal context
  router.post(
    "/api/contacts/:id/enrich",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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
        console.log(`[Enrichment] Searching for contact at ${companyName}`);
        const webResults = await searchCompanyInfo(`${contact.name} ${companyName}`);

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

  // Contact enrichment - search web and email inbox for contact info
  router.get(
    "/prospects/:prospectId/contacts",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        if (!req.user) return res.status(401).send("Not authenticated");
        const prospectId = parseInt(req.params.prospectId);
        const prospect = await getReadableProspect(req, prospectId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }
        const contacts = await storage.listContacts(prospectId, prospect.userId);
        res.json(contacts);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );


  router.post(
    "/prospects/:prospectId/contacts",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user!.id;
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

  router.patch(
    "/api/contacts/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user!.id;
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

  router.delete(
    "/api/contacts/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const userId = req.user!.id;
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
  router.post(
    "/api/contacts/:id/enrich",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const contactId = parseInt(req.params.id);
        const userId = req.user!.id;

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
        const company = await storage.getCompanyById(prospect.companyId!);
        const companyName = company?.companyName || "";

        // Search the web for contact info using Gemini
        const webResults = await searchCompanyInfo(contact.name, companyName);

        // Search email inbox for related emails
        let emailResults: any[] = [];
        try {
          const inbox = await storage.getEmailInbox(userId as any);
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
  // Get due diligence status summaries for all prospects (for pipeline cards)
  router.get(
    "/api/due-diligence/summaries",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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

  router.get(
    "/prospects/:prospectId/due-diligence",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const prospect = await getReadableProspect(req, prospectId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }
        const dueDiligenceData = await storage.getDueDiligence(prospectId, prospect.userId);
        res.json(dueDiligenceData || { prospectId, data: {} });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  router.patch(
    "/prospects/:prospectId/due-diligence",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const prospect = await getReadableProspect(req, prospectId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }
        const existing = await storage.getDueDiligence(prospectId, prospect.userId);
        const mergedData =
          existing && existing.data ? { ...(existing.data as object), ...req.body } : req.body;
        const dueDiligenceData = await storage.upsertDueDiligence(
          prospectId,
          prospect.userId,
          mergedData
        );
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

  router.post(
    "/prospects/:prospectId/underwriting/analyze-csv",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);
        const { csvFileName, loanAmount, monthlyRepayment, consentToAiProcessing } = req.body;
        let csvData = typeof req.body.csvData === "string" ? req.body.csvData : "";
        let sourceName = typeof csvFileName === "string" ? csvFileName : "";

        // Verify prospect belongs to user
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const documentId = Number(req.body.documentId);
        if (!csvData && Number.isFinite(documentId) && documentId > 0) {
          const document = await storage.getProspectDocument(documentId, userId);
          if (!document || document.prospectId !== prospectId) {
            return res.status(404).json({ error: "Document not found" });
          }
          if (!isSpreadsheetFile(document.fileName, document.fileType)) {
            return res.status(415).json({ error: "That document is not a CSV or Excel file" });
          }
          const { data } = await getObjectStorage().downloadAsBytes(document.storagePath);
          csvData = await extractSpreadsheetText(Buffer.from(data), document.fileName);
          sourceName = document.fileName;
        }

        if (!csvData || !loanAmount || !monthlyRepayment) {
          return res
            .status(400)
            .json({ error: "Missing required fields: csvData or documentId, loanAmount, monthlyRepayment" });
        }

        // Use governance wrapper for consent, redaction, size limits, and audit logging
        const { analyzeFinancials } = await import("../utils/geminiClient");

        const result = await wrapAiRequest(
          {
            userId,
            prospectId,
            operation: "analyze_csv",
            dataType: "csv",
            consentToAiProcessing: !!consentToAiProcessing,
          },
          csvData,
          async (processedData) => analyzeFinancials(processedData, loanAmount, monthlyRepayment),
          { maxSize: AI_GOVERNANCE_CONFIG.maxCsvSize }
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
            financialAnalysis: result.result,
            ...(sourceName.trim() ? { csvFileName: sourceName.trim() } : {}),
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
  router.get(
    "/prospects/:prospectId/due-diligence",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const prospect = await getReadableProspect(req, prospectId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const dueDiligence = await storage.getDueDiligence(prospectId, prospect.userId);
        res.json(dueDiligence?.data || {});
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Save due diligence data
  router.post(
    "/prospects/:prospectId/due-diligence",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const prospect = await getReadableProspect(req, prospectId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const existing = await storage.getDueDiligence(prospectId, prospect.userId);
        const mergedData =
          existing && existing.data ? { ...(existing.data as object), ...req.body } : req.body;
        const dueDiligence = await storage.upsertDueDiligence(
          prospectId,
          prospect.userId,
          mergedData
        );
        res.json(dueDiligence);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Analyze bank statement PDFs (alternative to CSV)
  router.post(
    "/prospects/:prospectId/underwriting/analyze-bank-pdfs",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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
        const { analyzeFinancialsFromPdf } = await import("../utils/geminiClient");

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
  router.post(
    "/prospects/:prospectId/underwriting/analyze-accounts",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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
        const { analyzeAuditedAccounts } = await import("../utils/geminiClient");

        const result = await wrapAiRequest(
          {
            userId,
            prospectId,
            operation: "analyze_accounts",
            dataType: "pdf",
            consentToAiProcessing: !!consentToAiProcessing,
          },
          combinedText,
          async () => analyzeAuditedAccounts(processedPdfTexts, loanAmount, monthlyRepayment, prospect.notes || ""),
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
            accountsPdfs: pdfTexts.map((pdf: { year: string; fileName?: string; text: string; pages?: number }) => ({
              year: pdf.year,
              fileName: pdf.fileName || pdf.year,
              text: pdf.text || "",
              ...(pdf.pages ? { pages: pdf.pages } : {}),
            })),
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

  router.post(
    "/prospects/:prospectId/underwriting/sweep-statements",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const prospect = await getReadableProspect(req, prospectId);
        if (!prospect) return res.status(404).json({ error: "Prospect not found" });
        const documents = await storage.listProspectDocuments(prospectId);
        const selectedIds = Array.isArray(req.body?.documentIds)
          ? (req.body.documentIds as unknown[]).map((id) => Number(id)).filter((id) => Number.isFinite(id))
          : [];
        const pool = selectedIds.length
          ? documents.filter((doc) => selectedIds.includes(doc.id))
          : documents;
        const pdfs = await pdfTextsFromDocuments(pool as any, "bank-statements");
        if (!pdfs.length) {
          return res.status(400).json({ error: "No bank statement PDFs on this record to sweep" });
        }
        const combined = pdfs.map((pdf) => pdf.text).join("\n");
        const ratePdfs = await pdfTextsFromDocuments(documents as any, "mca-rates");
        const rateText = ratePdfs.map((pdf) => pdf.text).join("\n");
        const existing = await storage.getDueDiligence(prospectId, prospect.userId);
        const existingData = (existing?.data || {}) as Record<string, any>;
        const underwriting = existingData.underwriting || {};
        const loanAmount = loanAmountPounds(prospect, underwriting);
        const rawRepayment = Number(req.body?.proposedMonthly || underwriting.loanDetails?.monthlyRepayment || 0);
        const proposedMonthly =
          Number(req.body?.proposedMonthly) > 0
            ? Number(req.body.proposedMonthly)
            : rawRepayment > 10000
              ? rawRepayment / 100
              : rawRepayment > 0
                ? rawRepayment
                : loanAmount > 0
                  ? Math.round((loanAmount / 60) * 100) / 100
                  : 0;
        const analysis = analyseBankStatements(combined, { proposedMonthly, rateText });
        const affordabilitySweep = {
          at: new Date().toISOString(),
          files: pdfs.map((pdf) => ({ id: pdf.id, fileName: pdf.fileName, pages: pdf.pages })),
          ...analysis,
        };
        const financialAnalysis = {
          ...(underwriting.financialAnalysis || {}),
          averageMonthlyRevenue: analysis.totals.avgIn,
          averageMonthlyExpenses: analysis.totals.avgOut,
          netDisposableIncome: analysis.totals.avgNet,
          dscr: analysis.dscrCurrent,
          summary: analysis.summary,
          monthlyBreakdown: analysis.months.map((month) => ({
            month: month.label,
            income: month.moneyIn,
            expenses: month.moneyOut,
            net: month.net,
            closingBalance: month.closing,
          })),
        };
        await storage.upsertDueDiligence(prospectId, prospect.userId, {
          ...existingData,
          underwriting: {
            ...underwriting,
            affordabilitySweep,
            financialAnalysis,
            analyzedAt: new Date().toISOString(),
            analysisSource: "pdf",
          },
        } as any);
        res.json({ affordabilitySweep, financialAnalysis });
      } catch (error) {
        handleApiError(res, error, "sweep-statements");
      }
    }
  );

  router.post(
    "/prospects/:prospectId/underwriting/analyze-accounts-documents",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const prospect = await getReadableProspect(req, prospectId);
        if (!prospect) return res.status(404).json({ error: "Prospect not found" });
        const documents = await storage.listProspectDocuments(prospectId);
        const pdfs = await accountPdfsFromDocuments(documents as any);
        const sheets = await spreadsheetTextsFromDocuments(documents as any);
        const spreadsheetText = sheets
          .map((sheet) => `=== FILE ${sheet.fileName} ===\n${sheet.text}`)
          .join("\n\n")
          .slice(0, 40000);
        const existing = await storage.getDueDiligence(prospectId, prospect.userId);
        const existingData = (existing?.data || {}) as Record<string, any>;
        const underwriting = existingData.underwriting || {};
        const statements = parseCreditsafeStatements((prospect as any).company?.creditsafeReport);
        const pdfYears = pdfs.flatMap((pdf) => yearsFromAccountsText(pdf.text, pdf.fileName));
        if (!pdfs.length && !statements.length && !sheets.length) {
          return res.status(400).json({ error: "No accounts PDFs, spreadsheets, or Creditsafe statements on this record" });
        }
        const loanAmount = loanAmountPounds(prospect, underwriting);
        const rawRepayment = Number(req.body?.monthlyRepayment || underwriting.loanDetails?.monthlyRepayment || 0);
        const monthlyRepayment = rawRepayment > 10000 ? rawRepayment / 100 : rawRepayment;
        const financeMonthly = Number(underwriting.affordabilitySweep?.financeMonthly || 0);
        const { analyzeAuditedAccounts } = await import("../utils/geminiClient");
        const combined = [
          JSON.stringify(statements).slice(0, 8000),
          spreadsheetText,
          ...pdfs.map((pdf) => pdf.text),
        ].join("\n---\n");
        let aiSlice = null;
        if (req.body?.consentToAiProcessing) {
          const result = await resultWithin(
            wrapAiRequest(
              {
                userId: req.user!.id,
                prospectId,
                operation: "analyze_accounts",
                dataType: "pdf",
                consentToAiProcessing: true,
              },
              combined,
              async () =>
                analyzeAuditedAccounts(
                  pdfs.map((pdf) => ({ year: pdf.fileName, text: pdf.text })),
                  loanAmount,
                  monthlyRepayment,
                  prospect.notes || "",
                  { creditsafeJson: JSON.stringify(statements), spreadsheetText }
                ),
              { skipRedaction: true }
            ),
            20000,
          );
          if (result && !("error" in result)) aiSlice = result.result;
        }
        const accountsAnalysis = buildAccountsAnalysis({
          statements,
          caseNotes: prospect.notes || "",
          financeMonthly,
          loanPounds: loanAmount,
          pdfYears,
          ai: aiSlice,
        });
        await storage.upsertDueDiligence(prospectId, prospect.userId, {
          ...existingData,
          underwriting: {
            ...underwriting,
            accountsPdfs: pdfs.map((pdf) => ({ year: pdf.fileName, fileName: pdf.fileName, pages: pdf.pages })),
            accountsAnalysis,
            accountsAnalyzedAt: new Date().toISOString(),
          },
        } as any);
        res.json(accountsAnalysis);
      } catch (error) {
        handleApiError(res, error, "analyze-accounts-documents");
      }
    }
  );

  // Parse PDF file to text
  // Note: 7.5MB decoded limit (base64 encoded ~10MB represents ~7.5MB binary)
  const MAX_PDF_DECODED_SIZE = 7.5 * 1024 * 1024; // 7.5MB decoded binary limit

  router.post("/parse-pdf", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { pdfBase64 } = req.body;

      if (!pdfBase64) {
        return res.status(400).json({ error: "PDF data is required" });
      }

      const pdfBuffer = Buffer.from(pdfBase64, "base64");

      if (pdfBuffer.length > MAX_PDF_DECODED_SIZE) {
        return res
          .status(413)
          .json({ error: "PDF exceeds 7.5MB limit. Please use a smaller file." });
      }

      const result = await parsePdfBuffer(pdfBuffer);

      res.json({
        text: result.text,
        pages: result.pages,
        info: {},
      });
    } catch (error: any) {
      console.error("PDF parsing error:", error);
      handleApiError(res, error, "api-error");
    }
  });

  // Analyze Management Accounts with AI commentary
  router.post(
    "/prospects/:prospectId/analyze-management-accounts",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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
        const { analyzeManagementAccounts } = await import("../utils/geminiClient");

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
  router.post(
    "/prospects/:prospectId/underwriting/swot-analysis",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);

        const { consentToAiProcessing } = req.body;

        const prospect = await getReadableProspect(req, prospectId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }
        const ownerId = prospect.userId;
        const existingDd = await storage.getDueDiligence(prospectId, ownerId);
        const ddData = (existingDd?.data || {}) as Record<string, any>;
        const contacts = await storage.listContacts(prospectId, ownerId);
        const fileFacts = buildCreditFileContext({
          prospect,
          dueDiligence: ddData,
          contacts,
          omitSwot: true,
        });
        const companyName = prospect.company.companyName;
        const loanAmount = loanAmountPounds(prospect, ddData.underwriting);
        if (!companyName || !loanAmount) {
          return res
            .status(400)
            .json({ error: "Missing required fields: companyName, loanAmount" });
        }

        const contextData = JSON.stringify({
          companyName,
          loanAmount,
          fileFactsChars: fileFacts.length,
        });

        const { generateSwotAnalysis } = await import("../utils/geminiClient");

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
              prospect.company.sicDescription || "",
              loanAmount,
              prospect.loanRequirementNotes || "",
              "",
              undefined,
              undefined,
              undefined,
              fileFacts
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
        const existing = await storage.getDueDiligence(prospectId, ownerId);
        const existingData = (existing?.data || {}) as Record<string, any>;
        const swotResult = result.result as {
          strengths: string[];
          weaknesses: string[];
          opportunities: string[];
          threats: string[];
          summary: string;
        };
        const proposal = { ...(existingData.proposal || {}) };
        const existingSlots = (proposal.slots || {}) as Record<string, any>;
        const swot = {
          strengths: validateSlot(swotResult.strengths || [], SLOT_CAPS.swot.cap, SLOT_CAPS.swot.maxWords),
          weaknesses: validateSlot(swotResult.weaknesses || [], SLOT_CAPS.swot.cap, SLOT_CAPS.swot.maxWords),
          opportunities: validateSlot(swotResult.opportunities || [], SLOT_CAPS.swot.cap, SLOT_CAPS.swot.maxWords),
          threats: validateSlot(swotResult.threats || [], SLOT_CAPS.swot.cap, SLOT_CAPS.swot.maxWords),
        };
        const swotHasContent =
          swot.strengths.length > 0 ||
          swot.weaknesses.length > 0 ||
          swot.opportunities.length > 0 ||
          swot.threats.length > 0;
        if (!swotHasContent) {
          return res.status(400).json({ error: "SWOT analysis returned no usable content" });
        }
        proposal.slots = {
          ...emptySlots(),
          ...existingSlots,
          campari: {
            ...emptySlots().campari,
            ...(existingSlots.campari || {}),
          },
          swot,
        };
        const mergedData = {
          ...existingData,
          proposal,
          underwriting: {
            ...(existingData.underwriting || {}),
            swotAnalysis: swotResult,
            swotAnalyzedAt: new Date().toISOString(),
          },
        };
        await storage.upsertDueDiligence(prospectId, ownerId, mergedData as any);

        res.json(swotResult);
      } catch (error: any) {
        console.error("SWOT analysis error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  // CAMPARI section AI generation
  router.post(
    "/prospects/:prospectId/underwriting/adviser-recommendation-assist",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);
        const { text = "", action = "draft", consentToAiProcessing } = req.body || {};
        const prospect = await getReadableProspect(req, prospectId);
        if (!prospect) return res.status(404).json({ error: "Prospect not found" });
        if (typeof text !== "string" || text.length > 12000) {
          return res.status(400).json({ error: "Recommendation text must be 12,000 characters or fewer" });
        }
        const key = xaiBearer(process.env);
        if (!key) return res.status(503).json({ error: "Grok is not configured on the server" });
        const existing = await storage.getDueDiligence(prospectId, prospect.userId);
        const ddData = (existing?.data || {}) as Record<string, any>;
        const contacts = await storage.listContacts(prospectId, prospect.userId);
        const fileFacts = buildCreditFileContext({ prospect, dueDiligence: ddData, contacts });
        const { redacted } = redactSensitiveData(text);
        const prompt = action === "improve"
          ? `Improve the adviser recommendation below for a UK commercial finance file. Keep every supported fact and number, remove unsupported claims. Return 4 to 6 short bullet points, one fact per line, no paragraphs.\n\nDRAFT:\n${redacted}`
          : `Draft an adviser recommendation for a UK commercial finance file using only the file facts below. Cover proposed route, key strengths, material risks, and conditions still required. 4 to 6 short bullet points, one fact per line, no paragraphs. Do not invent facts, rates, approvals, or lender decisions.\n\nFILE FACTS:\n${fileFacts}`;
        const contextData = JSON.stringify({ action, textChars: text.length });
        const result = await wrapAiRequest(
          { userId, prospectId, operation: "adviser_recommendation_grok", dataType: "underwriting", consentToAiProcessing: !!consentToAiProcessing },
          contextData,
          async () => {
            const response = await fetch("https://api.x.ai/v1/chat/completions", {
              method: "POST",
              headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
              body: JSON.stringify({
                model: process.env.XAI_MODEL?.trim() || "grok-3-mini",
                temperature: 0.2,
                max_tokens: 1200,
                messages: [
                  { role: "system", content: "You are a careful UK commercial finance adviser writing assistant. Never invent or overstate evidence. Use UK English. The packager does not lend or make the credit decision." },
                  { role: "user", content: prompt },
                ],
              }),
              signal: AbortSignal.timeout(60000),
            });
            if (!response.ok) throw new Error((await response.text()).slice(0, 400) || `Grok request failed (${response.status})`);
            const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
            const content = json.choices?.[0]?.message?.content?.trim();
            if (!content) throw new Error("Grok returned an empty recommendation");
            return joinAiBullets(toAiBullets(content, 6));
          },
        );
        if ("error" in result) return res.status(result.code).json({ error: result.error, requiresConsent: result.code === 403 });
        res.json({ text: result.result, provider: "grok" });
      } catch (error: any) {
        console.error("Grok adviser recommendation error:", error);
        handleApiError(res, error, "grok-recommendation-error");
      }
    },
  );

  router.post(
    "/prospects/:prospectId/underwriting/campari-section",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);

        const { sectionKey, consentToAiProcessing } = req.body;

        const prospect = await getReadableProspect(req, prospectId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }
        const ownerId = prospect.userId;
        const existingDd = await storage.getDueDiligence(prospectId, ownerId);
        const ddData = (existingDd?.data || {}) as Record<string, any>;
        const contacts = await storage.listContacts(prospectId, ownerId);
        const fileFacts = buildCreditFileContext({
          prospect,
          dueDiligence: ddData,
          contacts,
        });
        const companyName = prospect.company.companyName;
        const loanAmount = loanAmountPounds(prospect, ddData.underwriting);

        if (!sectionKey || !companyName || !loanAmount) {
          return res
            .status(400)
            .json({ error: "Missing required fields: sectionKey, companyName, loanAmount" });
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
        for (const doc of relevantDocs.slice(0, AI_GOVERNANCE_CONFIG.maxDocuments)) {
          try {
            const { data } = await getObjectStorage().downloadAsBytes(doc.storagePath);

            if (doc.fileType === "application/pdf" || doc.fileName.toLowerCase().endsWith(".pdf")) {
              const pdfData = await parsePdfBuffer(Buffer.from(data));
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

        const contextData = JSON.stringify({
          sectionKey,
          companyName,
          loanAmount,
          documentCount: documentSummaries.length,
          fileFactsChars: fileFacts.length,
        });

        const { generateCampariSection } = await import("../utils/geminiClient");

        const campariKeys = new Set([
          "character",
          "ability",
          "means",
          "purpose",
          "amount",
          "repayment",
          "insurance",
        ]);
        const slotCapForSection = (key: string) => {
          if (key === "overview") return SLOT_CAPS.theBusiness;
          if (key === "background") return SLOT_CAPS.background;
          if (key === "bank") return SLOT_CAPS.bankFindings;
          if (key === "recommendation") return SLOT_CAPS.recommendation;
          return SLOT_CAPS.campari;
        };

        const result = await wrapAiRequest(
          {
            userId,
            prospectId,
            operation: `campari_section_${sectionKey}`,
            dataType: "documents",
            consentToAiProcessing: !!consentToAiProcessing,
          },
          contextData,
          async () => {
            const content = await generateCampariSection(
              sectionKey,
              companyName,
              prospect.company.sicDescription || "",
              loanAmount,
              prospect.loanRequirementNotes || "",
              "",
              undefined,
              undefined,
              undefined,
              documentSummaries.length > 0 ? documentSummaries : undefined,
              fileFacts
            );
            const { cap, maxWords } = slotCapForSection(sectionKey);
            const bullets = hydrateBulletsFromMarkdown(content, cap, maxWords);
            if (bullets.length === 0) {
              throw new Error("Auto Write returned no usable content");
            }
            return { content: bullets.join("\n"), bullets };
          },
          { skipRedaction: true }
        );

        if ("error" in result) {
          return res.status(result.code).json({
            error: result.error,
            requiresConsent: result.code === 403,
          });
        }

        const { content, bullets } = result.result as { content: string; bullets: string[] };

        // Save to due diligence
        const existing = await storage.getDueDiligence(prospectId, ownerId);
        const existingData = (existing?.data || {}) as Record<string, any>;
        const proposal = { ...(existingData.proposal || {}) };
        const existingSlots = (proposal.slots || {}) as Record<string, any>;
        const slots = {
          ...emptySlots(),
          ...existingSlots,
          campari: {
            ...emptySlots().campari,
            ...(existingSlots.campari || {}),
          },
          swot: {
            ...emptySlots().swot,
            ...(existingSlots.swot || {}),
          },
        };

        if (sectionKey === "overview") {
          slots.theBusiness = bullets;
        } else if (sectionKey === "background") {
          slots.background = bullets;
        } else if (sectionKey === "bank") {
          slots.bankFindings = bullets;
        } else if (sectionKey === "recommendation") {
          slots.recommendation = bullets;
        } else if (campariKeys.has(sectionKey)) {
          slots.campari[sectionKey as keyof typeof slots.campari] = bullets;
        }

        proposal.slots = slots;
        const mergedData = {
          ...existingData,
          proposal,
          underwriting: {
            ...(existingData.underwriting || {}),
            adviserSummary: {
              ...(existingData.underwriting?.adviserSummary || {}),
              sections: {
                ...((existingData.underwriting?.adviserSummary?.sections as any) || {}),
                [sectionKey]: content,
              },
            },
          },
        };
        await storage.upsertDueDiligence(prospectId, ownerId, mergedData as any);

        res.json({ sectionKey, content, bullets });
      } catch (error: any) {
        console.error("CAMPARI section generation error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  router.post(
    "/prospects/:prospectId/underwriting/adverse-media",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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

  // PATCH /api/prospects/:id - Update prospect details (including background)
  router.patch(
    "/prospects/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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

  router.post(
    "/prospects/:prospectId/business-plan",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const prospect = await getReadableProspect(req, prospectId);
        if (!prospect) return res.status(404).json({ error: "Prospect not found" });

        const [contacts, documents, dueDiligence] = await Promise.all([
          storage.listContacts(prospectId),
          storage.listProspectDocuments(prospectId),
          storage.getDueDiligence(prospectId, prospect.userId),
        ]);
        let fundingReason = "";
        try {
          const deals = await storage.listAgenticDeals();
          const deal = deals.find((item: { prospectId?: number; fundingReason?: string }) => item.prospectId === prospectId);
          fundingReason = String(deal?.fundingReason || "");
        } catch {
          /* deal file is optional */
        }
        const research = (prospect as { researchData?: { businessProfile?: string } }).researchData;
        const generated = await generateBbbBusinessPlan({
          companyName: prospect.company.companyName,
          companyNumber: prospect.company.companyNumber,
          registeredAddress: prospect.company.registeredAddress,
          companyStatus: prospect.company.companyStatus,
          sicDescription: prospect.company.sicDescription,
          contacts: contacts.map((contact) => [contact.name, contact.role].filter(Boolean).join(", ")),
          background: prospect.background,
          fundingReason,
          researchProfile: research?.businessProfile,
          documents: documents.map((doc) => doc.fileName),
          loanAmount: loanAmountPounds(prospect, (dueDiligence?.data as any)?.underwriting),
          termMonths: prospect.term,
        });
        const stamp = Date.now();
        const storagePath = `.private/documents/${prospectId}/${stamp}_${generated.fileName.replace(/[^\w.\-]/g, "_")}`;
        await getObjectStorage().uploadFromStream(storagePath, pdfToStream(generated.pdf));
        const document = await storage.createProspectDocument(
          {
            prospectId,
            userId: req.user!.id,
            fileName: generated.fileName,
            fileType: "application/pdf",
            fileSize: generated.pdf.length,
            storagePath,
            category: "business-plan",
            notes: "AI-generated BBB / CDFI business plan",
            status: "pending",
          } as any,
          req.user!.id
        );
        res.status(201).json({ document, fileName: generated.fileName });
      } catch (error) {
        handleApiError(res, error, "business-plan");
      }
    }
  );

  // Prospect Documents - List all documents for a prospect
  router.get(
    "/prospects/:prospectId/documents",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const prospect = await getReadableProspect(req, prospectId);
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

  router.post(
    "/prospects/:prospectId/documents",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = req.user!.id;
      const prospectId = parseInt(req.params.prospectId);

      try {
        const prospect = await getReadableProspect(req, prospectId);
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
  router.post(
    "/prospects/:prospectId/documents/:id/ask",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);
        const documentId = parseInt(req.params.id);
        const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
        if (!question || question.length > 2000) {
          return res.status(400).json({ error: "Enter a question between 1 and 2,000 characters" });
        }
        const prospect = await getReadableProspect(req, prospectId);
        if (!prospect) return res.status(404).json({ error: "Prospect not found" });
        const document = await storage.getProspectDocument(documentId, prospect.userId);
        if (!document || document.prospectId !== prospectId) return res.status(404).json({ error: "Document not found" });

        const { data } = await getObjectStorage().downloadAsBytes(document.storagePath);
        const lowerName = document.fileName.toLowerCase();
        let documentText = "";
        if (document.fileType === "application/pdf" || lowerName.endsWith(".pdf")) {
          documentText = (await parsePdfBuffer(Buffer.from(data))).text || "";
        } else if (isSpreadsheetFile(document.fileName, document.fileType)) {
          documentText = await extractSpreadsheetText(Buffer.from(data), document.fileName);
        } else if (String(document.fileType || "").startsWith("text/") || lowerName.endsWith(".txt")) {
          documentText = Buffer.from(data).toString("utf8");
        } else {
          return res.status(415).json({ error: "AI questions currently support PDF, Excel, CSV, and text documents" });
        }
        documentText = documentText.trim();
        if (!documentText) return res.status(422).json({ error: "No readable text was found in this document" });
        if (Buffer.byteLength(documentText, "utf8") > AI_GOVERNANCE_CONFIG.maxPdfTextSize) {
          return res.status(413).json({ error: "This document is too large to question in one request" });
        }

        const { generateText } = await import("../utils/geminiClient");
        const result = await wrapAiRequest(
          { userId, prospectId, operation: "document_question_answer", dataType: "document", consentToAiProcessing: !!req.body?.consentToAiProcessing },
          documentText,
          async (processedText) => generateText(
            `Answer the question using only the document text below. If the document does not contain the answer, say so in one bullet. Do not infer, invent, or use outside knowledge. Mention the relevant page, section, or heading when the text makes that possible. Return 3 to 6 short bullet points, one fact per line, no paragraphs.\n\nQUESTION:\n${question}\n\nDOCUMENT TEXT:\n${processedText}`,
            undefined,
            "You are an evidence-grounded document assistant for a UK commercial finance case."
          ),
          { maxSize: AI_GOVERNANCE_CONFIG.maxPdfTextSize },
        );
        if ("error" in result) return res.status(result.code).json({ error: result.error, requiresConsent: result.code === 403 });
        res.json({ answer: joinAiBullets(toAiBullets(String(result.result || ""), 6)), fileName: document.fileName });
      } catch (error) {
        handleApiError(res, error, "document-question-error");
      }
    },
  );

  router.get(
    "/prospects/:prospectId/documents/:id/download",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const documentId = parseInt(req.params.id);
        const prospect = await getReadableProspect(req, prospectId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const document = await storage.getProspectDocument(documentId);
        if (!document || document.prospectId !== prospectId) {
          return res.status(404).json({ error: "Document not found" });
        }

        const { data } = await getObjectStorage().downloadAsBytes(document.storagePath);

        // SECURITY: Use sanitized filename to prevent header injection
        const { encodeContentDisposition } = await import("../utils/security");
        res.setHeader("Content-Type", document.fileType);
        res.setHeader("Content-Disposition", encodeContentDisposition(document.fileName));
        res.send(Buffer.from(data));
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Delete a prospect document
  router.patch(
    "/prospects/:prospectId/documents/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);
        const documentId = parseInt(req.params.id);
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) return res.status(404).json({ error: "Prospect not found" });

        const document = await storage.getProspectDocument(documentId);
        if (!document || document.prospectId !== prospectId) {
          return res.status(404).json({ error: "Document not found" });
        }

        const requestedName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
        const requestedCategory = typeof req.body?.category === "string" ? req.body.category.trim() : (document.category || "general");
        if (!requestedName || requestedName.length > 255) {
          return res.status(400).json({ error: "A document name between 1 and 255 characters is required" });
        }

        // This is a display/download name only. Keep storagePath unchanged so existing files remain valid.
        const safeName = requestedName
          .replace(/[\\/]/g, "-")
          .replace(/[\u0000-\u001f\u007f]/g, "")
          .trim();
        if (!safeName) return res.status(400).json({ error: "Document name is invalid" });
        if (!requestedCategory || requestedCategory.length > 80 || !/^[a-z0-9][a-z0-9_-]*$/i.test(requestedCategory)) {
          return res.status(400).json({ error: "Document category is invalid" });
        }

        const updated = await storage.updateProspectDocument(
          documentId,
          { fileName: safeName, category: requestedCategory },
          userId,
        );
        if (!updated) return res.status(404).json({ error: "Document not found" });
        res.json(updated);
      } catch (error) {
        handleApiError(res, error, "rename-document-error");
      }
    },
  );

  router.delete(
    "/prospects/:prospectId/documents/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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
  router.post(
    "/prospects/:id/sync-officers",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: "User not authenticated" });
        }
        const prospectId = parseInt(req.params.id);
        const userId = req.user!.id;

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


export default router;
