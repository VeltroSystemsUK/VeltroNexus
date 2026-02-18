import { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { useLocation } from "wouter";
import {
    Search,
    Settings,
    Mail,
    Star,
    Trash,
    Archive,
    MoreVertical,
    ArrowLeft,
    FolderInput,
    RefreshCw,
    Plus,
    Trash2,
    CheckSquare,
    Square,
    Inbox,
    Send,
    FileText,
    Edit,
    LayoutList,
    Grid,
    Columns,
    Rows,
    Reply,
    X as CloseIcon
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ComposeDrawer } from "@/components/gmail/ComposeDrawer";
import { useToast } from "@/hooks/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GmailMessage {
    id: string;
    threadId: string;
    snippet: string;
    from: string;
    subject: string;
    date: string;
    unread: boolean;
    labelIds: string[];
}

interface GmailLabel {
    id: string;
    name: string;
    type: "system" | "user";
}

export default function Gmail() {
    const [location] = useLocation();
    const [messages, setMessages] = useState<GmailMessage[]>([]);
    const [labels, setLabels] = useState<GmailLabel[]>([]);
    const [loading, setLoading] = useState(false);
    const [composeOpen, setComposeOpen] = useState(false);
    const [composeTo, setComposeTo] = useState("");
    const [composeName, setComposeName] = useState("");
    const [activeFolder, setActiveFolder] = useState<string>("inbox");
    const [newLabelName, setNewLabelName] = useState("");
    const [isCreateLabelOpen, setIsCreateLabelOpen] = useState(false);

    // Layout Settings
    const [density, setDensity] = useState<"default" | "compact">("default");
    const [layout, setLayout] = useState<"list" | "split-right" | "split-bottom">("list");
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
    const [composeSubject, setComposeSubject] = useState("");
    const [composeBody, setComposeBody] = useState("");
    const [composeThreadId, setComposeThreadId] = useState("");
    const [draggedMessageId, setDraggedMessageId] = useState<string | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [signature, setSignature] = useState("");
    const [oooSettings, setOooSettings] = useState<any>(null);

    const { toast } = useToast();

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/gmail/settings");
            if (res.ok) {
                const data = await res.json();
                setSignature(data.signature);
                setOooSettings(data.vacationResponder);
            }
        } catch (err) {
            console.error("Failed to fetch Gmail settings:", err);
        }
    };

    // Check URL params for compose
    useEffect(() => {
        fetchSettings();
        const params = new URLSearchParams(window.location.search);
        const shouldCompose = params.get("compose") === "true";
        const toEmail = params.get("to") || "";
        const name = params.get("name") || "";

        if (shouldCompose) {
            setComposeTo(toEmail);
            setComposeName(name);
            setComposeOpen(true);
            window.history.replaceState({}, "", "/gmail");
        }
    }, [location]);

    // Fetch Labels
    const fetchLabels = async () => {
        try {
            const response = await fetch("/api/gmail/labels");
            if (response.ok) {
                const data = await response.json();
                const userLabels = data.labels.filter((l: any) => l.type === "user");
                setLabels(userLabels);
            }
        } catch (error) {
            console.error("Failed to fetch labels:", error);
        }
    };

    useEffect(() => {
        fetchLabels();
    }, []);

    const loadMessages = async (searchOverride?: string) => {
        setLoading(true);
        try {
            let folderQuery = activeFolder;
            if (activeFolder === "inbox") folderQuery = "inbox";
            else if (activeFolder === "sent") folderQuery = "sent";
            else if (activeFolder === "drafts") folderQuery = "drafts";
            const query = searchOverride !== undefined ? searchOverride : searchTerm;
            const url = `/api/gmail/messages?folder=${activeFolder}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch messages");
            const data = await response.json();
            setMessages(data.messages || []);
        } catch (error) {
            console.error("Fetch error:", error);
            toast({
                title: "Error fetching messages",
                description: "Check your connection and ensure permissions are correct.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMessages();
    }, [activeFolder]);

    useEffect(() => {
        if (!selectedMessageId) {
            setSelectedMessage(null);
            return;
        }

        const fetchMessage = async () => {
            try {
                const response = await fetch(`/api/gmail/message/${selectedMessageId}`);
                if (response.ok) {
                    const data = await response.json();
                    setSelectedMessage(data.message);
                }
            } catch (error) {
                console.error("Failed to load message body", error);
            }
        };
        fetchMessage();
    }, [selectedMessageId]);


    const handleStar = async (msgId: string, isStarred: boolean) => {
        try {
            await fetch(`/api/gmail/message/${msgId}/modify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    addLabelIds: isStarred ? [] : ["STARRED"],
                    removeLabelIds: isStarred ? ["STARRED"] : [],
                }),
            });
            // Update local state for immediate feedback
            setMessages(prev => prev.map(m =>
                m.id === msgId
                    ? {
                        ...m, labelIds: isStarred
                            ? m.labelIds.filter(id => id !== "STARRED")
                            : [...m.labelIds, "STARRED"]
                    }
                    : m
            ));
            if (selectedMessage && selectedMessage.id === msgId) {
                setSelectedMessage({
                    ...selectedMessage,
                    labelIds: isStarred
                        ? selectedMessage.labelIds.filter((id: string) => id !== "STARRED")
                        : [...selectedMessage.labelIds, "STARRED"]
                });
            }
        } catch (error) {
            console.error("Star error:", error);
        }
    };

    const handleArchive = async (msgId: string) => {
        try {
            // Immediate local feedback
            setMessages(prev => prev.filter(m => m.id !== msgId));
            if (selectedMessageId === msgId) setSelectedMessageId(null);

            const response = await fetch(`/api/gmail/message/${msgId}/modify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    removeLabelIds: ["INBOX"],
                }),
            });

            if (!response.ok) throw new Error("Failed to archive");
            toast({ title: "Message archived" });
            setTimeout(() => loadMessages(), 1000);
        } catch (error) {
            console.error("Archive error:", error);
            loadMessages(); // Revert
        }
    };

    const handleDelete = async (msgId: string) => {
        try {
            // Immediate UI feedback
            setMessages(prev => prev.filter(m => m.id !== msgId));
            if (selectedMessageId === msgId) setSelectedMessageId(null);

            await fetch(`/api/gmail/message/${msgId}/trash`, { method: "POST" });
            toast({ title: "Message moved to trash" });
            setTimeout(() => loadMessages(), 1000);
        } catch (error) {
            console.error("Delete error:", error);
            toast({
                title: "Failed to delete",
                description: "An error occurred while moving the message to trash",
                variant: "destructive"
            });
            loadMessages(); // Revert on error
        }
    };

    const handleBatchTrash = async () => {
        if (selectedIds.length === 0) return;

        try {
            const idsToDelete = [...selectedIds];
            // Immediate UI feedback
            setMessages(prev => prev.filter(m => !idsToDelete.includes(m.id)));
            setSelectedIds([]);
            if (selectedMessageId && idsToDelete.includes(selectedMessageId)) {
                setSelectedMessageId(null);
            }

            await fetch(`/api/gmail/messages/batch-trash`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: idsToDelete }),
            });

            toast({ title: `${idsToDelete.length} messages moved to trash` });
            setTimeout(() => loadMessages(), 1000);
        } catch (error) {
            console.error("Batch delete error:", error);
            toast({
                title: "Failed to delete messages",
                variant: "destructive"
            });
            loadMessages();
        }
    };

    const handleMoveToFolder = async (msgId: string, targetLabelId: string) => {
        try {
            // Validate IDs
            if (!msgId || !targetLabelId) {
                console.error("[Gmail] Missing msgId or targetLabelId");
                return;
            }

            // Immediate UI feedback
            setMessages(prev => prev.filter(m => m.id !== msgId));
            if (selectedMessageId === msgId) setSelectedMessageId(null);

            // 1. Handle Trash movement
            if (targetLabelId === "TRASH") {
                const res = await fetch(`/api/gmail/message/${msgId}/trash`, { method: "POST" });
                if (!res.ok) throw new Error("Failed to move to Trash");
                toast({ title: "Moved to Trash" });
                setTimeout(() => loadMessages(), 1000);
                return;
            }

            // 2. Handle move OUT of Trash (requires untrash first)
            if (activeFolder === "trash") {
                const untrashRes = await fetch(`/api/gmail/message/${msgId}/untrash`, { method: "POST" });
                if (!untrashRes.ok) throw new Error("Failed to restore from trash");

                // If the target was Inbox, we're done after untrash
                if (targetLabelId === "INBOX") {
                    toast({ title: "Message restored to Inbox" });
                    setTimeout(() => loadMessages(), 1000);
                    return;
                }
                // Otherwise continue to modify for custom label
            }

            // 3. Handle standard move/modify
            const removeLabelIds: string[] = [];

            // Map active folder to its formal Label ID for removal
            if (activeFolder === "inbox") removeLabelIds.push("INBOX");
            else if (activeFolder === "sent") removeLabelIds.push("SENT");
            else if (activeFolder === "drafts") removeLabelIds.push("DRAFTS");
            else if (!["trash", "spam"].includes(activeFolder)) {
                // If it's a custom label ID, remove it to "move" it
                removeLabelIds.push(activeFolder);
            }

            // Map target folder if it's a system folder
            let finalTargetId = targetLabelId;
            if (targetLabelId === "inbox") finalTargetId = "INBOX";

            const modifyRes = await fetch(`/api/gmail/message/${msgId}/modify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    addLabelIds: [finalTargetId],
                    removeLabelIds,
                }),
            });

            const modifyData = await modifyRes.json();
            if (!modifyRes.ok) {
                console.error("[Gmail] Modify failed:", modifyData);
                throw new Error(modifyData.error || "Failed to modify labels");
            }
            toast({
                title: "Message moved",
                description: `Moved to ${labels.find(l => l.id === targetLabelId)?.name || targetLabelId}`
            });
            setTimeout(() => loadMessages(), 1000);
        } catch (error: any) {
            console.error("Move error:", error);
            toast({
                title: "Move failed",
                description: error.message || "An unexpected error occurred",
                variant: "destructive"
            });
            loadMessages(); // Revert UI if it failed
        }
    };

    const handleCreateLabel = async () => {
        if (!newLabelName) return;
        try {
            const response = await fetch("/api/gmail/labels", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newLabelName }),
            });

            if (response.ok) {
                toast({ title: "Label created", description: `Created label: ${newLabelName}` });
                setNewLabelName("");
                setIsCreateLabelOpen(false);
                fetchLabels();
            }
        } catch (error) {
            console.error("Create label error", error);
            toast({ title: "Error", description: "Failed to create label", variant: "destructive" });
        }
    };

    const handleDeleteLabel = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const response = await fetch(`/api/gmail/labels/${id}`, { method: "DELETE" });
            if (response.ok) {
                toast({ title: "Label deleted" });
                if (activeFolder === id) setActiveFolder("inbox");
                fetchLabels();
            }
        } catch (error) {
            console.error("Delete label error", error);
        }
    };

    const folders = [
        { id: "inbox", label: "Inbox", icon: Inbox },
        { id: "sent", label: "Sent", icon: Send },
        { id: "drafts", label: "Drafts", icon: FileText },
        { id: "trash", label: "Trash", icon: Trash2 },
    ];

    const renderMessageBody = (msg: any) => {
        if (!msg) return null;
        let body = "No content";
        if (msg.payload?.body?.data) {
            body = atob(msg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (msg.payload?.parts) {
            const part = msg.payload.parts.find((p: any) => p.mimeType === "text/html") || msg.payload.parts[0];
            if (part?.body?.data) {
                body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            }
        }

        return (
            <div className="prose dark:prose-invert max-w-none p-4" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body) }} />
        );
    };

    return (
        <div className="h-[calc(100vh-4rem)] flex">
            {/* Sidebar */}
            <div className="w-64 border-r p-4 flex flex-col gap-4 bg-background">
                <Button onClick={() => setComposeOpen(true)} className="w-full shadow-md">
                    <Edit className="h-4 w-4 mr-2" />
                    Compose
                </Button>

                <div className="space-y-1 flex-1 overflow-y-auto">
                    {folders.map((folder) => {
                        const Icon = folder.icon;
                        const isOver = dragOverFolderId === folder.id;
                        return (
                            <Button
                                key={folder.id}
                                variant={activeFolder === folder.id ? "secondary" : "ghost"}
                                className={`w-full justify-start font-normal transition-colors ${isOver ? "bg-blue-100 dark:bg-blue-900/40 border-2 border-dashed border-blue-400" : ""}`}
                                onClick={() => setActiveFolder(folder.id)}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    if (folder.id === "inbox" || folder.id === "trash") {
                                        setDragOverFolderId(folder.id);
                                    }
                                }}
                                onDragLeave={() => setDragOverFolderId(null)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOverFolderId(null);
                                    if (draggedMessageId) {
                                        let targetLabel = null;
                                        if (folder.id === "inbox") targetLabel = "INBOX";
                                        else if (folder.id === "trash") targetLabel = "TRASH";
                                        else if (folder.id === "sent") targetLabel = "SENT";
                                        else if (folder.id === "drafts") targetLabel = "DRAFTS";

                                        if (targetLabel) {
                                            handleMoveToFolder(draggedMessageId, targetLabel);
                                        }
                                    }
                                }}
                            >
                                <Icon className="h-4 w-4 mr-3" />
                                {folder.label}
                            </Button>
                        );
                    })}

                    <Separator className="my-2" />

                    <div className="px-2 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        <div className="flex items-center gap-2">
                            <span>Labels</span>
                            <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => fetchLabels()} title="Sync Labels">
                                <RefreshCw className="h-2 w-2" />
                            </Button>
                        </div>
                        <Dialog open={isCreateLabelOpen} onOpenChange={setIsCreateLabelOpen}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted">
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create New Label</DialogTitle>
                                    <DialogDescription>Enter a name for your new label.</DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Label htmlFor="name" className="text-right">Name</Label>
                                    <Input
                                        id="name"
                                        name="label-name"
                                        value={newLabelName}
                                        onChange={(e) => setNewLabelName(e.target.value)}
                                        className="mt-2"
                                    />
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleCreateLabel}>Create</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {labels.map((label: any) => (
                        <div key={label.id} className="group flex items-center w-full">
                            <Button
                                variant={activeFolder === label.id ? "secondary" : "ghost"}
                                className={`flex-1 justify-start font-normal truncate transition-colors ${dragOverFolderId === label.id ? "bg-blue-100 dark:bg-blue-900/40 border-2 border-dashed border-blue-400" : ""}`}
                                onClick={() => setActiveFolder(label.id)}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragOverFolderId(label.id);
                                }}
                                onDragLeave={() => setDragOverFolderId(null)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDragOverFolderId(null);
                                    if (draggedMessageId) {
                                        handleMoveToFolder(draggedMessageId, label.id);
                                    }
                                }}
                            >
                                <div className="w-2 h-2 rounded-full bg-blue-400 mr-3 shrink-0" />
                                <span className="truncate">{label.name}</span>
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreVertical className="h-3 w-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={(e) => handleDeleteLabel(label.id, e)} className="text-red-500">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}
                </div>

                <div className="text-xs text-muted-foreground px-2 pt-2 border-t">
                    <p className="font-medium mb-1">Account</p>
                    <p className="truncate">shaun@veltro.co.uk</p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="flex items-center gap-4 p-4 border-b h-16">
                    {layout === "list" && selectedMessageId && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedMessageId(null)}
                            className="mr-2"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <h1 className="text-xl font-bold capitalize truncate">
                        {selectedMessageId && layout === "list"
                            ? "View Email"
                            : (folders.find(f => f.id === activeFolder)?.label || labels.find(l => l.id === activeFolder)?.name || activeFolder)
                        }
                    </h1>

                    <div className="flex-1 max-w-2xl px-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="gmail-search"
                                name="q"
                                placeholder="Search emails..."
                                className="pl-10 pr-10 w-full bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        loadMessages();
                                    }
                                }}
                            />
                            {searchTerm && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        setSearchTerm("");
                                        loadMessages("");
                                    }}
                                >
                                    <CloseIcon className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSettingsOpen(true)}
                            title="Gmail Settings"
                        >
                            <Settings className="h-5 w-5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => loadMessages()}
                            disabled={loading}
                            title="Refresh"
                            className="h-9 w-9"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Settings className="h-5 w-5 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>View Density</DropdownMenuLabel>
                                <DropdownMenuRadioGroup value={density} onValueChange={(v: any) => setDensity(v)}>
                                    <DropdownMenuRadioItem value="default">
                                        <LayoutList className="h-4 w-4 mr-2" /> Default
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="compact">
                                        <Grid className="h-4 w-4 mr-2" /> Compact
                                    </DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Reading Pane</DropdownMenuLabel>
                                <DropdownMenuRadioGroup value={layout} onValueChange={(v: any) => setLayout(v)}>
                                    <DropdownMenuRadioItem value="list">
                                        <LayoutList className="h-4 w-4 mr-2" /> No Split
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="split-right">
                                        <Columns className="h-4 w-4 mr-2" /> Right of Inbox
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="split-bottom">
                                        <Rows className="h-4 w-4 mr-2" /> Below Inbox
                                    </DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button variant="ghost" size="icon" onClick={() => loadMessages()} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </div>

                {/* Bulk Actions Toolbar */}
                {selectedIds.length > 0 && (
                    <div className="flex items-center gap-4 p-2 bg-blue-50 dark:bg-blue-900/20 border-b animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center gap-2 px-2">
                            <Checkbox
                                id="select-all"
                                name="select-all"
                                checked={selectedIds.length === messages.length}
                                onCheckedChange={(checked) => {
                                    if (checked) setSelectedIds(messages.map(m => m.id));
                                    else setSelectedIds([]);
                                }}
                            />
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                {selectedIds.length} selected
                            </span>
                        </div>
                        <Separator orientation="vertical" className="h-6 bg-blue-200 dark:bg-blue-800" />
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50"
                                onClick={handleBatchTrash}
                            >
                                <Trash className="h-4 w-4 mr-2" />
                                Trash
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50"
                                onClick={() => setSelectedIds([])}
                            >
                                Deselect all
                            </Button>
                        </div>
                    </div>
                )}

                {/* Content - Split View Logic */}
                <div className={`flex-1 flex min-h-0 ${layout === "split-bottom" ? "flex-col" : "flex-row"}`}>

                    {/* Message List */}
                    {(!(layout === "list" && selectedMessageId)) && (
                        <div className={`
                            overflow-y-auto border-r
                            ${layout === "split-right" ? "w-1/2 min-w-[350px]" : layout === "split-bottom" ? "h-1/2 min-h-[300px]" : "w-full"}
                        `}>
                            {messages.length === 0 && !loading ? (
                                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground h-full">
                                    <Mail className="h-12 w-12 mb-4 opacity-20" />
                                    <p>No messages found</p>
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {messages.map((message) => (
                                        <div
                                            key={message.id}
                                            draggable
                                            onDragStart={() => setDraggedMessageId(message.id)}
                                            onDragEnd={() => {
                                                setDraggedMessageId(null);
                                                setDragOverFolderId(null);
                                            }}
                                            onClick={(e) => {
                                                if ((e.target as HTMLElement).closest('.selection-checkbox')) return;
                                                setSelectedMessageId(message.id);
                                            }}
                                            className={`
                                                group relative cursor-pointer hover:bg-muted/50 transition-colors active:opacity-70 flex gap-2 items-start
                                                ${density === "compact" ? "p-2" : "p-4"}
                                                ${selectedMessageId === message.id ? "bg-muted border-l-4 border-l-blue-500" : message.unread ? "bg-background font-semibold" : "bg-background/40"}
                                                ${draggedMessageId === message.id ? "opacity-40" : ""}
                                                ${selectedIds.includes(message.id) ? "bg-blue-50/50 dark:bg-blue-900/20" : ""}
                                            `}
                                        >
                                            <div className="selection-checkbox flex items-center h-5 mt-0.5">
                                                <Checkbox
                                                    id={`select-${message.id}`}
                                                    checked={selectedIds.includes(message.id)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedIds(prev => [...prev, message.id]);
                                                        } else {
                                                            setSelectedIds(prev => prev.filter(id => id !== message.id));
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <span className={`truncate mr-2 ${density === "compact" ? "text-sm" : "text-base"}`}>
                                                        {message.from}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {new Date(message.date).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className={`text-sm mb-1 truncate ${message.unread ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                                                    {message.subject || "(No subject)"}
                                                </div>
                                                <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
                                                    {message.snippet}
                                                    <div className="flex gap-1 overflow-hidden">
                                                        {message.labelIds?.filter((l: string) => !["INBOX", "SENT", "DRAFTS", "TRASH", "SPAM", "UNREAD", "IMPORTANT", "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_UPDATES", "CATEGORY_FORUMS"].includes(l)).map((labelId: string) => (
                                                            <span key={labelId} className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-[10px] text-blue-700 dark:text-blue-300 font-medium whitespace-nowrap">
                                                                {labels.find(l => l.id === labelId)?.name || labelId}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Reading Pane */}
                    {(layout !== "list" || selectedMessageId) && (
                        <div className={`flex-1 bg-background overflow-y-auto ${!selectedMessageId ? "flex items-center justify-center text-muted-foreground" : ""}`}>
                            {selectedMessageId ? (
                                selectedMessage ? (
                                    <div className="flex flex-col h-full">
                                        {/* Reading Pane Toolbar */}
                                        <div className="flex items-center gap-2 p-4 border-b">
                                            <Button variant="ghost" size="icon" onClick={() => handleStar(selectedMessage.id, selectedMessage.labelIds?.includes("STARRED"))}>
                                                <Star className={`h-4 w-4 ${selectedMessage.labelIds?.includes("STARRED") ? "fill-yellow-400 text-yellow-400" : ""}`} />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleArchive(selectedMessage.id)} title="Archive">
                                                <Archive className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(selectedMessage.id)} title="Delete" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                                <Trash className="h-4 w-4" />
                                            </Button>

                                            <Separator orientation="vertical" className="h-6 mx-1" />

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="gap-2">
                                                        <FolderInput className="h-4 w-4" />
                                                        Move to
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="w-48">
                                                    <DropdownMenuLabel>Label as...</DropdownMenuLabel>
                                                    {labels.map((label: any) => (
                                                        <DropdownMenuItem key={label.id} onClick={() => handleMoveToFolder(selectedMessage.id, label.id)}>
                                                            {label.name}
                                                        </DropdownMenuItem>
                                                    ))}
                                                    {labels.length === 0 && (
                                                        <div className="p-2 text-xs text-muted-foreground">No custom labels</div>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <div className="flex-1" />

                                            <div className="flex items-center gap-1">
                                                <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                                                    const from = selectedMessage.payload?.headers?.find((h: any) => h.name === "From")?.value || "";
                                                    const subject = selectedMessage.payload?.headers?.find((h: any) => h.name === "Subject")?.value || "";
                                                    setComposeTo(from);
                                                    setComposeSubject(subject.startsWith("Re:") ? subject : `Re: ${subject}`);
                                                    setComposeThreadId(selectedMessage.threadId);

                                                    // Simple quote for body
                                                    const date = new Date(parseInt(selectedMessage.internalDate)).toLocaleString();
                                                    const quote = `<br><br><div class="gmail_quote">On ${date}, ${from} wrote:<br><blockquote>${selectedMessage.snippet}</blockquote></div>`;
                                                    setComposeBody(quote);

                                                    setComposeOpen(true);
                                                }}>
                                                    <Reply className="h-4 w-4" />
                                                    Reply
                                                </Button>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="icon" className="h-9 w-9">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => {
                                                            const from = selectedMessage.payload?.headers?.find((h: any) => h.name === "From")?.value || "";
                                                            const to = selectedMessage.payload?.headers?.find((h: any) => h.name === "To")?.value || "";
                                                            const subject = selectedMessage.payload?.headers?.find((h: any) => h.name === "Subject")?.value || "";
                                                            setComposeTo(`${from}, ${to}`);
                                                            setComposeSubject(subject.startsWith("Re:") ? subject : `Re: ${subject}`);
                                                            setComposeThreadId(selectedMessage.threadId);
                                                            setComposeOpen(true);
                                                        }}>
                                                            Reply All
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => {
                                                            const subject = selectedMessage.payload?.headers?.find((h: any) => h.name === "Subject")?.value || "";
                                                            setComposeTo("");
                                                            setComposeSubject(subject.startsWith("Fwd:") ? subject : `Fwd: ${subject}`);
                                                            setComposeThreadId(selectedMessage.threadId);
                                                            setComposeBody(`<br><br>---------- Forwarded message ---------<br>${selectedMessage.snippet}`);
                                                            setComposeOpen(true);
                                                        }}>
                                                            Forward
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>

                                        <div className="p-6 overflow-y-auto">
                                            <h2 className="text-2xl font-bold mb-4">{selectedMessage.payload?.headers?.find((h: any) => h.name === "Subject")?.value}</h2>

                                            <div className="flex items-center justify-between mb-6 pb-4 border-b">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold">
                                                        {selectedMessage.payload?.headers?.find((h: any) => h.name === "From")?.value?.charAt(0) || "?"}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold">{selectedMessage.payload?.headers?.find((h: any) => h.name === "From")?.value}</div>
                                                        <div className="text-xs text-muted-foreground">to me</div>
                                                    </div>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {new Date(parseInt(selectedMessage.internalDate)).toLocaleString()}
                                                </div>
                                            </div>

                                            {renderMessageBody(selectedMessage)}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center p-8">
                                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                )
                            ) : (
                                <div className="text-center">
                                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <p>Select an email to read</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ComposeDrawer
                isOpen={composeOpen}
                onClose={() => setComposeOpen(false)}
                initialTo={composeTo}
                initialName={composeName}
                initialSubject={composeSubject}
                initialBody={signature ? `<br><br>--<br>${signature}` : ""}
                threadId={composeThreadId}
            />

            {/* Settings Dialog */}
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Gmail Settings</DialogTitle>
                        <DialogDescription>
                            Manage your email signature and vacation responder.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="signature">Email Signature</Label>
                            <Textarea
                                id="signature"
                                name="signature"
                                placeholder="Your email signature (HTML supported)..."
                                value={signature}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSignature(e.target.value)}
                                className="min-h-[200px] font-mono text-xs"
                            />
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <p>This will be appended to new messages. Supports HTML.</p>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 text-xs text-blue-500 hover:text-blue-600 underline"
                                    onClick={() => {
                                        // Using a direct link from Veltro website for better visibility if possible
                                        const logoUrl = "/veltro-logo.png"; // Changed to relative path
                                        const professionalSig = `<div dir="ltr"><table style="font-size:medium;border-collapse:collapse;color:rgb(51,51,51);max-width:550px"><tbody><tr><td style="padding-right:20px;padding-bottom:15px;vertical-align:middle"><img width="420" src="${logoUrl}" alt="Veltro Logo"></td><td style="border-left:2px solid rgb(120,163,198);padding-left:20px;padding-bottom:15px;vertical-align:middle"><div style="margin-bottom:6px"><span style="font-size:18px;font-weight:bold;background-color:rgb(255,255,255)"><font color="#0b5394">Shaun Tuhey</font></span><br><span style="color:rgb(120,163,198);font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">FOUNDER</span></div><div style="font-size:12px;line-height:1.5"><span style="color:rgb(120,163,198);font-weight:bold">m:</span><span style="background-color:rgb(255,255,255)"><font color="#134f5c">&nbsp;</font><b><font color="#0b5394">07898 789 313</font></b></span><br><span style="color:rgb(120,163,198);font-weight:bold">e:</span><font color="#444444">&nbsp;</font><a href="mailto:shaun@veltro.co.uk" style="background-color:rgb(255,255,255)" target="_blank"><b><font color="#0b5394">shaun@veltro.co.uk</font></b></a><br><span style="color:rgb(120,163,198);background-color:rgb(255,255,255);font-weight:bold">w:</span><span style="color:rgb(68,68,68);background-color:rgb(255,255,255)">&nbsp;</span><a href="http://www.veltro.co.uk/" target="_blank"><b style="background-color:rgb(255,255,255)"><font color="#0b5394">www.veltro.co.uk</font></b></a></div></td></tr><tr><td colspan="2" style="padding-top:10px;padding-bottom:10px;border-top:1px solid rgb(221,221,221);border-bottom:1px solid rgb(221,221,221);font-size:10px;color:rgb(153,153,153);line-height:1.4;text-align:justify"><span style="background-color:rgb(255,255,255)"><span style="color:rgb(6,21,40);font-weight:bold">Veltro</span>&nbsp;&nbsp;|&nbsp;&nbsp;<em>CONFIDENTIALITY NOTICE: The information contained in this email and any attachments is intended solely for the person or entity to whom it is addressed and may contain confidential or privileged material. If you are not the intended recipient, any use, disclosure, copying, or distribution of this message is strictly prohibited. If you have received this message in error, please delete it and notify the sender immediately.</em></span></td></tr></tbody></table></div>`;
                                        setSignature(professionalSig);
                                    }}
                                >
                                    Insert Veltro Preset
                                </Button>
                            </div>
                            <Button size="sm" onClick={async () => {
                                try {
                                    await fetch("/api/gmail/settings/signature", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ signature }),
                                    });
                                    toast({ title: "Signature updated" });
                                } catch (err) {
                                    toast({ title: "Failed to update signature", variant: "destructive" });
                                }
                            }}>Save Signature</Button>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="ooo-toggle" className="text-base">Vacation Responder</Label>
                                <Checkbox
                                    id="ooo-toggle"
                                    name="enable-vacation"
                                    checked={oooSettings?.enableVacationResponse}
                                    onCheckedChange={async (checked) => {
                                        const updated = { ...oooSettings, enableVacationResponse: checked };
                                        setOooSettings(updated);
                                        try {
                                            await fetch("/api/gmail/settings/vacation", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify(updated),
                                            });
                                            toast({ title: `Vacation responder ${checked ? "enabled" : "disabled"}` });
                                        } catch (err) {
                                            toast({ title: "Failed to update responder", variant: "destructive" });
                                        }
                                    }}
                                />
                            </div>

                            <div className={`space-y-4 ${!oooSettings?.enableVacationResponse ? "opacity-50 pointer-events-none" : ""}`}>
                                <div className="space-y-2">
                                    <Label htmlFor="ooo-subject">Subject</Label>
                                    <Input
                                        id="ooo-subject"
                                        name="ooo-subject"
                                        value={oooSettings?.responseSubject || ""}
                                        onChange={(e) => setOooSettings({ ...oooSettings, responseSubject: e.target.value })}
                                        placeholder="Out of Office"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ooo-body">Message</Label>
                                    <Textarea
                                        id="ooo-body"
                                        name="ooo-body"
                                        value={oooSettings?.responseBodyHtml || ""}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOooSettings({ ...oooSettings, responseBodyHtml: e.target.value })}
                                        placeholder="Your out of office message..."
                                        className="min-h-[100px]"
                                    />
                                </div>
                                <Button size="sm" onClick={async () => {
                                    try {
                                        await fetch("/api/gmail/settings/vacation", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify(oooSettings),
                                        });
                                        toast({ title: "Vacation responder updated" });
                                    } catch (err) {
                                        toast({ title: "Failed to update responder", variant: "destructive" });
                                    }
                                }}>Save Vacation Settings</Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
