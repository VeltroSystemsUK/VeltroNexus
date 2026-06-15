import fs from "fs";
import path from "path";
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

const JOBS_FILE_PATH = path.resolve(process.cwd(), "uploads", "agent_jobs.json");

function readJobs(): Record<string, AgentJob> {
  try {
    if (!fs.existsSync(JOBS_FILE_PATH)) {
      const dir = path.dirname(JOBS_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(JOBS_FILE_PATH, JSON.stringify({}));
      return {};
    }
    const data = fs.readFileSync(JOBS_FILE_PATH, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("[JobTracker] Error reading jobs file:", err);
    return {};
  }
}

function writeJobs(jobs: Record<string, AgentJob>) {
  try {
    const dir = path.dirname(JOBS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(JOBS_FILE_PATH, JSON.stringify(jobs, null, 2));
  } catch (err) {
    console.error("[JobTracker] Error writing jobs file:", err);
  }
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
    const job: AgentJob = {
      id: jobId,
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

    const jobs = readJobs();
    jobs[jobId] = job;
    writeJobs(jobs);

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
    const jobs = readJobs();
    const job = jobs[jobId];
    if (!job) return;

    job.currentStep = step;
    job.completedSteps = completedSteps;
    job.logs.push({
      timestamp: new Date(),
      message: logMessage,
      type: logType,
    });

    writeJobs(jobs);
    console.log(`[JobTracker] Job ${jobId}: ${logMessage}`);
  }

  async completeJob(jobId: string, results: any): Promise<void> {
    const jobs = readJobs();
    const job = jobs[jobId];
    if (!job) return;

    job.status = "completed";
    job.completedSteps = job.totalSteps;
    job.currentStep = "Completed";
    job.results = results;
    job.completedAt = new Date();
    job.logs.push({
      timestamp: new Date(),
      message: "Job completed successfully",
      type: "success",
    });

    writeJobs(jobs);
    console.log(`[JobTracker] Job ${jobId} completed`);
  }

  async failJob(jobId: string, error: string): Promise<void> {
    const jobs = readJobs();
    const job = jobs[jobId];
    if (!job) return;

    job.status = "failed";
    job.currentStep = "Failed";
    job.completedAt = new Date();
    job.logs.push({
      timestamp: new Date(),
      message: `Job failed: ${error}`,
      type: "error",
    });

    writeJobs(jobs);
    console.log(`[JobTracker] Job ${jobId} failed: ${error}`);
  }

  async getJob(jobId: string): Promise<AgentJob | null> {
    const jobs = readJobs();
    return jobs[jobId] || null;
  }

  async getJobsForUser(userId: string, limit: number = 10): Promise<AgentJob[]> {
    const jobs = readJobs();
    const userJobs = Object.values(jobs).filter((job) => job.userId === userId);
    return userJobs
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  async getRunningJobs(userId: string): Promise<AgentJob[]> {
    const jobs = readJobs();
    const runningJobs = Object.values(jobs).filter(
      (job) => job.userId === userId && job.status === "running"
    );
    return runningJobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async deleteJob(jobId: string): Promise<void> {
    const jobs = readJobs();
    if (jobs[jobId]) {
      delete jobs[jobId];
      writeJobs(jobs);
      console.log(`[JobTracker] Deleted job ${jobId}`);
    }
  }
}

export const agentJobTracker = new AgentJobTracker();
