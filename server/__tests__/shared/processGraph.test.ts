import { describe, expect, it } from "vitest";
import {
  applyFactoryOverrides,
  defaultShapeForKind,
  defaultSizeForShape,
  graphToWorkflow,
  mergeNodeCounts,
  toFactoryOverrides,
  workflowToGraph,
} from "@shared/processGraph";
import { FACTORY_NODES } from "@shared/factoryGraph";
import type { AgentWorkflow } from "@shared/agents";

describe("defaultShapeForKind", () => {
  it("maps factory kinds to distinct default shapes", () => {
    expect(defaultShapeForKind("trigger")).toBe("circle");
    expect(defaultShapeForKind("gate")).toBe("diamond");
    expect(defaultShapeForKind("auto")).toBe("rectangle");
    expect(defaultShapeForKind("human")).toBe("rounded");
    expect(defaultShapeForKind("output")).toBe("rectangle");
    expect(defaultShapeForKind("fail")).toBe("rounded");
  });
});

describe("factory overrides", () => {
  it("hydrates the built-in factory with default shapes and sizes when overrides are empty", () => {
    const { nodes, edges } = applyFactoryOverrides(null);
    const inbound = nodes.find((n) => n.id === "inbound");
    expect(inbound).toBeDefined();
    expect(inbound!.shape).toBe("circle");
    expect(inbound!.width).toBe(defaultSizeForShape("circle").width);
    expect(inbound!.height).toBe(defaultSizeForShape("circle").height);
    expect(edges.length).toBeGreaterThan(0);
  });

  it("round-trips a moved, resized, relabelled, reshaped node without snapping back", () => {
    const { nodes, edges } = applyFactoryOverrides(null);
    const nextNodes = nodes.map((n) =>
      n.id === "fit"
        ? {
            ...n,
            label: "Fit check",
            x: 400,
            y: 240,
            width: 300,
            height: 140,
            shape: "rounded" as const,
          }
        : n
    );
    const overrides = toFactoryOverrides(nextNodes, edges);
    const rehydrated = applyFactoryOverrides(overrides);
    const fit = rehydrated.nodes.find((n) => n.id === "fit")!;
    expect(fit.label).toBe("Fit check");
    expect(fit.x).toBe(400);
    expect(fit.y).toBe(240);
    expect(fit.width).toBe(300);
    expect(fit.height).toBe(140);
    expect(fit.shape).toBe("rounded");
  });

  it("keeps user-added nodes and drops deleted built-in nodes", () => {
    const { nodes, edges } = applyFactoryOverrides(null);
    const kept = nodes.filter((n) => n.id !== "parked");
    kept.push({
      id: "node-custom-1",
      label: "Legal review",
      desk: "You",
      detail: "Contract check",
      kind: "human",
      shape: "rounded",
      x: 100,
      y: 100,
      width: 220,
      height: 92,
    });
    const overrides = toFactoryOverrides(kept, edges.filter((e) => e.source !== "parked" && e.target !== "parked"));
    const rehydrated = applyFactoryOverrides(overrides);
    expect(rehydrated.nodes.some((n) => n.id === "parked")).toBe(false);
    expect(rehydrated.nodes.some((n) => n.id === "node-custom-1")).toBe(true);
  });
});

describe("mergeNodeCounts", () => {
  it("updates counts without clobbering position, size, or shape", () => {
    const { nodes } = applyFactoryOverrides(null);
    const inbound = nodes.find((n) => n.id === "inbound")!;
    const merged = mergeNodeCounts(nodes, { inbound: 4 });
    const after = merged.find((n) => n.id === "inbound")!;
    expect(after.count).toBe(4);
    expect(after.x).toBe(inbound.x);
    expect(after.y).toBe(inbound.y);
    expect(after.width).toBe(inbound.width);
    expect(after.height).toBe(inbound.height);
    expect(after.shape).toBe(inbound.shape);
    expect(after.label).toBe(inbound.label);
  });
});

describe("workflow graph mapping", () => {
  const workflow: AgentWorkflow = {
    jobDescription: "Qualify inbound",
    responsibilities: ["Answer the pack"],
    tasks: [
      {
        id: "task-a",
        name: "Read pack",
        description: "Open the files",
        trigger: "on_instruction",
        steps: ["Download", "Skim"],
        expectedOutput: "Notes",
      },
      {
        id: "task-b",
        name: "Call client",
        description: "Book a slot",
        trigger: "on_event",
        steps: ["Dial"],
        expectedOutput: "Meeting",
        escalationRule: "No answer twice",
      },
    ],
  };

  it("lays out tasks that have no saved position, then round-trips fields", () => {
    const { nodes, edges } = workflowToGraph(workflow);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].x).toBeDefined();
    expect(nodes[1].x).toBeGreaterThan(nodes[0].x);
    expect(nodes[0].label).toBe("Read pack");
    expect(nodes[0].steps).toEqual(["Download", "Skim"]);
    expect(edges).toEqual([]);

    const back = graphToWorkflow(workflow, nodes, [
      { id: "e-1", source: "task-a", target: "task-b", label: "then" },
    ]);
    expect(back.jobDescription).toBe("Qualify inbound");
    expect(back.responsibilities).toEqual(["Answer the pack"]);
    expect(back.tasks).toHaveLength(2);
    expect(back.tasks[0].name).toBe("Read pack");
    expect(back.tasks[0].steps).toEqual(["Download", "Skim"]);
    expect(back.tasks[1].escalationRule).toBe("No answer twice");
    expect(back.tasks[0].x).toBe(nodes[0].x);
    expect(back.edges).toEqual([{ id: "e-1", source: "task-a", target: "task-b", label: "then" }]);
  });

  it("adds and removes tasks from canvas nodes", () => {
    const { nodes, edges } = workflowToGraph(workflow);
    const withNew = [
      ...nodes,
      {
        id: "task-c",
        label: "Write memo",
        detail: "",
        shape: "rectangle" as const,
        x: 520,
        y: 80,
        width: 220,
        height: 92,
        trigger: "on_instruction" as const,
        steps: [""],
        expectedOutput: "",
      },
    ];
    const added = graphToWorkflow(workflow, withNew, edges);
    expect(added.tasks.map((t) => t.id)).toEqual(["task-a", "task-b", "task-c"]);

    const removed = graphToWorkflow(workflow, nodes.filter((n) => n.id !== "task-b"), edges);
    expect(removed.tasks.map((t) => t.id)).toEqual(["task-a"]);
  });

  it("does not use a built-in factory node as a missing-id fallback", () => {
    const ids = new Set(FACTORY_NODES.map((n) => n.id));
    const { nodes } = workflowToGraph(workflow);
    for (const node of nodes) {
      expect(ids.has(node.id)).toBe(false);
    }
  });
});
