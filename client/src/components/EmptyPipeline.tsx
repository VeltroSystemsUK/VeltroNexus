import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

interface EmptyPipelineProps {
  onAddProspect: () => void;
}

export default function EmptyPipeline({ onAddProspect }: EmptyPipelineProps) {
  return (
    <Card>
      <CardContent className="text-center py-12">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4" data-testid="text-empty-message">
          No prospects in your pipeline yet
        </p>
        <Button onClick={onAddProspect} data-testid="button-add-prospect">
          Retrieve Data
        </Button>
      </CardContent>
    </Card>
  );
}
