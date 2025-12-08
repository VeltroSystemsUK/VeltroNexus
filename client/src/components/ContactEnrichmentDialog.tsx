import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Mail, Phone, Linkedin, ExternalLink, Check } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import type { Contact } from "@shared/schema";

interface ContactEnrichmentDialogProps {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: number;
}

interface EnrichmentResult {
  contact: {
    id: number;
    name: string;
    currentEmail: string | null;
    currentPhone: string | null;
  };
  webSearch: {
    emails: string[];
    phones: string[];
    linkedinUrls: string[];
    sources: { url: string; title: string; snippet: string }[];
  };
  emailSearch: {
    relatedEmails: {
      subject: string;
      from: string;
      to: string[];
      date: string;
      snippet: string;
    }[];
  };
}

export function ContactEnrichmentDialog({
  contact,
  open,
  onOpenChange,
  prospectId,
}: ContactEnrichmentDialogProps) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<EnrichmentResult | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/contacts/${contact.id}/enrich`);
      return response.json();
    },
    onSuccess: (data: EnrichmentResult) => {
      setResult(data);
    },
    onError: (error: Error) => {
      toast.error("Failed to search for contact info: " + error.message);
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async (updates: { email?: string; phone?: string }) => {
      const response = await apiRequest("PATCH", `/api/contacts/${contact.id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/contacts`] });
      toast.success("Contact updated successfully");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error("Failed to update contact: " + error.message);
    },
  });

  const handleSearch = () => {
    setResult(null);
    setSelectedEmail(null);
    setSelectedPhone(null);
    enrichMutation.mutate();
  };

  const handleApply = () => {
    const updates: { email?: string; phone?: string } = {};
    if (selectedEmail) {
      updates.email = selectedEmail;
    }
    if (selectedPhone) {
      updates.phone = selectedPhone;
    }
    if (Object.keys(updates).length > 0) {
      updateContactMutation.mutate(updates);
    } else {
      toast.info("No changes to apply");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find Contact Info
          </DialogTitle>
          <DialogDescription>
            Search the web and your email inbox for contact information for {contact.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!result && !enrichMutation.isPending && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Click the button below to search for publicly available email addresses, 
                phone numbers, and LinkedIn profiles for this contact.
              </p>
              <Button onClick={handleSearch} data-testid="button-start-enrichment">
                <Search className="h-4 w-4 mr-2" />
                Search for Contact Info
              </Button>
            </div>
          )}

          {enrichMutation.isPending && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Searching the web and your inbox...</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Current Info */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Current Contact Info</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="flex flex-wrap gap-2">
                    {result.contact.currentEmail && (
                      <Badge variant="outline">
                        <Mail className="h-3 w-3 mr-1" />
                        {result.contact.currentEmail}
                      </Badge>
                    )}
                    {result.contact.currentPhone && (
                      <Badge variant="outline">
                        <Phone className="h-3 w-3 mr-1" />
                        {result.contact.currentPhone}
                      </Badge>
                    )}
                    {!result.contact.currentEmail && !result.contact.currentPhone && (
                      <span className="text-muted-foreground text-sm">No contact info on file</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Found Emails */}
              {result.webSearch.emails.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Found Email Addresses ({result.webSearch.emails.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="flex flex-wrap gap-2">
                      {result.webSearch.emails.map((email, i) => (
                        <Badge
                          key={i}
                          variant={selectedEmail === email ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => setSelectedEmail(selectedEmail === email ? null : email)}
                          data-testid={`badge-email-${i}`}
                        >
                          {selectedEmail === email && <Check className="h-3 w-3 mr-1" />}
                          {email}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Found Phones */}
              {result.webSearch.phones.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Found Phone Numbers ({result.webSearch.phones.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="flex flex-wrap gap-2">
                      {result.webSearch.phones.map((phone, i) => (
                        <Badge
                          key={i}
                          variant={selectedPhone === phone ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => setSelectedPhone(selectedPhone === phone ? null : phone)}
                          data-testid={`badge-phone-${i}`}
                        >
                          {selectedPhone === phone && <Check className="h-3 w-3 mr-1" />}
                          {phone}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* LinkedIn URLs */}
              {result.webSearch.linkedinUrls.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn Profiles ({result.webSearch.linkedinUrls.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="space-y-2">
                      {result.webSearch.linkedinUrls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                          data-testid={`link-linkedin-${i}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                          {url}
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Web Sources */}
              {result.webSearch.sources.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Web Sources</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="space-y-3">
                      {result.webSearch.sources.slice(0, 5).map((source, i) => (
                        <div key={i} className="border-b last:border-0 pb-2">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                          >
                            {source.title}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <p className="text-xs text-muted-foreground mt-1">{source.snippet}...</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Related Emails */}
              {result.emailSearch.relatedEmails.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Related Emails in Inbox ({result.emailSearch.relatedEmails.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="space-y-2">
                      {result.emailSearch.relatedEmails.map((email, i) => (
                        <div key={i} className="border-b last:border-0 pb-2">
                          <p className="text-sm font-medium">{email.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            From: {email.from} | {new Date(email.date).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* No results message */}
              {result.webSearch.emails.length === 0 &&
                result.webSearch.phones.length === 0 &&
                result.webSearch.linkedinUrls.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    No contact information found in public sources
                  </div>
                )}

              {/* Action buttons */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button variant="outline" onClick={handleSearch}>
                  <Search className="h-4 w-4 mr-2" />
                  Search Again
                </Button>
                {(selectedEmail || selectedPhone) && (
                  <Button
                    onClick={handleApply}
                    disabled={updateContactMutation.isPending}
                    data-testid="button-apply-contact-info"
                  >
                    {updateContactMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Apply Selected
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
