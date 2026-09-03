import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePageTitle } from "@/context/LayoutContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Loader2, GraduationCap, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { LearnBotLog, LearnPiece, LearnVideo } from "@shared/schema";
import { learnVideoGenerateInputError, slugifyLearnTitle } from "@shared/learn";

const PATHS = ["none", "1", "2", "3", "4", "5", "6"] as const;
const toPath = (v: string) => (v === "none" ? null : Number(v) >= 1 && Number(v) <= 6 ? Number(v) : null);
const fromPath = (v: number | null | undefined) => (v == null ? "none" : String(v));

function PathSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
      <SelectContent>
        {PATHS.map((p) => <SelectItem key={p} value={p}>{p === "none" ? "None" : p}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function invalidateDesk() {
  queryClient.invalidateQueries({ queryKey: ["/api/learn-desk/videos"] });
  queryClient.invalidateQueries({ queryKey: ["/api/learn-desk/pieces"] });
}

async function postJson(path: string, data?: unknown) {
  const res = await apiRequest(path, "POST", data);
  const json = await res.json().catch(() => ({}));
  invalidateDesk();
  return json;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}

export default function LearnDesk() {
  usePageTitle("LEARN", "");
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTopic, setDraftTopic] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [transcript, setTranscript] = useState("");
  const [durationLabel, setDurationLabel] = useState("");
  const [pathPosition, setPathPosition] = useState("none");
  const [publishSlug, setPublishSlug] = useState("");
  const [publishExcerpt, setPublishExcerpt] = useState("");
  const [publishPath, setPublishPath] = useState("none");
  const [uploading, setUploading] = useState(false);

  const { data: videos = [], isLoading: videosLoading } = useQuery<LearnVideo[]>({ queryKey: ["/api/learn-desk/videos"] });
  const { data: pieces = [], isLoading: piecesLoading } = useQuery<LearnPiece[]>({ queryKey: ["/api/learn-desk/pieces"] });
  const { data: botLogs = [] } = useQuery<LearnBotLog[]>({ queryKey: ["/api/learn-desk/bot-logs"] });
  const selected = videos.find((v) => v.id === selectedId) ?? null;
  const q = search.toLowerCase();
  const filteredVideos = videos.filter((v) => !q || v.title.toLowerCase().includes(q) || v.topic.toLowerCase().includes(q));
  const filteredPieces = pieces.filter((p) => !q || p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setDescription(selected.description || "");
    setTranscript(selected.transcript || "");
    setDurationLabel(selected.durationLabel || "");
    setPathPosition(fromPath(selected.pathPosition));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const patchBody = () => ({ title, description, transcript, durationLabel, pathPosition: toPath(pathPosition) });
  const isClean = () =>
    !!selected &&
    title === selected.title &&
    description === (selected.description || "") &&
    transcript === (selected.transcript || "") &&
    durationLabel === (selected.durationLabel || "") &&
    fromPath(selected.pathPosition) === pathPosition;

  useEffect(() => {
    if (!selected) return;
    const handle = window.setTimeout(() => {
      if (isClean()) return;
      apiRequest(`/api/learn-desk/videos/${selected.id}`, "PATCH", patchBody()).then(() => invalidateDesk());
    }, 600);
    return () => window.clearTimeout(handle);
  }, [title, description, transcript, durationLabel, pathPosition, selected?.id]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/learn-desk/videos", "POST", { title: draftTitle, topic: draftTopic });
      return res.json() as Promise<LearnVideo>;
    },
    onSuccess: (video) => {
      invalidateDesk();
      setWizardOpen(false);
      setDraftTitle("");
      setDraftTopic("");
      setSelectedId(video.id!);
      toast.success("Draft created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function flushEdits() {
    if (!selected || isClean()) return;
    await apiRequest(`/api/learn-desk/videos/${selected.id}`, "PATCH", patchBody());
  }

  async function postAction(path: string, data?: unknown) {
    await flushEdits();
    return postJson(path, data);
  }

  async function uploadMp4(file: File) {
    if (!selected) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/learn-desk/videos/${selected.id}/upload`, { method: "POST", body: form, credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      invalidateDesk();
      toast.success("Video uploaded");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  function act(suffix: string, data?: unknown, ok?: string) {
    if (!selected) return;
    postAction(`/api/learn-desk/videos/${selected.id}/${suffix}`, data)
      .then((json) => {
        if (suffix === "generate" && typeof json?.description === "string") setDescription(json.description);
        if (suffix === "scan") toast[json.warning ? "message" : "success"](json.warning || "Casey scanned this topic");
        else if (ok) toast.success(ok);
      })
      .catch((err: Error) => toast.error(err.message));
  }

  if (selected) {
    const canPublish = selected.status === "approved" && selected.compliance === "cleared" && Boolean(selected.videoUrl);
    const generateBlocked = learnVideoGenerateInputError(selected);
    const notes = selected.notes || [];
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setSelectedId(null)} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
          <Badge>{selected.status}</Badge>
          <Badge variant="secondary">{selected.compliance}</Badge>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => act("scan")}>Scan</Button>
          <Button variant="outline" disabled={Boolean(generateBlocked)} title={generateBlocked || undefined} onClick={() => act("generate", undefined, "Draft written")}>Generate</Button>
          <Button variant="outline" onClick={() => act("approve", undefined, "Approved")}>Approve</Button>
          <Button variant="outline" onClick={() => act("reject", undefined, "Rejected")}>Reject</Button>
          <Button variant="outline" onClick={() => act("compliance", { action: "cleared" }, "Compliance cleared")}>
            <ShieldCheck className="h-4 w-4 mr-1" /> Compliance
          </Button>
          <Button variant="ghost" onClick={() => act("compliance", { action: "blocked" }, "Compliance blocked")}>Block</Button>
          <Button
            disabled={!canPublish}
            onClick={() => {
              setPublishSlug(slugifyLearnTitle(title));
              setPublishExcerpt(selected.excerpt || "");
              setPublishPath(pathPosition);
              setPublishOpen(true);
            }}
          >
            Publish
          </Button>
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        <p className="text-xs text-muted-foreground">Topic: {selected.topic}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Field label="Description"><Textarea className="min-h-[220px]" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="Transcript"><Textarea className="min-h-[220px]" value={transcript} onChange={(e) => setTranscript(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Duration"><Input value={durationLabel} onChange={(e) => setDurationLabel(e.target.value)} placeholder="4 min" /></Field>
          <Field label="Path position"><PathSelect value={pathPosition} onChange={setPathPosition} /></Field>
          <Field label="mp4">
            <Input type="file" accept="video/mp4" disabled={uploading} onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMp4(file);
              e.target.value = "";
            }} />
          </Field>
        </div>
        <Input readOnly value={selected.videoUrl || ""} placeholder="videoUrl after upload" />
        <h3 className="text-sm font-semibold">Casey notes{notes.length ? ` (${notes.length})` : ""}</h3>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet. Scan this topic first.</p>
        ) : notes.map((note) => (
          <Card key={note.url}>
            <CardContent className="p-3 space-y-1">
              <p className="text-sm font-medium">{note.title}</p>
              <p className="text-[11px] text-muted-foreground break-all">{note.url}</p>
              <p className="text-xs">{note.snippet}</p>
            </CardContent>
          </Card>
        ))}
        <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Publish video</DialogTitle>
              <DialogDescription>Live on learn.stratanexus.co.uk. Never auto-publish.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Field label="Slug"><Input value={publishSlug} onChange={(e) => setPublishSlug(e.target.value)} /></Field>
              <Field label="Excerpt"><Textarea value={publishExcerpt} onChange={(e) => setPublishExcerpt(e.target.value)} /></Field>
              <Field label="Path position"><PathSelect value={publishPath} onChange={setPublishPath} /></Field>
              <Button
                className="w-full"
                onClick={() =>
                  postAction(`/api/learn-desk/videos/${selected.id}/publish`, {
                    slug: publishSlug,
                    excerpt: publishExcerpt,
                    pathPosition: toPath(publishPath),
                  }).then(() => { setPublishOpen(false); toast.success("Published to Learn"); }).catch((err: Error) => toast.error(err.message))
                }
              >
                Publish
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search videos and pieces..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => setWizardOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> New video</Button>
      </div>

      <h2 className="text-sm font-semibold">Videos</h2>
      {videosLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          {filteredVideos.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <GraduationCap className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold mb-1">No videos yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create a training video. Casey researches; you publish to Learn.</p>
              <Button onClick={() => setWizardOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> New video</Button>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Compliance</TableHead><TableHead>Path</TableHead><TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVideos.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id!)}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell><Badge>{row.status}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{row.compliance}</Badge></TableCell>
                    <TableCell>{row.pathPosition ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      <h2 className="text-sm font-semibold">Live pieces</h2>
      {piecesLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead><TableHead>Kind</TableHead><TableHead>Slug</TableHead><TableHead>Live</TableHead><TableHead>Path</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPieces.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No published pieces</TableCell></TableRow>
              ) : filteredPieces.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>{row.kind}</TableCell>
                  <TableCell className="font-mono text-xs">{row.slug}</TableCell>
                  <TableCell><Badge variant={row.live ? "default" : "secondary"}>{row.live ? "Live" : "Off"}</Badge></TableCell>
                  <TableCell>
                    <PathSelect
                      value={fromPath(row.pathPosition)}
                      onChange={(v) =>
                        apiRequest(`/api/learn-desk/pieces/${row.id}/path`, "PATCH", { pathPosition: toPath(v) })
                          .then(() => invalidateDesk())
                          .catch((err: Error) => toast.error(err.message))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {row.live && (
                      <Button variant="outline" size="sm" onClick={() => postJson(`/api/learn-desk/pieces/${row.id}/unpublish`).then(() => toast.message("Unpublished")).catch((err: Error) => toast.error(err.message))}>
                        Unpublish
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <h2 className="text-sm font-semibold">Bot logs</h2>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead><TableHead>Slug</TableHead><TableHead>Question</TableHead><TableHead>Handoff</TableHead><TableHead>Retrieved</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {botLogs.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No bot logs</TableCell></TableRow>
            ) : botLogs.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground text-sm">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</TableCell>
                <TableCell className="font-mono text-xs">{row.slug || "—"}</TableCell>
                <TableCell>{row.question}</TableCell>
                <TableCell>{row.handoff ? "yes" : "no"}</TableCell>
                <TableCell className="font-mono text-xs">{(row.retrievedIds || []).join(", ") || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New video</DialogTitle>
            <DialogDescription>Casey will scan the topic next.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Title"><Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} /></Field>
            <Field label="Topic"><Textarea value={draftTopic} onChange={(e) => setDraftTopic(e.target.value)} placeholder="What Casey should research" /></Field>
            <Button className="w-full" disabled={!draftTitle.trim() || !draftTopic.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create draft"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
