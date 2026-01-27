
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
    Users
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
                            </DialogDescription>
                        </div>
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
                                    <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Hash className="h-3 w-3" /> SIC Code
                                    </Label>
                                    <Input value={sicCode} onChange={(e) => setSicCode(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> Incorporation Date
                                    </Label>
                                    <Input value={incorporationDate} onChange={(e) => setIncorporationDate(e.target.value)} />
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
                                            value={newContact.name}
                                            onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                                            placeholder="e.g. John Doe"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Role</Label>
                                        <Input
                                            value={newContact.role}
                                            onChange={e => setNewContact({ ...newContact, role: e.target.value })}
                                            placeholder="e.g. Director"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Email</Label>
                                        <Input
                                            value={newContact.email}
                                            onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                                            placeholder="john@example.com"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Phone</Label>
                                        <Input
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
                                                <span className="hidden sm:inline truncate max-w-[150px]">{contact.email}</span>
                                            </div>
                                        )}
                                        {contact.phone && (
                                            <div className="flex items-center gap-1">
                                                <Phone className="h-3 w-3" />
                                                <span className="hidden sm:inline">{contact.phone}</span>
                                            </div>
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
