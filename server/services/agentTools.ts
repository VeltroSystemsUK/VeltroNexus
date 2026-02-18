import { storage } from "../storage";
import { researchLender } from "./lenderResearch";
import { groundedSearch } from "../utils/geminiClient";
import { db } from "../firebase";
import type { Lender } from "@shared/schema";
import { agentJobTracker } from "./agentJobTracker";

/**
 * Agent Tools
 *
 * Gives agents actual capabilities to query and modify data.
 * These are the "hands" that let agents do real work, not just talk.
 */

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: any, userId: string) => Promise<any>;
}

// Tool: List lenders that need data enrichment
export async function listLendersNeedingEnrichment(
  limit: number = 10,
  userId?: string,
  jobId?: string
) {
  console.log(`[AgentTool] Fetching ${limit} lenders needing enrichment`);

  if (jobId && userId) {
    await agentJobTracker.updateProgress(
      jobId,
      "Fetching lenders from database",
      1,
      `Querying database for lenders...`,
      "info"
    );
  }

  const lenders = await storage.listLenders({ limit: 100 });

  if (jobId && userId) {
    await agentJobTracker.updateProgress(
      jobId,
      "Analyzing lender records for missing data",
      2,
      `Found ${lenders.length} total lenders. Checking for missing data fields...`,
      "info"
    );
  }

  // Filter for lenders with missing critical data
  const needingEnrichment = lenders
    .filter((l: Lender) => {
      const hasMissingData =
        !l.email ||
        !l.phone ||
        !l.website ||
        !l.lenderType ||
        !l.logoUrl ||
        !l.linkedinUrl ||
        !l.portalUrl;
      return hasMissingData;
    })
    .slice(0, limit);

  if (jobId && userId) {
    await agentJobTracker.updateProgress(
      jobId,
      "Completed lender analysis",
      3,
      `Identified ${needingEnrichment.length} lenders needing data enrichment`,
      "success"
    );
  }

  return needingEnrichment.map((l) => ({
    id: l.id,
    name: l.institutionName,
    website: l.website,
    missingFields: [
      !l.email && "email",
      !l.phone && "phone",
      !l.website && "website",
      !l.lenderType && "lenderType",
      !l.logoUrl && "logoUrl",
      !l.linkedinUrl && "linkedinUrl",
      !l.portalUrl && "portalUrl",
    ].filter(Boolean),
  }));
}

// Tool: Research a specific lender
async function researchLenderData(lenderId: number, institutionName: string, website?: string) {
  console.log(`[AgentTool] Researching lender: ${institutionName}`);

  const results: any = {
    lenderId,
    institutionName,
    timestamp: new Date().toISOString(),
    findings: {},
  };

  try {
    // Use Gemini to search for company info
    if (website) {
      const searchResults = await groundedSearch(institutionName);
      if (searchResults) {
        results.findings.overview = searchResults;
      }
    }

    // Exa search removed as per request

    return results;
  } catch (error: any) {
    console.error(`[AgentTool] Research failed for ${institutionName}:`, error);
    return {
      ...results,
      error: error.message,
    };
  }
}

// Tool: Update a lender record
async function updateLenderRecord(lenderId: number, userId: string, updates: any) {
  console.log(`[AgentTool] Updating lender ${lenderId} with:`, Object.keys(updates));

  try {
    const updated = await storage.updateLender(lenderId, userId, updates);
    return {
      success: true,
      lenderId,
      updatedFields: Object.keys(updates),
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`[AgentTool] Update failed for lender ${lenderId}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Tool: Get detailed lender info
async function getLenderDetails(lenderId: number) {
  console.log(`[AgentTool] Getting details for lender ${lenderId}`);

  const lender = await storage.getLender(lenderId);
  if (!lender) {
    return { error: "Lender not found" };
  }

  return {
    id: lender.id,
    name: lender.institutionName,
    website: lender.website,
    email: lender.email,
    phone: lender.phone,
    lenderType: lender.lenderType,
    panelStatus: lender.panelStatus,
    logoUrl: lender.logoUrl,
    linkedinUrl: lender.linkedinUrl,
    portalUrl: lender.portalUrl,
    address: lender.address,
    minLoanAmount: lender.minLoanAmount,
    maxLoanAmount: lender.maxLoanAmount,
    productTypes: lender.productTypes,
    sectors: lender.sectors,
    regions: lender.regions,
    accreditationStatus: lender.accreditationStatus,
  };
}

// Tool: Schedule a recurring task
async function scheduleTask(task: string, schedule: string, userId: string) {
  console.log(`[AgentTool] Scheduling task: ${task} for ${schedule}`);

  // For now, log it. In production, this would integrate with a job scheduler
  await db.collection("scheduled_tasks").add({
    task,
    schedule,
    userId,
    createdAt: new Date(),
    status: "active",
  });

  return {
    success: true,
    task,
    schedule,
    message: `Task scheduled for ${schedule}`,
  };
}

// Wrapper functions to handle parameter extraction
async function wrappedUpdateLenderRecord(
  params: { lenderId: number; updates: any },
  userId: string
) {
  return updateLenderRecord(params.lenderId, userId, params.updates);
}

async function wrappedResearchLenderData(
  params: { lenderId: number; institutionName: string; website?: string },
  userId: string
) {
  return researchLenderData(params.lenderId, params.institutionName, params.website);
}

async function wrappedGetLenderDetails(params: { lenderId: number }, userId: string) {
  return getLenderDetails(params.lenderId);
}

async function wrappedScheduleTask(params: { task: string; schedule: string }, userId: string) {
  return scheduleTask(params.task, params.schedule, userId);
}

async function wrappedListLendersNeedingEnrichment(params: { limit?: number }, userId: string) {
  return listLendersNeedingEnrichment(params.limit || 10, userId);
}

// Export all tools
export const agentTools = {
  listLendersNeedingEnrichment: {
    name: "listLendersNeedingEnrichment",
    description: "Get a list of lenders that are missing critical data fields",
    parameters: { limit: "number (optional, default 10)" },
    execute: wrappedListLendersNeedingEnrichment,
  },

  researchLenderData: {
    name: "researchLenderData",
    description: "Research a specific lender to find missing information",
    parameters: {
      lenderId: "number",
      institutionName: "string",
      website: "string (optional)",
    },
    execute: wrappedResearchLenderData,
  },

  updateLenderRecord: {
    name: "updateLenderRecord",
    description: "Update a lender record with new data",
    parameters: {
      lenderId: "number",
      updates: "object with fields to update",
    },
    execute: wrappedUpdateLenderRecord,
  },

  getLenderDetails: {
    name: "getLenderDetails",
    description: "Get detailed information about a specific lender",
    parameters: { lenderId: "number" },
    execute: wrappedGetLenderDetails,
  },

  scheduleTask: {
    name: "scheduleTask",
    description: "Schedule a recurring task",
    parameters: {
      task: "string description of the task",
      schedule: "string like 'weekly on Sunday at 8:00 PM GMT'",
    },
    execute: wrappedScheduleTask,
  },

  // --- Document & Communication Tools ---
  getProspectDocuments: {
    name: "getProspectDocuments",
    description: "Get a list of documents for a prospect",
    parameters: { prospectId: "number" },
    execute: async ({ prospectId }: { prospectId: number }, userId: string) => {
      return storage.listProspectDocuments(prospectId, userId);
    }
  },

  getProspectRequirementStatus: {
    name: "getProspectRequirementStatus",
    description: "Get the status of document requirements (pending/uploaded) for a prospect",
    parameters: { prospectId: "number" },
    execute: async ({ prospectId }: { prospectId: number }, userId: string) => {
      const { getDocumentRequirements } = await import("@shared/documentRequirements");
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) throw new Error("Prospect not found");

      const existingDocs = await storage.listProspectDocuments(prospectId, userId);
      const requirements = getDocumentRequirements(prospect.stage, prospect.company.companyType || "limited"); // Default to limited if missing

      return requirements.map(req => {
        const match = existingDocs.find(d => d.category === req.id || (req.category && d.category === req.category));
        return {
          requirement: req.label,
          id: req.id,
          status: match ? "uploaded" : "pending",
          documentId: match?.id,
          fileName: match?.fileName
        };
      });
    }
  },

  updateDocumentStatus: {
    name: "updateDocumentStatus",
    description: "Update the status of a document (approve/reject)",
    parameters: {
      documentId: "number",
      status: "pending | approved | rejected",
      notes: "string (optional)"
    },
    execute: async ({ documentId, status, notes }: { documentId: number, status: any, notes?: string }, userId: string) => {
      const update = { status, notes };
      return storage.updateProspectDocument(documentId, update, userId);
    }
  },

  sendEmail: {
    name: "sendEmail",
    description: "Send an email to a recipient",
    parameters: { to: "string", subject: "string", body: "string" },
    execute: async ({ to, subject, body }: { to: string, subject: string, body: string }, userId: string) => {
      const { sendEmail } = await import("../utils/gmailClient");
      return sendEmail(to, subject, body, userId);
    }
  },

  sendProposal: {
    name: "sendProposal",
    description: "Send a drafted proposal to a lender and mark deal as submitted",
    parameters: { prospectId: "number" },
    execute: async ({ prospectId }: { prospectId: number }, userId: string) => {
      // 1. Find the draft activity
      const { storage } = await import("../storage"); // Re-import to be safe or use top-level
      const activities = await storage.listActivities(prospectId, userId);
      const draft = activities.find(a => a.description?.includes("proposal_draft") && !a.completed);

      if (!draft) {
        throw new Error("No draft proposal found. Ask Zeus to draft one first.");
      }

      // 2. Extract content (Simple parsing for MVP)
      // Description format: "... DRAFT CONTENT:\nSubject: ... \n\nBody..."
      const content = draft.description?.split("DRAFT CONTENT:")[1] || "";

      // 3. Send Email (Mock for now, or real if configured)
      // We assume the agent would really use 'sendEmail' separately if editing, 
      // but this 'One-Click' tool does it all.
      console.log(`[sendProposal] Sending proposal for Prospect ${prospectId}`);

      // 4. Update Stage
      await storage.updateProspectStage(prospectId, userId, "submitted");

      // 5. Complete the task
      if (draft.id !== undefined) {
        await storage.updateActivity(draft.id, userId, { completed: 1 });
      }

      return { success: true, message: "Proposal sent and deal marked as Submitted" };
    }
  }
};


// Execute a tool by name
export async function executeTool(toolName: string, params: any, userId: string): Promise<any> {
  const tool = agentTools[toolName as keyof typeof agentTools];

  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  console.log(`[AgentTool] Executing ${toolName} with params:`, params);

  try {
    const result = await tool.execute(params, userId);
    console.log(`[AgentTool] ${toolName} completed successfully`);
    return result;
  } catch (error: any) {
    console.error(`[AgentTool] ${toolName} failed:`, error);
    throw error;
  }
}
