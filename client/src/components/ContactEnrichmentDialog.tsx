import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Mail, Phone, Linkedin, ExternalLink, Check, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    currentProfilePicture: string | null;
    currentNotes: string | null;
  };
  companyName: string;
  searchNotes: string;
  webSearch: {
    emails: string[];
    phones: string[];
    linkedinUrls: string[];
    profileImages: string[];
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
  const [selectedProfileImage, setSelectedProfileImage] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setResult(null);
      setSelectedEmail(null);
      setSelectedPhone(null);
      setSelectedProfileImage(null);
    }
  }, [open]);

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/contacts/${contact.id}/enrich`, "POST");
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
    mutationFn: async (updates: { email?: string; phone?: string; profilePicture?: string; notes?: string }) => {
      const response = await apiRequest(`/api/contacts/${contact.id}`, "PATCH", updates);
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
    setSelectedProfileImage(null);
    enrichMutation.mutate();
  };

  const handleApply = () => {
    const updates: { email?: string; phone?: string; profilePicture?: string; notes?: string } = {};
    if (selectedEmail) {
      updates.email = selectedEmail;
    }
    if (selectedPhone) {
      updates.phone = selectedPhone;
    }
    if (selectedProfileImage) {
      updates.profilePicture = selectedProfileImage;
    }
    // Always append search notes when applying any changes
    if (result?.searchNotes) {
      const existingNotes = result.contact.currentNotes || '';
      updates.notes = existingNotes 
        ? `${existingNotes}\n\n${result.searchNotes}`
        : result.searchNotes;
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
            {result?.companyName && ` at ${result.companyName}`}
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

              {/* LinkedIn Search - Manual workflow */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Linkedin className="h-4 w-4" />
                    Search LinkedIn
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    LinkedIn blocks external search. Click below to search manually on LinkedIn.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const companyName = result.companyName
                          .replace(/\s*(limited|ltd\.?|plc|llp|inc\.?|corp\.?)\s*$/gi, '')
                          .trim();
                        window.open(
                          `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}`,
                          '_blank'
                        );
                      }}
                      data-testid="button-linkedin-company-search"
                    >
                      <Linkedin className="h-4 w-4 mr-2" />
                      Search Company
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Use just the contact name (First Last)
                        window.open(
                          `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(contact.name)}`,
                          '_blank'
                        );
                      }}
                      data-testid="button-linkedin-person-search"
                    >
                      <Linkedin className="h-4 w-4 mr-2" />
                      Search Person
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </Button>
                  </div>
                  {/* Show any LinkedIn URLs found */}
                  {result.webSearch.linkedinUrls.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Found references:</p>
                      <div className="space-y-1">
                        {result.webSearch.linkedinUrls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-primary hover:underline"
                            data-testid={`link-linkedin-${i}`}
                          >
                            <ExternalLink className="h-3 w-3" />
                            {url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Profile Pictures */}
              {result.webSearch.profileImages.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Profile Pictures ({result.webSearch.profileImages.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="flex flex-wrap gap-3">
                      {result.webSearch.profileImages.map((imageUrl, i) => (
                        <div
                          key={i}
                          className={`relative cursor-pointer rounded-lg border-2 p-1 transition-all ${
                            selectedProfileImage === imageUrl
                              ? "border-primary bg-primary/10"
                              : "border-transparent hover:border-muted-foreground/30"
                          }`}
                          onClick={() => setSelectedProfileImage(selectedProfileImage === imageUrl ? null : imageUrl)}
                          data-testid={`profile-image-${i}`}
                        >
                          <Avatar className="h-16 w-16">
                            <AvatarImage src={imageUrl} alt={`Profile option ${i + 1}`} />
                            <AvatarFallback>
                              <User className="h-8 w-8" />
                            </AvatarFallback>
                          </Avatar>
                          {selectedProfileImage === imageUrl && (
                            <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Click on an image to select it as the contact&apos;s profile picture
                    </p>
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
                result.webSearch.linkedinUrls.length === 0 &&
                result.webSearch.profileImages.length === 0 && (
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
                {(selectedEmail || selectedPhone || selectedProfileImage) && (
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
