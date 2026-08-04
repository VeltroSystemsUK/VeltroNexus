import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, FileText, Download, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface BrokerHandoff {
  id: number;
  submissionId: number;
  companyName: string;
  companyNumber?: string;
  status?: string;
  sentAt: string;
  expiresAt: string;
}

interface HandoffAttachment {
  index: number;
  fileName: string;
  fileType: string;
  fileSize: number;
}

function HandoffAttachments({ handoffId }: { handoffId: number }) {
  const { data: attachments } = useQuery<HandoffAttachment[]>({
    queryKey: [`/api/broker-portal/handoffs/${handoffId}/attachments`],
  });

  if (!attachments || attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">No source documents attached.</p>;
  }

  return (
    <div className="space-y-2">
      {attachments.map((a) => (
        <a
          key={a.index}
          href={`/api/broker-portal/handoffs/${handoffId}/attachments/${a.index}`}
          className="flex items-center justify-between p-2 rounded-md border hover:bg-muted/50 text-sm"
          data-testid={`link-attachment-${handoffId}-${a.index}`}
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {a.fileName}
          </span>
          <Download className="h-4 w-4 text-muted-foreground" />
        </a>
      ))}
    </div>
  );
}

export default function BrokerPortal() {
  const { user, logoutMutation } = useAuth();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: handoffs, isLoading } = useQuery<BrokerHandoff[]>({
    queryKey: ["/api/broker-portal/handoffs"],
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">Broker Portal</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            {user?.firstName && <span>{user.firstName}</span>}
            <Button variant="ghost" size="sm" onClick={() => logoutMutation.mutate()}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-4">
        {isLoading && <p className="text-muted-foreground">Loading...</p>}
        {!isLoading && (!handoffs || handoffs.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No deals have been sent to you yet.
            </CardContent>
          </Card>
        )}
        {handoffs?.map((h) => (
          <Card key={h.id} data-testid={`card-handoff-${h.id}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  {h.companyName}
                </CardTitle>
                <Badge variant="outline">{h.status || "sent_to_broker"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Sent {new Date(h.sentAt).toLocaleDateString("en-GB")} · Access expires{" "}
                {new Date(h.expiresAt).toLocaleDateString("en-GB")}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <a href={`/api/broker-portal/handoffs/${h.id}/report.pdf`} data-testid={`link-report-${h.id}`}>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Download credit assessment
                </Button>
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedId(expandedId === h.id ? null : h.id)}
                data-testid={`button-toggle-docs-${h.id}`}
              >
                {expandedId === h.id ? "Hide source documents" : "View source documents"}
              </Button>
              {expandedId === h.id && <HandoffAttachments handoffId={h.id} />}
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
