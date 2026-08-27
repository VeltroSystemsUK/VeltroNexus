export const STAGE_ID_ALIASES: Record<string, string> = {
  proposal: "packaging",
  approval: "further-information",
  withdrawn: "declined",
  due_diligence: "due-diligence",
};

export function remapStageId(id: string): string {
  return STAGE_ID_ALIASES[id] ?? id;
}

export interface PipelineStageDef {
  id: string;
  label: string;
  color: string;
}

export const DEFAULT_PIPELINE_STAGES: PipelineStageDef[] = [
  { id: "lead", label: "Lead", color: "#3B82F6" },
  { id: "contacted", label: "Contacted", color: "#6366F1" },
  { id: "qualified", label: "Qualified", color: "#8B5CF6" },
  { id: "packaging", label: "Packaging", color: "#EC4899" },
  { id: "due-diligence", label: "Due Diligence", color: "#F43F5E" },
  { id: "submission", label: "Submitted", color: "#0EA5E9" },
  { id: "further-information", label: "Further Information", color: "#FB923C" },
  { id: "declined", label: "Declined", color: "#6B7280" },
  { id: "approved", label: "Approved", color: "#10B981" },
];

export function remapSavedPipelineStages(saved: unknown): unknown {
  if (!saved) return saved;

  if (Array.isArray(saved)) {
    const seen = new Set<string>();
    const remapped: PipelineStageDef[] = [];
    for (const stage of saved) {
      if (!stage || typeof stage !== "object" || !("id" in stage)) continue;
      const id = remapStageId(String((stage as { id: string }).id));
      if (seen.has(id)) continue;
      seen.add(id);
      const def = DEFAULT_PIPELINE_STAGES.find((item) => item.id === id);
      remapped.push({
        id,
        label: def?.label ?? String((stage as { label?: string }).label || id),
        color: (stage as { color?: string }).color || def?.color || "#6B7280",
      });
    }
    return remapped;
  }

  if (typeof saved === "object") {
    const remapped: Record<string, string> = {};
    for (const [id, label] of Object.entries(saved as Record<string, string>)) {
      remapped[remapStageId(id)] = label;
    }
    return remapped;
  }

  return saved;
}
