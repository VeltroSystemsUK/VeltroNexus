import { useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { InternalLead, User } from "@shared/schema";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    Building2,
    Calendar,
    Mail,
    Phone,
    User as UserIcon,
    MapPin,
    Hash,
    Briefcase,
    TrendingUp,
    Plus,
    Trash2,
    Users,
    CheckCircle,
    Linkedin,
    ExternalLink
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { EmailLink } from "@/components/EmailLink";

interface InternalLeadDetailProps {
    lead: InternalLead;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    availableAgents: User[];
}

export default function InternalLeadDetail({ lead, open, onOpenChange, availableAgents = [] }: InternalLeadDetailProps) {
    const [notes, setNotes] = useState(lead.notes || "");
    const [status, setStatus] = useState(lead.status);
    const [assignedAgentId, setAssignedAgentId] = useState(lead.assignedAgentId || "unassigned");
    const [address, setAddress] = useState(lead.address || "");
    const [city, setCity] = useState(lead.city || "");
    const [sicCode, setSicCode] = useState(lead.sicCode || "");
    const [incorporationDate, setIncorporationDate] = useState(lead.incorporationDate || "");

    // Contact Form State
    const [newContact, setNewContact] = useState({ name: "", role: "", email: "", phone: "" });
    const [isAddingContact, setIsAddingContact] = useState(false);

    const updateLeadMutation = useMutation({
        mutationFn: (updates: Partial<InternalLead>) =>
            apiRequest(`/api/god/crm/leads/${lead.id}`, "PUT", updates),
        onSuccess: () => {
            toast.success("Lead updated");
            queryClient.invalidateQueries({ queryKey: ["/api/god/crm/leads"] });
        },
    });

    const handleSaveOverview = () => {
        updateLeadMutation.mutate({
            notes,
            status,
            assignedAgentId: assignedAgentId === "unassigned" ? undefined : assignedAgentId,
            address,
            city,
            sicCode,
            incorporationDate
        });
    };

    const handleAddContact = () => {
        if (!newContact.name) return;

        const contacts = Array.isArray(lead.contacts) ? [...lead.contacts] : [];
        contacts.push(newContact);

        updateLeadMutation.mutate({ contacts });
        setNewContact({ name: "", role: "", email: "", phone: "" });
        setIsAddingContact(false);
    };

    const handleDeleteContact = (index: number) => {
        const contacts = Array.isArray(lead.contacts) ? [...lead.contacts] : [];
        contacts.splice(index, 1);
        updateLeadMutation.mutate({ contacts });
    };

    const deleteLeadMutation = useMutation({
        mutationFn: () => apiRequest(`/api/god/crm/leads/${lead.id}`, "DELETE"),
        onSuccess: () => {
            toast.success("Lead deleted");
            queryClient.invalidateQueries({ queryKey: ["/api/god/crm/leads"] });
            onOpenChange(false);
        },
    });

    const handleDeleteLead = () => {
        deleteLeadMutation.mutate();
    };

    const enrichLeadMutation = useMutation({
        mutationFn: () => apiRequest(`/api/god/crm/enrich/${lead.id}`, "POST"),
        onSuccess: (data: any) => {
            toast.success(data.message || "Lead enriched successfully");
            queryClient.invalidateQueries({ queryKey: ["/api/god/crm/leads"] });
        },
        onError: (error: any) => {
            toast.error("Enrichment failed: " + error.message);
        }
    });

    const contacts = Array.isArray(lead.contacts) ? lead.contacts : [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-xl flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-primary" />
                                {lead.companyName}
                            </DialogTitle>
                            <DialogDescription className="flex items-center gap-2 mt-1">
                                {lead.companyNumber && <Badge variant="outline" className="font-mono text-xs">{lead.companyNumber}</Badge>}
                                {lead.companyType && <Badge variant="secondary" className="text-xs">{lead.companyType}</Badge>}
                                {lead.hasCharges && (
                                    <Badge variant="default" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] h-5 px-1 py-0 flex items-center gap-0.5">
                                        <CheckCircle className="h-3 w-3" />
                                        Debt Registered
                                    </Badge>
                                )}
                                {lead.linkedinUrl && (
                                    <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
                                        <Linkedin className="h-3 w-3" />
                                        LinkedIn
                                    </a>
                                )}
                            </DialogDescription>
                        </div>
                        <div className="flex gap-2 items-center">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => enrichLeadMutation.mutate()}
                                disabled={enrichLeadMutation.isPending}
                            >
                                <TrendingUp className="mr-2 h-4 w-4" />
                                {enrichLeadMutation.isPending ? "Enriching..." : "Enrich with AI"}
                            </Button>
                            <Select value={status} onValueChange={(val) => { setStatus(val); updateLeadMutation.mutate({ status: val }); }}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">New Lead</SelectItem>
                                    <SelectItem value="contacted">Contacted</SelectItem>
                                    <SelectItem value="demo_booked">Demo Booked</SelectItem>
                                    <SelectItem value="trial">Trial</SelectItem>
                                    <SelectItem value="subscribed">Subscribed</SelectItem>
                                    <SelectItem value="churned">Lost</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs defaultValue="overview" className="mt-4">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
                        <TabsTrigger value="activity">Notes & Activity</TabsTrigger>
                    </TabsList>

                    {/* --- OVERVIEW TAB --- */}
                    <TabsContent value="overview" className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <MapPin className="h-3 w-3" /> Address
                                    </Label>
                                    <Input id="lead-address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Building2 className="h-3 w-3" /> Town / City
                                    </Label>
                                    <Input id="lead-city" name="city" value={city} onChange={(e) => setCity(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Hash className="h-3 w-3" /> SIC Code
                                    </Label>
                                    <Input id="lead-sicCode" name="sicCode" value={sicCode} onChange={(e) => setSicCode(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> Incorporation Date
                                    </Label>
                                    <Input id="lead-incDate" name="incorporationDate" value={incorporationDate} onChange={(e) => setIncorporationDate(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1 font-semibold text-amber-600">
                                        <TrendingUp className="h-3 w-3" /> Registered Charge Holder
                                    </Label>
                                    <Input
                                        id="lead-lender"
                                        name="identifiedLender"
                                        value={lead.identifiedLender || (lead.hasCharges ? "AI Scan Required" : "None Detected")}
                                        disabled
                                        className={lead.identifiedLender ? "bg-amber-50 border-amber-200 text-amber-900 font-medium" : ""}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Assigned Agent</Label>
                                    <Select
                                        value={assignedAgentId}
                                        onValueChange={setAssignedAgentId}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Assign Agent" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {availableAgents.map(agent => (
                                                <SelectItem key={agent.id} value={agent.id}>
                                                    {agent.firstName} {agent.lastName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3" /> Est. Value
                                    </Label>
                                    <div className="relative">
                                        <span className="absolute left-2 top-2.5 text-xs">£</span>
                                        <Input
                                            id="lead-value"
                                            name="estimatedValue"
                                            disabled
                                            value={lead.estimatedValue || 0}
                                            className="pl-5"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between pt-4 border-t">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                        <Trash2 className="h-4 w-4 mr-2" /> Delete Lead
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Delete Lead?</DialogTitle>
                                        <DialogDescription>
                                            This action cannot be undone. This will permanently remove
                                            <strong> {lead.companyName} </strong> from your pipeline.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <Button variant="destructive" onClick={handleDeleteLead}>
                                            Confirm Delete
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <Button onClick={handleSaveOverview} disabled={updateLeadMutation.isPending}>
                                Save Changes
                            </Button>
                        </div>
                    </TabsContent>

                    {/* --- CONTACTS TAB --- */}
                    <TabsContent value="contacts" className="space-y-4 py-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-semibold">Key Contacts</h3>
                            {!isAddingContact && (
                                <Button size="sm" variant="outline" onClick={() => setIsAddingContact(true)}>
                                    <Plus className="h-4 w-4 mr-1" /> Add Contact
                                </Button>
                            )}
                        </div>

                        {isAddingContact && (
                            <div className="bg-muted/50 p-4 rounded-lg space-y-3 mb-4 border">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label>Name</Label>
                                        <Input
                                            id="new-contact-name"
                                            name="name"
                                            value={newContact.name}
                                            onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                                            placeholder="e.g. John Doe"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Role</Label>
                                        <Input
                                            id="new-contact-role"
                                            name="role"
                                            value={newContact.role}
                                            onChange={e => setNewContact({ ...newContact, role: e.target.value })}
                                            placeholder="e.g. Director"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Email</Label>
                                        <Input
                                            id="new-contact-email"
                                            name="email"
                                            value={newContact.email}
                                            onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                                            placeholder="john@example.com"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Phone</Label>
                                        <Input
                                            id="new-contact-phone"
                                            name="phone"
                                            value={newContact.phone}
                                            onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                                            placeholder="+44 7..."
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => setIsAddingContact(false)}>Cancel</Button>
                                    <Button size="sm" onClick={handleAddContact}>Save Contact</Button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            {contacts.length === 0 && !isAddingContact && (
                                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    No contacts added yet
                                </div>
                            )}
                            {contacts.map((contact: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="font-medium text-sm">{contact.name}</div>
                                            <div className="text-xs text-muted-foreground">{contact.role}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        {contact.email && (
                                            <div className="flex items-center gap-1" title={contact.email}>
                                                <Mail className="h-3 w-3" />
                                                <EmailLink email={contact.email} name={contact.name} className="hidden sm:inline truncate max-w-[150px]" />
                                            </div>
                                        )}
                                        {contact.phone && (
                                            <div className="flex items-center gap-1">
                                                <Phone className="h-3 w-3" />
                                                <span className="hidden sm:inline">{contact.phone}</span>
                                            </div>
                                        )}
                                        {contact.linkedinUrl && (
                                            <a
                                                href={contact.linkedinUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                                title="View LinkedIn Profile"
                                            >
                                                <Linkedin className="h-4 w-4" />
                                            </a>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteContact(idx)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    {/* --- NOTES TAB --- */}
                    <TabsContent value="activity" className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                                id="lead-notes"
                                name="notes"
                                className="min-h-[200px]"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Enter call notes, next steps, or general observations..."
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={handleSaveOverview} disabled={updateLeadMutation.isPending}>
                                Save Notes
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
