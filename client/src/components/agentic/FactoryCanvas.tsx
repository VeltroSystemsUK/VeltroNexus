import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { ProcessCanvas } from "@/components/process-canvas";
import { countDealsOnNodes } from "@shared/factoryGraph";
import {
  EMPTY_OVERRIDES,
  applyFactoryOverrides,
  mergeNodeCounts,
  toFactoryOverrides,
  type GraphOverrides,
  type ProcessEdgeRecord,
  type ProcessNodeRecord,
} from "@shared/processGraph";
import type { AgenticDealFile } from "@shared/agenticWorkflow";

const EMPTY_DEALS: AgenticDealFile[] = [];

export function FactoryCanvas() {
  const queryClient = useQueryClient();
  const [resetNonce, setResetNonce] = useState(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout>>();

  const { data: deals = EMPTY_DEALS } = useQuery<AgenticDealFile[]>({
    queryKey: ["/api/agentic/deals"],
  });
  const { data: overridesData, isFetched } = useQuery<GraphOverrides | null>({
    queryKey: ["/api/agentic/factory-graph-overrides"],
  });

  const saveMutation = useMutation({
    mutationFn: (next: GraphOverrides) => apiRequest("/api/agentic/factory-graph-overrides", "PUT", next),
    onSuccess: (_res, next) => {
      queryClient.setQueryData(["/api/agentic/factory-graph-overrides"], next);
    },
    onError: () => {
      toast.error("Couldn't save that change — the server may need restarting to pick up this feature.");
    },
  });

  const persist = useCallback(
    (graph: { nodes: ProcessNodeRecord[]; edges: ProcessEdgeRecord[] }) => {
      const next = toFactoryOverrides(graph.nodes, graph.edges);
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => saveMutation.mutate(next), 350);
    },
    [saveMutation.mutate]
  );

  const counts = useMemo(() => countDealsOnNodes(deals), [deals]);
  const graph = useMemo(
    () => applyFactoryOverrides(overridesData || EMPTY_OVERRIDES),
    [overridesData, resetNonce]
  );
  const initialNodes = useMemo(
    () => mergeNodeCounts(graph.nodes, counts),
    [graph.nodes, counts, resetNonce]
  );

  if (!isFetched) {
    return (
      <div className="h-full min-h-[480px] rounded-xl border border-white/10 bg-[#141419] flex items-center justify-center text-sm text-white/40">
        Loading blueprint…
      </div>
    );
  }

  return (
    <div className="h-full min-h-0">
      <ProcessCanvas
        key={resetNonce}
        variant="factory"
        className="h-full"
        initialNodes={initialNodes}
        initialEdges={graph.edges}
        counts={counts}
        onPersist={persist}
        onReset={() => {
          if (!confirm("Reset the blueprint back to the built-in default? This discards every custom edit.")) return;
          if (persistTimer.current) clearTimeout(persistTimer.current);
          queryClient.setQueryData(["/api/agentic/factory-graph-overrides"], EMPTY_OVERRIDES);
          saveMutation.mutate(EMPTY_OVERRIDES);
          setResetNonce((n) => n + 1);
        }}
      />
    </div>
  );
}
