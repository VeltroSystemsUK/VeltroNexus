import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePageTitle } from "@/context/LayoutContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Loader2,
  Newspaper,
  FileText,
  ArrowLeft,
  ShieldCheck,
  Download,
  ImageIcon,
  Hash,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import type { EditorialPiece } from "@shared/schema";
import {
  canExportPiece,
  editorialGenerateInputError,
  editorialMarkdownToHtml,
  editorialReadiness,
  editorialStillPrompt,
  formatEditorialLinkedInPost,
  insertEditorialImage,
  reviewEditorialCopy,
  type EditorialLinkedInPack,
  type EditorialReadiness,
} from "@shared/editorial";

const statusFilterValues = ["all", "draft", "approved", "exported"] as const;

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function copyText(label: string, value: string) {
  navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copied`),
    () => toast.error("Could not copy"),
  );
}

function ReadinessBarometer({ percent, label, tone, kind }: EditorialReadiness & { kind: string }) {
  const r = 46;
  const cx = 64;
  const cy = 56;
  const color =
    tone === "blocked"
      ? "hsl(var(--destructive))"
      : tone === "idle"
        ? "hsl(var(--muted-foreground))"
        : "hsl(var(--primary))";
  const ticks = [0, 25, 50, 75, 100];
  return (
    <div className="flex items-center gap-3 shrink-0 pr-2" title={`${percent}% · ${label}`}>
      <svg
        viewBox="0 0 128 72"
        className="h-14 w-[7.5rem]"
        role="meter"
        aria-label={`Readiness ${percent} percent. ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${percent} 100`}
        />
        {ticks.map((tick) => {
          const a = Math.PI - (tick / 100) * Math.PI;
          const inner = tick % 50 === 0 ? r - 12 : r - 9;
          return (
            <line
              key={tick}
              x1={cx + Math.cos(a) * inner}
              y1={cy - Math.sin(a) * inner}
              x2={cx + Math.cos(a) * (r + 1)}
              y2={cy - Math.sin(a) * (r + 1)}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={tick % 50 === 0 ? 1.6 : 1}
              opacity={0.5}
            />
          );
        })}
        <g transform={`rotate(${percent * 1.8} ${cx} ${cy})`}>
          <line
            x1={cx}
            y1={cy}
            x2={cx - r + 10}
            y2={cy}
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
        <circle cx={cx} cy={cy} r="3.4" fill={color} />
      </svg>
      <div className="min-w-[7.5rem] leading-tight">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{kind}</p>
        <p className="text-lg font-semibold font-mono tabular-nums leading-none">{percent}%</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function Editorial() {
  usePageTitle("EDITORIAL", "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draftType, setDraftType] = useState<"blog" | "press_release">("blog");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTopic, setDraftTopic] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [stillPrompt, setStillPrompt] = useState("");
  const [stillBusy, setStillBusy] = useState(false);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [linkedinBusy, setLinkedinBusy] = useState(false);
  const [linkedinPack, setLinkedinPack] = useState<EditorialLinkedInPack | null>(null);

  const { data: pieces = [], isLoading } = useQuery<EditorialPiece[]>({
    queryKey: ["/api/editorial"],
  });

  const selected = pieces.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setBody(selected.body || "");
    setStillPrompt(editorialStillPrompt(selected));
    setHeroUrl(selected.heroImageUrl || null);
    setLinkedinPack(selected.linkedinPack ?? null);
    // Hydrate only when the open piece changes; a list refetch must not clobber keystrokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) return;
    const handle = window.setTimeout(() => {
      if (title === selected.title && body === (selected.body || "")) return;
      apiRequest(`/api/editorial/${selected.id}`, "PATCH", { title, body }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/editorial"] });
      });
    }, 600);
    return () => window.clearTimeout(handle);
  }, [title, body, selected?.id]);

  const filtered = pieces.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q || p.title.toLowerCase().includes(q) || p.topic.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesType = typeFilter === "all" || p.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const stats = useMemo(
    () => ({
      total: pieces.length,
      draft: pieces.filter((p) => p.status === "draft").length,
      approved: pieces.filter((p) => p.status === "approved").length,
      exported: pieces.filter((p) => p.status === "exported").length,
    }),
    [pieces],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/editorial", "POST", {
        type: draftType,
        title: draftTitle,
        topic: draftTopic,
      });
      return res.json() as Promise<EditorialPiece>;
    },
    onSuccess: (piece) => {
      queryClient.invalidateQueries({ queryKey: ["/api/editorial"] });
      setWizardOpen(false);
      setDraftTitle("");
      setDraftTopic("");
      setSelectedId(piece.id!);
      toast.success("Draft created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function flushEdits() {
    if (!selected) return;
    if (title === selected.title && body === (selected.body || "")) return;
    await apiRequest(`/api/editorial/${selected.id}`, "PATCH", { title, body });
  }

  async function postAction(path: string, data?: unknown) {
    await flushEdits();
    const res = await apiRequest(path, "POST", data);
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("NEXUS is still running an old API build. Restart the NEXUS app, then try again.");
    }
    queryClient.invalidateQueries({ queryKey: ["/api/editorial"] });
    return json as any;
  }

  async function generateDraft() {
    if (!selected) return;
    const json = await postAction(`/api/editorial/${selected.id}/generate`);
    if (typeof json?.body === "string") setBody(json.body);
    toast.success("Draft written");
  }

  async function generateStill() {
    if (!selected) return;
    setStillBusy(true);
    try {
      const json = await postAction(`/api/editorial/${selected.id}/image`, { prompt: stillPrompt });
      if (typeof json?.url === "string") setHeroUrl(json.url);
      if (typeof json?.prompt === "string") setStillPrompt(json.prompt);
      toast.success("Still ready");
    } finally {
      setStillBusy(false);
    }
  }

  async function generateLinkedInPack() {
    if (!selected) return;
    setLinkedinBusy(true);
    try {
      await flushEdits();
      const json = await postAction(`/api/editorial/${selected.id}/linkedin`);
      if (json?.pack) setLinkedinPack(json.pack);
      toast.success("LinkedIn pack ready");
    } finally {
      setLinkedinBusy(false);
    }
  }

  const live = selected
    ? ({ ...selected, title, body, autoPublish: false } as EditorialPiece)
    : null;
  const review = live ? reviewEditorialCopy(live) : null;
  const exportOk = live ? canExportPiece(live) : false;
  const readiness = live ? editorialReadiness(live) : null;
  const generateBlocked = selected ? editorialGenerateInputError(selected) : "Scan Casey before generating";

  if (selected) {
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setSelectedId(null)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {readiness && (
            <ReadinessBarometer
              {...readiness}
              kind={selected.type === "blog" ? "Blog" : "Press release"}
            />
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const json = await postAction(`/api/editorial/${selected.id}/scan`);
                if (json.warning) toast.message(json.warning);
                else toast.success("Casey scanned this topic");
              } catch (err: any) {
                toast.error(err.message || "Scan failed");
              }
            }}
          >
            Scan
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(generateBlocked)}
            onClick={() => {
              if ((body || "").trim()) setConfirmGenerate(true);
              else {
                generateDraft().catch((err: Error) => toast.error(err.message));
              }
            }}
          >
            Generate
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              postAction(`/api/editorial/${selected.id}/approve`)
                .then(() => toast.success("Approved"))
                .catch((err: Error) => toast.error(err.message))
            }
          >
            Approve
          </Button>
          <Button variant="outline" onClick={() => postAction(`/api/editorial/${selected.id}/reject`).then(() => toast.message("Rejected"))}>
            Reject
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              postAction(`/api/editorial/${selected.id}/compliance`, { action: "cleared" })
                .then(() => toast.success("Compliance cleared"))
                .catch((err: Error) => toast.error(err.message))
            }
          >
            <ShieldCheck className="h-4 w-4 mr-1" /> Compliance
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              postAction(`/api/editorial/${selected.id}/compliance`, { action: "blocked" })
                .then(() => toast.message("Compliance blocked"))
                .catch((err: Error) => toast.error(err.message))
            }
          >
            Block
          </Button>
          <Button
            disabled={!exportOk}
            onClick={async () => {
              const json = await postAction(`/api/editorial/${selected.id}/export`);
              downloadText(`${json.filename}.md`, json.markdown, "text/markdown");
              downloadText(`${json.filename}.html`, json.html, "text/html");
              toast.success("Exported Markdown and HTML");
            }}
          >
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>

        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        <p className="text-xs text-muted-foreground">Topic: {selected.topic}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Textarea
            className="min-h-[480px] font-mono text-sm lg:col-span-1"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="lg:col-span-1 rounded-md border border-white/10 overflow-hidden min-h-[480px] bg-white">
            <iframe
              title="Editorial preview"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
              className="w-full min-h-[480px] h-full border-0 bg-white"
              srcDoc={editorialMarkdownToHtml(body, title)}
            />
          </div>
          <div className="space-y-3 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Copy review</h3>
              {review?.ok ? (
                <p className="text-xs text-emerald-400">House policy clear</p>
              ) : (
                review?.findings.map((f) => (
                  <p key={f.code} className="text-xs text-red-400">{f.message}</p>
                ))
              )}
            </div>

            <Card>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Images</h3>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Same Grok Imagine still as Craft. Download it or drop it into the article.
                </p>
                <Textarea
                  className="min-h-[4.5rem] text-xs"
                  aria-label="Image prompt"
                  value={stillPrompt}
                  onChange={(e) => setStillPrompt(e.target.value)}
                />
                <Button
                  size="sm"
                  className="w-full"
                  disabled={stillBusy || !stillPrompt.trim()}
                  onClick={() => generateStill().catch((err: Error) => toast.error(err.message))}
                >
                  {stillBusy ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating still…
                    </>
                  ) : (
                    "Generate still"
                  )}
                </Button>
                {heroUrl && (
                  <div className="space-y-2">
                    <img
                      src={heroUrl}
                      alt={title || "Article still"}
                      className="w-full rounded-md border border-white/10 object-cover"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = heroUrl;
                          a.download = `strata-editorial-${selected.id}.jpg`;
                          a.click();
                        }}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" /> Download
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          try {
                            setBody(insertEditorialImage(body, heroUrl, title || "Article still"));
                            toast.success("Inserted at the top of the article");
                          } catch (err: any) {
                            toast.error(err.message);
                          }
                        }}
                      >
                        Insert
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">LinkedIn</h3>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Feed post, 3–5 hashtags, and search keywords. You post it.
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={linkedinBusy}
                  onClick={() => generateLinkedInPack().catch((err: Error) => toast.error(err.message))}
                >
                  {linkedinBusy ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Writing pack…
                    </>
                  ) : (
                    "Generate pack"
                  )}
                </Button>
                {linkedinPack && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium leading-snug">{linkedinPack.hook}</p>
                    <p className="text-xs whitespace-pre-wrap text-muted-foreground">{linkedinPack.body}</p>
                    <p className="text-xs font-medium">{linkedinPack.cta}</p>
                    <p className="text-xs text-primary">{linkedinPack.hashtags.join(" ")}</p>
                    <div className="flex flex-wrap gap-1">
                      {linkedinPack.keywords.map((word) => (
                        <Badge key={word} variant="outline" className="text-[10px] font-normal">
                          {word}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => copyText("Post", formatEditorialLinkedInPost(linkedinPack))}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy post
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyText("Hashtags", linkedinPack.hashtags.join(" "))}
                      >
                        Hashtags
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyText("Keywords", linkedinPack.keywords.join(", "))}
                      >
                        Keywords
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <h3 className="text-sm font-semibold">Casey notes</h3>
            {(selected.notes || []).length === 0 && (
              <p className="text-sm text-muted-foreground">No notes yet. Scan this topic, or write the body yourself.</p>
            )}
            {(selected.notes || []).map((note) => (
              <Card key={note.url}>
                <CardContent className="p-3 space-y-1">
                  <p className="text-sm font-medium">{note.title}</p>
                  <p className="text-[11px] text-muted-foreground break-all">{note.url}</p>
                  <p className="text-xs">{note.snippet}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <AlertDialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace the body?</AlertDialogTitle>
              <AlertDialogDescription>
                Generate overwrites the current Markdown from Casey’s notes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  generateDraft().catch((err: Error) => toast.error(err.message))
                }
              >
                Generate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, icon: Newspaper },
          { label: "Draft", value: stats.draft, icon: FileText },
          { label: "Approved", value: stats.approved, icon: ShieldCheck },
          { label: "Exported", value: stats.exported, icon: Download },
        ].map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search pieces..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="h-9">
            {statusFilterValues.map((v) => (
              <TabsTrigger key={v} value={v} className="text-xs capitalize">{v}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={typeFilter} onValueChange={setTypeFilter}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">All types</TabsTrigger>
            <TabsTrigger value="blog" className="text-xs">Blog</TabsTrigger>
            <TabsTrigger value="press_release" className="text-xs">Press release</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => setWizardOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New piece
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Newspaper className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">No pieces yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create a blog or press release. Casey researches; you publish elsewhere.</p>
            <Button onClick={() => setWizardOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> New piece
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Engine</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id!)}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>{row.type === "blog" ? "Blog" : "Press release"}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.compliance}</TableCell>
                  <TableCell>{row.engine ? `${row.engine.provider}` : "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New piece</DialogTitle>
            <DialogDescription>Blog or press release. Casey will scan the topic next.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={draftType} onValueChange={(v) => setDraftType(v as "blog" | "press_release")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="blog">Blog</SelectItem>
                  <SelectItem value="press_release">Press release</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Topic</Label>
              <Textarea value={draftTopic} onChange={(e) => setDraftTopic(e.target.value)} placeholder="What Casey should research" />
            </div>
            <Button
              className="w-full"
              disabled={!draftTitle.trim() || !draftTopic.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create draft"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
