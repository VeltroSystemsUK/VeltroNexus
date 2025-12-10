import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  User,
  FileText,
  Download,
  Paperclip,
} from "lucide-react";
import { format } from "date-fns";
import type { UnderwritingActivity } from "@shared/schema";

interface ConversationThreadProps {
  submissionId: number;
  maxHeight?: string;
  showEmpty?: boolean;
}

type ActivityWithUser = UnderwritingActivity & {
  user?: { firstName?: string; lastName?: string; email?: string; role?: string };
};

const activityIcons: Record<string, any> = {
  submitted: Clock,
  claimed: User,
  queried: AlertCircle,
  responded: Send,
  approved: CheckCircle2,
  declined: XCircle,
  withdrawn: XCircle,
  comment: MessageSquare,
};

const activityColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  claimed: "bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-200",
  queried: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200",
  responded: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
  declined: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
  withdrawn: "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200",
  comment: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
};

const activityLabels: Record<string, string> = {
  submitted: "Submitted for Review",
  claimed: "Claimed by Underwriter",
  queried: "Query from Underwriter",
  responded: "Response from Broker",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
  comment: "Comment",
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function ConversationThread({
  submissionId,
  maxHeight = "400px",
  showEmpty = true,
}: ConversationThreadProps) {
  const { data: activities, isLoading } = useQuery<ActivityWithUser[]>({
    queryKey: [`/api/underwriting/submissions/${submissionId}/activities`],
    enabled: !!submissionId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No conversation history yet</p>
      </div>
    );
  }

  const handleDownload = async (storagePath: string, fileName: string) => {
    try {
      const response = await fetch(`/api/underwriting/attachments/download?path=${encodeURIComponent(storagePath)}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <ScrollArea className="pr-2" style={{ maxHeight }}>
      <div className="space-y-2">
        {activities.map((activity) => {
          const Icon = activityIcons[activity.activityType] || MessageSquare;
          const colorClass = activityColors[activity.activityType] || "bg-gray-100 text-gray-800";
          const label = activityLabels[activity.activityType] || activity.activityType;
          const isQuery = activity.activityType === 'queried';
          const isResponse = activity.activityType === 'responded';
          const attachments = (activity.attachments as any[]) || [];

          return (
            <div 
              key={activity.id} 
              className={`p-2.5 rounded-md border bg-card ${isQuery ? 'border-l-2 border-l-purple-500' : ''} ${isResponse ? 'border-l-2 border-l-cyan-500' : ''}`}
              data-testid={`activity-${activity.id}`}
            >
              <div className="flex items-start gap-2">
                <div className={`p-1 rounded-full ${colorClass} flex-shrink-0`}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="secondary" className={`${colorClass} text-xs py-0 px-1.5`}>
                      {label}
                    </Badge>
                    {activity.user && (
                      <span className="text-xs text-muted-foreground">
                        {activity.user.firstName} {activity.user.lastName}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      · {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                  
                  {activity.content && (
                    <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                      {activity.content}
                    </p>
                  )}

                  {attachments.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {attachments.map((att: any, idx: number) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className="h-6 py-0 px-1.5 text-xs"
                          onClick={() => handleDownload(att.storagePath, att.fileName)}
                          data-testid={`button-download-attachment-${activity.id}-${idx}`}
                        >
                          <Paperclip className="h-2.5 w-2.5 mr-1" />
                          <span className="truncate max-w-[100px]">{att.fileName}</span>
                          <Download className="h-2.5 w-2.5 ml-1" />
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
