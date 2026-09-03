import { describe, expect, it } from "vitest";
import {
  FACTORY_JOB_USER,
  applyJobStop,
  applyStoppedJobResults,
  harvestPassBlocked,
  jobVisibleToUser,
  type AgentJob,
} from "../../services/agentJobTracker";

describe("factory harvest jobs", () => {
  it("shows factory harvest jobs to the signed-in director", () => {
    expect(jobVisibleToUser({ userId: FACTORY_JOB_USER }, "user-1")).toBe(true);
    expect(jobVisibleToUser({ userId: "user-1" }, "user-1")).toBe(true);
    expect(jobVisibleToUser({ userId: "user-2" }, "user-1")).toBe(false);
  });
});

function runningJob(overrides: Partial<AgentJob> = {}): AgentJob {
  return {
    id: "job-1",
    agentId: "enrichment-agent",
    userId: "user-1",
    type: "data_enrichment",
    status: "running",
    title: "Bulk Lead Enrichment",
    description: "Enriching 100 leads",
    totalSteps: 100,
    completedSteps: 40,
    currentStep: "Enriching Acme Ltd...",
    logs: [{ timestamp: new Date("2026-09-03T08:00:00.000Z"), message: "started", type: "info" }],
    results: null,
    startedAt: new Date("2026-09-03T08:00:00.000Z"),
    ...overrides,
  };
}

describe("applyJobStop", () => {
  const at = new Date("2026-09-03T09:00:00.000Z");

  it("pauses a running job without discarding progress", () => {
    const next = applyJobStop(runningJob(), "pause", at);
    expect(next?.status).toBe("paused");
    expect(next?.completedSteps).toBe(40);
    expect(next?.currentStep).toBe("Paused");
    expect(next?.completedAt).toEqual(at);
    expect(next?.logs.at(-1)?.message).toMatch(/paused by director/i);
  });

  it("early-completes a running job at the current step count", () => {
    const next = applyJobStop(runningJob(), "complete", at);
    expect(next?.status).toBe("completed");
    expect(next?.completedSteps).toBe(40);
    expect(next?.completedSteps).toBeLessThan(next!.totalSteps);
    expect(next?.currentStep).toBe("Completed early");
    expect(next?.results).toMatchObject({ completed: 40, total: 100, early: true });
    expect(next?.logs.at(-1)?.message).toMatch(/completed early/i);
  });

  it("does not change a job that is already stopped", () => {
    expect(applyJobStop(runningJob({ status: "completed" }), "pause", at)).toBeNull();
    expect(applyJobStop(runningJob({ status: "paused" }), "complete", at)).toBeNull();
    expect(applyJobStop(runningJob({ status: "failed" }), "pause", at)).toBeNull();
  });

  it("keeps work already done in results when paused", () => {
    const next = applyJobStop(
      runningJob({ results: { processed: 40, lastCompany: "Acme Ltd" } }),
      "pause",
      at
    );
    expect(next?.completedSteps).toBe(40);
    expect(next?.results).toMatchObject({
      processed: 40,
      lastCompany: "Acme Ltd",
      completed: 40,
      total: 100,
      paused: true,
    });
  });
});

describe("applyStoppedJobResults", () => {
  const at = new Date("2026-09-03T09:00:00.000Z");

  it("saves worker results onto a paused job without marking remaining steps done", () => {
    const paused = applyJobStop(runningJob(), "pause", at)!;
    const next = applyStoppedJobResults(paused, { processed: 41, message: "stopped after 41" });
    expect(next?.status).toBe("paused");
    expect(next?.completedSteps).toBe(40);
    expect(next?.currentStep).toBe("Paused");
    expect(next?.results).toMatchObject({
      completed: 40,
      total: 100,
      paused: true,
      processed: 41,
      message: "stopped after 41",
    });
  });

  it("saves worker results onto an early-completed job without filling remaining steps", () => {
    const done = applyJobStop(runningJob(), "complete", at)!;
    const next = applyStoppedJobResults(done, { processed: 41, files: 12 });
    expect(next?.status).toBe("completed");
    expect(next?.completedSteps).toBe(40);
    expect(next?.completedSteps).toBeLessThan(next!.totalSteps);
    expect(next?.results).toMatchObject({
      completed: 40,
      total: 100,
      early: true,
      processed: 41,
      files: 12,
    });
  });
});

describe("harvestPassBlocked", () => {
  it("blocks a new harvest pass while one is paused", () => {
    expect(harvestPassBlocked([{ agentId: "harvest", status: "paused" }])).toBe(true);
    expect(harvestPassBlocked([{ agentId: "harvest", status: "completed" }])).toBe(false);
    expect(harvestPassBlocked([{ agentId: "enrichment-agent", status: "paused" }])).toBe(false);
    expect(harvestPassBlocked([])).toBe(false);
  });
});

