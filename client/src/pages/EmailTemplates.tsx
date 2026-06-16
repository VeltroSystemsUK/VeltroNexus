import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePageTitle } from "@/context/LayoutContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  FileText,
  Copy,
  Trash2,
  Pencil,
  Sparkles,
  Loader2,
  LayoutGrid,
  Tag,
  Clock,
  BarChart3,
  Save,
  X,
  Type,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { UnlayerEmailEditor, type UnlayerEditorHandle } from "@/components/email/UnlayerEmailEditor";
import type { EmailTemplate } from "@shared/schema";
import { EMAIL_TEMPLATE_CATEGORIES } from "@shared/schema";

const categoryColors: Record<string, string> = {
  cold_outreach: "bg-blue-500/20 text-blue-400",
  follow_up: "bg-amber-500/20 text-amber-400",
  newsletter: "bg-emerald-500/20 text-emerald-400",
  announcement: "bg-emerald-500/20 text-emerald-400",
  onboarding: "bg-emerald-500/20 text-emerald-400",
  re_engagement: "bg-orange-500/20 text-orange-400",
  custom: "bg-gray-500/20 text-muted-foreground",
};

export default function EmailTemplates() {
  usePageTitle("Email Templates", "Create and manage reusable email marketing templates");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiParams, setAiParams] = useState({ purpose: "cold_outreach", tone: "professional", topic: "", industry: "" });

  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formCategory, setFormCategory] = useState<string>("custom");
  const [formPreviewText, setFormPreviewText] = useState("");
  const [formDesignJson, setFormDesignJson] = useState<any>(null);
  const [formContent, setFormContent] = useState("");
  const [editorMode, setEditorMode] = useState<"visual" | "plaintext">("visual");

  const editorRef = useRef<UnlayerEditorHandle>(null);

  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("/api/email-templates", "POST", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast.success("Template created successfully");
      closeBuilder();
    },
    onError: () => toast.error("Failed to create template"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest(`/api/email-templates/${id}`, "PATCH", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast.success("Template updated successfully");
      closeBuilder();
    },
    onError: () => toast.error("Failed to update template"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/email-templates/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast.success("Template deleted");
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete template"),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/email-templates/${id}/duplicate`, "POST");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast.success("Template duplicated");
    },
    onError: () => toast.error("Failed to duplicate template"),
  });

  const closeBuilder = () => {
    setBuilderOpen(false);
    setEditingId(null);
    setFormName("");
    setFormSubject("");
    setFormCategory("custom");
    setFormPreviewText("");
    setFormDesignJson(null);
    setFormContent("");
    setEditorMode("visual");
  };

  const openBuilder = (template?: EmailTemplate) => {
    if (template) {
      setEditingId(template.id!);
      setFormName(template.name);
      setFormSubject(template.subject);
      setFormCategory(template.category);
      setFormPreviewText(template.previewText || "");
      setFormContent(template.content || "");

      // Detect editor mode: if designJson exists it's visual, if designJson is
      // explicitly set to "plaintext" marker or there's no design, use plaintext
      if ((template as any).designJson === "plaintext") {
        setEditorMode("plaintext");
        setFormDesignJson(null);
      } else if ((template as any).designJson) {
        setEditorMode("visual");
        setFormDesignJson((template as any).designJson);
      } else if (template.content) {
        // Legacy template with HTML but no design — wrap in Unlayer block
        setEditorMode("visual");
        setFormDesignJson({
          body: {
            rows: [{
              cells: [1],
              columns: [{
                contents: [{
                  type: "html",
                  values: { html: template.content },
                }],
              }],
            }],
          },
        });
      } else {
        setEditorMode("visual");
        setFormDesignJson(null);
      }
    } else {
      setEditingId(null);
      setFormName("");
      setFormSubject("");
      setFormCategory("custom");
      setFormPreviewText("");
      setFormDesignJson(null);
      setFormContent("");
      setEditorMode("visual");
    }
    setBuilderOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSubject.trim()) {
      toast.error("Name and subject are required");
      return;
    }

    let content: string;
    let designJson: any;

    if (editorMode === "plaintext") {
      if (!formContent.trim()) {
        toast.error("Email content is required");
        return;
      }
      // Convert plain text to simple HTML (preserve line breaks)
      content = formContent
        .split("\n")
        .map((line) => `<p>${line || "&nbsp;"}</p>`)
        .join("\n");
      designJson = "plaintext"; // marker so we know to reopen in plaintext mode
    } else {
      try {
        const exported = await editorRef.current!.exportHtml();
        content = exported.html;
        designJson = exported.design;
      } catch {
        toast.error("Failed to export template content");
        return;
      }
    }

    const data = {
      name: formName,
      subject: formSubject,
      content,
      designJson,
      category: formCategory,
      previewText: formPreviewText || null,
      tags: [],
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleAiGenerate = async () => {
    setAiLoading(true);
    try {
      const res = await apiRequest("/api/email-templates/generate", "POST", aiParams);
      const result = await res.json();
      if (result.subject) setFormSubject(result.subject);
      if (result.content) {
        if (editorMode === "plaintext") {
          // Strip HTML tags and set as plain text
          const plainText = result.content
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n")
            .replace(/<\/div>/gi, "\n")
            .replace(/<\/li>/gi, "\n")
            .replace(/<li>/gi, "- ")
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
          setFormContent(plainText);
        } else {
          // Load AI-generated HTML into Unlayer as an HTML block
          const htmlDesign = {
            body: {
              rows: [{
                cells: [1],
                columns: [{
                  contents: [{
                    type: "html",
                    values: { html: result.content },
                  }],
                }],
              }],
            },
          };
          editorRef.current?.loadDesign(htmlDesign);
        }
      }
      setAiDialogOpen(false);
      toast.success("AI content generated — you can now customise it in the editor");
    } catch {
      toast.error("Failed to generate content");
    } finally {
      setAiLoading(false);
    }
  };

  // Filters
  const filtered = templates.filter((t) => {
    if (t.isArchived) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.subject.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    return true;
  });

  const uniqueCategories = [...new Set(templates.filter((t) => !t.isArchived).map((t) => t.category))];
  const mostUsed = templates.reduce((a, b) => (a.useCount > b.useCount ? a : b), templates[0]);

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{templates.filter((t) => !t.isArchived).length}</p>
                <p className="text-xs text-muted-foreground">Total Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mostUsed?.useCount || 0}</p>
                <p className="text-xs text-muted-foreground truncate">Most Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {templates.filter((t) => {
                    if (!t.createdAt) return false;
                    const d = new Date(t.createdAt as any);
                    const now = new Date();
                    return now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
                  }).length}
                </p>
                <p className="text-xs text-muted-foreground">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <LayoutGrid className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueCategories.length}</p>
                <p className="text-xs text-muted-foreground">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EMAIL_TEMPLATE_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => openBuilder()} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Template Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No templates yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first email template to get started with campaigns
            </p>
            <Button onClick={() => openBuilder()} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <Card
              key={template.id}
              className="group hover:shadow-md transition-all cursor-pointer border-border/40 hover:border-primary/30"
              onClick={() => openBuilder(template)}
            >
              <CardContent className="p-0">
                {/* Color Strip */}
                <div
                  className="h-2 rounded-t-lg"
                  style={{ backgroundColor: template.thumbnailColor || "#D4A843" }}
                />
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{template.name}</h3>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {template.subject}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn("ml-2 shrink-0 text-[10px]", categoryColors[template.category])}
                    >
                      {EMAIL_TEMPLATE_CATEGORIES.find((c) => c.value === template.category)?.label}
                    </Badge>
                  </div>

                  {/* Preview snippet */}
                  <div className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 rounded p-2">
                    {template.previewText ||
                      template.content.replace(/<[^>]+>/g, "").slice(0, 120) + "..."}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {template.useCount} uses
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(template.createdAt as any).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateMutation.mutate(template.id!);
                        }}
                        title="Duplicate"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(template.id!);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template Builder — Full Screen Overlay */}
      {builderOpen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-3">
              <Pencil className="h-5 w-5 text-primary" />
              <span className="font-semibold">
                {editingId ? "Edit Template" : "Create Template"}
              </span>
              {/* Editor Mode Toggle */}
              <div className="flex items-center border rounded-md overflow-hidden ml-2">
                <button
                  onClick={() => setEditorMode("visual")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                    editorMode === "visual"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Palette className="h-3.5 w-3.5" />
                  Visual
                </button>
                <button
                  onClick={() => setEditorMode("plaintext")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l",
                    editorMode === "plaintext"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Type className="h-3.5 w-3.5" />
                  Plain Text
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAiDialogOpen(true)}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Generate with AI
              </Button>
              <Button variant="outline" size="sm" onClick={closeBuilder} className="gap-1.5">
                <X className="h-3.5 w-3.5" />
                Close
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {editingId ? "Update" : "Save"}
              </Button>
            </div>
          </div>

          {/* Settings Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-2.5 border-b bg-background shrink-0">
            <div className="space-y-1">
              <Label className="text-xs">Template Name</Label>
              <Input
                placeholder="e.g. Q1 Cold Outreach"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subject Line</Label>
              <Input
                placeholder="e.g. {{firstName}}, let's discuss funding"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TEMPLATE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preview Text <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                placeholder="Inbox preview text..."
                value={formPreviewText}
                onChange={(e) => setFormPreviewText(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Editor Area */}
          {editorMode === "visual" ? (
            <div className="flex-1 min-h-0 relative">
              <UnlayerEmailEditor
                ref={editorRef}
                designJson={formDesignJson}
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col p-4 gap-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <Label>Plain Text Content</Label>
                <span className="text-xs text-muted-foreground">
                  Use merge tags: {"{{firstName}}"}, {"{{companyName}}"}, {"{{senderName}}"}
                </span>
              </div>
              <textarea
                className="flex-1 w-full rounded-md border border-input bg-background px-4 py-3 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder={"Hi {{firstName}},\n\nI hope this message finds you well...\n\nBest regards,\n{{senderName}}"}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* AI Generation Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generate with AI
            </DialogTitle>
            <DialogDescription>Describe your email and let AI generate the content.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Select value={aiParams.purpose} onValueChange={(v) => setAiParams({ ...aiParams, purpose: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TEMPLATE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={aiParams.tone} onValueChange={(v) => setAiParams({ ...aiParams, tone: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Topic</Label>
              <Input
                placeholder="e.g. working capital solutions for SMEs"
                value={aiParams.topic}
                onChange={(e) => setAiParams({ ...aiParams, topic: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Industry <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                placeholder="e.g. manufacturing, retail, construction"
                value={aiParams.industry}
                onChange={(e) => setAiParams({ ...aiParams, industry: e.target.value })}
              />
            </div>
            <Button onClick={handleAiGenerate} disabled={aiLoading} className="w-full gap-1.5">
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate Content
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
