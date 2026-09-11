import { describe, expect, it } from "vitest";
import {
  FACTORY_JOB_USER,
  applyJobStop,
  applyStoppedJobResults,
  capJobLogs,
  harvestHourBlocked,
  harvestPassBlocked,
  harvestPassDecision,
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

describe("capJobLogs", () => {
  it("keeps only the newest 40 lines so a 3000-file harvest cannot rewrite a multi-megabyte jobs file", () => {
    const logs = Array.from({ length: 80 }, (_, i) => ({
      timestamp: new Date(i),
      message: `Checking Co ${i}`,
      type: "info" as const,
    }));
    const next = capJobLogs(logs);
    expect(next).toHaveLength(40);
    expect(next[0].message).toBe("Checking Co 40");
    expect(next.at(-1)?.message).toBe("Checking Co 79");
  });
});

describe("harvestPassDecision", () => {
  const now = Date.parse("2026-09-10T08:06:19.841Z");
  const log = (iso: string) => [{ timestamp: iso, message: "Checking Co", type: "info" as const }];

  it("starts when nothing is running", () => {
    expect(harvestPassDecision([], 100, now)).toBe("start");
  });

  it("does not replace this process's harvest because one company took longer than 3 minutes", () => {
    expect(
      harvestPassDecision(
        [{ results: { workerPid: 100 }, logs: log("2026-09-10T08:02:58.269Z") }],
        100,
        now
      )
    ).toBe("skip");
  });

  it("leaves a harvest alone for a minute after a restart while logs are still fresh", () => {
    expect(
      harvestPassDecision(
        [{ results: { workerPid: 99 }, logs: log("2026-09-10T08:06:10.000Z") }],
        100,
        now
      )
    ).toBe("skip");
  });

  it("takes over an orphan harvest left running by a dead process", () => {
    expect(
      harvestPassDecision(
        [{ results: { workerPid: 99 }, logs: log("2026-09-10T08:02:58.269Z") }],
        100,
        now
      )
    ).toBe("replace-orphan");
  });
});

describe("harvestHourBlocked", () => {
  const now = Date.parse("2026-09-10T10:00:00.000Z");

  it("does not idle after a successful slice — only a live run blocks the next", () => {
    expect(
      harvestHourBlocked(
        [{ agentId: "harvest", status: "completed", startedAt: "2026-09-10T09:10:00.000Z" }],
        now
      )
    ).toBe(false);
    expect(
      harvestHourBlocked(
        [{ agentId: "harvest", status: "running", startedAt: "2026-09-10T09:50:00.000Z" }],
        now
      )
    ).toBe(true);
  });

  it("does not let a cancelled harvest burn the hour", () => {
    expect(
      harvestHourBlocked(
        [{ agentId: "harvest", status: "failed", startedAt: "2026-09-10T09:10:00.000Z" }],
        now
      )
    ).toBe(false);
  });
});

describe("harvestPassBlocked", () => {
  it("blocks a new harvest pass while one is paused", () => {
    expect(harvestPassBlocked([{ agentId: "harvest", status: "paused", totalSteps: 100 }])).toBe(true);
    expect(harvestPassBlocked([{ agentId: "harvest", status: "completed" }])).toBe(false);
    expect(harvestPassBlocked([{ agentId: "enrichment-agent", status: "paused" }])).toBe(false);
    expect(harvestPassBlocked([])).toBe(false);
  });

  it("does not let a cancelled 3000-file harvest pause block the 100-per-hour regimen", () => {
    expect(harvestPassBlocked([{ agentId: "harvest", status: "paused", totalSteps: 3438 }])).toBe(false);
  });
});

