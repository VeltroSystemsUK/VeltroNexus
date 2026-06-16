import { Button } from "@/components/ui/button";
import { Building2, Plus } from "lucide-react";

interface EmptyPipelineProps {
  onAddProspect: () => void;
}

export default function EmptyPipeline({ onAddProspect }: EmptyPipelineProps) {
  return (
    <div className="glass relative overflow-hidden grain mx-auto max-w-2xl mt-6 md:mt-10 p-10 md:p-14 text-center">
      <div className="aurora-field">
        <div className="aurora-blob b1" />
        <div className="aurora-blob b3" />
      </div>
      <div className="relative z-10">
        <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <div className="kicker">Your deck is clear</div>
        <h3
          className="text-xl md:text-2xl font-semibold tracking-tight mt-2"
          data-testid="text-empty-message"
        >
          No deals in the pipeline yet
        </h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
          Pull a company from Companies House to start your first deal — Veltro takes
          it from signal to funded.
        </p>
        <Button onClick={onAddProspect} className="mt-6 accent-glow" data-testid="button-add-prospect">
          <Plus className="mr-2 h-4 w-4" /> Retrieve company data
        </Button>
      </div>
    </div>
  );
}
