import { useState, useEffect } from "react";
import { X, Send, Paperclip, Minimize2, Bold, Italic, List, ListOrdered, Link, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface ComposeDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    initialTo?: string;
    initialName?: string;
    initialSubject?: string;
    initialBody?: string;
    threadId?: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
    if (!editor) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/30">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                data-active={editor.isActive('bold')}
            >
                <Bold className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                data-active={editor.isActive('italic')}
            >
                <Italic className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
                <List className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
                <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
                <Quote className="h-4 w-4" />
            </Button>
        </div>
    );
};

export function ComposeDrawer({
    isOpen,
    onClose,
    initialTo = "",
    initialName = "",
    initialSubject = "",
    initialBody = "",
    threadId = ""
}: ComposeDrawerProps) {
    const [to, setTo] = useState(initialTo);
    const [cc, setCc] = useState("");
    const [bcc, setBcc] = useState("");
    const [subject, setSubject] = useState(initialSubject);
    const [showCc, setShowCc] = useState(false);
    const [showBcc, setShowBcc] = useState(false);
    const [sending, setSending] = useState(false);
    const { toast } = useToast();

    const editor = useEditor({
        extensions: [
            StarterKit,
        ],
        content: initialBody,
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert focus:outline-none min-h-[300px] max-w-none p-4',
            },
        },
    });

    // Update form when props change
    useEffect(() => {
        if (isOpen) {
            setTo(initialTo);
            setSubject(initialSubject);
            if (editor) {
                editor.commands.setContent(initialBody);
            }
        }
    }, [isOpen, initialTo, initialSubject, initialBody, editor]);

    const handleSend = async () => {
        const body = editor?.getHTML();
        if (!to || !subject || !body || body === '<p></p>') {
            toast({
                title: "Missing fields",
                description: "Please fill in recipient, subject, and message",
                variant: "destructive",
            });
            return;
        }

        setSending(true);
        try {
            const response = await fetch("/api/gmail/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ to, cc, bcc, subject, body, threadId }),
            });

            if (!response.ok) {
                throw new Error("Failed to send email");
            }

            toast({
                title: "Email sent",
                description: `Message sent to ${to}`,
            });

            // Reset form
            setTo("");
            setCc("");
            setBcc("");
            setSubject("");
            editor?.commands.setContent("");
            onClose();
        } catch (error) {
            console.error("Send error:", error);
            toast({
                title: "Send failed",
                description: "Could not send email. Please try again.",
                variant: "destructive",
            });
        } finally {
            setSending(false);
        }
    };

    const handleSaveDraft = async () => {
        const body = editor?.getHTML();
        try {
            const response = await fetch("/api/gmail/draft", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ to, cc, bcc, subject, body, threadId }),
            });

            if (!response.ok) {
                throw new Error("Failed to save draft");
            }

            toast({
                title: "Draft saved",
                description: "Email saved to drafts",
            });
            onClose();
        } catch (error) {
            console.error("Save draft error:", error);
            toast({
                title: "Save failed",
                description: "Could not save draft",
                variant: "destructive",
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col border-l">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">{threadId ? "Reply" : "New Message"}</h2>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <Minimize2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="space-y-1">
                    <Label htmlFor="compose-to">To</Label>
                    <div className="flex gap-2">
                        <Input
                            id="compose-to"
                            name="compose-to"
                            type="email"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            placeholder="recipient@example.com"
                            className="flex-1"
                        />
                        {!showCc && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowCc(true)}
                            >
                                Cc
                            </Button>
                        )}
                        {!showBcc && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowBcc(true)}
                            >
                                Bcc
                            </Button>
                        )}
                    </div>
                </div>

                {showCc && (
                    <div className="space-y-1">
                        <Label htmlFor="compose-cc">Cc</Label>
                        <Input
                            id="compose-cc"
                            name="compose-cc"
                            type="email"
                            value={cc}
                            onChange={(e) => setCc(e.target.value)}
                            placeholder="cc@example.com"
                        />
                    </div>
                )}

                {showBcc && (
                    <div className="space-y-1">
                        <Label htmlFor="compose-bcc">Bcc</Label>
                        <Input
                            id="compose-bcc"
                            name="compose-bcc"
                            type="email"
                            value={bcc}
                            onChange={(e) => setBcc(e.target.value)}
                            placeholder="bcc@example.com"
                        />
                    </div>
                )}

                <div className="space-y-1">
                    <Label htmlFor="compose-subject">Subject</Label>
                    <Input
                        id="compose-subject"
                        name="compose-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Email subject"
                    />
                </div>

                <div className="space-y-1 border rounded-md overflow-hidden">
                    <MenuBar editor={editor} />
                    <EditorContent editor={editor} className="min-h-[300px]" />
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t">
                <div className="flex gap-2">
                    <Button onClick={handleSend} disabled={sending}>
                        <Send className="h-4 w-4 mr-2" />
                        {sending ? "Sending..." : "Send"}
                    </Button>
                    <Button variant="outline" onClick={handleSaveDraft}>
                        Save Draft
                    </Button>
                </div>
                <Button variant="ghost" size="icon">
                    <Paperclip className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
