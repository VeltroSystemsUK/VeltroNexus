import { useState, useMemo } from "react";
import { usePageTitle, usePageActions } from "@/context/LayoutContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UnderwritingSubmission, Prospect, Company } from "@shared/schema";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  User,
  Building2,
  Ticket,
  ArrowRight,
  RefreshCw,
  Settings,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import ConversationThread from "@/components/ConversationThread";
import { useUnderwritingAccess } from "@/hooks/useUnderwritingAccess";
import { UnderwritingPaywall } from "@/components/UnderwritingPaywall";
import { SLATimer } from "@/components/SLATimer";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const statusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  in_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  queried: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
  declined: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  withdrawn: "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-200",
  normal: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
};

type SubmissionWithDetails = UnderwritingSubmission & {
  prospect?: Prospect & { company?: Company };
  broker?: { firstName?: string; lastName?: string; email?: string };
};

export default function UnderwriterInbox() {
  usePageTitle("UNDERWRITING", "Review and process loan applications");

  const headerActions = useMemo(() => (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/underwriting/submissions"] })}
        data-testid="button-refresh"
        className="bg-transparent text-white border-slate-600 hover:bg-slate-800 hover:text-white transition-colors"
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Refresh
      </Button>
      <Link href="/profile">
        <Button
          variant="outline"
          size="sm"
          data-testid="button-profile"
          className="bg-transparent text-white border-slate-600 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <User className="h-4 w-4 mr-2" />
          Profile
        </Button>
      </Link>
    </>
  ), []);

  usePageActions(headerActions);

  const { hasAccess } = useUnderwritingAccess();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("queue");
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithDetails | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<"approved" | "declined" | "queried" | null>(
    null
  );
  const [decisionReason, setDecisionReason] = useState("");
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [messageAsQuery, setMessageAsQuery] = useState(false);

  const { data: submissions, isLoading } = useQuery<UnderwritingSubmission[]>({
    queryKey: ["/api/underwriting/submissions"],
  });

  const { data: mySubmissions } = useQuery<UnderwritingSubmission[]>({
    queryKey: ["/api/underwriting/submissions", { assigned: "me" }],
  });

  // Fetch SLA Settings for timers
  const { data: slaSettings } = useQuery<{ green: number; amber: number; red: number }>({
    queryKey: ["/api/admin/settings/sla"],
  });

  const claimMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/underwriting/submissions/${id}/claim`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/underwriting/submissions"] });
      toast.success("Submission claimed successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to claim submission");
    },
  });

  const decisionMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      decisionReason,
    }: {
      id: number;
      status: string;
      decisionReason: string;
    }) => {
      return apiRequest(`/api/underwriting/submissions/${id}`, "PATCH", { status, decisionReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/underwriting/submissions"] });
      setDecisionDialogOpen(false);
      setDecisionType(null);
      setDecisionReason("");
      toast.success("Decision recorded successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record decision");
    },
  });

  const messageMutation = useMutation({
    mutationFn: async ({
      id,
      message,
      setStatus,
    }: {
      id: number;
      message: string;
      setStatus?: string;
    }) => {
      return apiRequest(`/api/underwriting/submissions/${id}/message`, "POST", {
        message,
        setStatus,
      });
    },
    onSuccess: () => {
      if (selectedSubmission) {
        queryClient.invalidateQueries({
          queryKey: [`/api/underwriting/submissions/${selectedSubmission.id}/activities`],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/underwriting/submissions"] });
      setMessageDialogOpen(false);
      setNewMessage("");
      setMessageAsQuery(false);
      toast.success(messageAsQuery ? "Query sent to broker" : "Message sent successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send message");
    },
  });

  const handleSendMessage = () => {
    if (!selectedSubmission || !newMessage.trim()) return;
    messageMutation.mutate({
      id: selectedSubmission.id,
      message: newMessage,
      setStatus: messageAsQuery ? "queried" : undefined,
    });
  };

  const queueSubmissions = submissions?.filter((s) => s.status === "submitted") || [];
  const inReviewSubmissions =
    submissions?.filter((s) => s.status === "in_review" || s.status === "queried") || [];
  const completedSubmissions =
    submissions?.filter((s) => ["approved", "declined", "withdrawn"].includes(s.status)) || [];

  const handleClaim = (submission: UnderwritingSubmission) => {
    claimMutation.mutate(submission.id);
  };

  const handleViewDetails = (submission: UnderwritingSubmission) => {
    setSelectedSubmission(submission as SubmissionWithDetails);
    setDetailDialogOpen(true);
  };

  const handleDecision = (type: "approved" | "declined" | "queried") => {
    setDecisionType(type);
    setDecisionDialogOpen(true);
  };

  const submitDecision = () => {
    if (!selectedSubmission || !decisionType) return;
    decisionMutation.mutate({
      id: selectedSubmission.id,
      status: decisionType,
      decisionReason,
    });
  };

  const prioritySubmissions = useMemo(() => {
    if (!submissions) return [];
    return submissions
      .filter((s) => ["submitted", "in_review", "queried"].includes(s.status))
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
      .slice(0, 1);
  }, [submissions]);

  const analyticsData = useMemo(() => {
    if (!submissions) return { trend: [], sla: [], avgResponseTime: "0.0" };

    // 1. Trend (Last 7 Days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d;
    }).reverse();

    const trend = last7Days.map(date => {
      const dateStr = format(date, "yyyy-MM-dd");
      return {
        date: format(date, "dd MMM"),
        count: submissions.filter(s => format(new Date(s.submittedAt), "yyyy-MM-dd") === dateStr).length
      };
    });

    // 2. SLA Compliance (Real Logic)
    const amberLimit = (slaSettings?.amber || 24) * 60 * 60 * 1000;
    const redLimit = (slaSettings?.red || 48) * 60 * 60 * 1000;

    let onTrack = 0;
    let atRisk = 0;
    let breached = 0;

    submissions.forEach(s => {
      const submitted = new Date(s.submittedAt).getTime();
      // @ts-ignore
      const updatedVal = s.status === 'submitted' || s.status === 'in_review' || s.status === 'queried' ? null : s.updatedAt;
      const end = updatedVal ? new Date(updatedVal).getTime() : Date.now();

      const elapsed = end - submitted;

      if (elapsed > redLimit) {
        breached++;
      } else if (elapsed > amberLimit) {
        atRisk++;
      } else {
        onTrack++;
      }
    });

    const sla = [
      { name: "On Track", value: onTrack, color: "#22c55e" },
      { name: "At Risk", value: atRisk, color: "#f59e0b" },
      { name: "Breached", value: breached, color: "#ef4444" },
    ];

    // 3. Avg Response Time (Completed items only)
    const completed = submissions.filter(s => ["approved", "declined"].includes(s.status));
    let totalTime = 0;
    completed.forEach(s => {
      const submitted = new Date(s.submittedAt).getTime();
      // @ts-ignore
      const updated = new Date(s.updatedAt || Date.now()).getTime();
      totalTime += (updated - submitted);
    });

    // Avg in hours
    const avgResponseTime = completed.length ? (totalTime / completed.length / (1000 * 60 * 60)).toFixed(1) : "0.0";

    return { trend, sla, avgResponseTime };
  }, [submissions, slaSettings]);

  const AnalyticsWidget = () => (
    <div className="space-y-6">
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader className="pb-4 border-b border-slate-800/50 mb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Prospects Received
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[150px] w-full p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analyticsData.trend}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px' }}
                itemStyle={{ color: '#fff' }}
                cursor={{ stroke: '#334155' }}
              />
              <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader className="pb-4 border-b border-slate-800/50 mb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            SLA Targets
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[150px] w-full flex items-center justify-center relative p-2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={analyticsData.sla}
                innerRadius={35}
                outerRadius={55}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {analyticsData.sla.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none mt-2">
            <span className="text-xl font-bold">
              {analyticsData.sla.reduce((acc, curr) => acc + curr.value, 0) > 0
                ? Math.round((analyticsData.sla[0].value / analyticsData.sla.reduce((acc, curr) => acc + curr.value, 0)) * 100)
                : 0}%
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Hit Rate</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const PriorityWidget = ({ submission }: { submission: SubmissionWithDetails }) => (
    <Card className="border-red-500/50 bg-red-500/5 dark:bg-red-900/10 shadow-sm">
      <CardHeader className="pb-3 border-b border-red-200/10 mb-3">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold animate-pulse">
          <AlertCircle className="h-5 w-5" />
          <span>Urgent Attention Needed</span>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Prospect</p>
            <p className="font-bold text-lg leading-tight">
              {submission.prospect?.company?.companyName || `Prospect #${submission.prospectId}`}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Time Elapsed</p>
            <SLATimer submittedAt={submission.submittedAt} slaSettings={slaSettings || { green: 4, amber: 24, red: 48 }} />
          </div>

          <Button
            className="w-full bg-red-600 hover:bg-red-700 text-white shadow-md transition-all hover:scale-[1.02]"
            onClick={() => handleViewDetails(submission)}
          >
            Review Now
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const SubmissionCard = ({ submission }: { submission: SubmissionWithDetails }) => (
    <Card className="hover-elevate cursor-pointer" onClick={() => handleViewDetails(submission)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span
                className="font-semibold truncate"
                data-testid={`text-prospect-${submission.id}`}
              >
                {submission.prospect?.company?.companyName || `Prospect #${submission.prospectId}`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{format(new Date(submission.submittedAt), "dd MMM yyyy HH:mm")}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge
              className={statusColors[submission.status]}
              data-testid={`badge-status-${submission.id}`}
            >
              {submission.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className={priorityColors[submission.priority]}>
              {submission.priority}
            </Badge>
          </div>
        </div>

        {/* SLA Timer */}
        <div className="mb-3">
          <SLATimer
            submittedAt={submission.submittedAt}
            slaSettings={slaSettings || { green: 4, amber: 24, red: 48 }}
          />
        </div>

        {submission.brokerComments && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">

            {submission.brokerComments}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          {submission.status === "submitted" && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleClaim(submission);
              }}
              disabled={claimMutation.isPending}
              data-testid={`button-claim-${submission.id}`}
            >
              {claimMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Claim"}
            </Button>
          )}
          {submission.status === "in_review" && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 border-green-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSubmission(submission as SubmissionWithDetails);
                  handleDecision("approved");
                }}
                data-testid={`button-approve-${submission.id}`}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSubmission(submission as SubmissionWithDetails);
                  handleDecision("declined");
                }}
                data-testid={`button-decline-${submission.id}`}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Decline
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSubmission(submission as SubmissionWithDetails);
                  handleDecision("queried");
                }}
                data-testid={`button-query-${submission.id}`}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Query
              </Button>
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/prospect/${submission.prospectId}`);
            }}
            data-testid={`button-view-prospect-${submission.id}`}
          >
            View Prospect
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="w-full p-4 md:p-6">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-12 w-full mb-4" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Show paywall if user doesn't have access
  if (!hasAccess) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <UnderwritingPaywall />
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-6 pb-24 md:pb-6">


      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Priority Cases */}
        <div className="lg:col-span-1 space-y-6">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Priority Cases
            </h2>

            {prioritySubmissions.length > 0 ? (
              prioritySubmissions.map(s => <PriorityWidget key={s.id} submission={s as SubmissionWithDetails} />)
            ) : (
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50 text-green-500" />
                  <p className="text-sm font-medium">No urgent cases pending</p>
                  <p className="text-xs opacity-70 mt-1">Great job clearing the queue!</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Quick Stats or Tips could technically go here */}
          <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10">
            <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Pro Tip
            </h3>
            <p className="text-xs text-muted-foreground">
              Submissions are prioritized based on SLA timers. Clear "Red" alerts first to maintain compliance.
            </p>
          </div>
        </div>

        {/* Right Column: Inbox Tabs */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50 p-1">
              <TabsTrigger value="queue" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all" data-testid="tab-queue">
                Queue
                {queueSubmissions.length > 0 && (
                  <Badge className="ml-2 bg-blue-600 text-white">{queueSubmissions.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="in-review" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all" data-testid="tab-in-review">
                In Review
                {inReviewSubmissions.length > 0 && (
                  <Badge className="ml-2 bg-amber-600 text-white">{inReviewSubmissions.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all" data-testid="tab-completed">
                Completed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="queue" className="space-y-4">
              {queueSubmissions.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No submissions in queue</h3>
                    <p className="text-muted-foreground text-center">
                      New submissions will appear here for you to claim and review.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                queueSubmissions.map((submission) => (
                  <SubmissionCard key={submission.id} submission={submission} />
                ))
              )}
            </TabsContent>

            <TabsContent value="in-review" className="space-y-4">
              {inReviewSubmissions.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No submissions in review</h3>
                    <p className="text-muted-foreground text-center">
                      Claim a submission from the queue to start reviewing.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                inReviewSubmissions.map((submission) => (
                  <SubmissionCard key={submission.id} submission={submission} />
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completedSubmissions.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No completed submissions</h3>
                    <p className="text-muted-foreground text-center">
                      Completed submissions will appear here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                completedSubmissions.map((submission) => (
                  <SubmissionCard key={submission.id} submission={submission} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Analytics */}
        <div className="hidden lg:block lg:col-span-1 space-y-6">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-primary" />
              Analytics
            </h2>
            <AnalyticsWidget />
          </div>

          <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-5 w-5 text-blue-400" />
              <span className="font-semibold text-sm">Avg. Response Time</span>
            </div>
            <p className="text-2xl font-bold text-white">{analyticsData.avgResponseTime} hrs</p>
            <p className="text-xs text-slate-400 mt-1">
              Based on completed reviews
            </p>
          </div>
        </div>
      </div>

      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionType === "approved" && "Approve Application"}
              {decisionType === "declined" && "Decline Application"}
              {decisionType === "queried" && "Query Broker"}
            </DialogTitle>
            <DialogDescription>
              {decisionType === "approved" && "Confirm approval of this loan application."}
              {decisionType === "declined" && "Provide a reason for declining this application."}
              {decisionType === "queried" && "Request additional information from the broker."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="decision-reason">
              {decisionType === "queried" ? "Your Question" : "Reason / Notes"}
            </Label>
            <Textarea
              id="decision-reason"
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              placeholder={
                decisionType === "approved"
                  ? "Optional notes for approval..."
                  : decisionType === "declined"
                    ? "Please provide a reason for declining..."
                    : "What information do you need from the broker?"
              }
              className="mt-2"
              rows={4}
              data-testid="input-decision-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitDecision}
              disabled={
                decisionMutation.isPending || (decisionType !== "approved" && !decisionReason)
              }
              className={
                decisionType === "approved"
                  ? "bg-green-600 hover:bg-green-700"
                  : decisionType === "declined"
                    ? "bg-red-600 hover:bg-red-700"
                    : ""
              }
              data-testid="button-confirm-decision"
            >
              {decisionMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {decisionType === "approved" && "Approve"}
              {decisionType === "declined" && "Decline"}
              {decisionType === "queried" && "Send Query"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog with Conversation Thread */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {selectedSubmission?.prospect?.company?.companyName ||
                `Submission #${selectedSubmission?.id}`}
            </DialogTitle>
            <DialogDescription>Review details and communication history</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Submission Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <div className="mt-1">
                  <Badge className={statusColors[selectedSubmission?.status || "submitted"]}>
                    {selectedSubmission?.status?.replace("_", " ")}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <div className="mt-1">
                  <Badge className={priorityColors[selectedSubmission?.priority || "normal"]}>
                    {selectedSubmission?.priority}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Submitted</Label>
                <p className="text-sm mt-1">
                  {selectedSubmission?.submittedAt &&
                    format(new Date(selectedSubmission.submittedAt), "dd MMM yyyy HH:mm")}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Broker</Label>
                <p className="text-sm mt-1">
                  {selectedSubmission?.broker?.firstName} {selectedSubmission?.broker?.lastName}
                </p>
              </div>
            </div>

            {selectedSubmission?.brokerComments && (
              <div>
                <Label className="text-xs text-muted-foreground">Initial Comments</Label>
                <p className="text-sm mt-1 p-3 bg-muted rounded-lg">
                  {selectedSubmission.brokerComments}
                </p>
              </div>
            )}

            <Separator />

            {/* Conversation Thread */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Communication History</Label>
                {selectedSubmission &&
                  (selectedSubmission.status === "in_review" ||
                    selectedSubmission.status === "queried") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setMessageDialogOpen(true)}
                      data-testid="button-send-message"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                  )}
              </div>
              {selectedSubmission && (
                <ConversationThread submissionId={selectedSubmission.id} maxHeight="300px" />
              )}
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 justify-between border-t pt-4">
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
            <div className="flex gap-2">
              {selectedSubmission?.status === "in_review" && (
                <>
                  <Button
                    variant="outline"
                    className="text-green-600 border-green-600"
                    onClick={() => {
                      setDetailDialogOpen(false);
                      handleDecision("approved");
                    }}
                    data-testid="button-detail-approve"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-600"
                    onClick={() => {
                      setDetailDialogOpen(false);
                      handleDecision("declined");
                    }}
                    data-testid="button-detail-decline"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                </>
              )}
              <Button
                onClick={() => {
                  setDetailDialogOpen(false);
                  setLocation(`/prospect/${selectedSubmission?.prospectId}`);
                }}
                data-testid="button-detail-view-prospect"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                View Full Prospect
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Send Message to Broker
            </DialogTitle>
            <DialogDescription>
              Send a message or query to the broker regarding this submission.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="new-message">Your Message</Label>
              <Textarea
                id="new-message"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="mt-2"
                rows={4}
                data-testid="input-new-message"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="message-as-query"
                checked={messageAsQuery}
                onChange={(e) => setMessageAsQuery(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
                data-testid="checkbox-message-as-query"
              />
              <Label htmlFor="message-as-query" className="text-sm font-normal">
                Mark as query (requires broker response)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || messageMutation.isPending}
              data-testid="button-submit-message"
            >
              {messageMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send {messageAsQuery ? "Query" : "Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
