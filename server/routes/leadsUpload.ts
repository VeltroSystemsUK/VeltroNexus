import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { insertMarketingContactSchema } from "@shared/schema";
import { zeusService } from "../services/zeusService";
import { getSicDescription } from "../utils/sicCodeLookup";
import { formatAddress } from "../utils/formatters";
import { parseCSVLine } from "../utils/routerHelpers";
import { mailIsSuppressed } from "../services/mailDesk";

interface AuthenticatedRequest extends Request {
  user?: any;
}

const router = Router();

// Get all lead uploads for the user
router.get(
  "/leads/uploads",
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
router.post(
  "/leads/uploads",
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

        if (mailIsSuppressed(leadData.email || leadData.contactEmail, leadData.companyNumber)) {
          errors.push({ row: i + 1, message: "Do not contact" });
          continue;
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

// Get all leads for the user
router.get("/leads", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
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
router.get("/leads/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
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
router.patch("/leads/:id", isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
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
router.delete(
  "/leads/:id",
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
router.delete(
  "/leads/uploads/:id",
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id);

      await storage.deleteLeadsByUpload(id, userId);
      res.status(204).send();
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  }
);

// Create prospect from lead
router.post(
  "/leads/:id/prospects",
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

export default router;
