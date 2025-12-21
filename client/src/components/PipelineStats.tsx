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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
      <Card className="hover-elevate">
        <CardHeader className="flex flex-row items-center justify-between pb-2 md:pb-3 pt-3 md:pt-5 px-3 md:px-5 gap-2">
          <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Total Prospects
          </CardTitle>
          <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          </div>
        </CardHeader>
        <CardContent className="px-3 md:px-5 pb-3 md:pb-5">
          <div
            className="text-2xl md:text-4xl font-bold tracking-tight"
            data-testid="text-total-prospects"
          >
            {totalProspects}
          </div>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 md:mt-2 hidden sm:block">
            Total in pipeline
          </p>
        </CardContent>
      </Card>
      <Card className="hover-elevate">
        <CardHeader className="flex flex-row items-center justify-between pb-2 md:pb-3 pt-3 md:pt-5 px-3 md:px-5 gap-2">
          <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Active
          </CardTitle>
          <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-blue-600 dark:text-blue-400" />
          </div>
        </CardHeader>
        <CardContent className="px-3 md:px-5 pb-3 md:pb-5">
          <div
            className="text-2xl md:text-4xl font-bold tracking-tight"
            data-testid="text-active-prospects"
          >
            {activeProspects}
          </div>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 md:mt-2 hidden sm:block">
            Currently processing
          </p>
        </CardContent>
      </Card>
      <Card className="hover-elevate">
        <CardHeader className="flex flex-row items-center justify-between pb-2 md:pb-3 pt-3 md:pt-5 px-3 md:px-5 gap-2">
          <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Value
          </CardTitle>
          <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center">
            <PoundSterling className="h-4 w-4 md:h-5 md:w-5 text-amber-600 dark:text-amber-400" />
          </div>
        </CardHeader>
        <CardContent className="px-3 md:px-5 pb-3 md:pb-5">
          <div
            className="text-lg md:text-3xl font-bold tracking-tight"
            data-testid="text-pipeline-value"
          >
            {totalValue}
          </div>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 md:mt-2 hidden sm:block">
            Total loan amount
          </p>
        </CardContent>
      </Card>
      <Card className="hover-elevate">
        <CardHeader className="flex flex-row items-center justify-between pb-2 md:pb-3 pt-3 md:pt-5 px-3 md:px-5 gap-2">
          <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Approved
          </CardTitle>
          <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-green-500/10 dark:bg-green-400/10 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-600 dark:text-green-400" />
          </div>
        </CardHeader>
        <CardContent className="px-3 md:px-5 pb-3 md:pb-5">
          <div
            className="text-2xl md:text-4xl font-bold tracking-tight text-green-600 dark:text-green-400"
            data-testid="text-approved-count"
          >
            {approvedCount}
          </div>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 md:mt-2 hidden sm:block">
            Successfully closed
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
