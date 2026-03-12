import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { fromZodError } from "zod-validation-error";
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
import { createErrorResponse } from "../utils/errorResponse";
import { getSicDescription } from "../utils/sicCodeLookup";
import { generatePipelineExcel } from "../utils/excelExporter";
import { formatOfficerName } from "../utils/formatters";
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

      const userId = req.user!.id;

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
  router.post("/prospects/:id/documents/upload", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const prospectId = parseInt(req.params.id);
      const category = req.body.category || "general";
      const userId = req.user!.id; // Assuming user is populated

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
      const userId = req.user!.id;
      const docs = await storage.listProspectDocuments(prospectId, userId);
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
    "/api/prospects/count",
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
    "/api/prospects/export/excel",
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
    "/api/prospects/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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
    "/api/prospects/:id/stage",
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
    "/api/prospects/reorder",
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
    "/api/prospects/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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

  router.delete(
    "/api/prospects/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const id = parseInt(req.params.id);

        await storage.deleteProspect(id, userId);
        res.status(204).send();
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  router.get(
    "/api/prospects/:id/report",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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
          await import("../utils/pdfGenerator");

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
        // const { encodeContentDisposition } = await import("../utils/security");
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
  router.get(
    "/api/prospects/:id/business-overview",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const id = parseInt(req.params.id);

        const prospect = await storage.getProspect(id, userId);
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

  // Enhanced PDF report with business overview
  router.get(
    "/api/prospects/:id/report-enhanced",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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
            const industry =
              prospect.company.sicDescription || prospect.company.sicCode || undefined;
            const result = await groundedSearch(
              `${prospect.company.companyName} UK business overview${industry ? ` ${industry} industry` : ''}`
            );
            businessOverview = result.bulletPoints;
          } catch (overviewError) {
            console.error("[PDF Report] Business overview fetch error:", overviewError);
          }
        }

        const { createProspectReportDocument, renderProspectReport } =
          await import("../utils/pdfGenerator");

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

        const { encodeContentDisposition } = await import("../utils/security");
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


  // Contact enrichment - search web and email inbox for contact info
  router.get(
    "/api/prospects/:prospectId/contacts",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        if (!req.user) return res.status(401).send("Not authenticated");
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user!.id;
        const contacts = await storage.listContacts(prospectId, userId);
        res.json(contacts);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );


  router.post(
    "/api/prospects/:prospectId/contacts",
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
        const company = await storage.getCompany(prospect.companyId!);
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
    "/api/prospects/:prospectId/due-diligence",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user!.id;
        const dueDiligenceData = await storage.getDueDiligence(prospectId, userId);
        res.json(dueDiligenceData || { prospectId, data: {} });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  router.patch(
    "/api/prospects/:prospectId/due-diligence",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const prospectId = parseInt(req.params.prospectId);
        const userId = req.user!.id;
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

  router.post(
    "/api/prospects/:prospectId/underwriting/analyze-csv",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);
        const { csvData, loanAmount, monthlyRepayment, consentToAiProcessing } = req.body;

        if (!csvData || !loanAmount || !monthlyRepayment) {
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
    "/api/prospects/:prospectId/due-diligence",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);

        const dueDiligence = await storage.getDueDiligence(prospectId, userId);
        res.json(dueDiligence?.data || {});
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Save due diligence data
  router.post(
    "/api/prospects/:prospectId/due-diligence",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);

        const dueDiligence = await storage.upsertDueDiligence(prospectId, userId, req.body);
        res.json(dueDiligence);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Analyze bank statement PDFs (alternative to CSV)
  router.post(
    "/api/prospects/:prospectId/underwriting/analyze-bank-pdfs",
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
    "/api/prospects/:prospectId/underwriting/analyze-accounts",
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

  router.post("/parse-pdf", isAuthenticated, async (req: Request, res: Response) => {
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
  router.post(
    "/api/prospects/:prospectId/analyze-management-accounts",
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
    "/api/prospects/:prospectId/underwriting/swot-analysis",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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
  router.post(
    "/api/prospects/:prospectId/underwriting/campari-section",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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
        const { generateCampariSection } = await import("../utils/geminiClient");

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

  router.post(
    "/api/prospects/:prospectId/underwriting/adverse-media",
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
    "/api/prospects/:id",
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

  // Prospect Documents - List all documents for a prospect
  router.get(
    "/api/prospects/:prospectId/documents",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
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

  router.post(
    "/api/prospects/:prospectId/documents",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = req.user!.id;
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
  router.get(
    "/api/prospects/:prospectId/documents/:id/download",
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
  router.delete(
    "/api/prospects/:prospectId/documents/:id",
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
    "/api/prospects/:id/sync-officers",
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
