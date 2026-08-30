import type { AgentWorkflow, WorkflowTask, WorkflowTaskTrigger } from "./agents";
import {
  FACTORY_EDGES,
  FACTORY_NODES,
  type FactoryEdgeDef,
  type FactoryNodeDef,
  type FactoryNodeKind,
} from "./factoryGraph";

export type ProcessShape = "rectangle" | "rounded" | "diamond" | "circle";

export const PROCESS_SHAPES: ProcessShape[] = ["rectangle", "rounded", "diamond", "circle"];

export const KIND_COLOR: Record<FactoryNodeKind, string> = {
  trigger: "#ea4b71",
  auto: "#7a8cff",
  human: "#f5a524",
  gate: "#3ec6c9",
  output: "#3dd68c",
  fail: "#f97066",
};

export const KIND_OPTIONS: FactoryNodeKind[] = ["trigger", "auto", "human", "gate", "output", "fail"];

export type ProcessNodeRecord = {
  id: string;
  label: string;
  desk?: string;
  detail: string;
  kind?: FactoryNodeKind;
  shape: ProcessShape;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  count?: number;
  trigger?: WorkflowTaskTrigger;
  steps?: string[];
  expectedOutput?: string;
  escalationRule?: string;
};

export type ProcessEdgeRecord = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

export type StyledNodeDef = FactoryNodeDef & {
  color?: string;
  width?: number;
  height?: number;
  shape?: ProcessShape;
};

type NodeStyleFields = "label" | "desk" | "detail" | "kind" | "x" | "y" | "color" | "width" | "height" | "shape";

export type GraphOverrides = {
  nodeEdits: Record<string, Partial<Pick<StyledNodeDef, NodeStyleFields>>>;
  addedNodes: StyledNodeDef[];
  deletedNodeIds: string[];
  edgeEdits: Record<string, Partial<Pick<FactoryEdgeDef, "label">>>;
  addedEdges: FactoryEdgeDef[];
  deletedEdgeIds: string[];
};

export const EMPTY_OVERRIDES: GraphOverrides = {
  nodeEdits: {},
  addedNodes: [],
  deletedNodeIds: [],
  edgeEdits: {},
  addedEdges: [],
  deletedEdgeIds: [],
};

export function defaultShapeForKind(kind: FactoryNodeKind): ProcessShape {
  switch (kind) {
    case "trigger":
      return "circle";
    case "gate":
      return "diamond";
    case "human":
    case "fail":
      return "rounded";
    default:
      return "rectangle";
  }
}

export function defaultSizeForShape(shape: ProcessShape): { width: number; height: number } {
  if (shape === "circle") return { width: 148, height: 148 };
  if (shape === "diamond") return { width: 176, height: 176 };
  return { width: 220, height: 92 };
}

function toRecord(node: StyledNodeDef): ProcessNodeRecord {
  const kind = node.kind;
  const shape = node.shape ?? defaultShapeForKind(kind);
  const size = defaultSizeForShape(shape);
  return {
    id: node.id,
    label: node.label,
    desk: node.desk,
    detail: node.detail,
    kind,
    shape,
    color: node.color,
    x: node.x,
    y: node.y,
    width: node.width ?? size.width,
    height: node.height ?? size.height,
  };
}

function fromRecord(node: ProcessNodeRecord): StyledNodeDef {
  return {
    id: node.id,
    label: node.label,
    desk: node.desk || "You",
    detail: node.detail,
    kind: node.kind || "auto",
    shape: node.shape,
    color: node.color,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
}

export function applyFactoryOverrides(overrides: GraphOverrides | null | undefined): {
  nodes: ProcessNodeRecord[];
  edges: ProcessEdgeRecord[];
} {
  const next = overrides || EMPTY_OVERRIDES;
  const base = FACTORY_NODES.filter((n) => !next.deletedNodeIds.includes(n.id)).map((n) =>
    toRecord({ ...n, ...(next.nodeEdits[n.id] || {}) })
  );
  const added = next.addedNodes.map(toRecord);
  const nodes = [...base, ...added];
  const liveIds = new Set(nodes.map((n) => n.id));
  const baseEdges = FACTORY_EDGES.filter((e) => !next.deletedEdgeIds.includes(e.id)).map((e) => ({
    ...e,
    ...(next.edgeEdits[e.id] || {}),
  }));
  const edges = [...baseEdges, ...next.addedEdges].filter(
    (e) => liveIds.has(e.source) && liveIds.has(e.target)
  );
  return { nodes, edges };
}

export function toFactoryOverrides(
  nodes: ProcessNodeRecord[],
  edges: ProcessEdgeRecord[]
): GraphOverrides {
  const liveIds = new Set(nodes.map((n) => n.id));
  const nodeEdits: GraphOverrides["nodeEdits"] = {};
  const addedNodes: StyledNodeDef[] = [];

  for (const node of nodes) {
    const base = FACTORY_NODES.find((n) => n.id === node.id);
    if (!base) {
      addedNodes.push(fromRecord(node));
      continue;
    }
    const edits: Partial<Pick<StyledNodeDef, NodeStyleFields>> = {};
    if (node.label !== base.label) edits.label = node.label;
    if ((node.desk || "") !== base.desk) edits.desk = node.desk;
    if (node.detail !== base.detail) edits.detail = node.detail;
    if (node.kind && node.kind !== base.kind) edits.kind = node.kind;
    if (node.x !== base.x) edits.x = node.x;
    if (node.y !== base.y) edits.y = node.y;
    if (node.color) edits.color = node.color;
    const kind = node.kind || base.kind;
    if (node.shape !== defaultShapeForKind(kind)) edits.shape = node.shape;
    const size = defaultSizeForShape(node.shape);
    if (node.width !== size.width) edits.width = node.width;
    if (node.height !== size.height) edits.height = node.height;
    if (Object.keys(edits).length > 0) nodeEdits[node.id] = edits;
  }

  const liveEdgeIds = new Set(edges.map((e) => e.id));
  const edgeEdits: GraphOverrides["edgeEdits"] = {};
  const addedEdges: FactoryEdgeDef[] = [];
  for (const edge of edges) {
    const base = FACTORY_EDGES.find((e) => e.id === edge.id);
    if (!base) {
      addedEdges.push(edge);
      continue;
    }
    if ((edge.label || "") !== (base.label || "")) {
      edgeEdits[edge.id] = { label: edge.label };
    }
  }

  return {
    nodeEdits,
    addedNodes,
    deletedNodeIds: FACTORY_NODES.filter((n) => !liveIds.has(n.id)).map((n) => n.id),
    edgeEdits,
    addedEdges,
    deletedEdgeIds: FACTORY_EDGES.filter((e) => !liveEdgeIds.has(e.id)).map((e) => e.id),
  };
}

export function mergeNodeCounts(
  nodes: ProcessNodeRecord[],
  counts: Record<string, number>
): ProcessNodeRecord[] {
  return nodes.map((node) => ({ ...node, count: counts[node.id] || 0 }));
}

export function workflowToGraph(workflow: AgentWorkflow): {
  nodes: ProcessNodeRecord[];
  edges: ProcessEdgeRecord[];
} {
  const nodes = workflow.tasks.map((task, index) => {
    const shape = task.shape ?? "rectangle";
    const size = defaultSizeForShape(shape);
    return {
      id: task.id,
      label: task.name,
      detail: task.description,
      shape,
      color: task.color,
      x: task.x ?? index * 260,
      y: task.y ?? 80,
      width: task.width ?? size.width,
      height: task.height ?? size.height,
      trigger: task.trigger,
      steps: task.steps,
      expectedOutput: task.expectedOutput,
      escalationRule: task.escalationRule,
    };
  });
  return { nodes, edges: workflow.edges ?? [] };
}

export function graphToWorkflow(
  workflow: AgentWorkflow,
  nodes: ProcessNodeRecord[],
  edges: ProcessEdgeRecord[]
): AgentWorkflow {
  const byId = new Map(workflow.tasks.map((task) => [task.id, task]));
  const tasks: WorkflowTask[] = nodes.map((node) => {
    const existing = byId.get(node.id);
    return {
      id: node.id,
      name: node.label,
      description: node.detail,
      trigger: node.trigger ?? existing?.trigger ?? "on_instruction",
      steps: node.steps ?? existing?.steps ?? [""],
      expectedOutput: node.expectedOutput ?? existing?.expectedOutput ?? "",
      escalationRule: node.escalationRule ?? existing?.escalationRule,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      shape: node.shape,
      color: node.color,
    };
  });
  return {
    ...workflow,
    tasks,
    edges,
  };
}
