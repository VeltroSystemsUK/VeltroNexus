import type { CraftDocument, CraftFont } from "./types";

export const FONT_WEIGHTS = [
  { id: "400", label: "Book" },
  { id: "600", label: "Semibold" },
  { id: "700", label: "Bold" },
  { id: "800", label: "Black" },
] as const;

export const STRATA_SITE_FONTS = ["Unbounded", "Plus Jakarta Sans", "Space Mono"] as const;

export const SYSTEM_FONTS = [
  ...STRATA_SITE_FONTS,
  "Lexend",
  "Inter",
  "IBM Plex Sans",
  "Playfair Display",
  "Montserrat",
  "Poppins",
  "Merriweather",
  "Work Sans",
  "Libre Baskerville",
  "JetBrains Mono",
];

export function isFontFile(file: { name: string; type?: string }): boolean {
  const mime = (file.type ?? "").toLowerCase();
  if (mime.includes("font") || mime.includes("woff") || mime.includes("sfnt") || mime.includes("otf") || mime.includes("ttf")) {
    return true;
  }
  return /\.(ttf|otf|woff2?)$/i.test(file.name);
}

export function familyFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Custom Font";
}

export function documentFonts(doc: CraftDocument | null | undefined): string[] {
  const custom = (doc?.fonts ?? []).map((font) => font.family);
  return [...custom, ...SYSTEM_FONTS.filter((name) => !custom.includes(name))];
}

const loaded = new Set<string>();

export async function loadCraftFonts(doc: CraftDocument): Promise<void> {
  if (typeof FontFace === "undefined" || typeof document === "undefined") return;
  for (const font of doc.fonts ?? []) {
    const asset = doc.assets.find((item) => item.id === font.assetId);
    if (!asset?.dataUrl) continue;
    const key = `${font.family}:${asset.dataUrl.slice(0, 48)}`;
    if (loaded.has(key)) continue;
    try {
      const face = new FontFace(font.family, `url(${asset.dataUrl})`);
      await face.load();
      document.fonts.add(face);
      loaded.add(key);
    } catch {
      // skip unreadable font files
    }
  }
}

export function makeCraftFont(family: string, assetId: string): CraftFont {
  return { id: `font_${assetId}`, family, assetId };
}
