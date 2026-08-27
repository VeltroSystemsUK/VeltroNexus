import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  getSmoothStepPath,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./factory-canvas.css";
import {
  FACTORY_EDGES,
  FACTORY_NODES,
  countDealsOnNodes,
  type FactoryNodeKind,
} from "@shared/factoryGraph";
import type { AgenticDealFile } from "@shared/agenticWorkflow";

const KIND_COLOR: Record<FactoryNodeKind, string> = {
  trigger: "#ea4b71",
  auto: "#7a8cff",
  human: "#f5a524",
  gate: "#3ec6c9",
  output: "#3dd68c",
  fail: "#f97066",
};

type ProcessData = {
  label: string;
  desk: string;
  detail: string;
  kind: FactoryNodeKind;
  count: number;
};

function isStopPath(label?: string) {
  return /fail|personal|not sent|no pack/i.test(label || "");
}

function ProcessNode({ data }: { data: ProcessData }) {
  const color = KIND_COLOR[data.kind];
  return (
    <div
      className="min-w-[220px] rounded-md bg-[#1d1d21] shadow-[0_8px_24px_rgba(0,0,0,0.45)] overflow-visible"
      style={{ border: `1px solid ${color}55` }}
    >
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-[#1d1d21]"
        style={{ background: color }}
      />
      <div className="h-1 rounded-t-md" style={{ background: color }} />
      <div className="px-3 py-2 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">{data.desk}</p>
          {data.count > 0 && (
            <span
              className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
              style={{ background: `${color}22`, color }}
            >
              {data.count}
            </span>
          )}
        </div>
        <p className="text-[13px] font-semibold text-white leading-tight">{data.label}</p>
        <p className="text-[11px] text-white/50 leading-snug">{data.detail}</p>
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

function FactoryEdge({
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
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke, strokeWidth: 2.5, fill: "none" }}
      />
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
const edgeTypes = { factory: FactoryEdge };

export function FactoryCanvas() {
  const { data: deals = [] } = useQuery<AgenticDealFile[]>({
    queryKey: ["/api/agentic/deals"],
  });
  const counts = useMemo(() => countDealsOnNodes(deals), [deals]);

  const initialNodes: Node<ProcessData>[] = useMemo(
    () =>
      FACTORY_NODES.map((node) => ({
        id: node.id,
        type: "process",
        position: { x: node.x, y: node.y },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          label: node.label,
          desk: node.desk,
          detail: node.detail,
          kind: node.kind,
          count: counts[node.id] || 0,
        },
      })),
    []
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      FACTORY_EDGES.map((edge) => {
        const stop = isStopPath(edge.label);
        const stroke = stop ? "#f97066" : "#c5c5d4";
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: "out",
          targetHandle: "in",
          label: edge.label,
          type: "factory",
          className: stop ? "stop" : undefined,
          data: { stop },
          animated: false,
          style: { stroke, strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: stroke },
        };
      }),
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        data: { ...node.data, count: counts[node.id] || 0 },
      }))
    );
    setEdges((current) =>
      current.map((edge) => ({
        ...edge,
        animated: (counts[edge.source] || 0) > 0,
      }))
    );
  }, [counts, setNodes, setEdges]);

  return (
    <div className="relative h-[calc(100vh-13rem)] min-h-[560px] rounded-xl border border-white/10 overflow-hidden bg-[#141419]">
      <div className="absolute top-3 left-3 z-10 pointer-events-none">
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Strata factory</p>
        <p className="text-sm text-white/80">
          Lines are the work path. Drag the canvas · scroll to zoom
        </p>
      </div>
      <div className="absolute top-3 right-3 z-10 flex gap-2 text-[10px] uppercase tracking-wide text-white/50 pointer-events-none">
        <Legend color={KIND_COLOR.trigger} label="Trigger" />
        <Legend color={KIND_COLOR.auto} label="Agent" />
        <Legend color={KIND_COLOR.human} label="You" />
        <Legend color={KIND_COLOR.gate} label="Gate" />
        <Legend color={KIND_COLOR.output} label="Output" />
        <Legend color={KIND_COLOR.fail} label="Stop" />
      </div>
      <ReactFlow
        className="factory-canvas"
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.25}
        maxZoom={1.6}
        panOnScroll
        panOnDrag
        selectionOnDrag={false}
        defaultEdgeOptions={{
          type: "factory",
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
          nodeColor={(node) => KIND_COLOR[(node.data as ProcessData).kind] || "#666"}
          bgColor="#0e0e12"
        />
      </ReactFlow>
    </div>
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
