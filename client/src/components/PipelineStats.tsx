import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PipelineStatsProps {
  totalProspects: number;
  activeProspects: number;
  totalValue: string;
  approvedCount: number;
}

export default function PipelineStats({
  totalProspects,
  activeProspects,
  totalValue,
  approvedCount,
}: PipelineStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Prospects
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-total-prospects">
            {totalProspects}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Active Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-active-prospects">
            {activeProspects}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Pipeline Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-pipeline-value">
            {totalValue}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Approved
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-approved-count">
            {approvedCount}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
