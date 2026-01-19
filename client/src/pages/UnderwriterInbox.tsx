import { useState } from "react";
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
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import ConversationThread from "@/components/ConversationThread";
import { useUnderwritingAccess } from "@/hooks/useUnderwritingAccess";
import { UnderwritingPaywall } from "@/components/UnderwritingPaywall";

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
      <div className="container mx-auto p-4 md:p-6 max-w-6xl">
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
    <div className="container mx-auto p-4 md:p-6 max-w-6xl pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">
            Underwriter Inbox
          </h1>
          <p className="text-muted-foreground mt-1">Review and process loan applications</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["/api/underwriting/submissions"] })
            }
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/profile">
            <Button variant="outline" size="sm" data-testid="button-profile">
              <User className="h-4 w-4 mr-2" />
              Profile
            </Button>
          </Link>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="queue" className="relative" data-testid="tab-queue">
            Queue
            {queueSubmissions.length > 0 && (
              <Badge className="ml-2 bg-blue-600 text-white">{queueSubmissions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="in-review" data-testid="tab-in-review">
            In Review
            {inReviewSubmissions.length > 0 && (
              <Badge className="ml-2 bg-amber-600 text-white">{inReviewSubmissions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
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
