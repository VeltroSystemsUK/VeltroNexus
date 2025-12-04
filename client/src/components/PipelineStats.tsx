import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, TrendingUp, PoundSterling, CheckCircle2 } from "lucide-react";

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      <Card className="hover-elevate">
        <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-5 gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Total Prospects
          </CardTitle>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="text-4xl font-bold tracking-tight" data-testid="text-total-prospects">
            {totalProspects}
          </div>
          <p className="text-sm text-muted-foreground mt-2">Total in pipeline</p>
        </CardContent>
      </Card>
      <Card className="hover-elevate">
        <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-5 gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Active Pipeline
          </CardTitle>
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="text-4xl font-bold tracking-tight" data-testid="text-active-prospects">
            {activeProspects}
          </div>
          <p className="text-sm text-muted-foreground mt-2">Currently processing</p>
        </CardContent>
      </Card>
      <Card className="hover-elevate">
        <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-5 gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Pipeline Value
          </CardTitle>
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center">
            <PoundSterling className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="text-3xl font-bold tracking-tight" data-testid="text-pipeline-value">
            {totalValue}
          </div>
          <p className="text-sm text-muted-foreground mt-2">Total loan amount</p>
        </CardContent>
      </Card>
      <Card className="hover-elevate">
        <CardHeader className="flex flex-row items-center justify-between pb-3 pt-5 px-5 gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Approved
          </CardTitle>
          <div className="h-10 w-10 rounded-lg bg-green-500/10 dark:bg-green-400/10 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="text-4xl font-bold tracking-tight text-green-600 dark:text-green-400" data-testid="text-approved-count">
            {approvedCount}
          </div>
          <p className="text-sm text-muted-foreground mt-2">Successfully closed</p>
        </CardContent>
      </Card>
    </div>
  );
}
