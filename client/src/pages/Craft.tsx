import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Palette, PenLine, Radar, Radio } from "lucide-react";
import { toast } from "sonner";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePageTitle } from "@/context/LayoutContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CraftView } from "@/components/craft/CraftView";
import { purgeAllCraftDocs } from "@/components/craft/persist";
import { useCraftStore } from "@/components/craft/store";
import type { ComplianceStatus, CraftChannel, CraftCopyPatch, CraftPost, PostStatus } from "@shared/craftQueue";
import {
  COPY_LIMITS,
  canExportPost,
  exportablePosts,
  reviewMarketingCopy,
  type WeekGenerateMode,
} from "@shared/craftQueue";
import type { CreativeAmmoBrief } from "@shared/craftScout";
import { ammoForPost, yafflePromptFromAmmo } from "@shared/craftYaffle";
import { slugifyLearnTitle, NEWS_CATEGORIES, NEWS_CATEGORY_LABELS } from "@shared/learn";

import { isoWeekId, type WeekRoute } from "@/components/craft/lib/weekGrammar";
import { pulseMotion, setMotionBusy } from "@/components/craft/lib/motionSignals";

let paneLayoutTimer = 0;

type Desk = {
  week: CraftPost[];
  channels: CraftChannel[];
  weekStart: string | null;
  briefs?: CreativeAmmoBrief[];
  weekId?: string | null;
  route?: string | null;
  researchWarning?: string | null;
};

type CopyDraft = {
  title: string;
  eyebrow: string;
  hook: string;
  hook2: string;
  body: string;
  cta: string;
  links: string;
  hashtags: string;
};

function copyFrom(post: CraftPost): CopyDraft {
  return {
    title: post.title,
    eyebrow: post.eyebrow ?? "",
    hook: post.hook,
    hook2: post.hook2 ?? "",
    body: post.body,
    cta: post.cta,
    links: (post.links ?? []).join("\n"),
    hashtags: post.hashtags.join(" "),
  };
}

function draftFromPatch(post: CraftPost, patch: CraftCopyPatch): CopyDraft {
  const next = copyFrom(post);
  if (typeof patch.title === "string") next.title = patch.title;
  if (typeof patch.eyebrow === "string") next.eyebrow = patch.eyebrow;
  if (typeof patch.hook === "string") next.hook = patch.hook;
  if (typeof patch.hook2 === "string") next.hook2 = patch.hook2;
  if (typeof patch.body === "string") next.body = patch.body;
  if (typeof patch.cta === "string") next.cta = patch.cta;
  if (patch.links !== undefined) {
    next.links = Array.isArray(patch.links) ? patch.links.join("\n") : patch.links;
  }
  if (patch.hashtags !== undefined) {
    next.hashtags = Array.isArray(patch.hashtags) ? patch.hashtags.join(" ") : patch.hashtags;
  }
  return next;
}

function copyUnchanged(copy: CopyDraft, post: CraftPost): boolean {
  const current = copyFrom(post);
  return (
    copy.title === current.title &&
    copy.eyebrow === current.eyebrow &&
    copy.hook === current.hook &&
    copy.hook2 === current.hook2 &&
    copy.body === current.body &&
    copy.cta === current.cta &&
    copy.links === current.links &&
    copy.hashtags === current.hashtags
  );
}

function queueLabel(post: CraftPost): string {
  if (post.status === "rejected") return "Rejected";
  if (post.status === "exported") return "Exported";
  if (canExportPost(post)) return "Cleared";
  if (post.status === "approved") return post.compliance === "blocked" ? "Blocked" : "Compliance";
  return "Draft";
}

export default function Craft() {
  usePageTitle("Craft", "MKT-2 social queue — marketing, then compliance, then you post");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [contentAidOpen, setContentAidOpen] = useState(false);
  const [yaffleProgress, setYaffleProgress] = useState("");
  const [copy, setCopy] = useState<CopyDraft | null>(null);
  const [weekOpen, setWeekOpen] = useState(false);
  const [weekRoute, setWeekRoute] = useState<WeekRoute>("sharp-cultural");
  const [learnOpen, setLearnOpen] = useState(false);
  const [learnSlug, setLearnSlug] = useState("");
  const [learnExcerpt, setLearnExcerpt] = useState("");
  const [learnCategory, setLearnCategory] = useState<string>("uk_commercial_finance");
  const [learnPublishedAt, setLearnPublishedAt] = useState<string>("");

  const { data: desk, isLoading } = useQuery<Desk>({
    queryKey: ["/api/craft/desk"],
    queryFn: async () => {
      const res = await fetch("/api/craft/desk", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load CRAFT desk");
      return res.json();
    },
  });

  const week = desk?.week ?? [];
  const channels = desk?.channels ?? [];
  const briefs = desk?.briefs ?? [];
  const selected = week.find((p) => p.id === selectedId) ?? null;
  const boardOpen = Boolean(selected);
  const weekHasCopy = week.some((post) => Boolean(post.hook || post.body));

  const closeBoard = () => {
    pulseMotion("close");
    setSelectedId(null);
    useCraftStore.getState().close();
  };

  useEffect(() => {
    if (isLoading) return;
    if (!weekHasCopy) void purgeAllCraftDocs();
  }, [isLoading, weekHasCopy]);

  useEffect(() => {
    if (selected) setCopy(copyFrom(selected));
    else setCopy(null);
  }, [selected?.id, selected?.title, selected?.eyebrow, selected?.hook, selected?.hook2, selected?.body, selected?.cta, selected?.links?.join("\n"), selected?.hashtags?.join(" ")]);

  useEffect(() => {
    if (selectedId) pulseMotion("pane");
  }, [selectedId]);

  const newWeek = useMutation({
    mutationFn: async (route: WeekRoute) => {
      const from = new Date().toISOString().slice(0, 10);
      const res = await apiRequest("/api/craft/week/grammar", "POST", { from, route });
      return res.json() as Promise<Desk>;
    },
    onSuccess: async (next) => {
      queryClient.setQueryData(["/api/craft/desk"], next);
      setWeekOpen(false);
      const weekId = next.weekId || next.week[0]?.weekId || isoWeekId();
      const route = (next.route === "safe-distinctive" || next.route === "beautiful-insane" || next.route === "sharp-cultural"
        ? next.route
        : weekRoute) as WeekRoute;
      await useCraftStore.getState().createWeek({ weekId, route });
      const first = next.week[0];
      if (first) setSelectedId(first.id);
      toast.success("Week is on the desk. Isla writes one day at a time.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const generate = useMutation({
    mutationFn: async (mode: WeekGenerateMode) => {
      useCraftStore.getState().close();
      setSelectedId(null);
      await purgeAllCraftDocs();
      const res = await apiRequest("/api/craft/week", "POST", {
        mode,
        selectedId: mode === "selected" ? selectedId : undefined,
        stamp: mode === "replace" ? Date.now().toString(36) : undefined,
      });
      return { desk: (await res.json()) as Desk, mode };
    },
    onSuccess: async ({ desk: next, mode }) => {
      await purgeAllCraftDocs();
      const weekId = next.weekId || next.week[0]?.weekId;
      queryClient.setQueryData(["/api/craft/desk"], next);
      setSelectedId(null);
      if (weekId) {
        const route = (next.route === "safe-distinctive" || next.route === "beautiful-insane" || next.route === "sharp-cultural"
          ? next.route
          : weekRoute) as WeekRoute;
        await useCraftStore.getState().createWeek({ weekId, route });
        useCraftStore.getState().paintWeekFromPosts(next.week);
      }
      toast.success(
        mode === "replace"
          ? "Week replaced on the house boards. Old templates cleared."
          : mode === "keep_approved"
            ? "Drafts refreshed on the house week. Approved posts kept."
            : "This post was rebuilt on the house week.",
      );
      if (next.researchWarning) toast.warning(next.researchWarning);
      toast("Generating stills for the week…");
      void useCraftStore.getState().generateStillsForWeek(next.week, next.briefs ?? []);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const scanAmmo = useMutation({
    mutationFn: async () => {
      useCraftStore.getState().close();
      setSelectedId(null);
      await purgeAllCraftDocs();
      const res = await apiRequest("/api/craft/scan", "POST", {});
      return res.json() as Promise<Desk>;
    },
    onSuccess: async (next) => {
      await purgeAllCraftDocs();
      queryClient.setQueryData(["/api/craft/desk"], { ...next, week: [] });
      setContentAidOpen(true);
      useCraftStore.getState().close();
      setSelectedId(null);
      toast.success("Casey landed ammo. Generate week for Isla to write and design.");
      if (next.researchWarning) toast.warning(next.researchWarning);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const patchPost = useMutation({
    mutationFn: async ({
      id,
      ...body
    }: { id: string; status?: PostStatus; compliance?: ComplianceStatus } & Partial<CopyDraft>) => {
      const res = await apiRequest(`/api/craft/week/${id}`, "PATCH", body);
      return res.json() as Promise<Desk>;
    },
    onSuccess: (next, vars) => {
      queryClient.setQueryData(["/api/craft/desk"], next);
      const post = next.week.find((p) => p.id === vars.id);
      if (post) useCraftStore.getState().syncFromPost(post);
    },
    onError: (err: Error) => {
      const match = err.message.match(/^\d+:\s*(\{.*\})\s*$/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.error) {
            toast.error(parsed.error);
            return;
          }
        } catch {
          /* use raw message */
        }
      }
      toast.error(err.message);
    },
  });

  const publishLearn = useMutation({
    mutationFn: async ({
      id,
      ...body
    }: { id: string; slug: string; excerpt: string; category: string; publishedAt?: string }) => {
      const res = await apiRequest(`/api/craft/week/${id}/publish-learn`, "POST", {
        ...body,
        overrideCompliance: true,
      });
      return res.json();
    },
    onSuccess: () => {
      setLearnOpen(false);
      toast.success("Published to Learn");
    },
    onError: (err: Error) => {
      const match = err.message.match(/^\d+:\s*(\{.*\})\s*$/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.error) {
            toast.error(parsed.error);
            return;
          }
        } catch {
          /* use raw message */
        }
      }
      toast.error(err.message);
    },
  });

  const saveCopy = (nextCopy = copy) => {
    if (!selected || !nextCopy || copyUnchanged(nextCopy, selected)) return;
    if (
      nextCopy.eyebrow.length > COPY_LIMITS.eyebrow ||
      nextCopy.hook.length > COPY_LIMITS.hook ||
      nextCopy.hook2.length > COPY_LIMITS.hook2 ||
      nextCopy.body.length > COPY_LIMITS.body ||
      nextCopy.cta.length > COPY_LIMITS.cta
    ) {
      return;
    }
    patchPost.mutate({ id: selected.id, ...nextCopy });
  };

  const setStatus = (status: PostStatus) => {
    if (!selected) return;
    if (copy && !copyUnchanged(copy, selected)) {
      patchPost.mutate({ id: selected.id, status, ...copy });
    } else {
      patchPost.mutate({ id: selected.id, status });
    }
  };

  const patchChannel = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { handle?: string; url?: string; accountId?: string } }) =>
      apiRequest(`/api/craft/channels/${id}`, "PUT", patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/craft/desk"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const approvedCount = useMemo(() => exportablePosts(week).length, [week]);
  const ammo = selected ? ammoForPost(briefs, selected) : undefined;
  const yafflePrompt = ammo ? yafflePromptFromAmmo(ammo) : selected?.visual?.prompt || "";

  const { data: yaffleHealth } = useQuery({
    queryKey: ["/api/craft/yaffle/status"],
    queryFn: async () => {
      const res = await fetch("/api/craft/yaffle/status", { credentials: "include" });
      if (!res.ok) throw new Error("Could not reach Images");
      return res.json() as Promise<{ ok: boolean; provider?: string; worker?: string; message: string }>;
    },
    refetchInterval: 20000,
  });

  const yaffleGenerate = useMutation({
    mutationFn: async (prompt: string) => {
      if (!selected) throw new Error("Pick a post");
      setYaffleProgress("Generating still…");
      const res = await apiRequest("/api/craft/yaffle/image", "POST", { postId: selected.id, prompt });
      const job = (await res.json()) as { id: string; state?: string; provider?: string };
      const pull = async () => {
        const file = await fetch(`/api/craft/yaffle/jobs/${job.id}/image`, { credentials: "include" });
        if (!file.ok) throw new Error("Still missing");
        const blob = await file.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Could not read still"));
          reader.readAsDataURL(blob);
        });
      };
      if (job.state === "ready") return pull();
      for (let i = 0; i < 90; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const statusRes = await fetch(`/api/craft/yaffle/jobs/${job.id}`, { credentials: "include" });
        const status = (await statusRes.json()) as {
          state?: string;
          progress?: number;
          message?: string;
          error?: string;
        };
        setYaffleProgress(status.message || (status.progress != null ? `${status.progress}%` : "Generating…"));
        if (status.state === "ready") return pull();
        if (status.state === "error") throw new Error(status.error || status.message || "Images failed");
      }
      throw new Error("Images timed out.");
    },
    onSuccess: (dataUrl) => {
      useCraftStore.getState().applyYaffleVisual(dataUrl);
      setYaffleProgress("");
      toast.success("Still is on the board.");
    },
    onError: (err: Error) => {
      setYaffleProgress("");
      toast.error(err.message);
    },
  });

  useEffect(() => {
    const busy = generate.isPending || scanAmmo.isPending || yaffleGenerate.isPending || newWeek.isPending;
    setMotionBusy(busy);
    return () => setMotionBusy(false);
  }, [generate.isPending, scanAmmo.isPending, yaffleGenerate.isPending, newWeek.isPending]);

  const openInCanvas = (post: CraftPost) => setSelectedId(post.id);

  useEffect(() => {
    if (selected) void useCraftStore.getState().openFromPost(selected);
  }, [selected?.id]);

  useEffect(() => {
    useCraftStore.getState().setReleaseLock(selected ? canExportPost(selected) : true);
  }, [selected?.id, selected?.status, selected?.compliance, selected?.hook, selected?.body, selected?.cta]);

  const exportCopyPack = () => {
    const pack = exportablePosts(week);
    if (!pack.length) {
      toast.message("Marketing approve, then compliance sign-off, then export");
      return;
    }
    const text = pack
      .map(
        (p) =>
          `${p.date} · ${p.track} · LinkedIn\n${p.hook}\n${p.hook2}\n\n${p.body}\n\n${p.cta}\n${(p.links ?? []).join("\n")}${p.links?.length ? "\n" : ""}${p.hashtags.join(" ")}\n`
      )
      .join("\n---\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "craft-week.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Copy pack downloaded. You post it.");
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col md:flex-row overflow-hidden">
      <aside
        className={cn(
          "w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-white/10 flex-col min-h-0 bg-black/20",
          boardOpen ? "hidden md:flex" : "flex",
        )}
      >
        <div className="px-3 py-3 border-b border-white/10 flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">Week queue</p>
            <p className="text-[11px] text-white/40 truncate">Correct copy. Compliance. Then export.</p>
          </div>
        </div>
        <div className="p-3 flex gap-2 border-b border-white/10">
          <Button size="sm" variant="secondary" onClick={() => setWeekOpen(true)} disabled={newWeek.isPending}>
            New week
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="flex-1" disabled={generate.isPending}>
                {generate.isPending ? "Queuing…" : "Generate week"}
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                What should happen to the queue?
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => generate.mutate("replace")}>
                <span className="flex flex-col gap-0.5">
                  <span>Replace all</span>
                  <span className="text-[11px] text-muted-foreground">New copy and designs. Wipes this week.</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={week.length === 0}
                onClick={() => generate.mutate("keep_approved")}
              >
                <span className="flex flex-col gap-0.5">
                  <span>Keep approved</span>
                  <span className="text-[11px] text-muted-foreground">Refresh drafts only. Cleared posts stay.</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!selected}
                onClick={() => generate.mutate("selected")}
              >
                <span className="flex flex-col gap-0.5">
                  <span>This post only</span>
                  <span className="text-[11px] text-muted-foreground">Rebuild the open card from ammo.</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" onClick={exportCopyPack} disabled={!approvedCount} title={!approvedCount ? "Compliance must sign off first" : undefined}>
            Export
          </Button>
        </div>
        <div className="flex items-stretch shrink-0 border-l-2 border-sky-400/80">
          <button
            type="button"
            onClick={() => setContentAidOpen((v) => !v)}
            className={cn(
              "flex-1 px-3 py-2 flex items-center gap-2 text-left hover:bg-sky-400/[0.06]",
              contentAidOpen && "bg-sky-400/[0.05]",
            )}
          >
            <Radar className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">
                Content aid {contentAidOpen ? "▾" : "▸"}
              </span>
              <span className="block text-[10px] text-sky-200/40 truncate">Casey · Creative Ammo Briefs</span>
            </span>
          </button>
          <button
            type="button"
            className="px-2 text-[10px] uppercase tracking-wider text-sky-300 hover:text-sky-200"
            onClick={() => scanAmmo.mutate()}
            disabled={scanAmmo.isPending}
          >
            {scanAmmo.isPending ? "Scan…" : "Scan"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setChannelsOpen((v) => !v)}
          className={cn(
            "px-3 py-2 flex items-center gap-2 text-left border-l-2 border-amber-400/80 hover:bg-amber-400/[0.06] shrink-0",
            channelsOpen && "bg-amber-400/[0.05]",
          )}
        >
          <Radio className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
              Channels {channelsOpen ? "▾" : "▸"}
            </span>
            <span className="block text-[10px] text-amber-200/40 truncate">Handles and public URLs</span>
          </span>
        </button>
        <ResizablePanelGroup
          direction="vertical"
          autoSaveId="craft-desk-nav"
          className="flex-1 min-h-0"
          onLayout={() => {
            window.clearTimeout(paneLayoutTimer);
            paneLayoutTimer = window.setTimeout(() => pulseMotion("pane"), 90);
          }}
        >
        {contentAidOpen && (
          <>
          <ResizablePanel
            id="craft-ammo"
            order={1}
            defaultSize={22}
            minSize={12}
            className="flex min-h-0 flex-col"
          >
          <div className="h-full px-3 pb-3 space-y-2 border-b border-sky-400/15 bg-sky-400/[0.03] overflow-y-auto">
            {briefs.length === 0 && (
              <p className="text-[11px] text-white/45 leading-relaxed pt-1">
                Scan the UK lending week. Casey writes ammo. Isla writes the copy. No invented rates.
              </p>
            )}
            {briefs.map((brief) => (
              <div key={brief.id} className="space-y-1 border-b border-white/5 pb-2 last:border-b-0">
                <p className="text-[10px] uppercase tracking-wider text-sky-300/80">
                  {brief.track} · ammo
                </p>
                <p className="text-xs text-white/85 leading-snug">{brief.headline}</p>
                <p className="text-[11px] text-white/55 leading-snug">{brief.socialAngle}</p>
                {brief.imagePrompt && (
                  <p className="text-[10px] text-sky-200/50 leading-snug">Still · {brief.imagePrompt}</p>
                )}
                <p className="text-[10px] text-white/35 leading-snug">{brief.source}</p>
              </div>
            ))}
          </div>
          </ResizablePanel>
          <ResizableHandle withHandle className="bg-sky-400/20" aria-label="Resize content aid" />
          </>
        )}
        {channelsOpen && (
          <>
          <ResizablePanel
            id="craft-channels"
            order={2}
            defaultSize={selected && copy ? 22 : 28}
            minSize={12}
            className="flex min-h-0 flex-col"
          >
          <div className="h-full px-3 pb-3 space-y-2 border-b border-amber-400/15 bg-amber-400/[0.03] overflow-y-auto">
            {channels.map((ch) => (
              <div key={ch.id} className="space-y-1">
                <p className="text-[11px] text-white/70">
                  {ch.label}{" "}
                  <span className="text-white/30">{ch.status.replace("_", " ")}</span>
                </p>
                <Input
                  key={`${ch.id}-handle-${ch.handle}`}
                  defaultValue={ch.handle}
                  placeholder="Handle"
                  className="h-8 text-xs"
                  onBlur={(e) =>
                    patchChannel.mutate({ id: ch.id, patch: { handle: e.target.value } })
                  }
                />
                <Input
                  key={`${ch.id}-url-${ch.url}`}
                  defaultValue={ch.url}
                  placeholder="Public URL"
                  className="h-8 text-xs"
                  onBlur={(e) =>
                    patchChannel.mutate({ id: ch.id, patch: { url: e.target.value } })
                  }
                />
                {ch.id.endsWith("_ads") && (
                  <Input
                    defaultValue={ch.accountId}
                    placeholder="Ads account id"
                    className="h-8 text-xs"
                    onBlur={(e) =>
                      patchChannel.mutate({ id: ch.id, patch: { accountId: e.target.value } })
                    }
                  />
                )}
              </div>
            ))}
            <p className="text-[10px] text-white/35 leading-relaxed">
              No passwords. Connect is OAuth when the developer apps exist. Ads stay draft-only.
            </p>
          </div>
          </ResizablePanel>
          <ResizableHandle withHandle className="bg-amber-400/20" aria-label="Resize channels" />
          </>
        )}
        <ResizablePanel
          id="craft-queue"
          order={3}
          defaultSize={channelsOpen && selected && copy ? 38 : channelsOpen ? 72 : selected && copy ? 52 : 100}
          minSize={16}
          className="min-h-0"
        >
        <div className="h-full overflow-y-auto p-2 space-y-1.5">
          {isLoading && <p className="text-xs text-white/40 px-2 py-6 text-center">Loading desk…</p>}
          {!isLoading && week.length === 0 && (
            <p className="text-xs text-white/45 px-2 py-6 text-center leading-relaxed">
              {briefs.length
                ? "Casey landed ammo. Generate week for Isla to write and design."
                : "Scan first — Casey lands ammo. Generate week is Isla writing and designing. Nothing is generated from a scan."}
            </p>
          )}
          {week.map((post) => {
            const active = selected?.id === post.id;
            return (
              <button
                key={post.id}
                type="button"
                onClick={() => openInCanvas(post)}
                className={cn(
                  "w-full text-left rounded-lg px-2.5 py-2 border transition-colors",
                  active
                    ? "bg-white/[0.06] border-primary/40"
                    : "bg-white/[0.02] border-white/5 hover:border-white/15"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-white/40">
                    {post.weekday} · {post.track}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] uppercase",
                      canExportPost(post) ? "text-primary" : post.status === "approved" ? "text-amber-400/90" : "text-white/35"
                    )}
                  >
                    {queueLabel(post)}
                  </span>
                </div>
                <p className="text-xs text-white/85 mt-0.5 truncate">{post.title}</p>
                <p className="text-[10px] text-white/35 mt-1 truncate">
                  LI · IG · FB · TT
                </p>
              </button>
            );
          })}
        </div>
        </ResizablePanel>
        {selected && copy && (
          <>
          <ResizableHandle withHandle className="bg-primary/25" aria-label="Resize draft copy" />
          <ResizablePanel
            id="craft-draft"
            order={4}
            defaultSize={channelsOpen ? 40 : 48}
            minSize={18}
            className="min-h-0"
          >
          <div className="h-full border-t border-primary/25 bg-primary/[0.04] flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1 border-l-2 border-primary shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <PenLine className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Draft copy</p>
                  <p className="text-[10px] text-primary/50 truncate">This post · hook 1, hook 2, body, CTA</p>
                </div>
              </div>
              {!copyUnchanged(copy, selected) && (
                <button
                  type="button"
                  className="text-[10px] uppercase tracking-wider text-primary"
                  onClick={() => saveCopy()}
                >
                  Save
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-2">
              {selected.visual?.query && (
                <p className="text-[10px] leading-relaxed text-white/40">
                  Visual · {selected.visual.query}
                </p>
              )}
              <label className="grid gap-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                Title
                <Input
                  value={copy.title}
                  aria-label="Title"
                  className="h-8 text-xs"
                  onChange={(e) => setCopy({ ...copy, title: e.target.value })}
                  onBlur={() => saveCopy()}
                />
              </label>
              <label className="grid gap-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                <span className="flex justify-between gap-2">
                  Eyebrow
                  <span className="normal-case tracking-normal text-white/25">
                    {copy.eyebrow.length}/{COPY_LIMITS.eyebrow}
                  </span>
                </span>
                <Input
                  value={copy.eyebrow}
                  aria-label="Eyebrow"
                  maxLength={COPY_LIMITS.eyebrow}
                  className="h-8 text-xs"
                  onChange={(e) => setCopy({ ...copy, eyebrow: e.target.value })}
                  onBlur={() => saveCopy()}
                />
              </label>
              <label className="grid gap-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                <span className="flex justify-between gap-2">
                  Hook 1
                  <span className="normal-case tracking-normal text-white/25">
                    {copy.hook.length}/{COPY_LIMITS.hook}
                  </span>
                </span>
                <Textarea
                  value={copy.hook}
                  aria-label="Hook 1"
                  maxLength={COPY_LIMITS.hook}
                  rows={2}
                  className="min-h-[3.5rem] text-xs"
                  onChange={(e) => setCopy({ ...copy, hook: e.target.value })}
                  onBlur={() => saveCopy()}
                />
              </label>
              <label className="grid gap-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                <span className="flex justify-between gap-2">
                  Hook 2
                  <span className="normal-case tracking-normal text-white/25">
                    {copy.hook2.length}/{COPY_LIMITS.hook2}
                  </span>
                </span>
                <Textarea
                  value={copy.hook2}
                  aria-label="Hook 2"
                  maxLength={COPY_LIMITS.hook2}
                  rows={2}
                  className="min-h-[3.5rem] text-xs"
                  onChange={(e) => setCopy({ ...copy, hook2: e.target.value })}
                  onBlur={() => saveCopy()}
                />
              </label>
              <label className="grid gap-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                <span className="flex justify-between gap-2">
                  Body
                  <span className="normal-case tracking-normal text-white/25">
                    {copy.body.length}/{COPY_LIMITS.body}
                  </span>
                </span>
                <Textarea
                  value={copy.body}
                  aria-label="Body"
                  maxLength={COPY_LIMITS.body}
                  rows={3}
                  className="min-h-[4.5rem] text-xs"
                  onChange={(e) => setCopy({ ...copy, body: e.target.value })}
                  onBlur={() => saveCopy()}
                />
              </label>
              <label className="grid gap-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                <span className="flex justify-between gap-2">
                  CTA
                  <span className="normal-case tracking-normal text-white/25">
                    {copy.cta.length}/{COPY_LIMITS.cta}
                  </span>
                </span>
                <Input
                  value={copy.cta}
                  aria-label="Call to action"
                  maxLength={COPY_LIMITS.cta}
                  className="h-8 text-xs"
                  onChange={(e) => setCopy({ ...copy, cta: e.target.value })}
                  onBlur={() => saveCopy()}
                />
              </label>
              <label className="grid gap-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                Links
                <Textarea
                  value={copy.links}
                  aria-label="Links"
                  placeholder="https://stratafinance.co.uk/start"
                  rows={2}
                  className="min-h-[3.5rem] text-xs"
                  onChange={(e) => setCopy({ ...copy, links: e.target.value })}
                  onBlur={() => saveCopy()}
                />
              </label>
              <label className="grid gap-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                Hashtags
                <Input
                  value={copy.hashtags}
                  aria-label="Hashtags"
                  className="h-8 text-xs"
                  onChange={(e) => setCopy({ ...copy, hashtags: e.target.value })}
                  onBlur={() => saveCopy()}
                />
              </label>
            </div>
            {(() => {
              const review = reviewMarketingCopy(selected);
              const blocked = review.findings.filter((item) => item.level === "block");
              return (
                <div className="px-3 pb-3 space-y-2 shrink-0">
                  {blocked.length > 0 && (
                    <ul className="space-y-1">
                      {blocked.map((item) => (
                        <li key={item.code} className="text-[10px] leading-relaxed text-amber-400/90">
                          {item.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  {canExportPost(selected) && (
                    <p className="text-[10px] text-primary">Cleared for export.</p>
                  )}
                  {canExportPost(selected) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setLearnSlug(slugifyLearnTitle(selected.title));
                        setLearnExcerpt(selected.hook || selected.body);
                        setLearnCategory("uk_commercial_finance");
                        setLearnPublishedAt(new Date().toISOString().slice(0, 10));
                        setLearnOpen(true);
                      }}
                    >
                      Publish to Learn
                    </Button>
                  )}
                  <div className="flex gap-2">
                    {selected.status !== "approved" && selected.status !== "exported" && (
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={patchPost.isPending}
                        onClick={() => setStatus("approved")}
                      >
                        Approve copy
                      </Button>
                    )}
                    {selected.status === "approved" && selected.compliance !== "cleared" && (
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={patchPost.isPending || blocked.length > 0}
                        onClick={() => {
                          if (copy && !copyUnchanged(copy, selected)) {
                            patchPost.mutate({ id: selected.id, status: "approved", compliance: "cleared", ...copy });
                          } else {
                            patchPost.mutate({ id: selected.id, compliance: "cleared" });
                          }
                        }}
                      >
                        Compliance sign-off
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={patchPost.isPending}
                      onClick={() => setStatus("rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
          </ResizablePanel>
          </>
        )}
        </ResizablePanelGroup>
      </aside>

      <div
        className={cn(
          "min-w-0 flex-1 min-h-0 flex-col",
          boardOpen ? "flex" : "hidden md:flex",
        )}
      >
        {selected && (
          <div className="px-3 md:px-4 py-2 border-b border-white/10 text-xs text-white/50 shrink-0 flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={closeBoard}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Queue
            </Button>
            <span className="truncate">
              {selected.title} · {selected.weekday} · {queueLabel(selected)}
            </span>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CraftView
            onClose={closeBoard}
            onCopyChange={(patch) => {
              if (!selected) return;
              const next = draftFromPatch(selected, patch);
              setCopy(next);
              saveCopy(next);
            }}
            yaffle={
              selected
                ? {
                    ok: yaffleHealth?.ok,
                    message: yaffleHealth?.message,
                    prompt: yafflePrompt,
                    generating: yaffleGenerate.isPending,
                    progress: yaffleProgress,
                    onGenerate: (prompt) => yaffleGenerate.mutate(prompt),
                  }
                : undefined
            }
          />
        </div>
      </div>

      <Dialog
        open={weekOpen}
        onOpenChange={(open) => {
          setWeekOpen(open);
          pulseMotion(open ? "dialog" : "close");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New week</DialogTitle>
            <DialogDescription>
              One route for the seven boards. Isla writes one day at a time. Sharp cultural is the default.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {(
              [
                { id: "sharp-cultural", label: "Sharp cultural", hint: "Two-beat corrections, redact, named voice. Recommended." },
                { id: "safe-distinctive", label: "Safe distinctive", hint: "Stamp, paper, identity as object." },
                { id: "beautiful-insane", label: "Beautiful insane", hint: "One still slightly wrong. Copy stays deadpan." },
              ] as { id: WeekRoute; label: string; hint: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setWeekRoute(item.id)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left",
                  weekRoute === item.id ? "border-primary bg-primary/10" : "border-white/10",
                )}
              >
                <span className="block text-sm text-white/90">{item.label}</span>
                <span className="block text-[11px] text-white/45">{item.hint}</span>
              </button>
            ))}
            <Button disabled={newWeek.isPending} onClick={() => newWeek.mutate(weekRoute)}>
              {newWeek.isPending ? "Opening…" : "Open this week"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={learnOpen}
        onOpenChange={(open) => {
          setLearnOpen(open);
          pulseMotion(open ? "dialog" : "close");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish to Learn</DialogTitle>
            <DialogDescription>Live post on learn.stratanexus.co.uk. Never auto-publish.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Slug</Label>
                <Input value={learnSlug} onChange={(e) => setLearnSlug(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Excerpt</Label>
                <Textarea value={learnExcerpt} onChange={(e) => setLearnExcerpt(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>News section</Label>
                <Select value={learnCategory} onValueChange={setLearnCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NEWS_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{NEWS_CATEGORY_LABELS[cat]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Published date</Label>
                <Input type="date" value={learnPublishedAt} onChange={(e) => setLearnPublishedAt(e.target.value)} />
              </div>
              <Button
                className="w-full"
                disabled={publishLearn.isPending}
                onClick={() =>
                  publishLearn.mutate({
                    id: selected.id,
                    slug: learnSlug,
                    excerpt: learnExcerpt,
                    category: learnCategory,
                    publishedAt: learnPublishedAt || undefined,
                  })
                }
              >
                {publishLearn.isPending ? "Publishing…" : "Publish"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
