

export interface StockPhoto {
  id: string;
  provider: string;
  thumb: string;
  full: string;
  credit: string;
  tags?: string[];
}

const CURATED: StockPhoto[] = [
  { id: "desk", provider: "unsplash", thumb: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&q=60", full: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80", credit: "Photo by Unsplash", tags: ["office", "desk", "work"] },
  { id: "product", provider: "unsplash", thumb: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=60", full: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1600&q=80", credit: "Photo by Unsplash", tags: ["product", "watch", "shop"] },
  { id: "portrait", provider: "unsplash", thumb: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=60", full: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1600&q=80", credit: "Photo by Unsplash", tags: ["people", "portrait", "face"] },
  { id: "city", provider: "unsplash", thumb: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=400&q=60", full: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1600&q=80", credit: "Photo by Unsplash", tags: ["city", "street", "night"] },
  { id: "nature", provider: "unsplash", thumb: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=400&q=60", full: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80", credit: "Photo by Unsplash", tags: ["nature", "lake", "mountain"] },
  { id: "texture", provider: "unsplash", thumb: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=400&q=60", full: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1600&q=80", credit: "Photo by Unsplash", tags: ["texture", "abstract", "color"] },
  { id: "food", provider: "unsplash", thumb: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=60", full: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80", credit: "Photo by Unsplash", tags: ["food", "kitchen", "restaurant"] },
  { id: "studio", provider: "unsplash", thumb: "https://images.unsplash.com/photo-1493863641943-9b68992a8d07?auto=format&fit=crop&w=400&q=60", full: "https://images.unsplash.com/photo-1493863641943-9b68992a8d07?auto=format&fit=crop&w=1600&q=80", credit: "Photo by Unsplash", tags: ["studio", "light", "camera"] },
  { id: "hands", provider: "unsplash", thumb: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=400&q=60", full: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80", credit: "Photo by Unsplash", tags: ["team", "meeting", "people"] },
  { id: "gradient", provider: "unsplash", thumb: "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=400&q=60", full: "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1600&q=80", credit: "Photo by Unsplash", tags: ["gradient", "background", "color"] },
  { id: "shop", provider: "unsplash", thumb: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=60", full: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80", credit: "Photo by Unsplash", tags: ["shop", "retail", "store"] },
  { id: "paper", provider: "unsplash", thumb: "https://images.unsplash.com/photo-1516387938699-a93567ec168e?auto=format&fit=crop&w=400&q=60", full: "https://images.unsplash.com/photo-1516387938699-a93567ec168e?auto=format&fit=crop&w=1600&q=80", credit: "Photo by Unsplash", tags: ["paper", "write", "desk"] },
];

function matchCurated(query: string): StockPhoto[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return CURATED;
  const hits = CURATED.filter((photo) => words.some((word) => photo.tags?.some((tag) => tag.includes(word)) || photo.id.includes(word)));
  return hits.length ? hits : CURATED;
}

async function searchProvider(_provider: "unsplash" | "pexels", _query: string): Promise<StockPhoto[]> {
  return [];
}

export function stockById(id: string): StockPhoto | undefined {
  return CURATED.find((photo) => photo.id === id);
}

export async function searchStock(query: string): Promise<{ photos: StockPhoto[]; source: "api" | "library"; warning?: string }> {
  const q = query.trim();
  if (!q) return { photos: CURATED, source: "library" };
  for (const provider of ["unsplash", "pexels"] as const) {
    try {
      const photos = await searchProvider(provider, q);
      if (photos.length) return { photos, source: "api" };
    } catch {
      // try the next provider, then the local library
    }
  }
  return {
    photos: matchCurated(q),
    source: "library",
    warning: "Stock APIs need Unsplash/Pexels keys. Showing the built-in library.",
  };
}

export async function fetchImageDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (res.ok) {
      const blob = await res.blob();
      return await blobToDataUrl(blob);
    }
  } catch {
    // CORS or offline — fall through to an Image draw
  }

  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not decode stock image."));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Could not load that stock image."));
    img.src = url;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
