import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SendMessageProps {
    prospectId: number;
    contacts: any[];
}

export const SendMessageForm: React.FC<SendMessageProps> = ({ prospectId, contacts }) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [channel, setChannel] = useState("email");
    const [contactId, setContactId] = useState<string>("");
    const [templateId, setTemplateId] = useState<string>("none");
    const [subject, setSubject] = useState("");
    const [content, setContent] = useState("");

    const { data: templates } = useQuery<any[]>({
        queryKey: ["/api/communications/templates"],
    });

    // Filter templates by channel
    const availableTemplates = templates?.filter((t: any) => t.channel === channel) || [];

    // Update content when template selected
    useEffect(() => {
        if (templateId && templateId !== "none" && templates) {
            const tmpl = templates.find((t: any) => t.id === parseInt(templateId));
            if (tmpl) {
                setSubject(tmpl.subject || "");
                setContent(tmpl.content || "");
            }
        }
    }, [templateId, templates]);

    const sendMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("/api/communications/send", "POST", {
                prospectId,
                contactId: parseInt(contactId),
                channel,
                templateId: templateId === "none" ? null : parseInt(templateId),
                subject,
                content,
            });
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Message Sent", description: "Your message has been sent successfully." });
            setContent("");
            setSubject("");
            queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/communications`] });
        },
        onError: (error: any) => {
            toast({
                title: "Send Failed",
                description: error.message || "Failed to send message. Please check Email Settings.",
                variant: "destructive"
            });
        }
    });

    const handleSend = () => {
        if (!contactId) {
            toast({ title: "Recipient Required", description: "Please select a contact.", variant: "destructive" });
            return;
        }
        if (!content.trim()) {
            toast({ title: "Content Required", description: "Message content cannot be empty.", variant: "destructive" });
            return;
        }
        sendMutation.mutate();
    };

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-white shadow-sm">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <div className="text-sm font-medium leading-none">Channel</div>
                    <Select value={channel} onValueChange={setChannel}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="sms" disabled>SMS (Coming Soon)</SelectItem>
                            <SelectItem value="whatsapp" disabled>WhatsApp (Coming Soon)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <div className="text-sm font-medium leading-none">Template (Optional)</div>
                    <Select value={templateId} onValueChange={setTemplateId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a template..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {availableTemplates.map((t: any) => (
                                <SelectItem key={t.id} value={t.id.toString()}>
                                    {t.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <div className="text-sm font-medium leading-none">Recipient</div>
                <Select value={contactId} onValueChange={setContactId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a contact..." />
                    </SelectTrigger>
                    <SelectContent>
                        {contacts.map((c: any) => (
                            <SelectItem key={c.id} value={c.id.toString()}>
                                {c.name} {c.email ? `<${c.email}>` : "(No Email)"}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {channel === "email" && (
                <div className="space-y-2">
                    <div className="text-sm font-medium leading-none">Subject</div>
                    <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Email Subject"
                    />
                </div>
            )}

            <div className="space-y-2">
                <div className="text-sm font-medium leading-none">Message</div>
                <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Type your message here..."
                    className="min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">Supported variables: {'{{firstName}}'}, {'{{name}}'}, {'{{company}}'}</p>
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSend} disabled={sendMutation.isPending}>
                    {sendMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send Message
                </Button>
            </div>
        </div>
    );
};
