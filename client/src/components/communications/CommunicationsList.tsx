import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Mail, MessageSquare, Check, CheckCheck, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface CommunicationsListProps {
    prospectId: number;
}

export const CommunicationsList: React.FC<CommunicationsListProps> = ({ prospectId }) => {
    const { data: logs, isLoading } = useQuery<any[]>({
        queryKey: [`/api/prospects/${prospectId}/communications`],
    });

    if (isLoading) return <div className="text-center py-4 text-muted-foreground">Loading history...</div>;

    if (!logs || logs.length === 0) {
        return (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
                <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No communications logged yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {logs.map((log: any) => (
                <Card key={log.id}>
                    <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-full ${log.channel === 'email' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                {log.channel === 'email' ? <Mail className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <div className="font-medium text-sm">
                                        {log.direction === 'outbound' ? 'Sent to' : 'Received from'} Contact
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {format(new Date(log.sentAt), "MMM d, yyyy h:mm a")}
                                    </div>
                                </div>

                                {log.subject && <div className="text-sm font-semibold">{log.subject}</div>}

                                <div className="text-sm text-gray-600 whitespace-pre-wrap mt-2 bg-gray-50 p-3 rounded-md border text-xs">
                                    {log.content}
                                </div>

                                <div className="flex items-center gap-2 mt-2">
                                    <Badge variant={log.status === 'failed' ? "destructive" : "outline"} className="text-xs uppercase">
                                        {log.status === 'sent' && <Check className="h-3 w-3 mr-1" />}
                                        {log.status === 'delivered' && <CheckCheck className="h-3 w-3 mr-1 text-green-600" />}
                                        {log.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                                        {log.status}
                                    </Badge>
                                    {log.metadata?.provider && <span className="text-[10px] text-muted-foreground uppercase">{log.metadata.provider}</span>}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
