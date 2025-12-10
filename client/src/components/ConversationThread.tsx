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

  // Determine if message is from broker (right side) or underwriter (left side)
  const isBrokerMessage = (type: string) => ['submitted', 'responded', 'comment'].includes(type) && 
    activities?.find(a => a.activityType === type)?.user?.role !== 'underwriter';

  return (
    <ScrollArea className="pr-2" style={{ maxHeight }}>
      <div className="space-y-3 py-2">
        {activities.map((activity) => {
          const label = activityLabels[activity.activityType] || activity.activityType;
          const attachments = (activity.attachments as any[]) || [];
          
          // Broker messages (submitted, responded, comment from broker) go right
          // Underwriter messages (queried, claimed, approved, declined, withdrawn, comment from underwriter) go left
          const isFromBroker = activity.user?.role === 'broker' || 
            (activity.activityType === 'submitted') ||
            (activity.activityType === 'responded');
          
          // System messages (no content, just status updates)
          const isSystemMessage = ['claimed', 'approved', 'declined', 'withdrawn'].includes(activity.activityType) && !activity.content;

          if (isSystemMessage) {
            return (
              <div key={activity.id} className="flex justify-center" data-testid={`activity-${activity.id}`}>
                <div className="bg-muted/50 text-muted-foreground text-xs px-3 py-1 rounded-full">
                  {label} · {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                </div>
              </div>
            );
          }

          return (
            <div 
              key={activity.id} 
              className={`flex ${isFromBroker ? 'justify-end' : 'justify-start'}`}
              data-testid={`activity-${activity.id}`}
            >
              <div className={`max-w-[80%] ${isFromBroker ? 'order-1' : ''}`}>
                {/* Sender name */}
                <p className={`text-xs text-muted-foreground mb-0.5 ${isFromBroker ? 'text-right' : 'text-left'}`}>
                  {activity.user?.firstName || (isFromBroker ? 'You' : 'Underwriter')}
                </p>
                
                {/* Message bubble */}
                <div 
                  className={`px-3 py-2 rounded-2xl ${
                    isFromBroker 
                      ? 'bg-primary text-primary-foreground rounded-br-sm' 
                      : 'bg-muted rounded-bl-sm'
                  }`}
                >
                  {/* Activity type badge for non-standard messages */}
                  {!['responded', 'comment'].includes(activity.activityType) && (
                    <p className={`text-xs font-medium mb-1 ${isFromBroker ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                      {label}
                    </p>
                  )}
                  
                  {activity.content && (
                    <p className="text-sm whitespace-pre-wrap">
                      {activity.content}
                    </p>
                  )}

                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {attachments.map((att: any, idx: number) => (
                        <Button
                          key={idx}
                          variant={isFromBroker ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 w-full justify-start text-xs"
                          onClick={() => handleDownload(att.storagePath, att.fileName)}
                          data-testid={`button-download-attachment-${activity.id}-${idx}`}
                        >
                          <Paperclip className="h-3 w-3 mr-1.5 flex-shrink-0" />
                          <span className="truncate">{att.fileName}</span>
                          <Download className="h-3 w-3 ml-auto flex-shrink-0" />
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Timestamp */}
                <p className={`text-[10px] text-muted-foreground mt-0.5 ${isFromBroker ? 'text-right' : 'text-left'}`}>
                  {format(new Date(activity.createdAt), "h:mm a")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
