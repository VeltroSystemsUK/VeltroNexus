import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  MiniMap,
  Handle,
  NodeResizer,
  Position,
  MarkerType,
  getSmoothStepPath,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type EdgeProps,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./process-canvas.css";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { FACTORY_NODES } from "@shared/factoryGraph";
import {
  KIND_COLOR,
  KIND_OPTIONS,
  PROCESS_SHAPES,
  defaultShapeForKind,
  defaultSizeForShape,
  type ProcessEdgeRecord,
  type ProcessNodeRecord,
  type ProcessShape,
} from "@shared/processGraph";
import type { FactoryNodeKind } from "@shared/factoryGraph";
import type { WorkflowTaskTrigger } from "@shared/agents";

export type ProcessCanvasVariant = "factory" | "workflow";

type FlowNode = Node<ProcessNodeRecord, "process">;

type CanvasApi = {
  persistResize: (id: string, width: number, height: number) => void;
  setNodeLabel: (id: string, label: string) => void;
};

const CanvasApiContext = createContext<CanvasApi | null>(null);

function isStopPath(label?: string) {
  return /fail|personal|not sent|no pack/i.test(label || "");
}

function nodeColor(data: ProcessNodeRecord) {
  if (data.color) return data.color;
  if (data.kind) return KIND_COLOR[data.kind];
  return "#7a8cff";
}

function flowFromRecords(nodes: ProcessNodeRecord[], edges: ProcessEdgeRecord[]): {
  nodes: FlowNode[];
  edges: Edge[];
} {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: "process",
      position: { x: node.x, y: node.y },
      style: { width: node.width, height: node.height },
      data: node,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    })),
    edges: edges.map((edge) => {
      const stop = isStopPath(edge.label);
      const stroke = stop ? "#f97066" : "#c5c5d4";
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: "out",
        targetHandle: "in",
        label: edge.label,
        type: "process",
        className: stop ? "stop" : undefined,
        data: { stop },
        style: { stroke, strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: stroke },
      };
    }),
  };
}

function recordsFromFlow(nodes: Node[], edges: Edge[]): {
  nodes: ProcessNodeRecord[];
  edges: ProcessEdgeRecord[];
} {
  return {
    nodes: nodes.map((node) => {
      const data = node.data as ProcessNodeRecord;
      const width = Number(node.width ?? node.style?.width ?? data.width);
      const height = Number(node.height ?? node.style?.height ?? data.height);
      return {
        ...data,
        x: node.position.x,
        y: node.position.y,
        width,
        height,
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label ? String(edge.label) : undefined,
    })),
  };
}

function ProcessNode({ id, data, selected }: NodeProps<FlowNode>) {
  const api = useContext(CanvasApiContext);
  const color = nodeColor(data);
  const shape = data.shape || "rectangle";
  const [draft, setDraft] = useState(data.label);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(data.label);
  }, [data.label, editing]);

  const commit = () => {
    const next = draft.trim() || data.label;
    setEditing(false);
    if (next !== data.label) api?.setNodeLabel(id, next);
  };

  const visualClass =
    shape === "circle"
      ? "rounded-full"
      : shape === "rounded"
        ? "rounded-2xl"
        : shape === "diamond"
          ? "process-shape-diamond"
          : "rounded-md";

  return (
    <div className="w-full h-full relative">
      <NodeResizer
        isVisible={selected}
        minWidth={shape === "circle" || shape === "diamond" ? 110 : 160}
        minHeight={shape === "circle" || shape === "diamond" ? 110 : 70}
        keepAspectRatio={shape === "circle"}
        lineClassName="!border-white/30"
        handleClassName="!bg-white !border-white/60 !w-2 !h-2"
        onResizeEnd={(_event, params) => api?.persistResize(id, params.width, params.height)}
      />
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-[#1d1d21]"
        style={{ background: color }}
      />
      <div
        className={cn(
          "absolute inset-0 overflow-hidden bg-[#1d1d21] shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
          visualClass
        )}
        style={{ border: `1px solid ${color}55` }}
      >
        <div className="h-1" style={{ background: color }} />
        <div
          className={cn(
            "px-3 py-2 space-y-1",
            shape === "diamond" && "px-8 py-7",
            shape === "circle" && "px-5 py-6 text-center"
          )}
          onDoubleClick={(event) => {
            event.stopPropagation();
            setEditing(true);
          }}
        >
          {data.desk && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/45 truncate">{data.desk}</p>
              {(data.count || 0) > 0 && (
                <span
                  className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: `${color}22`, color }}
                >
                  {data.count}
                </span>
              )}
            </div>
          )}
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(data.label);
                  setEditing(false);
                }
                e.stopPropagation();
              }}
              className="w-full bg-black/40 border border-white/20 rounded px-1.5 py-0.5 text-[13px] font-semibold text-white outline-none"
            />
          ) : (
            <p className="text-[13px] font-semibold text-white leading-tight">{data.label || "Untitled"}</p>
          )}
          {shape !== "circle" && data.detail ? (
            <p className="text-[11px] text-white/50 leading-snug line-clamp-3">{data.detail}</p>
          ) : null}
        </div>
      </div>
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-[#1d1d21]"
        style={{ background: color }}
      />
    </div>
  );
}

function ProcessEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  markerEnd,
  data,
}: EdgeProps) {
  const stop = Boolean(data?.stop);
  const stroke = stop ? "#f97066" : "#e4e4ef";
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
  });
  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ stroke, strokeWidth: 2.5, fill: "none" }} />
      {label ? (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={stop ? "#f97066" : "#ececf4"}
          fontSize={11}
          fontWeight={600}
          style={{ pointerEvents: "none" }}
        >
          {String(label)}
        </text>
      ) : null}
    </>
  );
}

const nodeTypes = { process: ProcessNode };
const edgeTypes = { process: ProcessEdge };

const TRIGGER_OPTIONS: { value: WorkflowTaskTrigger; label: string }[] = [
  { value: "on_instruction", label: "On instruction" },
  { value: "scheduled", label: "Scheduled" },
  { value: "on_event", label: "On event" },
  { value: "deal_closed", label: "Deal closed" },
  { value: "missing_docs_alert", label: "Missing docs" },
  { value: "file_uploaded", label: "File uploaded" },
  { value: "no_response_alert", label: "No response" },
  { value: "proposal_draft_ready", label: "Proposal ready" },
];

const SHAPE_META: { id: ProcessShape; label: string }[] = [
  { id: "rectangle", label: "Rectangle" },
  { id: "rounded", label: "Rounded" },
  { id: "diamond", label: "Diamond" },
  { id: "circle", label: "Circle" },
];

function ShapeGlyph({ shape }: { shape: ProcessShape }) {
  if (shape === "circle") return <span className="block w-3.5 h-3.5 rounded-full border border-current" />;
  if (shape === "diamond") return <span className="block w-2.5 h-2.5 rotate-45 border border-current" />;
  if (shape === "rounded") return <span className="block w-3.5 h-3.5 rounded-md border border-current" />;
  return <span className="block w-3.5 h-3.5 rounded-[2px] border border-current" />;
}

type MenuState =
  | { kind: "node"; id: string; x: number; y: number }
  | { kind: "edge"; id: string; x: number; y: number }
  | { kind: "pane"; flowX: number; flowY: number; x: number; y: number };

export function ProcessCanvas(props: {
  variant: ProcessCanvasVariant;
  initialNodes: ProcessNodeRecord[];
  initialEdges: ProcessEdgeRecord[];
  counts?: Record<string, number>;
  onPersist: (graph: { nodes: ProcessNodeRecord[]; edges: ProcessEdgeRecord[] }) => void;
  onReset?: () => void;
  className?: string;
}) {
  return (
    <ReactFlowProvider>
      <ProcessCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function ProcessCanvasInner({
  variant,
  initialNodes,
  initialEdges,
  counts,
  onPersist,
  onReset,
  className,
}: {
  variant: ProcessCanvasVariant;
  initialNodes: ProcessNodeRecord[];
  initialEdges: ProcessEdgeRecord[];
  counts?: Record<string, number>;
  onPersist: (graph: { nodes: ProcessNodeRecord[]; edges: ProcessEdgeRecord[] }) => void;
  onReset?: () => void;
  className?: string;
}) {
  const isMobile = useIsMobile();
  const { screenToFlowPosition } = useReactFlow();
  const persistRef = useRef(onPersist);
  persistRef.current = onPersist;
  const wrapperRef = useRef<HTMLDivElement>(null);

  const seeded = useMemo(() => flowFromRecords(initialNodes, initialEdges), [initialNodes, initialEdges]);
  const [nodes, setNodes, onNodesChange] = useNodesState(seeded.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seeded.edges);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  const persistResize = useCallback((id: string, width: number, height: number) => {
    const next = nodesRef.current.map((node) =>
      node.id === id
        ? {
            ...node,
            width,
            height,
            style: { ...node.style, width, height },
            data: { ...node.data, width, height },
          }
        : node
    );
    nodesRef.current = next;
    setNodes(next);
    persistRef.current(recordsFromFlow(next, edgesRef.current));
  }, [setNodes]);

  const setNodeLabel = useCallback((id: string, label: string) => {
    setNodes((current) => {
      const next = current.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, label } } : node
      );
      nodesRef.current = next;
      persistRef.current(recordsFromFlow(next, edgesRef.current));
      return next;
    });
  }, [setNodes]);

  const api = useMemo<CanvasApi>(
    () => ({ persistResize, setNodeLabel }),
    [persistResize, setNodeLabel]
  );

  useEffect(() => {
    if (!counts) return;
    setNodes((current) =>
      current.map((node) => {
        const nextCount = counts[node.id] || 0;
        if ((node.data.count || 0) === nextCount) return node;
        return { ...node, data: { ...node.data, count: nextCount } };
      })
    );
  }, [counts, setNodes]);

  const selectedNode = nodes.find((node) => node.selected);
  const selectedEdge = edges.find((edge) => edge.selected);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [draftShape, setDraftShape] = useState<ProcessShape>("rectangle");

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const patchNode = (id: string, patch: Partial<ProcessNodeRecord>, opts?: { resize?: boolean }) => {
    setNodes((current) => {
      const next = current.map((node) => {
        if (node.id !== id) return node;
        const data = { ...node.data, ...patch };
        const style = { ...node.style };
        if (opts?.resize && data.shape) {
          const size = defaultSizeForShape(data.shape);
          data.width = size.width;
          data.height = size.height;
          style.width = size.width;
          style.height = size.height;
        }
        return { ...node, data, style };
      });
      nodesRef.current = next;
      persistRef.current(recordsFromFlow(next, edgesRef.current));
      return next;
    });
  };

  const patchEdge = (id: string, label: string) => {
    setEdges((current) => {
      const next = current.map((edge) => {
        if (edge.id !== id) return edge;
        const stop = isStopPath(label);
        const stroke = stop ? "#f97066" : "#c5c5d4";
        return {
          ...edge,
          label,
          className: stop ? "stop" : undefined,
          data: { stop },
          style: { ...edge.style, stroke },
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: stroke },
        };
      });
      edgesRef.current = next;
      persistRef.current(recordsFromFlow(nodesRef.current, next));
      return next;
    });
  };

  const addNodeAt = (x: number, y: number, shape = draftShape) => {
    const size = defaultSizeForShape(shape);
    const id = variant === "workflow" ? `task-${Date.now()}` : `node-custom-${Date.now()}`;
    const kind: FactoryNodeKind | undefined = variant === "factory" ? "auto" : undefined;
    const record: ProcessNodeRecord = {
      id,
      label: variant === "workflow" ? "New task" : "New step",
      desk: variant === "factory" ? "You" : undefined,
      detail: "",
      kind,
      shape,
      x,
      y,
      width: size.width,
      height: size.height,
      trigger: variant === "workflow" ? "on_instruction" : undefined,
      steps: variant === "workflow" ? [""] : undefined,
      expectedOutput: variant === "workflow" ? "" : undefined,
    };
    const flowNode: FlowNode = {
      id,
      type: "process",
      position: { x, y },
      style: { width: size.width, height: size.height },
      data: record,
      selected: true,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
    setNodes((current) => {
      const next: FlowNode[] = [
        ...current.map((node) => ({ ...node, selected: false })),
        flowNode,
      ];
      nodesRef.current = next;
      persistRef.current(recordsFromFlow(next, edgesRef.current));
      return next;
    });
    setEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
    setMenu(null);
  };

  const addNodeInView = () => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const point = screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 800) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 500) / 2,
    });
    addNodeAt(point.x - defaultSizeForShape(draftShape).width / 2, point.y - defaultSizeForShape(draftShape).height / 2);
  };

  const deleteNode = (id: string) => {
    const builtIn = variant === "factory" && FACTORY_NODES.some((node) => node.id === id);
    if (builtIn && !confirm("Remove this step from the blueprint? Live deals still follow the built-in process.")) {
      setMenu(null);
      return;
    }
    const nextNodes = nodesRef.current.filter((node) => node.id !== id);
    const nextEdges = edgesRef.current.filter((edge) => edge.source !== id && edge.target !== id);
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
    persistRef.current(recordsFromFlow(nextNodes, nextEdges));
    setMenu(null);
  };

  const deleteEdge = (id: string) => {
    setEdges((current) => {
      const next = current.filter((edge) => edge.id !== id);
      edgesRef.current = next;
      persistRef.current(recordsFromFlow(nodesRef.current, next));
      return next;
    });
    setMenu(null);
  };

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const id = `e-custom-${Date.now()}`;
      setEdges((current) => {
        const next = current.concat({
          id,
          source: connection.source!,
          target: connection.target!,
          sourceHandle: connection.sourceHandle || "out",
          targetHandle: connection.targetHandle || "in",
          type: "process",
          style: { stroke: "#c5c5d4", strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "#c5c5d4" },
        });
        edgesRef.current = next;
        persistRef.current(recordsFromFlow(nodesRef.current, next));
        return next;
      });
    },
    [setEdges]
  );

  const inspector = selectedNode ? (
    <NodeInspector
      variant={variant}
      node={selectedNode.data}
      onPatch={(patch, resize) => patchNode(selectedNode.id, patch, { resize })}
      onDelete={() => deleteNode(selectedNode.id)}
    />
  ) : selectedEdge ? (
    <EdgeInspector
      label={String(selectedEdge.label || "")}
      onChange={(label) => patchEdge(selectedEdge.id, label)}
      onDelete={() => deleteEdge(selectedEdge.id)}
    />
  ) : (
    <div className="p-4 text-sm text-white/45 leading-relaxed">
      Select a step to edit it, drag a corner to resize, or add a shape from the toolbar.
    </div>
  );

  return (
    <CanvasApiContext.Provider value={api}>
      <div
        ref={wrapperRef}
        className={cn(
          "relative flex h-full min-h-0 rounded-xl border border-white/10 overflow-hidden bg-[#141419]",
          className
        )}
      >
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-white/10 bg-[#121217]">
            <button
              type="button"
              onClick={addNodeInView}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-white/10 hover:bg-white/15 text-xs text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              {variant === "workflow" ? "Add task" : "Add step"}
            </button>
            <div className="flex items-center gap-1">
              {SHAPE_META.map((shape) => {
                const active = draftShape === shape.id;
                return (
                  <button
                    key={shape.id}
                    type="button"
                    title={shape.label}
                    onClick={() => setDraftShape(shape.id)}
                    className={cn(
                      "h-8 w-8 inline-flex items-center justify-center rounded-md",
                      active ? "bg-white/15 text-white" : "text-white/50 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <ShapeGlyph shape={shape.id} />
                  </button>
                );
              })}
            </div>
            {variant === "factory" && (
              <div className="hidden md:flex items-center gap-1.5 ml-2 text-[10px] uppercase tracking-wide text-white/45">
                <Legend color={KIND_COLOR.trigger} label="Trigger" />
                <Legend color={KIND_COLOR.auto} label="Agent" />
                <Legend color={KIND_COLOR.human} label="You" />
                <Legend color={KIND_COLOR.gate} label="Gate" />
                <Legend color={KIND_COLOR.output} label="Output" />
                <Legend color={KIND_COLOR.fail} label="Stop" />
              </div>
            )}
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="ml-auto text-[10px] uppercase tracking-wide text-white/45 hover:text-white px-2 py-1 rounded hover:bg-white/10"
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0">
            <ReactFlow
              className="process-canvas"
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={(_event, node) => {
                const next = nodesRef.current.map((current) =>
                  current.id === node.id ? { ...current, position: node.position } : current
                );
                nodesRef.current = next;
                persistRef.current(recordsFromFlow(next, edgesRef.current));
              }}
              onConnect={onConnect}
              onNodeContextMenu={(event, node) => {
                event.preventDefault();
                setMenu({ kind: "node", id: node.id, x: event.clientX, y: event.clientY });
              }}
              onEdgeContextMenu={(event, edge) => {
                event.preventDefault();
                setMenu({ kind: "edge", id: edge.id, x: event.clientX, y: event.clientY });
              }}
              onPaneContextMenu={(event) => {
                event.preventDefault();
                const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
                setMenu({ kind: "pane", flowX: flow.x, flowY: flow.y, x: event.clientX, y: event.clientY });
              }}
              onBeforeDelete={({ nodes: deleting }) => {
                if (variant !== "factory") return true;
                const hitsBuiltIn = deleting.some((node) => FACTORY_NODES.some((built) => built.id === node.id));
                if (!hitsBuiltIn) return true;
                return confirm("Remove this step from the blueprint? Live deals still follow the built-in process.");
              }}
              onNodesDelete={(deleted) => {
                const ids = new Set(deleted.map((node) => node.id));
                const nextNodes = nodesRef.current.filter((node) => !ids.has(node.id));
                const nextEdges = edgesRef.current.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target));
                nodesRef.current = nextNodes;
                edgesRef.current = nextEdges;
                persistRef.current(recordsFromFlow(nextNodes, nextEdges));
              }}
              onEdgesDelete={(deleted) => {
                const ids = new Set(deleted.map((edge) => edge.id));
                const nextEdges = edgesRef.current.filter((edge) => !ids.has(edge.id));
                edgesRef.current = nextEdges;
                persistRef.current(recordsFromFlow(nodesRef.current, nextEdges));
              }}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              minZoom={0.25}
              maxZoom={1.6}
              panOnScroll
              selectionOnDrag={false}
              deleteKeyCode={["Backspace", "Delete"]}
              defaultEdgeOptions={{
                type: "process",
                style: { stroke: "#e4e4ef", strokeWidth: 2.5 },
                markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "#e4e4ef" },
              }}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#3a3a44" />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                maskColor="rgba(8,8,12,0.7)"
                nodeColor={(node) => nodeColor(node.data as ProcessNodeRecord)}
                bgColor="#0e0e12"
              />
            </ReactFlow>
          </div>
        </div>

        {!isMobile && (
          <aside className="w-[280px] shrink-0 border-l border-white/10 bg-[#16161c] overflow-y-auto">
            {inspector}
          </aside>
        )}

        {isMobile && (selectedNode || selectedEdge) && (
          <div className="absolute bottom-0 left-0 right-0 max-h-[46%] overflow-y-auto border-t border-white/10 bg-[#16161c] z-20">
            {inspector}
          </div>
        )}

        {menu && (
          <div
            className="fixed z-50 min-w-[160px] bg-[#1d1d21] border border-white/10 rounded-md shadow-2xl py-1 text-sm"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {menu.kind === "node" && (
              <MenuItem onClick={() => deleteNode(menu.id)} danger>
                Delete
              </MenuItem>
            )}
            {menu.kind === "edge" && (
              <MenuItem onClick={() => deleteEdge(menu.id)} danger>
                Delete connection
              </MenuItem>
            )}
            {menu.kind === "pane" && (
              <MenuItem onClick={() => addNodeAt(menu.flowX, menu.flowY)}>
                Add {variant === "workflow" ? "task" : "step"} here
              </MenuItem>
            )}
          </div>
        )}
      </div>
    </CanvasApiContext.Provider>
  );
}

function NodeInspector({
  variant,
  node,
  onPatch,
  onDelete,
}: {
  variant: ProcessCanvasVariant;
  node: ProcessNodeRecord;
  onPatch: (patch: Partial<ProcessNodeRecord>, resize?: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-4 space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
          {variant === "workflow" ? "Task" : "Step"}
        </p>
        <p className="text-sm text-white font-semibold truncate">{node.label || "Untitled"}</p>
      </div>
      <FieldInput label="Label" value={node.label} onChange={(label) => onPatch({ label })} />
      {variant === "factory" && (
        <FieldInput label="Desk" value={node.desk || ""} onChange={(desk) => onPatch({ desk })} />
      )}
      <FieldArea
        label={variant === "workflow" ? "Description" : "Detail"}
        value={node.detail}
        onChange={(detail) => onPatch({ detail })}
      />
      {variant === "factory" && (
        <FieldSelect
          label="Kind"
          value={node.kind || "auto"}
          options={KIND_OPTIONS.map((kind) => ({ value: kind, label: kind }))}
          onChange={(kind) => {
            const nextKind = kind as FactoryNodeKind;
            onPatch({ kind: nextKind, shape: defaultShapeForKind(nextKind), color: undefined }, true);
          }}
        />
      )}
      {variant === "workflow" && (
        <>
          <FieldSelect
            label="Trigger"
            value={node.trigger || "on_instruction"}
            options={TRIGGER_OPTIONS}
            onChange={(trigger) => onPatch({ trigger: trigger as WorkflowTaskTrigger })}
          />
          <div>
            <p className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Steps</p>
            <div className="space-y-1.5">
              {(node.steps || [""]).map((step, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <input
                    value={step}
                    onChange={(e) => {
                      const steps = [...(node.steps || [""])];
                      steps[index] = e.target.value;
                      onPatch({ steps });
                    }}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    className="text-white/30 hover:text-red-400 px-1"
                    onClick={() => onPatch({ steps: (node.steps || []).filter((_, i) => i !== index) })}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-1.5 text-[10px] font-bold text-white/40 hover:text-white"
              onClick={() => onPatch({ steps: [...(node.steps || []), ""] })}
            >
              + Add step
            </button>
          </div>
          <FieldInput
            label="Expected output"
            value={node.expectedOutput || ""}
            onChange={(expectedOutput) => onPatch({ expectedOutput })}
          />
          <FieldInput
            label="Escalation"
            value={node.escalationRule || ""}
            onChange={(escalationRule) => onPatch({ escalationRule })}
          />
        </>
      )}
      <div>
        <p className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Shape</p>
        <div className="flex gap-1">
          {SHAPE_META.map((shape) => {
            const active = node.shape === shape.id;
            return (
              <button
                key={shape.id}
                type="button"
                title={shape.label}
                onClick={() => onPatch({ shape: shape.id }, true)}
                className={cn(
                  "h-8 w-8 inline-flex items-center justify-center rounded-md",
                  active ? "bg-white/15 text-white" : "text-white/45 hover:text-white hover:bg-white/10"
                )}
              >
                <ShapeGlyph shape={shape.id} />
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Colour</p>
        <input
          type="color"
          value={nodeColor(node)}
          onChange={(e) => onPatch({ color: e.target.value })}
          className="h-9 w-12 rounded-md border border-slate-800 bg-slate-950 cursor-pointer"
        />
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="w-full mt-2 border border-red-900/60 text-red-400 rounded-lg py-2 text-sm hover:bg-red-950/40"
      >
        Delete
      </button>
    </div>
  );
}

function EdgeInspector({
  label,
  onChange,
  onDelete,
}: {
  label: string;
  onChange: (label: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Connection</p>
      <FieldInput label="Label" value={label} onChange={onChange} />
      <button
        type="button"
        onClick={onDelete}
        className="w-full border border-red-900/60 text-red-400 rounded-lg py-2 text-sm hover:bg-red-950/40"
      >
        Delete connection
      </button>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-primary"
      />
    </label>
  );
}

function FieldArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-primary resize-none"
      />
    </label>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MenuItem({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors", danger ? "text-red-400" : "text-white/85")}
    >
      {children}
    </button>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-black/30 rounded px-2 py-1">
      <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
