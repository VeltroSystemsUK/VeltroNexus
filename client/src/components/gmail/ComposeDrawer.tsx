import { useState, useEffect, useRef } from "react";
import { X, Send, Paperclip, Minimize2, Bold, Italic, Link as LinkIcon, Quote, Image as ImageIcon, Underline as UnderlineIcon, Strikethrough, Smile, Undo, Redo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import EmojiPicker from "emoji-picker-react";
import DOMPurify from "dompurify";
import { appendGmailSignature } from "@shared/gmail";

interface ComposeDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    initialTo?: string;
    initialName?: string;
    initialSubject?: string;
    initialBody?: string;
    threadId?: string;
    signature?: string;
}

const MenuBar = ({ editor, onImageInput, onAttachmentInput }: { editor: any, onImageInput: () => void, onAttachmentInput: () => void }) => {
    if (!editor) {
        return null;
    }

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL', previousUrl);
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    return (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo className="h-3.5 w-3.5" /></Button>
            
            <div className="w-px h-4 bg-border mx-1" />

            <Select onValueChange={(val) => editor.chain().focus().setFontFamily(val).run()}>
                <SelectTrigger className="h-7 w-[100px] text-xs shadow-none">
                    <SelectValue placeholder="Font" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Inter">Inter</SelectItem>
                    <SelectItem value="Arial">Arial</SelectItem>
                    <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                    <SelectItem value="Courier New">Courier New</SelectItem>
                </SelectContent>
            </Select>

            <Select onValueChange={(val) => {
                if (val === "p") editor.chain().focus().setParagraph().run();
                else editor.chain().focus().toggleHeading({ level: parseInt(val) as any }).run();
            }}>
                <SelectTrigger className="h-7 w-[90px] text-xs shadow-none">
                    <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="2">Large</SelectItem>
                    <SelectItem value="3">Medium</SelectItem>
                    <SelectItem value="p">Normal</SelectItem>
                    <SelectItem value="6">Small</SelectItem>
                </SelectContent>
            </Select>

            <div className="w-px h-4 bg-border mx-1" />

            <Button variant="ghost" size="icon" className={`h-7 w-7 ${editor.isActive('bold') ? 'bg-muted' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${editor.isActive('italic') ? 'bg-muted' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${editor.isActive('underline') ? 'bg-muted' : ''}`} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${editor.isActive('strike') ? 'bg-muted' : ''}`} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${editor.isActive('blockquote') ? 'bg-muted' : ''}`} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5" /></Button>
            
            <div className="w-px h-4 bg-border mx-1" />
            
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${editor.isActive('link') ? 'bg-muted' : ''}`} onClick={setLink}><LinkIcon className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onImageInput}><ImageIcon className="h-3.5 w-3.5" /></Button>
            
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Smile className="h-3.5 w-3.5" /></Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 border-none shadow-none w-auto" side="bottom" align="start">
                    <EmojiPicker onEmojiClick={(emojiData) => editor.commands.insertContent(emojiData.emoji)} />
                </PopoverContent>
            </Popover>
            
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAttachmentInput}><Paperclip className="h-3.5 w-3.5" /></Button>
        </div>
    );
};

export function ComposeDrawer({
    isOpen,
    onClose,
    initialTo = "",
    initialSubject = "",
    initialBody = "",
    threadId = "",
    signature = "",
}: ComposeDrawerProps) {
    const [to, setTo] = useState(initialTo);
    const [cc, setCc] = useState("");
    const [bcc, setBcc] = useState("");
    const [subject, setSubject] = useState(initialSubject);
    const [showCc, setShowCc] = useState(false);
    const [showBcc, setShowBcc] = useState(false);
    const [sending, setSending] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextStyle,
            FontFamily,
            Image,
            Link.configure({ openOnClick: false }),
        ],
        content: initialBody,
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert focus:outline-none min-h-[300px] max-w-none p-4',
            },
        },
    });

    useEffect(() => {
        if (isOpen) {
            setTo(initialTo);
            setSubject(initialSubject);
            if (editor) {
                editor.commands.setContent(initialBody || "<p></p>");
            }
            setAttachments([]);
        }
    }, [isOpen, initialTo, initialSubject, initialBody, signature, editor]);

    const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachments((prev) => [...prev, ...Array.from(e.target.files as FileList)]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleImageInsert = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const src = event.target?.result as string;
                editor?.chain().focus().setImage({ src }).run();
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSend = async () => {
        const body = appendGmailSignature(editor?.getHTML() || "", signature);
        if (!to || !subject || !editor?.getHTML() || editor.getHTML() === '<p></p>') {
            toast({
                title: "Missing fields",
                description: "Please fill in recipient, subject, and message",
                variant: "destructive",
            });
            return;
        }

        setSending(true);

        const processedAttachments = await Promise.all(attachments.map(async (file) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    const base64 = result.split(',')[1];
                    resolve({
                        filename: file.name,
                        content: base64,
                        encoding: 'base64',
                        contentType: file.type
                    });
                };
                reader.readAsDataURL(file);
            });
        }));

        try {
            const response = await fetch("/api/gmail/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ to, cc, bcc, subject, body, threadId, attachments: processedAttachments }),
            });

            if (!response.ok) {
                throw new Error("Failed to send email");
            }

            toast({
                title: "Email sent",
                description: `Message sent to ${to}`,
            });

            setTo("");
            setCc("");
            setBcc("");
            setSubject("");
            setAttachments([]);
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
        const body = appendGmailSignature(editor?.getHTML() || "", signature);
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

            <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-3">
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
                            <Button variant="ghost" size="sm" onClick={() => setShowCc(true)}>Cc</Button>
                        )}
                        {!showBcc && (
                            <Button variant="ghost" size="sm" onClick={() => setShowBcc(true)}>Bcc</Button>
                        )}
                    </div>
                </div>

                {showCc && (
                    <div className="space-y-1">
                        <Label htmlFor="compose-cc">Cc</Label>
                        <Input id="compose-cc" type="email" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc@example.com" />
                    </div>
                )}

                {showBcc && (
                    <div className="space-y-1">
                        <Label htmlFor="compose-bcc">Bcc</Label>
                        <Input id="compose-bcc" type="email" value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="bcc@example.com" />
                    </div>
                )}

                <div className="space-y-1">
                    <Label htmlFor="compose-subject">Subject</Label>
                    <Input id="compose-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
                </div>

                <div className="flex-1 flex flex-col border rounded-md overflow-hidden min-h-[350px]">
                    <MenuBar 
                        editor={editor} 
                        onImageInput={() => imageInputRef.current?.click()}
                        onAttachmentInput={() => fileInputRef.current?.click()}
                    />
                    <div className="flex-1 overflow-y-auto cursor-text bg-background" onClick={() => editor?.commands.focus()}>
                        <EditorContent editor={editor} className="min-h-full outline-none" />
                        {signature ? (
                            <div className="px-4 pb-4 border-t bg-white text-foreground">
                                <div
                                    className="gmail_signature pt-3 text-sm overflow-x-auto"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(signature) }}
                                />
                            </div>
                        ) : null}
                    </div>
                    {attachments.length > 0 && (
                        <div className="p-2 border-t bg-muted/5 flex flex-wrap gap-2">
                            {attachments.map((file, i) => (
                                <div key={i} className="flex items-center gap-1.5 bg-background border shadow-sm rounded text-xs px-2 py-1">
                                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                                    <span className="truncate max-w-[150px]">{file.name}</span>
                                    <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-red-500 ml-1" title="Remove attachment" aria-label={`Remove attachment ${file.name}`}>
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <input type="file" aria-label="Choose file attachments" title="Choose file attachments" ref={fileInputRef} className="hidden" multiple onChange={handleAttachment} />
            <input type="file" aria-label="Choose image to insert" title="Choose image to insert" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageInsert} />

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
                <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
