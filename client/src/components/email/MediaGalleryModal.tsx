import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Loader2,
  FolderOpen,
  Library,
  Globe,
  Sparkles,
  Check,
  ImageIcon,
} from "lucide-react";
import { MEDIA_CATEGORIES, type MediaAsset } from "@shared/schema";
import { toast } from "sonner";

const categoryColors: Record<string, string> = {
  business_corporate: "bg-blue-500/20 text-blue-400",
  finance_banking: "bg-emerald-500/20 text-emerald-400",
  property_real_estate: "bg-amber-500/20 text-amber-400",
  professional_people: "bg-emerald-500/20 text-emerald-400",
  technology_digital: "bg-emerald-500/20 text-emerald-400",
  charts_data: "bg-orange-500/20 text-orange-400",
  city_architecture: "bg-emerald-500/20 text-emerald-400",
  abstract_backgrounds: "bg-pink-500/20 text-pink-400",
  uncategorised: "bg-gray-500/20 text-muted-foreground",
};

interface WebImage {
  url: string;
  thumbnail: string;
  description: string;
  credit: string;
  source: string;
}

interface MediaGalleryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export function MediaGalleryModal({ open, onClose, onSelect }: MediaGalleryModalProps) {
  const [activeTab, setActiveTab] = useState<"stock" | "mine" | "search">("stock");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);

  // Web search state
  const [webQuery, setWebQuery] = useState("");
  const [webResults, setWebResults] = useState<WebImage[]>([]);
  const [webSearching, setWebSearching] = useState(false);
  const [selectedWebImage, setSelectedWebImage] = useState<WebImage | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  // Fetch gallery images
  useEffect(() => {
    if (!open) return;
    if (activeTab === "search") return;

    const fetchAssets = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ type: activeTab === "stock" ? "stock" : "mine" });
        if (activeTab === "stock" && categoryFilter !== "all") {
          params.set("category", categoryFilter);
        }
        const res = await fetch(`/api/media?${params}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setAssets(data);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, [open, activeTab, categoryFilter]);

  const filteredAssets = assets.filter((a) =>
    a.filename.toLowerCase().includes(search.toLowerCase())
  );

  const handleWebSearch = async () => {
    if (!webQuery.trim()) return;
    setWebSearching(true);
    setWebResults([]);
    setSelectedWebImage(null);
    try {
      const res = await fetch(`/api/media/search-images?q=${encodeURIComponent(webQuery)}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setWebResults(data.images || []);
      } else {
        toast.error("Image search failed");
      }
    } catch {
      toast.error("Image search failed");
    } finally {
      setWebSearching(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!selectedWebImage || !aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      const res = await fetch("/api/media/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sourceUrl: selectedWebImage.url,
          prompt: aiPrompt,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          onSelect(data.url);
          onClose();
          toast.success("AI-generated image inserted");
        } else {
          toast.error("AI generation did not return an image");
        }
      } else {
        const err = await res.json().catch(() => ({ error: "Generation failed" }));
        toast.error(err.error || "AI generation failed");
      }
    } catch {
      toast.error("AI generation failed");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSelect = (url: string) => {
    onSelect(url);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Image</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as "stock" | "mine" | "search");
            setSearch("");
            setCategoryFilter("all");
          }}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="stock" className="px-3 py-1.5 text-xs">
                <Library className="h-3.5 w-3.5 mr-1.5" />
                Stock Library
              </TabsTrigger>
              <TabsTrigger value="mine" className="px-3 py-1.5 text-xs">
                <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                My Uploads
              </TabsTrigger>
              <TabsTrigger value="search" className="px-3 py-1.5 text-xs">
                <Globe className="h-3.5 w-3.5 mr-1.5" />
                Image Search
              </TabsTrigger>
            </TabsList>

            {activeTab === "stock" && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
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
          </div>

          {/* Stock & My Uploads tabs */}
          {(activeTab === "stock" || activeTab === "mine") && (
            <>
              <div className="relative max-w-xs mt-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <TabsContent value={activeTab} className="flex-1 overflow-y-auto mt-3">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {search ? "No images match your filter" : "No images available"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {filteredAssets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => handleSelect(asset.url)}
                        className="group relative aspect-square bg-muted rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-all focus:outline-none focus:border-primary"
                      >
                        <img
                          src={asset.url}
                          alt={asset.filename}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {asset.isStock && asset.category && (
                          <Badge
                            variant="secondary"
                            className={`absolute top-1 left-1 text-[8px] px-1 py-0 ${categoryColors[asset.category] || ""}`}
                          >
                            {MEDIA_CATEGORIES.find((c) => c.value === asset.category)?.label}
                          </Badge>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="bg-primary text-primary-foreground rounded-full p-1.5">
                            <Check className="h-4 w-4" />
                          </div>
                        </div>
                        <p className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] px-1.5 py-0.5 truncate">
                          {asset.filename}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </>
          )}

          {/* Image Search tab */}
          <TabsContent value="search" className="flex-1 flex flex-col min-h-0 mt-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search for images (e.g. 'modern office building')..."
                  value={webQuery}
                  onChange={(e) => setWebQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleWebSearch()}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                onClick={handleWebSearch}
                disabled={webSearching || !webQuery.trim()}
                className="h-8"
              >
                {webSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto mt-3">
              {webSearching ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Searching images...</span>
                </div>
              ) : webResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Globe className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Search for images across the web
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Results from Unsplash — free to use
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {webResults.map((img, i) => (
                      <div key={i} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => handleSelect(img.url)}
                          className={`group relative aspect-square bg-muted rounded-lg overflow-hidden border-2 transition-all focus:outline-none w-full ${
                            selectedWebImage?.url === img.url
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-transparent hover:border-primary/50"
                          }`}
                        >
                          <img
                            src={img.thumbnail}
                            alt={img.description}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="bg-primary text-primary-foreground rounded-full p-1.5">
                              <Check className="h-4 w-4" />
                            </div>
                          </div>
                        </button>
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] text-muted-foreground truncate flex-1">
                            {img.credit}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[9px]"
                            onClick={() => setSelectedWebImage(img)}
                          >
                            <Sparkles className="h-3 w-3 mr-0.5" />
                            AI
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Generation panel */}
                  {selectedWebImage && (
                    <div className="mt-4 p-3 border rounded-lg bg-muted/30 space-y-3">
                      <div className="flex items-start gap-3">
                        <img
                          src={selectedWebImage.thumbnail}
                          alt="Selected"
                          className="w-20 h-20 rounded object-cover shrink-0"
                        />
                        <div className="flex-1 space-y-2">
                          <p className="text-xs font-medium flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            Generate AI variation
                          </p>
                          <Input
                            placeholder="Describe the changes you want (e.g. 'make it more professional with a blue tone')..."
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
                            className="h-8 text-xs"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={handleAiGenerate}
                              disabled={aiGenerating || !aiPrompt.trim()}
                            >
                              {aiGenerating ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5 mr-1" />
                              )}
                              Generate
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setSelectedWebImage(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
