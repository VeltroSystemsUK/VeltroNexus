import { agentJobTracker } from "./agentJobTracker";
import { agentRunner } from "./agentRunner";
import { storage } from "../storage";
import { listLendersNeedingEnrichment } from "./agentTools";
import type { DigitalAssociate } from "@shared/agents";

/**
 * ARES Control Center
 * 
 * The autonomous orchestration layer that manages the AI workforce.
 * Handles task assignment, scheduling, and performance monitoring.
 */

interface TaskAssignment {
    taskId: string;
    agentId: string;
    priority: number;
    estimatedDuration: number;
}

interface AgentMetrics {
    agentId: string;
    agentName: string;
    successRate: number;
    averageJobTime: number;
    totalJobs: number;
    failedJobs: number;
    currentLoad: number;
}

export class AresControlCenter {
    /**
     * Assigns a task to the best available agent
     */
    async assignTask(
        taskType: string,
        instruction: string,
        userId: string
    ): Promise<TaskAssignment> {
        console.log(`[ARES] Assigning task: ${taskType}`);

        // Get all available agents
        const agents = await storage.getAgents();

        // Get agent metrics to find best fit
        const metrics = await this.getAgentMetrics(userId);

        // Simple load balancing: pick agent with lowest current load
        const bestAgent = metrics.reduce((best, current) =>
            current.currentLoad < best.currentLoad ? current : best
        );

        console.log(`[ARES] Selected agent: ${bestAgent.agentName} (load: ${bestAgent.currentLoad})`);

        // Execute the task
        await agentRunner.runInstruction(bestAgent.agentId, userId, instruction);

        return {
            taskId: `task-${Date.now()}`,
            agentId: bestAgent.agentId,
            priority: 1,
            estimatedDuration: bestAgent.averageJobTime,
        };
    }

    /**
     * Gets performance metrics for all agents
     */
    async getAgentMetrics(userId: string): Promise<AgentMetrics[]> {
        const agents = await storage.getAgents();
        const jobs = await agentJobTracker.getJobsForUser(userId, 100);

        return agents.map((agent: any) => {
            const agentJobs = jobs.filter((job) => job.agentId === agent.id);
            const completedJobs = agentJobs.filter((job) => job.status === "completed");
            const failedJobs = agentJobs.filter((job) => job.status === "failed");
            const runningJobs = agentJobs.filter((job) => job.status === "running");

            // Calculate average job time for completed jobs
            const avgTime = completedJobs.length > 0
                ? completedJobs.reduce((sum, job) => {
                    const start = new Date(job.startedAt).getTime();
                    const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
                    return sum + (end - start);
                }, 0) / completedJobs.length
                : 30000; // Default 30 seconds

            return {
                agentId: agent.id,
                agentName: agent.name,
                successRate: agentJobs.length > 0
                    ? (completedJobs.length / agentJobs.length) * 100
                    : 100,
                averageJobTime: Math.round(avgTime / 1000), // Convert to seconds
                totalJobs: agentJobs.length,
                failedJobs: failedJobs.length,
                currentLoad: runningJobs.length,
            };
        }).filter((m: any) => m.agentName); // Filter out any invalid agents
    }

    /**
     * Schedules autonomous daily lender enrichment
     */
    async scheduleDailyEnrichment(userId: string): Promise<void> {
        console.log("[ARES] Scheduling daily lender enrichment");

        // Find lenders that need enrichment
        const lenders = await listLendersNeedingEnrichment(10, userId);

        if (lenders.length === 0) {
            console.log("[ARES] No lenders need enrichment currently");
            return;
        }

        // Assign to best available agent
        await this.assignTask(
            "data_enrichment",
            `Enrich the following ${lenders.length} lenders: ${lenders.map(l => l.name).join(", ")}`,
            userId
        );

        console.log(`[ARES] Scheduled enrichment for ${lenders.length} lenders`);
    }

    /**
     * Pipeline Driver
     * Proactively checks for stage progression criteria and promotes prospects.
     */
    async runPipelineDriver(userId: string): Promise<void> {
        console.log("[ARES] Running Pipeline Driver...");

        try {
            // 1. Fetch active prospects in 'onboarding' stage
            const onboardingProspects = await storage.listProspects(userId, "onboarding");
            console.log(`[ARES] Pipeline: Checking ${onboardingProspects.length} onboarding prospects.`);

            const { agentTools } = await import("./agentTools");
            const { zeusService } = await import("./zeusService");

            for (const prospect of onboardingProspects) {
                if (!prospect.id) continue;
                // 2. Check Exit Criteria: Are documents complete?
                const requirementStatus = await agentTools.getProspectRequirementStatus.execute({ prospectId: prospect.id }, userId);
                const isComplete = requirementStatus.every((r: { status: string }) => r.status === "uploaded");

                if (isComplete) {
                    console.log(`[ARES] Auto-Promoting Prospect ${prospect.id} to Underwriting`);

                    // 3. Promote to Underwriting
                    await storage.updateProspectStage(prospect.id, userId, "underwriting");

                    // 4. Trigger Zeus: Smart Underwriting Enhancement
                    // This analyzes financials and prepares the draft
                    await zeusService.performSmartUnderwritingEnhancement(prospect.id, userId);
                }
            }

            // Future: Add checks for other stages (e.g. Lead -> Onboarding)
        } catch (error) {
            console.error("[ARES] Pipeline Driver failed:", error);
        }
    }

    /**
     * Runs the autonomous orchestration loop
     */
    async runAutonomousLoop(userId: string): Promise<void> {
        console.log("[ARES] Starting autonomous orchestration loop");

        try {
            // 1. Pipeline Driver (New Layer)
            await this.runPipelineDriver(userId);

            // 2. Discover new prospects (20/day)
            console.log("[ARES] Step 2: Discovering new prospects");
            const { prospectDiscovery } = await import("./prospectDiscovery");
            const prospects = await prospectDiscovery.discoverProspects(20, userId);
            console.log(`[ARES] Discovered ${prospects.length} new prospects`);

            // 3. Daily lender enrichment
            console.log("[ARES] Step 3: Running lender enrichment");
            await this.scheduleDailyEnrichment(userId);

            // 4. Monitor agent health
            const metrics = await this.getAgentMetrics(userId);
            console.log(`[ARES] Agent Health: ${metrics.map(m =>
                `${m.agentName}: ${m.successRate.toFixed(1)}% success, ${m.currentLoad} active jobs`
            ).join(" | ")}`);

            console.log("[ARES] Autonomous loop complete");
        } catch (error) {
            console.error("[ARES] Autonomous loop failed:", error);
        }
    }
}

export const aresControlCenter = new AresControlCenter();
