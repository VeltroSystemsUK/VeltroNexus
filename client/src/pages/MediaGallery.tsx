import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePageTitle } from "@/context/LayoutContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  Upload,
  Search,
  Trash2,
  Copy,
  Loader2,
  ImageIcon,
  Calendar,
  HardDrive,
  FolderOpen,
  Library,
  Camera,
  Radar,
} from "lucide-react";
import { toast } from "sonner";
import type { MediaAsset } from "@shared/schema";
import { MEDIA_CATEGORIES } from "@shared/schema";

type CuratedRow = {
  id: string;
  title: string;
  description: string;
  originalUrl: string;
  tags: string[];
  license: string;
  attribution?: string;
  aspectRatio: string;
  usageCount: number;
};

const categoryColors: Record<string, string> = {
  business_corporate: "bg-blue-500/20 text-blue-400",
  finance_banking: "bg-emerald-500/20 text-emerald-400",
  property_real_estate: "bg-amber-500/20 text-amber-400",
  professional_people: "bg-purple-500/20 text-purple-400",
  technology_digital: "bg-cyan-500/20 text-cyan-400",
  charts_data: "bg-orange-500/20 text-orange-400",
  city_architecture: "bg-indigo-500/20 text-indigo-400",
  abstract_backgrounds: "bg-pink-500/20 text-pink-400",
  uncategorised: "bg-gray-500/20 text-muted-foreground",
};

export default function MediaGallery() {
  usePageTitle("Media Gallery");

  const [activeTab, setActiveTab] = useState<"mine" | "stock" | "curated">("stock");
  const [ingestUrl, setIngestUrl] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: assets = [], isLoading } = useQuery<MediaAsset[]>({
    queryKey: ["/api/media", activeTab, categoryFilter],
    enabled: activeTab !== "curated",
    queryFn: async () => {
      const params = new URLSearchParams({ type: activeTab });
      if (activeTab === "stock" && categoryFilter !== "all") {
        params.set("category", categoryFilter);
      }
      const res = await fetch(`/api/media?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch media");
      return res.json();
    },
  });

  const { data: curated = { assets: [] }, isLoading: curatedLoading } = useQuery<{ assets: CuratedRow[] }>({
    queryKey: ["/api/curator/search", search],
    enabled: activeTab === "curated",
    queryFn: async () => {
      const res = await apiRequest("/api/curator/search", "POST", { q: search });
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast.success("Image uploaded successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/media/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast.success("Image deleted");
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error("Failed to delete image");
    },
  });

  const curatorRun = useMutation({
    mutationFn: async (query?: string) => {
      const res = await apiRequest("/api/curator/run", "POST", { query });
      return res.json() as Promise<{ ingested: number; skipped: number; sources?: string[] }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/curator/search"] });
      const from = data.sources?.length ? ` · ${data.sources.join(", ")}` : "";
      toast.success(`Kit ingested ${data.ingested} stills${data.skipped ? `, skipped ${data.skipped}` : ""}${from}.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const curatorIngest = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("/api/curator/ingest", "POST", { url, source: "feed", license: "commercial" });
      return res.json();
    },
    onSuccess: (data: { duplicate?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/curator/search"] });
      toast.success(data.duplicate ? "Already in the index." : "Kit indexed that still.");
      setIngestUrl("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/media/seed-stock", "POST");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast.success(`Stock library loaded: ${data.count} images`);
    },
    onError: (err: Error) => {
      if (err.message.includes("409")) {
        toast.info("Stock library is already loaded");
        queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      } else {
        toast.error("Failed to load stock library");
      }
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard");
  };

  const blobFromCurated = async (asset: CuratedRow) => {
    const res = await fetch(asset.originalUrl, { credentials: "include" });
    if (!res.ok) throw new Error("Could not read that still.");
    return await res.blob();
  };

  const saveToUploads = useMutation({
    mutationFn: async (asset: CuratedRow) => {
      const blob = await blobFromCurated(asset);
      const slug = asset.title.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "curated";
      const name = `${slug}_${asset.id.slice(0, 8)}.jpg`;
      const file = new File([blob], name, { type: blob.type || "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/media/upload", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      await apiRequest(`/api/curator/assets/${asset.id}/use`, "POST", {
        campaignId: "my-uploads",
        channel: "email",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/curator/search"] });
      toast.success("Saved to My Uploads");
      setSearch("");
      setActiveTab("mine");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const formatSize = (bytes: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const filtered = assets.filter((a) =>
    a.filename.toLowerCase().includes(search.toLowerCase())
  );

  const renderImageCard = (asset: MediaAsset) => {
    const isStock = asset.isStock;
    return (
      <Card
        key={asset.id}
        className="group overflow-hidden hover:ring-2 hover:ring-primary/20 transition-all"
      >
        <div className="aspect-square bg-muted relative overflow-hidden">
          <img
            src={asset.url}
            alt={asset.filename}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Category badge for stock images */}
          {isStock && asset.category && (
            <Badge
              variant="secondary"
              className={`absolute top-2 left-2 text-[10px] ${categoryColors[asset.category] || categoryColors.uncategorised}`}
            >
              {MEDIA_CATEGORIES.find((c) => c.value === asset.category)?.label || asset.category}
            </Badge>
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={() => copyUrl(asset.url)}
              title="Copy URL"
            >
              <Copy className="h-4 w-4" />
            </Button>
            {!isStock && (
              <Button
                size="icon"
                variant="destructive"
                className="h-8 w-8"
                onClick={() => setDeleteTarget(asset)}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <CardContent className="p-3 space-y-1">
          <p
            className="text-xs font-medium truncate"
            title={asset.filename}
          >
            {asset.filename}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {isStock && asset.credit ? (
              <span className="flex items-center gap-1 truncate">
                <Camera className="h-3 w-3 shrink-0" />
                {asset.credit}
              </span>
            ) : (
              <>
                {asset.size > 0 && (
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />
                    {formatSize(asset.size)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(asset.createdAt)}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-base md:text-lg font-bold uppercase">Media Gallery</h1>
        <p className="text-muted-foreground text-sm">
          Kit Lang (MKT-4) hunts Unsplash, Pexels, Openverse and Firecrawl. Click Curated stills to save them to My Uploads.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as "mine" | "stock" | "curated");
          setCategoryFilter("all");
          setSearch("");
        }}
      >
        {/* Controls bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="stock" className="px-4 py-2">
              <Library className="h-4 w-4 mr-2" />
              Stock Library
            </TabsTrigger>
            <TabsTrigger value="mine" className="px-4 py-2">
              <FolderOpen className="h-4 w-4 mr-2" />
              My Uploads
            </TabsTrigger>
            <TabsTrigger value="curated" className="px-4 py-2">
              <Radar className="h-4 w-4 mr-2" />
              Curated
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {activeTab === "stock" && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {MEDIA_CATEGORIES.filter((c) => c.value !== "uncategorised").map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {activeTab === "curated" && (
              <>
                <Input
                  placeholder="Image URL to ingest"
                  value={ingestUrl}
                  onChange={(e) => setIngestUrl(e.target.value)}
                  className="w-[240px]"
                />
                <Button
                  variant="outline"
                  disabled={!ingestUrl.trim() || curatorIngest.isPending}
                  onClick={() => curatorIngest.mutate(ingestUrl.trim())}
                >
                  {curatorIngest.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Ingest
                </Button>
                <Button onClick={() => curatorRun.mutate(search || undefined)} disabled={curatorRun.isPending}>
                  {curatorRun.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Radar className="h-4 w-4 mr-2" />}
                  Run curator
                </Button>
              </>
            )}
            {activeTab === "mine" && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  aria-label="Upload image"
                  onChange={handleFileSelect}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {uploading ? "Uploading..." : "Upload Image"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={activeTab === "curated" ? "warm office desk with coffee and laptop" : "Search by filename..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stock Library Tab */}
        <TabsContent value="stock" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 && !search ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <Library className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">Stock Library Not Loaded</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Load curated stock photos for your marketing campaigns — business, finance, property, and more.
                </p>
                <Button
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                >
                  {seedMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Load Stock Library
                </Button>
              </CardContent>
            </Card>
          ) : filtered.length === 0 && search ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">No images match your search</h3>
                <p className="text-muted-foreground text-sm">Try a different search term</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filtered.map(renderImageCard)}
            </div>
          )}
        </TabsContent>

        {/* My Uploads Tab */}
        <TabsContent value="mine" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">
                  {search ? "No images match your search" : "No images yet"}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {search
                    ? "Try a different search term"
                    : "Upload images to use in your email campaigns"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filtered.map(renderImageCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="curated" className="mt-4">
          {curatedLoading || curatorRun.isPending ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (curated.assets ?? []).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <Radar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">Kit has an empty index</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Run the curator to hunt Unsplash, Pexels, Openverse and Firecrawl, or paste a URL.
                </p>
                <Button onClick={() => curatorRun.mutate(undefined)} disabled={curatorRun.isPending}>
                  Run curator
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-3">
                Click a still to save it to My Uploads. Type a search then Run curator to steer the hunt.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {curated.assets.map((asset) => {
                  const saving = saveToUploads.isPending && saveToUploads.variables?.id === asset.id;
                  return (
                  <Card
                    key={asset.id}
                    className="group overflow-hidden hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer"
                    onClick={() => !saveToUploads.isPending && saveToUploads.mutate(asset)}
                  >
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      <img src={asset.originalUrl} alt={asset.title} className="w-full h-full object-cover" loading="lazy" />
                      {saving && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3 space-y-1">
                      <p className="text-xs font-medium truncate" title={asset.title}>{asset.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {asset.aspectRatio} · {asset.license}{asset.attribution ? ` · ${asset.attribution}` : ""} · used {asset.usageCount}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{asset.tags.slice(0, 4).join(" · ")}</p>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.filename}"? This
              action cannot be undone. If this image is used in any email
              templates, those templates will show a broken image.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
