import { clearBlobs, deleteBlob, getBlob, putBlob } from "./idb";
import { parseCraftJson, serializeCraft } from "./lib/persist";
import { DEFAULT_BRAND, activePage, type CraftAsset, type CraftBrand, type CraftDocument } from './lib/types';
import { cloneBrand } from './lib/brand';

const INDEX_KEY = 'forge:craft-index';
const BRAND_KEY = 'forge:craft-brand';
const BRAND_LOGO_KEY = 'forge:craft-brand-logo';

export function loadBrandKit(): CraftBrand {
  try {
    const raw = localStorage.getItem(BRAND_KEY);
    if (!raw) return cloneBrand(DEFAULT_BRAND);
    return cloneBrand({ ...DEFAULT_BRAND, ...JSON.parse(raw) as CraftBrand });
  } catch {
    return cloneBrand(DEFAULT_BRAND);
  }
}

export function saveBrandKit(brand: CraftBrand): void {
  localStorage.setItem(BRAND_KEY, JSON.stringify(cloneBrand(brand)));
}

/** The real Strata mark, served from brand/logo/. Falls in until someone saves an override. */
const DEFAULT_LOGO: CraftAsset = {
  id: "strata-mark-default",
  name: "Strata mark",
  mime: "image/svg+xml",
  dataUrl: "/brand/logo/strata-mark.svg",
  width: 70,
  height: 62,
};

export function loadBrandLogo(): CraftAsset | null {
  try {
    const raw = localStorage.getItem(BRAND_LOGO_KEY);
    if (!raw) return DEFAULT_LOGO;
    const asset = JSON.parse(raw) as CraftAsset;
    if (!asset?.id || typeof asset.dataUrl !== "string") return DEFAULT_LOGO;
    return asset;
  } catch {
    return DEFAULT_LOGO;
  }
}

export function saveBrandLogo(logo: CraftAsset | null): void {
  if (!logo) {
    localStorage.removeItem(BRAND_LOGO_KEY);
    return;
  }
  localStorage.setItem(BRAND_LOGO_KEY, JSON.stringify(logo));
}

function readIndex(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function writeIndex(index: Record<string, string>): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function isCraftAsset(asset: { name: string; mimeType: string }): boolean {
  const name = asset.name.toLowerCase();
  if (name.endsWith('.craft.json') || name.endsWith('.craft')) return true;
  return asset.mimeType === 'application/json' && name.includes('craft');
}

export function craftFileName(title: string): string {
  const base = title.trim().replace(/[<>:"/\\|?*]+/g, '').replace(/\s+/g, ' ') || 'Untitled design';
  const lower = base.toLowerCase();
  if (lower.endsWith('.craft.json')) return base;
  if (lower.endsWith('.json')) return `${base.slice(0, -5)}.craft.json`;
  return `${base}.craft.json`;
}

export function craftJsonBytes(doc: CraftDocument): Uint8Array {
  return new TextEncoder().encode(serializeCraft(doc));
}

export async function saveCraftDoc(doc: CraftDocument, assetId?: string): Promise<void> {
  await putBlob(`craftdoc:${doc.id}`, new Blob([serializeCraft(doc)], { type: 'application/json' }));
  if (assetId) {
    const index = readIndex();
    index[assetId] = doc.id;
    writeIndex(index);
  }
}

export async function loadCraftDoc(docId: string): Promise<CraftDocument | null> {
  const blob = await getBlob(`craftdoc:${docId}`);
  if (!blob) return null;
  return parseCraftJson(await blob.text());
}

export async function loadCraftForAsset(assetId: string): Promise<CraftDocument | null> {
  const id = readIndex()[assetId];
  if (!id) return null;
  return loadCraftDoc(id);
}

export async function deleteCraftDoc(doc: CraftDocument, assetId?: string): Promise<void> {
  await deleteBlob(`craftdoc:${doc.id}`);
  if (assetId) {
    const index = readIndex();
    delete index[assetId];
    writeIndex(index);
  }
}

export async function deleteCraftForAsset(assetId: string): Promise<void> {
  const index = readIndex();
  const id = index[assetId];
  if (id) await deleteBlob(`craftdoc:${id}`);
  delete index[assetId];
  writeIndex(index);
}

/** Wipe every Craft document in this browser. Scan and Generate both start from empty boards. */
export async function purgeAllCraftDocs(): Promise<void> {
  await clearBlobs();
  writeIndex({});
}

export function pageSizeOf(doc: CraftDocument): { width: number; height: number } {
  const page = activePage(doc);
  return { width: page.width, height: page.height };
}
