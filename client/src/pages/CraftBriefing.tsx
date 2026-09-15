import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CraftView } from "@/components/craft/CraftView";
import { briefingDocumentFromBind, fillDocumentMergeTags } from "@/components/craft/lib/briefingBoard";
import { rasterBlob } from "@/components/craft/lib/export";
import { loadCraftForAsset } from "@/components/craft/persist";
import { useCraftStore } from "@/components/craft/store";
import { MediaGalleryModal } from "@/components/email/MediaGalleryModal";
import { packHtmlFromPageImages } from "@shared/briefingCraft";
import type { BriefingBind, FilledSlide } from "@shared/briefingRender";
import { usePageTitle } from "@/context/LayoutContext";
import { apiRequest } from "@/lib/queryClient";

type CraftPayload = {
  bind: BriefingBind;
  merge: Record<string, string>;
  pageUrl?: string | null;
  briefing?: { packHtml?: string | null; filledSlides?: FilledSlide[] };
};

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

export default function CraftBriefing() {
  const params = useParams<{ openerId: string }>();
  const openerId = params.openerId || "";
  const [, setLocation] = useLocation();
  const [siteUrl, setSiteUrl] = useState("");
  const [bullets, setBullets] = useState<string[]>([]);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [converted, setConverted] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const openDocument = useCraftStore((state) => state.openDocument);
  const close = useCraftStore((state) => state.close);

  usePageTitle("Direct Outreach", "Design this company's private briefing");

  const craftQuery = useQuery({
    queryKey: ["/api/openers", openerId, "briefing", "craft"],
    enabled: Boolean(openerId),
    queryFn: async () => {
      const res = await apiRequest(`/api/openers/${openerId}/briefing/craft`, "GET");
      return res.json() as Promise<CraftPayload>;
    },
  });

  useEffect(() => {
    if (!craftQuery.data?.bind) return;
    let cancelled = false;
    const assetId = `briefing:${openerId}`;
    void (async () => {
      const saved = await loadCraftForAsset(assetId);
      if (cancelled) return;
      openDocument(saved ?? briefingDocumentFromBind(craftQuery.data.bind), assetId);
      if (craftQuery.data.pageUrl) setPageUrl(craftQuery.data.pageUrl);
    })();
    return () => {
      cancelled = true;
      close();
    };
  }, [craftQuery.data, openerId, openDocument, close]);

  const fetchSite = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/openers/${openerId}/briefing/site`, "POST", { url: siteUrl });
      return res.json() as Promise<{ url: string; bullets: string[] }>;
    },
    onSuccess: (data) => {
      setSiteUrl(data.url);
      setBullets(data.bullets);
      toast.success("Site copy is in the well");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const convertHtml = useMutation({
    mutationFn: async () => {
      const bind = craftQuery.data?.bind;
      if (!bind) throw new Error("Briefing is not loaded");
      const store = useCraftStore.getState();
      if (!store.doc) throw new Error("Open the board first");
      const filled = fillDocumentMergeTags(store.doc, bind);
      store.openDocument(filled, store.assetId);
      const images: string[] = [];
      for (const page of filled.pages) {
        const { blob } = await rasterBlob(page, filled.assets, filled.title, "jpeg");
        images.push(await blobToDataUrl(blob));
      }
      const html = packHtmlFromPageImages({
        companyName: bind.companyName,
        images,
        enquiryUrl: bind.enquiryUrl,
        veltroUrl: bind.veltroUrl,
        slides: craftQuery.data.briefing?.filledSlides,
      });
      const res = await apiRequest(`/api/openers/${openerId}/briefing/html`, "POST", { html });
      return res.json();
    },
    onSuccess: () => {
      setConverted(true);
      toast.success("Pack saved. Create page if you want a live link, then Send from the contact.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createPage = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/openers/${openerId}/briefing/page`, "POST");
      return res.json() as Promise<{ pageUrl: string }>;
    },
    onSuccess: (data) => {
      setPageUrl(data.pageUrl);
      toast.success("Page is live");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dropBullet = (line: string) => {
    const store = useCraftStore.getState();
    store.addText();
    const doc = useCraftStore.getState().doc;
    const page = doc?.pages.find((item) => item.id === doc.activePageId);
    const created = page?.nodes.filter((node) => node.type === "text").at(-1);
    if (created?.type === "text") store.updateNode(created.id, { text: line });
  };

  const mergeTags = ["companyName", "dwellLine", "filings", "hypothesis", "mechanism"] as const;
  const packReady = converted || Boolean(craftQuery.data?.briefing?.packHtml);

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/10 px-3 py-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            data-testid="btn-back-to-opener"
            onClick={() => setLocation("/openers")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to contact
          </Button>
          <p className="text-sm font-medium" data-testid="label-design-briefing">
            Design briefing
            {craftQuery.data?.bind?.companyName ? ` · ${craftQuery.data.bind.companyName}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mergeTags.map((tag) => (
            <Button
              key={tag}
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs font-mono"
              onClick={() => useCraftStore.getState().insertMergeTag(`{{${tag}}}`)}
            >
              {`{{${tag}}}`}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            data-testid="input-briefing-site-url"
            placeholder="https://their-site.co.uk"
            value={siteUrl}
            onChange={(event) => setSiteUrl(event.target.value)}
            className="max-w-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="btn-fetch-site"
            disabled={fetchSite.isPending || !siteUrl.trim()}
            onClick={() => fetchSite.mutate()}
          >
            {fetchSite.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Fetch site
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="btn-briefing-gallery"
            onClick={() => setGalleryOpen(true)}
          >
            <ImageIcon className="h-4 w-4 mr-1" />
            Gallery
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="btn-convert-html"
            disabled={convertHtml.isPending || !craftQuery.data}
            onClick={() => convertHtml.mutate()}
          >
            {convertHtml.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Convert to HTML
          </Button>
          <Button
            type="button"
            size="sm"
            data-testid="btn-create-page"
            disabled={createPage.isPending || convertHtml.isPending || !packReady}
            onClick={() => createPage.mutate()}
          >
            {createPage.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create page
          </Button>
          {pageUrl ? (
            <a
              data-testid="briefing-page-url"
              className="text-sm underline truncate max-w-[28rem]"
              href={pageUrl}
              target="_blank"
              rel="noreferrer"
            >
              {pageUrl}
            </a>
          ) : null}
        </div>
        {bullets.length > 0 ? (
          <ul data-testid="list-site-copy" className="flex flex-wrap gap-2">
            {bullets.map((line) => (
              <li key={line}>
                <button
                  type="button"
                  className="text-left text-xs rounded-md border border-white/15 px-2 py-1 hover:bg-white/5"
                  onClick={() => dropBullet(line)}
                >
                  {line}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        {craftQuery.isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading this company…
          </div>
        ) : craftQuery.isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm">
            <p className="text-destructive">Could not generate this briefing.</p>
            <p className="text-muted-foreground">
              {craftQuery.error instanceof Error ? craftQuery.error.message : "Request failed"}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => setLocation("/openers")}>
              Back to Openers
            </Button>
          </div>
        ) : (
          <CraftView onClose={() => setLocation("/openers")} />
        )}
      </div>
      <MediaGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={(url) => {
          void useCraftStore.getState().placeGalleryImage(url);
        }}
      />
    </div>
  );
}
