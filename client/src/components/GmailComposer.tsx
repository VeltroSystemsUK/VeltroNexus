import React, { useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { 
  Bold, Italic, Strikethrough, Underline as UnderlineIcon, 
  Undo, Redo, Link as LinkIcon, Paperclip, Smile, Image as ImageIcon,
  Type, Send, X
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { Loader2 } from "lucide-react";

interface GmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (payload: any) => Promise<void>;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
}

export function GmailComposer({ isOpen, onClose, onSend, defaultTo = "", defaultSubject = "", defaultBody = "" }: GmailComposerProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [importance, setImportance] = useState("normal");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontFamily,
      Image,
      Link.configure({ openOnClick: false }),
    ],
    content: defaultBody,
  });

  if (!editor) {
    return null;
  }

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
        editor.chain().focus().setImage({ src }).run();
      };
      reader.readAsDataURL(file);
    }
  };

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

  const handleSend = async () => {
    setIsSending(true);
    
    // Process attachments to base64
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
      await onSend({
        to,
        subject,
        body: editor.getHTML(),
        importance,
        attachments: processedAttachments
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b bg-muted/20">
          <DialogTitle className="flex items-center gap-2">
            <MailIcon className="h-5 w-5 text-red-500" /> Draft Outreach
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto flex flex-col pt-2">
          {/* Email Headers */}
          <div className="px-4 space-y-3 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground w-12">To:</span>
              <Input value={to} onChange={(e) => setTo(e.target.value)} className="h-8 border-transparent hover:border-input focus-visible:ring-1 bg-transparent" placeholder="recipient@example.com" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground w-12">Subject:</span>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-8 border-transparent hover:border-input focus-visible:ring-1 bg-transparent font-medium" placeholder="Message Subject" />
            </div>
          </div>

          <div className="border-y bg-muted/10 p-1 px-2 flex items-center flex-wrap gap-1 sticky top-0 z-10 backdrop-blur-sm">
            {/* Toolbar */}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo className="h-3.5 w-3.5" /></Button>
            
            <div className="w-px h-4 bg-border mx-1" />

            {/* Font Family */}
            <Select onValueChange={(val) => editor.chain().focus().setFontFamily(val).run()}>
              <SelectTrigger className="h-7 w-[120px] text-xs border-transparent shadow-none px-2 focus:ring-0">
                <SelectValue placeholder="Font" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Inter">Inter</SelectItem>
                <SelectItem value="Arial">Arial</SelectItem>
                <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                <SelectItem value="Courier New">Courier New</SelectItem>
              </SelectContent>
            </Select>

            {/* Font Size (using Headers as proxy for sizes) */}
            <Select onValueChange={(val) => {
              if (val === "p") editor.chain().focus().setParagraph().run();
              else editor.chain().focus().toggleHeading({ level: parseInt(val) as any }).run();
            }}>
              <SelectTrigger className="h-7 w-[100px] text-xs border-transparent shadow-none px-2 focus:ring-0">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">Large (H2)</SelectItem>
                <SelectItem value="3">Medium (H3)</SelectItem>
                <SelectItem value="p">Normal</SelectItem>
                <SelectItem value="6">Small (H6)</SelectItem>
              </SelectContent>
            </Select>

            <div className="w-px h-4 bg-border mx-1" />
            
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${editor.isActive('bold') ? 'bg-muted' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${editor.isActive('italic') ? 'bg-muted' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${editor.isActive('underline') ? 'bg-muted' : ''}`} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${editor.isActive('strike') ? 'bg-muted' : ''}`} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5" /></Button>
            
            <div className="w-px h-4 bg-border mx-1" />
            
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${editor.isActive('link') ? 'bg-muted' : ''}`} onClick={setLink}><LinkIcon className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => imageInputRef.current?.click()}><ImageIcon className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-3.5 w-3.5" /></Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7"><Smile className="h-3.5 w-3.5" /></Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 border-none shadow-none bg-transparent" side="bottom" align="start">
                <EmojiPicker onEmojiClick={(emojiData) => editor.commands.insertContent(emojiData.emoji)} />
              </PopoverContent>
            </Popover>

            <div className="flex-1" />

            <Select value={importance} onValueChange={setImportance}>
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue placeholder="Importance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high"><span className="text-red-500 font-medium">High Importance</span></SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low"><span className="text-muted-foreground">Low Priority</span></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Hidden inputs */}
          <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleAttachment} />
          <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageInsert} />

          {/* Editor Body */}
          <div className="flex-1 p-4 cursor-text prose prose-sm max-w-none text-sm focus:outline-none min-h-[300px]" onClick={() => editor.commands.focus()}>
            <EditorContent editor={editor} className="min-h-full outline-none" />
          </div>

          {/* Attachment tray */}
          {attachments.length > 0 && (
            <div className="p-3 border-t bg-muted/5 flex flex-wrap gap-2">
              {attachments.map((file, i) => (
                <div key={i} className="flex items-center gap-2 bg-background border shadow-sm rounded-md px-2 py-1.5 text-xs">
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <span className="text-muted-foreground">{(file.size / 1024).toFixed(0)}kb</span>
                  <button onClick={() => removeAttachment(i)} className="ml-1 text-muted-foreground hover:text-red-500"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 items-center justify-between sm:justify-between">
            <Button variant="ghost" onClick={onClose} >Discard Draft</Button>
            <Button onClick={handleSend} disabled={isSending || !to || !subject} className="gap-2">
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send Draft
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// MailIcon helper to match Lucide naming
const MailIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
     <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);
