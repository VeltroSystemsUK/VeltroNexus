import { create } from "zustand";
import { toast } from "sonner";
import type { CraftPost } from "@shared/craftQueue";
import { adaptPage, spawnSizes } from "./lib/adapt";
import { applyPostCopy, applyPostVisual, composeSocialPost, STRATA_BRAND } from "./lib/composePost";
import { applyImageLook, applyNodeMotion, applyNodeOpacity, nudgeNodeOrder, type ImageLookId, type ImageMotionId } from "./lib/looks";
import { fetchImageDataUrl, stockById } from "./lib/stock";
import { applyBrand, applyBrandLogo, cloneBrand, extractPaletteFromImage, isLogoSlot } from './lib/brand';
import { exportPack as exportFormatPack, exportRaster, rasterBlob } from "./lib/export";
import {
  alignNodes,
  hitTest,
  moveNodes,
  resizeNode,
  resizePage,
} from './lib/geometry';
import { cloneDocument } from './lib/types';
import { pushHistory, redoHistory, undoHistory } from './lib/history';
import { parseCraftJson } from './lib/persist';
import { fitPageInView } from "./canvas/viewport";
import {
  DESIGN_TEMPLATES,
  documentFromBlank,
  documentFromTemplate,
  makeImageNode,
  makeShapeNode,
  makeTextStyle,
  presetById,
  type TextStyleId,
} from './lib/templates';
import {
  activePage,
  type CraftAsset,
  type CraftBrand,
  type CraftDocument,
  type CraftNode,
  type CraftPage,
  type Handle,
  type ShapeVariant,
} from './lib/types';
import {
  craftFileName,
  loadBrandKit,
  loadBrandLogo,
  loadCraftForAsset,
  saveBrandKit,
  saveBrandLogo,
  saveCraftDoc,
} from "./persist";

export type CraftTool = 'select' | 'text' | 'shape' | 'image';

const PACK_IDS = ['story', 'square', 'og'] as const;

function fallbackFit(width: number, height: number) {
  if (typeof window === "undefined") return { zoom: 0.5, panX: 48, panY: 48 };
  return fitPageInView(width, height, Math.max(320, window.innerWidth - 640), Math.max(240, window.innerHeight - 180));
}

function withPage(doc: CraftDocument, pageId: string, fn: (page: CraftPage) => CraftPage): CraftDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => (page.id === pageId ? fn(page) : page)),
    updatedAt: new Date().toISOString(),
  };
}

function currentPage(doc: CraftDocument, pageId: string | null): CraftPage {
  return doc.pages.find((page) => page.id === (pageId ?? doc.activePageId)) ?? activePage(doc);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

async function attachPostVisual(doc: CraftDocument, post: CraftPost): Promise<CraftDocument> {
  const stockId = post.visual?.stockId;
  if (!stockId) return doc;
  if (doc.pages.some((page) => page.nodes.some((node) => node.type === "image" && node.name === "Visual"))) {
    return doc;
  }
  const photo = stockById(stockId);
  if (!photo) return doc;
  try {
    const dataUrl = await fetchImageDataUrl(photo.full);
    const asset: CraftAsset = {
      id: `visual_${post.id}`,
      name: photo.credit,
      mime: "image/jpeg",
      dataUrl,
    };
    return applyPostVisual(doc, asset);
  } catch {
    return doc;
  }
}

async function persistLocal(doc: CraftDocument, assetId?: string | null): Promise<string> {
  const id = assetId || doc.id;
  await saveCraftDoc(doc, id);
  return id;
}

interface CraftState {
  doc: CraftDocument | null;
  assetId: string | null;
  selectedIds: string[];
  editingTextId: string | null;
  pageId: string | null;
  tool: CraftTool;
  shapeVariant: ShapeVariant;
  dirty: boolean;
  releaseUnlocked: boolean;
  zoom: number;
  panX: number;
  panY: number;
  history: CraftDocument[];
  historyIndex: number;
  animOriginMs: number;

  setReleaseLock: (unlocked: boolean) => void;
  setTool: (tool: CraftTool) => void;
  setShapeVariant: (variant: ShapeVariant) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  fitView: (availW: number, availH: number) => void;
  setPage: (pageId: string) => void;
  select: (ids: string[], additive?: boolean) => void;
  beginTextEdit: (id: string) => void;
  endTextEdit: (text?: string) => void;
  beginGesture: () => void;
  close: () => void;

  newBlank: (opts?: { title?: string; presetId?: string }) => Promise<void>;
  openFromPost: (post: CraftPost) => Promise<void>;
  syncFromPost: (post: CraftPost) => void;
  openFromAsset: (asset: { id: string; name: string; mimeType: string }) => Promise<void>;
  openFromFile: (file: File) => Promise<void>;
  save: (opts?: { silent?: boolean }) => Promise<void>;

  addText: (x?: number, y?: number, style?: TextStyleId) => void;
  addShape: (variant?: ShapeVariant, x?: number, y?: number) => void;
  addImageFromFile: (file: File, x?: number, y?: number) => Promise<void>;
  applyTemplate: (templateId: string) => void;
  applyPreset: (presetId: string) => void;
  applyBrandKit: (brand?: CraftBrand) => void;
  saveBrandKit: () => void;
  setBrandLogo: (file: File) => Promise<void>;
  clearBrandLogo: () => void;
  updateBrand: (partial: Partial<Omit<CraftBrand, 'colors'>> & { colors?: Partial<CraftBrand['colors']> }) => void;
  updateTitle: (title: string) => void;
  updatePage: (updates: Partial<CraftPage>) => void;
  updateNode: (id: string, updates: Partial<CraftNode>) => void;
  replaceNodes: (nodes: CraftNode[]) => void;
  moveSelected: (dx: number, dy: number) => void;
  placeSelectedFrom: (origins: CraftNode[], dx: number, dy: number) => void;
  resizeFrom: (origin: CraftNode, handle: Exclude<Handle, 'rotate'>, dx: number, dy: number, lockAspect?: boolean) => void;
  rotateFrom: (origin: CraftNode, px: number, py: number) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  applyLook: (look: ImageLookId) => void;
  applyMotion: (motion: ImageMotionId) => void;
  applyYaffleVisual: (dataUrl: string) => void;
  setOpacity: (opacity: number) => void;
  nudgeZ: (direction: 1 | -1) => void;
  alignSelected: (dir: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') => void;
  spawnPackPages: () => void;
  exportPng: () => Promise<void>;
  exportPack: () => Promise<void>;
  exportFormats: () => Promise<void>;

  undo: () => void;
  redo: () => void;
  jumpHistory: (index: number) => void;
}

export const useCraftStore = create<CraftState>((set, get) => {
  const commit = (next: CraftDocument, record = true) => {
    if (record) {
      const { history, historyIndex } = get();
      const pushed = pushHistory(history, historyIndex, next);
      set({
        doc: next,
        pageId: next.activePageId,
        dirty: true,
        history: pushed.stack,
        historyIndex: pushed.index,
      });
      return;
    }
    set({ doc: next, pageId: next.activePageId, dirty: true });
  };

  const loadDocument = (doc: CraftDocument, assetId: string | null) => {
    const page = activePage(doc);
    set({
      doc,
      assetId,
      selectedIds: [],
      editingTextId: null,
      pageId: doc.activePageId,
      dirty: false,
      history: [cloneDocument(doc)],
      historyIndex: 0,
      animOriginMs: typeof performance !== "undefined" ? performance.now() : 0,
      ...fallbackFit(page.width, page.height),
    });
  };

  return {
    doc: null,
    assetId: null,
    selectedIds: [],
    editingTextId: null,
    pageId: null,
    tool: 'select',
    shapeVariant: 'rounded-rect',
    dirty: false,
    releaseUnlocked: true,
    zoom: 0.5,
    panX: 48,
    panY: 48,
    history: [],
    historyIndex: 0,
    animOriginMs: 0,

    setReleaseLock: (releaseUnlocked) => set({ releaseUnlocked }),
    setTool: (tool) => set({ tool }),
    setShapeVariant: (shapeVariant) => set({ shapeVariant, tool: 'shape' }),
    setZoom: (zoom) => set({ zoom: Math.min(8, Math.max(0.08, zoom)) }),
    setPan: (panX, panY) => set({ panX, panY }),
    fitView: (availW, availH) => {
      const { doc, pageId } = get();
      if (!doc) return;
      const page = currentPage(doc, pageId);
      set(fitPageInView(page.width, page.height, availW, availH));
    },
    setPage: (pageId) => {
      const { doc } = get();
      if (!doc || !doc.pages.some((page) => page.id === pageId)) return;
      set({
        pageId,
        selectedIds: [],
        editingTextId: null,
        doc: { ...doc, activePageId: pageId },
      });
    },
    select: (ids, additive) => set((state) => ({
      selectedIds: additive ? Array.from(new Set([...state.selectedIds, ...ids])) : ids,
      editingTextId: ids.length === 1 && ids[0] === state.editingTextId ? state.editingTextId : null,
    })),
    beginTextEdit: (id) => {
      const { doc, pageId } = get();
      if (!doc) return;
      const page = currentPage(doc, pageId);
      const node = page.nodes.find((item) => item.id === id);
      if (!node || node.type !== "text" || node.locked || node.hidden) return;
      set({ selectedIds: [id], editingTextId: id, tool: "select" });
    },
    endTextEdit: (text) => {
      const { editingTextId, doc, pageId } = get();
      if (!editingTextId || !doc) return;
      if (typeof text === "string") {
        const page = currentPage(doc, pageId);
        const node = page.nodes.find((item) => item.id === editingTextId);
        if (node?.type === "text" && node.text !== text) {
          get().updateNode(editingTextId, { text });
        }
      }
      set({ editingTextId: null });
    },
    beginGesture: () => {
      const { doc, history, historyIndex } = get();
      if (!doc) return;
      const pushed = pushHistory(history, historyIndex, doc);
      set({ history: pushed.stack, historyIndex: pushed.index });
    },
    close: () => set({
      doc: null,
      assetId: null,
      selectedIds: [],
      editingTextId: null,
      pageId: null,
      dirty: false,
      history: [],
      historyIndex: 0,
    }),

    newBlank: async ({ title, presetId } = {}) => {
      try {
        if (get().dirty) {
          try { await get().save({ silent: true }); } catch { /* continue */ }
        }
        const doc = documentFromBlank(presetId ?? "square", loadBrandKit(), title ?? "Untitled design");
        const id = await persistLocal(doc, doc.id);
        loadDocument(doc, id);
        toast.success("New design created");
      } catch (error) {
        console.error(error);
        toast.error("Could not create design");
      }
    },

    openFromPost: async (post) => {
      if (get().assetId === post.id && get().doc) return;
      try {
        if (get().dirty) {
          try { await get().save({ silent: true }); } catch { /* continue */ }
        }
        const existing = await loadCraftForAsset(post.id);
        if (existing) {
          const logo = loadBrandLogo();
          let doc = logo ? applyBrandLogo(existing, logo) : existing;
          doc = await attachPostVisual(doc, post);
          await persistLocal(doc, post.id);
          loadDocument(doc, post.id);
          return;
        }
        const saved = loadBrandKit();
        const brand = saved.name && saved.name !== "Studio" ? saved : STRATA_BRAND;
        let doc = composeSocialPost(post, brand, loadBrandLogo());
        doc = await attachPostVisual(doc, post);
        const id = await persistLocal(doc, post.id);
        loadDocument(doc, id);
      } catch (error) {
        console.error(error);
        toast.error("Could not compose that post");
      }
    },

    syncFromPost: (post) => {
      const { doc, assetId, history, historyIndex } = get();
      if (!doc || assetId !== post.id) return;
      const next = applyPostCopy(doc, post);
      const pushed = pushHistory(history, historyIndex, next);
      set({
        doc: next,
        pageId: next.activePageId,
        dirty: false,
        history: pushed.stack,
        historyIndex: pushed.index,
      });
      void persistLocal(next, post.id);
    },

    openFromAsset: async (asset) => {
      if (get().assetId === asset.id && get().doc) return;
      try {
        if (get().dirty) {
          try { await get().save({ silent: true }); } catch { /* continue */ }
        }
        const existing = await loadCraftForAsset(asset.id);
        if (existing) {
          loadDocument(existing, asset.id);
          return;
        }
        toast.message("Open a .craft.json design, or drop an image onto the board");
      } catch (error) {
        console.error(error);
        toast.error("Could not open design");
      }
    },

    openFromFile: async (file) => {
      const name = file.name.toLowerCase();
      if (file.type.startsWith("image/") && !name.endsWith(".json")) {
        if (!get().doc) await get().newBlank({ title: "Untitled design" });
        await get().addImageFromFile(file);
        return;
      }
      try {
        if (get().dirty) {
          try { await get().save({ silent: true }); } catch { /* continue */ }
        }
        const text = await file.text();
        const doc = parseCraftJson(text);
        const id = await persistLocal(doc, doc.id);
        loadDocument(doc, id);
        toast.success(`Opened ${craftFileName(doc.title)}`);
      } catch (error) {
        console.error(error);
        toast.error("That file is not a CRAFT design");
      }
    },

    save: async (opts) => {
      const { doc, assetId } = get();
      if (!doc) return;
      const next = { ...doc, updatedAt: new Date().toISOString() };
      const id = await persistLocal(next, assetId);
      set({ dirty: false, doc: next, assetId: id });
      if (!opts?.silent) toast.success("Saved");
    },

    addText: (x, y, style = 'heading') => {
      const { doc, pageId } = get();
      if (!doc) return;
      const page = currentPage(doc, pageId);
      const node = makeTextStyle(page, doc.brand, style, x, y);
      commit(withPage(doc, page.id, (current) => ({ ...current, nodes: [...current.nodes, node] })));
      set({ selectedIds: [node.id], tool: "select", editingTextId: node.id });
    },

    addShape: (variant, x, y) => {
      const { doc, pageId, shapeVariant } = get();
      if (!doc) return;
      const page = currentPage(doc, pageId);
      const node = makeShapeNode(page, doc.brand, variant ?? shapeVariant, x, y);
      commit(withPage(doc, page.id, (current) => ({ ...current, nodes: [...current.nodes, node] })));
      set({ selectedIds: [node.id], tool: 'select' });
    },

    addImageFromFile: async (file, x, y) => {
      const { doc, pageId } = get();
      if (!doc) return;
      try {
        const dataUrl = await fileToDataUrl(file);
        const asset: CraftAsset = {
          id: `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          mime: file.type || 'image/png',
          dataUrl,
        };
        const page = currentPage(doc, pageId);
        const node = makeImageNode(page, asset.id);
        if (x !== undefined) node.x = x;
        if (y !== undefined) node.y = y;
        const next: CraftDocument = {
          ...withPage(doc, page.id, (current) => ({ ...current, nodes: [...current.nodes, node] })),
          assets: [...doc.assets, asset],
        };
        commit(next);
        set({ selectedIds: [node.id], tool: 'select' });
        toast.success(`Placed ${file.name}`);
      } catch (error) {
        console.error(error);
        toast.error('Could not add image');
      }
    },

    applyTemplate: (templateId) => {
      const built = documentFromTemplate(templateId, get().doc?.brand ?? loadBrandKit());
      if (!DESIGN_TEMPLATES.some((item) => item.id === templateId) && !presetById(templateId)) {
        toast.message('Unknown template');
        return;
      }
      const { doc } = get();
      if (!doc) {
        void (async () => {
          try {
            const id = await persistLocal(built, built.id);
            loadDocument(built, id);
            toast.success(`Opened ${built.title}`);
          } catch (error) {
            console.error(error);
            toast.error("Could not open template");
          }
        })();
        return;
      }
      commit({
        ...doc,
        title: built.title,
        brand: built.brand,
        pages: built.pages,
        activePageId: built.activePageId,
        updatedAt: new Date().toISOString(),
      });
      set({ selectedIds: [] });
    },

    applyPreset: (presetId) => {
      const { doc, pageId } = get();
      if (!doc) {
        void get().newBlank({ presetId });
        return;
      }
      const preset = presetById(presetId);
      if (!preset) return;
      const page = currentPage(doc, pageId);
      const nextPage = adaptPage(page, preset.width, preset.height, preset.id);
      commit({
        ...doc,
        pages: doc.pages.map((item) => (item.id === page.id ? nextPage : item)),
        updatedAt: new Date().toISOString(),
      });
    },

    applyBrandKit: (brand) => {
      const { doc } = get();
      if (!doc) return;
      const next = brand ?? loadBrandKit();
      let stamped = applyBrand(doc, next);
      const logo = loadBrandLogo();
      stamped = applyBrandLogo(stamped, next.logoAssetId ? logo : null);
      commit(stamped);
    },

    saveBrandKit: () => {
      const { doc } = get();
      if (!doc) return;
      saveBrandKit(doc.brand);
      const logo = doc.assets.find((asset) => asset.id === doc.brand.logoAssetId) ?? null;
      saveBrandLogo(logo);
      toast.success(`Saved ${doc.brand.name || 'brand'} kit`);
    },

    setBrandLogo: async (file) => {
      const { doc } = get();
      if (!doc) return;
      if (file.size > 2.5 * 1024 * 1024) {
        toast.error("Logo must be under 2.5 MB");
        return;
      }
      if (!file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".svg")) {
        toast.error("Use a PNG, JPG, or SVG logo");
        return;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        const size = await new Promise<{ width: number; height: number } | undefined>((resolve) => {
          if (typeof Image === "undefined") return resolve(undefined);
          const img = new Image();
          img.onload = () => resolve({
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
          });
          img.onerror = () => resolve(undefined);
          img.src = dataUrl;
        });
        const asset: CraftAsset = {
          id: `logo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          mime: file.type || "image/png",
          dataUrl,
          ...(size?.width && size.height ? { width: size.width, height: size.height } : {}),
        };
        let colors = doc.brand.colors;
        try {
          colors = await extractPaletteFromImage(dataUrl);
        } catch {
          /* keep current colours if sampling fails */
        }
        const branded = applyBrand(doc, { ...doc.brand, colors, logoAssetId: asset.id });
        const next = applyBrandLogo(branded, asset);
        commit(next);
        saveBrandKit(next.brand);
        saveBrandLogo(asset);
        toast.success("Logo on the kit. Colours pulled from the file.");
      } catch (error) {
        console.error(error);
        toast.error("Could not read that logo");
      }
    },

    clearBrandLogo: () => {
      const { doc } = get();
      if (!doc) return;
      const next = applyBrandLogo(doc, null);
      commit(next);
      saveBrandKit(next.brand);
      saveBrandLogo(null);
      toast.success("Logo removed from the kit");
    },

    updateBrand: (partial) => {
      const { doc } = get();
      if (!doc) return;
      const nextBrand = cloneBrand({
        ...doc.brand,
        name: partial.name ?? doc.brand.name,
        headingFont: partial.headingFont ?? doc.brand.headingFont,
        bodyFont: partial.bodyFont ?? doc.brand.bodyFont,
        logoAssetId: partial.logoAssetId ?? doc.brand.logoAssetId,
        colors: { ...doc.brand.colors, ...partial.colors },
      });
      set({ doc: { ...doc, brand: nextBrand }, dirty: true });
    },

    updateTitle: (title) => {
      const { doc } = get();
      if (!doc) return;
      set({ doc: { ...doc, title: title.trim() || doc.title }, dirty: true });
    },

    updatePage: (updates) => {
      const { doc, pageId } = get();
      if (!doc) return;
      const page = currentPage(doc, pageId);
      commit(withPage(doc, page.id, (current) => ({ ...current, ...updates })));
    },

    updateNode: (id, updates) => {
      const { doc, pageId } = get();
      if (!doc) return;
      const page = currentPage(doc, pageId);
      commit(withPage(doc, page.id, (current) => ({
        ...current,
        nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...updates } as CraftNode : node)),
      })));
    },

    replaceNodes: (nodes) => {
      const { doc, pageId } = get();
      if (!doc) return;
      const page = currentPage(doc, pageId);
      commit(withPage(doc, page.id, (current) => ({ ...current, nodes })), false);
    },

    moveSelected: (dx, dy) => {
      const { doc, pageId, selectedIds } = get();
      if (!doc || selectedIds.length === 0) return;
      const page = currentPage(doc, pageId);
      const ids = new Set(selectedIds);
      commit(withPage(doc, page.id, (current) => ({
        ...current,
        nodes: moveNodes(current.nodes, ids, dx, dy),
      })), false);
    },

    placeSelectedFrom: (origins, dx, dy) => {
      const { doc, pageId } = get();
      if (!doc) return;
      const page = currentPage(doc, pageId);
      const moved = new Map(origins.map((node) => [node.id, { ...node, x: node.x + dx, y: node.y + dy }]));
      set({
        doc: withPage(doc, page.id, (current) => ({
          ...current,
          nodes: current.nodes.map((node) => moved.get(node.id) ?? node),
        })),
        dirty: true,
      });
    },

    resizeFrom: (origin, handle, dx, dy, lockAspect) => {
      const { doc, pageId } = get();
      if (!doc) return;
      const page = currentPage(doc, pageId);
      const next = resizeNode(origin, handle, dx, dy, lockAspect || isLogoSlot(origin));
      set({
        doc: withPage(doc, page.id, (current) => ({
          ...current,
          nodes: current.nodes.map((node) => (node.id === origin.id ? next : node)),
        })),
        dirty: true,
      });
    },

    rotateFrom: (origin, px, py) => {
      const { doc, pageId } = get();
      if (!doc) return;
      const page = currentPage(doc, pageId);
      const cx = origin.x + origin.width / 2;
      const cy = origin.y + origin.height / 2;
      const rotation = Math.round((Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90);
      set({
        doc: withPage(doc, page.id, (current) => ({
          ...current,
          nodes: current.nodes.map((node) => (node.id === origin.id ? { ...node, rotation } : node)),
        })),
        dirty: true,
      });
    },

    removeSelected: () => {
      const { doc, pageId, selectedIds } = get();
      if (!doc || selectedIds.length === 0) return;
      const page = currentPage(doc, pageId);
      const ids = new Set(selectedIds);
      commit(withPage(doc, page.id, (current) => ({
        ...current,
        nodes: current.nodes.filter((node) => !ids.has(node.id)),
      })));
      set({ selectedIds: [] });
    },

    duplicateSelected: () => {
      const { doc, pageId, selectedIds } = get();
      if (!doc || selectedIds.length === 0) return;
      const page = currentPage(doc, pageId);
      const copies = page.nodes
        .filter((node) => selectedIds.includes(node.id))
        .map((node) => ({
          ...structuredClone(node),
          id: `${node.type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          x: node.x + 24,
          y: node.y + 24,
          name: `${node.name} copy`,
        }));
      commit(withPage(doc, page.id, (current) => ({ ...current, nodes: [...current.nodes, ...copies] })));
      set({ selectedIds: copies.map((node) => node.id) });
    },

    applyYaffleVisual: (dataUrl) => {
      const { doc, assetId } = get();
      if (!doc || !dataUrl.startsWith("data:image/")) return;
      const asset: CraftAsset = {
        id: `image_${Date.now().toString(36)}`,
        name: "Image",
        mime: dataUrl.includes("jpeg") ? "image/jpeg" : "image/png",
        dataUrl,
      };
      const next = applyPostVisual(doc, asset, "plain");
      commit(next);
      void persistLocal(next, assetId);
    },
    applyLook: (look) => {
      const { doc, pageId, selectedIds } = get();
      if (!doc || !selectedIds.length) return;
      const page = currentPage(doc, pageId);
      commit(withPage(doc, page.id, (current) => ({
        ...current,
        nodes: current.nodes.map((node) => {
          if (!selectedIds.includes(node.id) || node.type !== "image") return node;
          return applyImageLook(node, look);
        }),
      })));
    },
    applyMotion: (motion) => {
      const { doc, pageId, selectedIds } = get();
      if (!doc || !selectedIds.length) return;
      const page = currentPage(doc, pageId);
      commit(withPage(doc, page.id, (current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          selectedIds.includes(node.id) ? applyNodeMotion(node, motion) : node
        ),
      })));
      set({ animOriginMs: typeof performance !== "undefined" ? performance.now() : 0 });
    },
    setOpacity: (opacity) => {
      const { doc, pageId, selectedIds } = get();
      if (!doc || !selectedIds.length) return;
      const page = currentPage(doc, pageId);
      commit(withPage(doc, page.id, (current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          selectedIds.includes(node.id) ? applyNodeOpacity(node, opacity) : node
        ),
      })));
    },
    nudgeZ: (direction) => {
      const { doc, pageId, selectedIds } = get();
      if (!doc || selectedIds.length !== 1) return;
      const page = currentPage(doc, pageId);
      commit(withPage(doc, page.id, (current) => ({
        ...current,
        nodes: nudgeNodeOrder(current.nodes, selectedIds[0]!, direction),
      })));
    },

    alignSelected: (dir) => {
      const { doc, pageId, selectedIds } = get();
      if (!doc) return;
      const page = currentPage(doc, pageId);
      commit(withPage(doc, page.id, (current) => ({
        ...current,
        nodes: alignNodes(current.nodes, selectedIds, dir, current),
      })));
    },

    spawnPackPages: () => {
      const { doc, pageId } = get();
      if (!doc) return;
      const page = currentPage(doc, pageId);
      const next = spawnSizes(doc, page.id, [...PACK_IDS]);
      if (next === doc) {
        toast.message('Pack sizes already exist');
        return;
      }
      commit(next);
      toast.success('Spawned story, square, and OG pages');
    },

    exportPng: async () => {
      const { doc, pageId, releaseUnlocked, assetId } = get();
      if (!doc) return;
      if (assetId?.startsWith("mkt-") && !releaseUnlocked) {
        toast.error("Compliance must sign off before export.");
        return;
      }
      const page = currentPage(doc, pageId);
      await exportRaster(page, doc.assets, doc.title, 'png');
    },

    exportPack: async () => {
      const { doc, pageId, releaseUnlocked, assetId } = get();
      if (!doc) return;
      if (assetId?.startsWith("mkt-") && !releaseUnlocked) {
        toast.error("Compliance must sign off before export.");
        return;
      }
      const page = currentPage(doc, pageId);
      for (const id of PACK_IDS) {
        const preset = presetById(id);
        if (!preset) continue;
        const adapted = adaptPage(page, preset.width, preset.height, preset.id);
        const { blob, filename } = await rasterBlob(adapted, doc.assets, `${doc.title}-${preset.name}`, "png");
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(href);
      }
      toast.success("Exported story, square, and OG");
    },

    exportFormats: async () => {
      const { doc, pageId, releaseUnlocked, assetId } = get();
      if (!doc) return;
      if (assetId?.startsWith("mkt-") && !releaseUnlocked) {
        toast.error("Compliance must sign off before export.");
        return;
      }
      const page = currentPage(doc, pageId);
      await exportFormatPack(doc, page);
    },

    undo: () => {
      const { history, historyIndex } = get();
      const result = undoHistory(history, historyIndex);
      if (!result) return;
      set({
        doc: result.document,
        pageId: result.document.activePageId,
        historyIndex: result.index,
        dirty: true,
        selectedIds: [],
      });
    },
    redo: () => {
      const { history, historyIndex } = get();
      const result = redoHistory(history, historyIndex);
      if (!result) return;
      set({
        doc: result.document,
        pageId: result.document.activePageId,
        historyIndex: result.index,
        dirty: true,
        selectedIds: [],
      });
    },
    jumpHistory: (index) => {
      const { history, historyIndex } = get();
      if (index === historyIndex || index < 0 || index >= history.length) return;
      if (index < historyIndex) {
        for (let i = 0; i < historyIndex - index; i++) get().undo();
      } else {
        for (let i = 0; i < index - historyIndex; i++) get().redo();
      }
    },
  };
});

export function pageOf(state: CraftState): CraftPage | null {
  if (!state.doc) return null;
  return currentPage(state.doc, state.pageId);
}

export function selectedNodesOf(state: CraftState): CraftNode[] {
  const page = pageOf(state);
  if (!page) return [];
  return page.nodes.filter((node) => state.selectedIds.includes(node.id));
}

export function hitNodeAt(state: CraftState, x: number, y: number): CraftNode | null {
  const page = pageOf(state);
  if (!page) return null;
  return hitTest(page.nodes, x, y);
}

export function resizePageTo(doc: CraftDocument, pageId: string, width: number, height: number, presetId?: string): CraftDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => (page.id === pageId ? resizePage(page, width, height, presetId) : page)),
    updatedAt: new Date().toISOString(),
  };
}
