import { db } from "../firebase";
import { v4 as uuidv4 } from "uuid";

export interface AgentJob {
  id: string;
  agentId: string;
  userId: string;
  type: "data_enrichment" | "research" | "update" | "scheduled_task";
  status: "pending" | "running" | "completed" | "failed";
  title: string;
  description: string;
  totalSteps: number;
  completedSteps: number;
  currentStep: string;
  logs: Array<{
    timestamp: Date;
    message: string;
    type: "info" | "success" | "warning" | "error";
  }>;
  results: any;
  startedAt: Date;
  completedAt?: Date;
}

export class AgentJobTracker {
  async createJob(
    agentId: string,
    userId: string,
    type: AgentJob["type"],
    title: string,
    description: string,
    totalSteps: number
  ): Promise<string> {
    const jobId = uuidv4();
    const job: Omit<AgentJob, "id"> = {
      agentId,
      userId,
      type,
      status: "running",
      title,
      description,
      totalSteps,
      completedSteps: 0,
      currentStep: "Initializing...",
      logs: [
        {
          timestamp: new Date(),
          message: `Job started: ${title}`,
          type: "info",
        },
      ],
      results: null,
      startedAt: new Date(),
    };

    await db.collection("agent_jobs").doc(jobId).set(job);
    console.log(`[JobTracker] Created job ${jobId}: ${title}`);
    return jobId;
  }

  async updateProgress(
    jobId: string,
    step: string,
    completedSteps: number,
    logMessage: string,
    logType: "info" | "success" | "warning" | "error" = "info"
  ): Promise<void> {
    const admin = await import("firebase-admin");
    const jobRef = db.collection("agent_jobs").doc(jobId);

    await jobRef.update({
      currentStep: step,
      completedSteps: completedSteps,
      logs: admin.firestore.FieldValue.arrayUnion({
        timestamp: new Date(),
        message: logMessage,
        type: logType,
      }),
    });

    console.log(`[JobTracker] Job ${jobId}: ${logMessage}`);
  }

  async completeJob(jobId: string, results: any): Promise<void> {
    const jobRef = db.collection("agent_jobs").doc(jobId);
    const job = await jobRef.get();

    if (!job.exists) return;

    const jobData = job.data() as AgentJob;

    await jobRef.update({
      status: "completed",
      completedSteps: jobData.totalSteps,
      currentStep: "Completed",
      results: results,
      completedAt: new Date(),
      logs: [
        ...jobData.logs,
        {
          timestamp: new Date(),
          message: "Job completed successfully",
          type: "success",
        },
      ],
    });

    console.log(`[JobTracker] Job ${jobId} completed`);
  }

  async failJob(jobId: string, error: string): Promise<void> {
    const jobRef = db.collection("agent_jobs").doc(jobId);
    const job = await jobRef.get();

    if (!job.exists) return;

    const jobData = job.data() as AgentJob;

    await jobRef.update({
      status: "failed",
      currentStep: "Failed",
      completedAt: new Date(),
      logs: [
        ...jobData.logs,
        {
          timestamp: new Date(),
          message: `Job failed: ${error}`,
          type: "error",
        },
      ],
    });

    console.log(`[JobTracker] Job ${jobId} failed: ${error}`);
  }

  async getJob(jobId: string): Promise<AgentJob | null> {
    const job = await db.collection("agent_jobs").doc(jobId).get();
    if (!job.exists) return null;
    return { id: job.id, ...job.data() } as AgentJob;
  }

  async getJobsForUser(userId: string, limit: number = 10): Promise<AgentJob[]> {
    const snapshot = await db
      .collection("agent_jobs")
      .where("userId", "==", userId)
      .get();

    // Sort and limit in-memory to avoid composite index requirement
    const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AgentJob);
    return jobs
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  async getRunningJobs(userId: string): Promise<AgentJob[]> {
    const snapshot = await db
      .collection("agent_jobs")
      .where("userId", "==", userId)
      .where("status", "==", "running")
      .get();

    // Sort in-memory to avoid composite index requirement
    const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AgentJob);
    return jobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async deleteJob(jobId: string): Promise<void> {
    await db.collection("agent_jobs").doc(jobId).delete();
    console.log(`[JobTracker] Deleted job ${jobId}`);
  }
}

export const agentJobTracker = new AgentJobTracker();
