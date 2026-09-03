import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { agentService } from "../services/agentService";
import { agentRunner } from "../services/agentRunner";
import { DigitalAssociate } from "@shared/agents";

const router = Router();

  // --- AI WORKFORCE PLATFORM ROUTES ---

  // Get active workforce roster
  router.get("/workforce", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const roster = await storage.getAgents();
      res.json(roster);
    } catch (error) {
      handleApiError(res, error, "get-workforce");
    }
  });

  // Get recent mission deviations (Shadow Audit log)
  // IMPORTANT: This must be registered BEFORE /workforce/:id to avoid :id catching "deviations"
  router.get(
    "/workforce/deviations",
    isAuthenticated,
    async (req: Request, res: Response) => {
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
  router.get(
    "/workforce/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
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
  router.post(
    "/workforce/:agentId/run",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { agentId } = req.params;
        const { instruction, context } = req.body;
        const userId = req.user!.id;

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
  router.put(
    "/workforce/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
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
  router.delete(
    "/workforce/:id",
    isAuthenticated,
    async (req: Request, res: Response) => {
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
  router.get(
    "/workforce/:agentId/chats",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { agentId } = req.params;
        const userId = req.user!.id;
        const limit = parseInt(req.query.limit as string) || 50;

        const messages = await storage.getAgentChatHistory(agentId, userId, limit);
        res.json(messages);
      } catch (error) {
        handleApiError(res, error, "get-agent-chats");
      }
    }
  );

  // Clear chat history for an agent
  router.delete(
    "/workforce/:agentId/chats",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { agentId } = req.params;
        const userId = req.user!.id;

        await storage.clearAgentChatHistory(agentId, userId);
        res.json({ success: true, message: "Chat history cleared" });
      } catch (error) {
        handleApiError(res, error, "clear-agent-chats");
      }
    }
  );

  // Create a new agent
  router.post("/workforce", isAuthenticated, async (req: Request, res: Response) => {
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
  router.get("/agent-jobs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { agentJobTracker } = await import("../services/agentJobTracker");
      const jobs = await agentJobTracker.getJobsForUser(req.user!.id, 20);
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching agent jobs:", error);
      res.status(500).json({ error: "Failed to fetch agent jobs" });
    }
  });

  router.get(
    "/agent-jobs/running",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { agentJobTracker } = await import("../services/agentJobTracker");
        const jobs = await agentJobTracker.getRunningJobs(req.user!.id);
        res.json(jobs);
      } catch (error) {
        console.error("Error fetching running jobs:", error);
        res.status(500).json({ error: "Failed to fetch running jobs" });
      }
    }
  );

  router.get(
    "/agent-jobs/:jobId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { agentJobTracker } = await import("../services/agentJobTracker");
        const job = await agentJobTracker.getJob(req.params.jobId);
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
        // Verify user owns this job
        const { jobVisibleToUser } = await import("../services/agentJobTracker");
        if (!jobVisibleToUser(job, req.user!.id)) {
          return res.status(403).json({ error: "Access denied" });
        }
        res.json(job);
      } catch (error) {
        console.error("Error fetching agent job:", error);
        res.status(500).json({ error: "Failed to fetch agent job" });
      }
    }
  );

  router.delete(
    "/agent-jobs/:jobId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { agentJobTracker } = await import("../services/agentJobTracker");
        const job = await agentJobTracker.getJob(req.params.jobId);
        if (!job) {
          return res.status(404).json({ error: "Job not found" });
        }
        // Verify user owns this job
        const { jobVisibleToUser } = await import("../services/agentJobTracker");
        if (!jobVisibleToUser(job, req.user!.id)) {
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

  async function stopAgentJob(req: Request, res: Response, action: "pause" | "complete") {
    try {
      const { agentJobTracker, jobVisibleToUser } = await import("../services/agentJobTracker");
      const job = await agentJobTracker.getJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      if (!jobVisibleToUser(job, req.user!.id)) {
        return res.status(403).json({ error: "Access denied" });
      }
      const next = action === "pause"
        ? await agentJobTracker.pauseJob(req.params.jobId)
        : await agentJobTracker.earlyCompleteJob(req.params.jobId);
      if (!next) {
        return res.status(409).json({ error: "Job is not running" });
      }
      res.json(next);
    } catch (error) {
      console.error(`Error ${action === "pause" ? "pausing" : "completing"} agent job:`, error);
      res.status(500).json({ error: action === "pause" ? "Failed to pause agent job" : "Failed to complete agent job" });
    }
  }

  router.post(
    "/agent-jobs/:jobId/pause",
    isAuthenticated,
    async (req: Request, res: Response) => {
      await stopAgentJob(req, res, "pause");
    }
  );

  router.post(
    "/agent-jobs/:jobId/complete",
    isAuthenticated,
    async (req: Request, res: Response) => {
      await stopAgentJob(req, res, "complete");
    }
  );

export default router;
