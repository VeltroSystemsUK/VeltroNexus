import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Mail, Send, AlertCircle } from "lucide-react";
import type { Contact, EmailInbox } from "@shared/schema";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  prospectId?: number;
  defaultTo?: string;
  defaultSubject?: string;
}

export function EmailComposeDialog({
  open,
  onOpenChange,
  contact,
  prospectId,
  defaultTo = "",
  defaultSubject = "",
}: EmailComposeDialogProps) {
  const [to, setTo] = useState(defaultTo || contact?.email || "");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");

  const {
    data: inbox,
    isLoading: inboxLoading,
    error: inboxError,
  } = useQuery<EmailInbox>({
    queryKey: ["/api/email/inbox"],
    enabled: open,
  });

  const { data: emailStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/email/status"],
    enabled: open,
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (data: {
      to: string;
      subject: string;
      body: string;
      contactId?: number;
      prospectId?: number;
    }) => {
      const response = await apiRequest("/api/email/send", "POST", data);
      return response;
    },
    onSuccess: () => {
      toast.success("Email sent successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/email/messages"] });
      if (prospectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/email/prospect/${prospectId}/messages`] });
      }
      if (contact?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/email/contact/${contact.id}/messages`] });
      }
      onOpenChange(false);
      setTo("");
      setSubject("");
      setBody("");
    },
    onError: (error: Error) => {
      toast.error(`Failed to send email: ${error.message}`);
    },
  });

  const handleSend = () => {
    if (!to || !subject) {
      toast.error("Please fill in the recipient and subject");
      return;
    }
    sendEmailMutation.mutate({
      to,
      subject,
      body,
      contactId: contact?.id,
      prospectId,
    });
  };

  const isAgentMailConfigured = emailStatus?.configured;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Compose Email
          </DialogTitle>
          <DialogDescription>
            {contact ? `Send an email to ${contact.name}` : "Send an email"}
          </DialogDescription>
        </DialogHeader>

        {!isAgentMailConfigured && !inboxLoading ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Email integration is not configured. Please connect AgentMail in your integrations to
              enable email functionality.
            </AlertDescription>
          </Alert>
        ) : inboxLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Setting up your email inbox...</span>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">From</Label>
                <Input
                  value={inbox?.emailAddress || "Loading..."}
                  disabled
                  className="bg-muted"
                  data-testid="input-email-from"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-to">To *</Label>
                <Input
                  id="email-to"
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  data-testid="input-email-to"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-subject">Subject *</Label>
                <Input
                  id="email-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                  data-testid="input-email-subject"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-body">Message</Label>
                <Textarea
                  id="email-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type your message here..."
                  rows={8}
                  className="resize-none"
                  data-testid="input-email-body"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={!to || !subject || sendEmailMutation.isPending}
                data-testid="button-send-email"
              >
                {sendEmailMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
