import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Mail,
    Send,
    X,
    Clock,
    CheckCircle2,
    XCircle,
    Eye
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface PendingEmail {
    id: string;
    prospectName: string;
    prospectCompany: string;
    subject: string;
    body: string;
    status: "pending" | "approved" | "rejected" | "sent";
    createdAt: string;
}

export default function OutreachQueue() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedEmail, setSelectedEmail] = useState<PendingEmail | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    // Fetch pending emails
    const { data: emails, isLoading } = useQuery<PendingEmail[]>({
        queryKey: ["/api/outreach/pending"],
        refetchInterval: 10000, // Refresh every 10 seconds
    });

    // Approve and send mutation
    const approveMutation = useMutation({
        mutationFn: (emailId: string) =>
            apiRequest(`/api/outreach/${emailId}/approve`, "POST"),
        onSuccess: () => {
            toast({
                title: "Email sent!",
                description: "The outreach email has been sent successfully.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/outreach/pending"] });
            setSelectedEmail(null);
        },
        onError: () => {
            toast({
                title: "Failed to send",
                description: "Could not send the email. Please try again.",
                variant: "destructive",
            });
        },
    });

    // Reject mutation
    const rejectMutation = useMutation({
        mutationFn: ({ emailId, reason }: { emailId: string; reason: string }) =>
            apiRequest(`/api/outreach/${emailId}/reject`, "POST", { reason }),
        onSuccess: () => {
            toast({
                title: "Email rejected",
                description: "The email has been removed from the queue.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/outreach/pending"] });
            setSelectedEmail(null);
            setRejectReason("");
        },
    });

    const pendingCount = emails?.filter(e => e.status === "pending").length || 0;

    return (
        <div className="container mx-auto py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-100">Outreach Approval Queue</h1>
                    <p className="text-slate-400 mt-2">
                        Review and approve AI-generated outreach emails before sending
                    </p>
                </div>
                <Button
                    onClick={() => {
                        apiRequest("/api/outreach/generate-mock-test", "POST")
                            .then((data: any) => {
                                toast({
                                    title: "Test emails generated!",
                                    description: `Created ${data.emails?.length || 3} sample emails.`,
                                });
                                queryClient.setQueryData(["/api/outreach/pending"], data.emails);
                            })
                            .catch(() => {
                                toast({
                                    title: "Generation failed",
                                    description: "Could not generate test emails.",
                                    variant: "destructive",
                                });
                            });
                    }}
                    variant="outline"
                    className="gap-2"
                >
                    <Mail className="w-4 h-4" />
                    Generate Test Emails
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-slate-800 bg-slate-900/50">
                    <CardHeader className="pb-3">
                        <CardDescription className="text-xs text-slate-400">Pending Approval</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-3xl font-bold text-slate-100">{pendingCount}</div>
                            <Clock className="w-8 h-8 text-amber-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-800 bg-slate-900/50">
                    <CardHeader className="pb-3">
                        <CardDescription className="text-xs text-slate-400">Sent Today</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-3xl font-bold text-slate-100">
                                {emails?.filter(e => e.status === "sent").length || 0}
                            </div>
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-800 bg-slate-900/50">
                    <CardHeader className="pb-3">
                        <CardDescription className="text-xs text-slate-400">Rejected</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="text-3xl font-bold text-slate-100">
                                {emails?.filter(e => e.status === "rejected").length || 0}
                            </div>
                            <XCircle className="w-8 h-8 text-red-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Email List */}
            <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                    <CardTitle className="text-slate-100">Pending Emails</CardTitle>
                    <CardDescription>Click to review and approve</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-sm text-slate-400 text-center py-8">Loading...</div>
                    ) : emails && emails.length > 0 ? (
                        <div className="space-y-3">
                            {emails.filter(e => e.status === "pending").map((email) => (
                                <div
                                    key={email.id}
                                    className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
                                    onClick={() => setSelectedEmail(email)}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-blue-400" />
                                            <h4 className="font-medium text-slate-200">{email.prospectCompany}</h4>
                                            <Badge variant="outline" className="text-xs">
                                                {email.prospectName}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-slate-400 mt-1">{email.subject}</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Created {new Date(email.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="ml-4"
                                    >
                                        <Eye className="w-4 h-4 mr-2" />
                                        Review
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-slate-400 text-center py-8">
                            No pending emails. ARES will generate outreach emails after discovering new prospects.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Review Dialog */}
            <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
                <DialogContent className="max-w-2xl bg-slate-900 border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="text-slate-100">Review Outreach Email</DialogTitle>
                        <DialogDescription>
                            Review the AI-generated email before sending
                        </DialogDescription>
                    </DialogHeader>

                    {selectedEmail && (
                        <div className="space-y-4">
                            {/* Prospect Info */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-lg">
                                <div>
                                    <Label className="text-xs text-slate-400">Company</Label>
                                    <p className="text-sm text-slate-200 font-medium">{selectedEmail.prospectCompany}</p>
                                </div>
                                <div>
                                    <Label className="text-xs text-slate-400">Contact</Label>
                                    <p className="text-sm text-slate-200 font-medium">{selectedEmail.prospectName}</p>
                                </div>
                            </div>

                            {/* Email Content */}
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-slate-400">Subject</Label>
                                    <Input
                                        value={selectedEmail.subject}
                                        readOnly
                                        className="bg-slate-800 border-slate-700 text-slate-100 mt-1"
                                    />
                                </div>

                                <div>
                                    <Label className="text-slate-400">Body</Label>
                                    <Textarea
                                        value={selectedEmail.body}
                                        readOnly
                                        rows={10}
                                        className="bg-slate-800 border-slate-700 text-slate-100 mt-1 font-mono text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (selectedEmail) {
                                    rejectMutation.mutate({
                                        emailId: selectedEmail.id,
                                        reason: rejectReason || "Manual rejection",
                                    });
                                }
                            }}
                            disabled={rejectMutation.isPending}
                        >
                            <X className="w-4 h-4 mr-2" />
                            Reject
                        </Button>
                        <Button
                            onClick={() => {
                                if (selectedEmail) {
                                    approveMutation.mutate(selectedEmail.id);
                                }
                            }}
                            disabled={approveMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            <Send className="w-4 h-4 mr-2" />
                            {approveMutation.isPending ? "Sending..." : "Approve & Send"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
