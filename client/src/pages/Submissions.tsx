import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import ThemeToggle from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Send, Building2, Calendar, FileText, Mail, MailX, TrendingUp, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ApplicationSubmission, Prospect, Lender } from "@shared/schema";

type SubmissionWithDetails = ApplicationSubmission & {
  prospect: Prospect & {
    company: {
      companyName: string;
    };
  };
  lender: Lender;
};

export default function Submissions() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });
  
  const { data: submissions = [], isLoading } = useQuery<SubmissionWithDetails[]>({
    queryKey: ["/api/submissions"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      await apiRequest(`/api/submissions/${submissionId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      toast({
        title: "Submission deleted",
        description: "The submission has been deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete submission",
        variant: "destructive",
      });
    },
  });

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
      case "approved":
        return "bg-green-500/10 text-green-700 dark:text-green-300";
      case "declined":
        return "bg-red-500/10 text-red-700 dark:text-red-300";
      case "withdrawn":
        return "bg-gray-500/10 text-gray-700 dark:text-gray-300";
      default:
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300";
    }
  };

  const pendingSubmissions = submissions.filter(s => s.status === "pending" || s.status === "sent");
  const approvedSubmissions = submissions.filter(s => s.status === "approved");
  const declinedSubmissions = submissions.filter(s => s.status === "declined");

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col h-screen">
        <header className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold" data-testid="text-app-title">FlowLoan</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-user-menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild data-testid="menu-item-profile">
                  <Link href="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild data-testid="menu-item-settings">
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild data-testid="menu-item-pipeline">
                  <Link href="/pipeline">Pipeline</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild data-testid="menu-item-dashboard">
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} data-testid="menu-item-logout">Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Application Submissions</h2>
              <p className="text-muted-foreground">Track all your loan applications submitted to lenders</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending/Sent</CardTitle>
                  <Send className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-pending-count">{pendingSubmissions.length}</div>
                  <p className="text-xs text-muted-foreground">Awaiting response</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Approved</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-approved-count">{approvedSubmissions.length}</div>
                  <p className="text-xs text-muted-foreground">Successfully approved</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Declined</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-declined-count">{declinedSubmissions.length}</div>
                  <p className="text-xs text-muted-foreground">Not approved</p>
                </CardContent>
              </Card>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading submissions...</p>
              </div>
            ) : submissions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Send className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No submissions yet</h3>
                  <p className="text-muted-foreground mb-4">Submit applications from the Pipeline view</p>
                  <Link href="/pipeline">
                    <Button>Go to Pipeline</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {submissions.map((submission) => (
                  <Card key={submission.id} data-testid={`card-submission-${submission.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            {submission.prospect.company.companyName}
                          </CardTitle>
                          <CardDescription>
                            Submitted to {submission.lender.institutionName}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={getStatusColor(submission.status)}>
                            {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                          </Badge>
                          {submission.emailSent ? (
                            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <Mail className="h-3 w-3" />
                              <span>Email sent</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                              <MailX className="h-3 w-3" />
                              <span>Email failed</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Sent:</span>
                            <span>{submission.sentAt ? format(new Date(submission.sentAt), "PPP") : 'Pending'}</span>
                          </div>
                          {submission.prospect.loanAmount && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">Amount:</span>
                              <span className="font-semibold">£{(submission.prospect.loanAmount / 100).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Lender Contact:</span>
                            <div className="mt-1">
                              {submission.lender.contactName && (
                                <div>{submission.lender.contactName}</div>
                              )}
                              <div className="text-muted-foreground">{submission.lender.email}</div>
                              {submission.lender.phone && (
                                <div className="text-muted-foreground">{submission.lender.phone}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {submission.commentary && (
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Commentary:</div>
                          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                            {submission.commentary}
                          </div>
                        </div>
                      )}
                      {submission.responseNotes && (
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Response Notes:</div>
                          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                            {submission.responseNotes}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Link href={`/prospect/${submission.prospectId}`}>
                          <Button variant="outline" size="sm" data-testid={`button-view-prospect-${submission.id}`}>
                            View Prospect
                          </Button>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              data-testid={`button-delete-submission-${submission.id}`}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Submission?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this submission to {submission.lender.institutionName}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid={`button-cancel-delete-${submission.id}`}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                data-testid={`button-confirm-delete-${submission.id}`}
                                onClick={() => deleteMutation.mutate(submission.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
