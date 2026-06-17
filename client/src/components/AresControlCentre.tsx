import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Play, Activity, TrendingUp, Clock, CheckCircle2, AlertTriangle, Calendar } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface AgentMetrics {
    agentId: string;
    agentName: string;
    successRate: number;
    averageJobTime: number;
    totalJobs: number;
    failedJobs: number;
    currentLoad: number;
}

interface ScheduleStatus {
    running: boolean;
    enabled: boolean;
    scheduledTime: string;
    lastRunDate: string | null;
    nextRunDate: string;
}

export function AresControlCentre() {
    const queryClient = useQueryClient();
    const [lastRun, setLastRun] = useState<string | null>(null);

    // Fetch agent metrics
    const { data: metrics, isLoading } = useQuery<AgentMetrics[]>({
        queryKey: ["/api/ares/metrics"],
        refetchInterval: 5000, // Refresh every 5 seconds
    });

    // Fetch scheduler status
    const { data: scheduleStatus } = useQuery<ScheduleStatus>({
        queryKey: ["/api/ares/schedule"],
        refetchInterval: 60000, // Refresh every minute
    });

    // Trigger autonomous loop
    const runMutation = useMutation({
        mutationFn: () => apiRequest("/api/ares/run", "POST"),
        onSuccess: () => {
            setLastRun(new Date().toLocaleTimeString());
            queryClient.invalidateQueries({ queryKey: ["/api/ares/metrics"] });
            queryClient.invalidateQueries({ queryKey: ["/api/agent-jobs"] });
        },
    });

    // Toggle scheduler
    const toggleSchedulerMutation = useMutation({
        mutationFn: (enabled: boolean) =>
            apiRequest("/api/ares/schedule", "POST", { enabled }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/ares/schedule"] });
        },
    });

    const getHealthStatus = (successRate: number) => {
        if (successRate >= 95) return { label: "Excellent", color: "text-emerald-500", bg: "bg-emerald-500/10" };
        if (successRate >= 80) return { label: "Good", color: "text-blue-500", bg: "bg-blue-500/10" };
        if (successRate >= 60) return { label: "Fair", color: "text-amber-500", bg: "bg-amber-500/10" };
        return { label: "Poor", color: "text-red-500", bg: "bg-red-500/10" };
    };

    const overallHealth = metrics
        ? metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length
        : 0;
    const totalJobs = metrics?.reduce((sum, m) => sum + m.totalJobs, 0) || 0;
    const activeJobs = metrics?.reduce((sum, m) => sum + m.currentLoad, 0) || 0;

    return (
        <div className="space-y-6">
            {/* Header with Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-border bg-card/60">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs text-muted-foreground">System Health</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-2xl font-bold text-foreground">
                                {overallHealth.toFixed(1)}%
                            </div>
                            <Activity className={cn("w-5 h-5", getHealthStatus(overallHealth).color)} />
                        </div>
                        <Progress value={overallHealth} className="h-1 mt-2" />
                    </CardContent>
                </Card>

                <Card className="border-border bg-card/60">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs text-muted-foreground">Active Jobs</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-2xl font-bold text-foreground">{activeJobs}</div>
                            <Play className="w-5 h-5 text-blue-500" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Currently running</p>
                    </CardContent>
                </Card>

                <Card className="border-border bg-card/60">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs text-muted-foreground">Total Jobs</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-2xl font-bold text-foreground">{totalJobs}</div>
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">All time</p>
                    </CardContent>
                </Card>

                <Card className="border-border bg-card/60">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs text-muted-foreground">Last Run</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-foreground">
                                {lastRun || "Never"}
                            </div>
                            <Clock className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Autonomous loop</p>
                    </CardContent>
                </Card>
            </div>

            {/* Control Panel */}
            <Card className="border-border bg-card/60">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-foreground">Autonomous Control</CardTitle>
                            <CardDescription>Trigger autonomous orchestration and monitoring</CardDescription>
                        </div>
                        <Button
                            onClick={() => runMutation.mutate()}
                            disabled={runMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            <Play className="w-4 h-4 mr-2" />
                            {runMutation.isPending ? "Running..." : "Run ARES Loop"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {runMutation.isSuccess && (
                        <div className="flex items-center gap-2 text-sm text-emerald-500 bg-emerald-500/10 p-3 rounded-md">
                            <CheckCircle2 className="w-4 h-4" />
                            Autonomous loop completed successfully
                        </div>
                    )}
                    {runMutation.isError && (
                        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 p-3 rounded-md">
                            <AlertTriangle className="w-4 h-4" />
                            Failed to run autonomous loop
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Scheduler Settings */}
            <Card className="border-border bg-card/60">
                <CardHeader>
                    <CardTitle className="text-foreground">Automated Schedule</CardTitle>
                    <CardDescription>Configure daily autonomous enrichment</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white/[0.05] rounded-lg">
                            <div className="flex-1">
                                <Label className="text-foreground font-medium">Daily Auto-Enrichment</Label>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Automatically run enrichment daily at {scheduleStatus?.scheduledTime || "09:00"}
                                </p>
                            </div>
                            <Switch
                                checked={scheduleStatus?.enabled || false}
                                onCheckedChange={(checked) => toggleSchedulerMutation.mutate(checked)}
                                disabled={toggleSchedulerMutation.isPending}
                            />
                        </div>

                        {scheduleStatus?.enabled && (
                            <div className="flex items-center gap-2 text-sm bg-blue-500/10 text-blue-400 p-3 rounded-md">
                                <Calendar className="w-4 h-4" />
                                <div>
                                    <div className="font-medium">Next Run</div>
                                    <div className="text-xs text-blue-300">
                                        {new Date(scheduleStatus.nextRunDate).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Agent Performance Metrics */}
            <Card className="border-border bg-card/60">
                <CardHeader>
                    <CardTitle className="text-foreground">Agent Performance</CardTitle>
                    <CardDescription>Real-time metrics for the AI workforce</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-sm text-muted-foreground">Loading metrics...</div>
                    ) : metrics && metrics.length > 0 ? (
                        <div className="space-y-4">
                            {metrics.map((agent) => {
                                const health = getHealthStatus(agent.successRate);
                                return (
                                    <div
                                        key={agent.agentId}
                                        className="flex items-center justify-between p-4 bg-white/[0.05] rounded-lg border border-border"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h4 className="font-medium text-foreground">{agent.agentName}</h4>
                                                <Badge className={cn(health.bg, health.color, "border-0")}>
                                                    {health.label}
                                                </Badge>
                                                {agent.currentLoad > 0 && (
                                                    <Badge variant="outline" className="border-blue-500 text-blue-500">
                                                        {agent.currentLoad} active
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="mt-2 grid grid-cols-4 gap-4 text-xs">
                                                <div>
                                                    <span className="text-muted-foreground">Success Rate</span>
                                                    <div className="font-semibold text-foreground mt-1">
                                                        {agent.successRate.toFixed(1)}%
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Avg Time</span>
                                                    <div className="font-semibold text-foreground mt-1">
                                                        {agent.averageJobTime}s
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Total Jobs</span>
                                                    <div className="font-semibold text-foreground mt-1">
                                                        {agent.totalJobs}
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Failed</span>
                                                    <div className="font-semibold text-foreground mt-1">
                                                        {agent.failedJobs}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ml-4">
                                            <Progress value={agent.successRate} className="h-2 w-24" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground text-center py-8">
                            No agent metrics available. Run the ARES loop to collect data.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
