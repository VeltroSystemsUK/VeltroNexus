import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  ArrowLeft,
  Download,
  FilePlus,
  Image as ImageIcon,
  MousePointer2,
  Redo2,
  Save,
  Square,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { panFromWheel, zoomToward } from "./canvas/viewport";
import { EmptyState } from "./shell/EmptyState";
import { CraftContextMenu } from "./shell/CraftContextMenu";
import { ShapeGlyph } from "./shell/glyphs";
import { ColorPicker, InspectorHint, InspectorRail, InspectorSection, InspectorSlider } from "./shell/Inspector";
import { LiveStatusBar } from "./shell/LiveStatusBar";
import { isTypingTarget, useAutosave } from "./hooks/useAutosave";
import { noteTyping, pulseMotion, setMotionBusy, setMotionFocus, snapshotMotionSignals } from "./lib/motionSignals";
import { COLOR_ROLES } from './lib/brand';
import { hitHandle, nodesInMarquee, pointInNode, type Rect } from './lib/geometry';
import { liveMotionIds } from "./lib/motion";
import { disposeAll, retainMotionNodes, setDensityScale, syncMotionLiveSet } from "./lib/motionRuntime";
import { MOTION_PRESETS, MOTION_PRESET_GROUPS } from "./lib/motionPresets";
import {
  clearMotionSessionWarning,
  getMotionSessionWarning,
  validateMotionSchema,
  type MotionBlending,
  type MotionFps,
  type MotionTrigger,
} from "./lib/motionSchema";
import { drawFrame } from './lib/renderer';
import {
  DEFAULT_BRAND,
  type ColorRole,
  type CraftNode,
  type Handle,
  type MotionNode,
  type MotionPreview,
  type TextAlign,
  type TextNode,
} from './lib/types';
import { FRAME_SHAPES, IMAGE_LOOKS, IMAGE_MOTIONS, SHADOW_PRESETS, pageHasMotion, toColorInput, type ImageLookId, type ImageMotionId } from "./lib/looks";
import { DESIGN_TEMPLATES, SHAPE_GROUPS, SHAPE_LABELS, SIZE_PRESETS, TEXT_STYLES } from './lib/templates';
import { FONT_WEIGHTS, STRATA_SITE_FONTS, documentFonts } from "./lib/fonts";
import { EMAIL_MERGE_CHIP } from "./lib/emailHtml";
import { canvasCopyLimit, copyPatchFromNode } from "./lib/composePost";
import { textOverlayBox } from "./lib/text";
import { pageOf, useCraftStore, type CraftTool } from "./store";
import { type CraftCopyPatch } from "@shared/craftQueue";
import { reviewWeekPage, weekContractReminder } from "./lib/weekGrammar";
import type { AssetSource, WeekRoute } from "./lib/types";
import { Checkbox } from "@/components/ui/checkbox";

const TOOLS: { id: CraftTool; label: string; shortcut: string; icon: typeof Type }[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
  { id: 'text', label: 'Text', shortcut: 'T', icon: Type },
  { id: 'shape', label: 'Shape', shortcut: 'S', icon: Square },
  { id: 'image', label: 'Image', shortcut: 'I', icon: ImageIcon },
];

const KEYS: Record<string, CraftTool> = {
  v: 'select',
  t: 'text',
  s: 'shape',
  i: 'image',
};

const LOCKED_EXPORT = "opacity-40 grayscale bg-muted text-muted-foreground border-muted shadow-none";

const ROUTES: { id: WeekRoute; label: string }[] = [
  { id: "sharp-cultural", label: "Sharp cultural" },
  { id: "safe-distinctive", label: "Safe distinctive" },
  { id: "beautiful-insane", label: "Beautiful insane" },
];

const MEDIA_SOURCES: { id: AssetSource | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "analog-capture", label: "Analog" },
  { id: "motion-capture", label: "Motion" },
  { id: "generated", label: "Generated" },
  { id: "upload", label: "Upload" },
];

export type CraftYaffleProps = {
  ok?: boolean;
  message?: string;
  prompt: string;
  generating?: boolean;
  progress?: string;
  onGenerate: (prompt: string) => void;
};

export function CraftView({
  onClose,
  onCopyChange,
  yaffle,
  mode = "social",
}: {
  onClose?: () => void;
  onCopyChange?: (patch: CraftCopyPatch) => void;
  yaffle?: CraftYaffleProps;
  mode?: "social" | "email";
} = {}) {
  const doc = useCraftStore((state) => state.doc);
  const dirty = useCraftStore((state) => state.dirty);
  const releaseUnlocked = useCraftStore((state) => state.releaseUnlocked);
  const assetId = useCraftStore((state) => state.assetId);
  const pageId = useCraftStore((state) => state.pageId);
  const editingTextId = useCraftStore((state) => state.editingTextId);
  const weekPage = doc ? (doc.pages.find((item) => item.id === (pageId ?? doc.activePageId)) ?? doc.pages[0]) : null;
  const weekReasons = doc?.week && weekPage ? reviewWeekPage(weekPage).findings.map((item) => item.message) : [];
  const exportLocked =
    Boolean(assetId?.startsWith("mkt-") && !releaseUnlocked) ||
    Boolean(doc?.week && weekPage && !reviewWeekPage(weekPage).ok);
  const exportReason = weekReasons.join(" ") || (exportLocked ? "Marketing approve, then compliance sign-off, then export." : undefined);
  const imageInput = useRef<HTMLInputElement>(null);
  useAutosave(dirty, () => useCraftStore.getState().save({ silent: true }));

  useEffect(() => {
    pulseMotion("pane");
  }, [pageId]);

  useEffect(() => {
    setMotionFocus(Boolean(editingTextId));
  }, [editingTextId]);

  useEffect(() => {
    setMotionBusy(Boolean(yaffle?.generating));
    return () => setMotionBusy(false);
  }, [yaffle?.generating]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) noteTyping();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { getInputProps, getRootProps, open } = useDropzone({
    noClick: true,
    noKeyboard: true,
    accept: {
      'application/json': ['.json', '.craft.json'],
      'image/*': [],
    },
    onDrop: (files) => {
      if (files[0]) {
        pulseMotion("dock");
        void useCraftStore.getState().openFromFile(files[0]);
      }
    },
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const state = useCraftStore.getState();
      if (!state.doc) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? state.redo() : state.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void state.save();
        return;
      }
      if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        state.duplicateSelected();
        return;
      }
      if (event.key === 'Escape') {
        if (state.editingTextId) {
          state.endTextEdit();
          return;
        }
        state.select([]);
        state.setTool('select');
        return;
      }
      if (event.key === 'Enter' && !mod) {
        const page = pageOf(state);
        const selected = page?.nodes.filter((node) => state.selectedIds.includes(node.id));
        if (selected?.length === 1 && selected[0].type === 'text') {
          event.preventDefault();
          state.beginTextEdit(selected[0].id);
          return;
        }
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (state.editingTextId) return;
        event.preventDefault();
        state.removeSelected();
        return;
      }
      if (event.key.startsWith('Arrow') && state.selectedIds.length) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
        state.moveSelected(dx, dy);
        return;
      }
      const tool = KEYS[event.key.toLowerCase()];
      if (tool && !mod) state.setTool(tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!doc) {
    return (
      <div
        {...getRootProps({ className: "flex h-full min-h-0 flex-col overflow-hidden" })}
      >
        <input {...getInputProps()} />
        <div className="min-h-0 flex-1">
          <EmptyState
            title="New design"
            body="Start from a LinkedIn banner (1584×396), a 1080×1080 square, or pick a template. Brand once, resize to story / square / OG, and export."
            actions={(
              <>
                <Button onClick={() => useCraftStore.getState().applyTemplate("linkedin-banner")}>
                  LinkedIn banner
                </Button>
                <Button variant="outline" onClick={() => void useCraftStore.getState().newBlank()}>
                  <FilePlus />
                  New design
                </Button>
                <Button variant="outline" onClick={open}>Open file</Button>
              </>
            )}
          />
        </div>
        <TemplateStrip empty />
      </div>
    );
  }

  const page = pageOf(useCraftStore.getState());

  return (
    <div
      {...getRootProps({ className: "flex h-full min-h-0 flex-1 flex-col overflow-hidden" })}
    >
      <div className="flex h-10 items-center gap-2 border-b border-[var(--border-subtle)] px-3">
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
          value={doc.title}
          aria-label="Design title"
          onChange={(event) => useCraftStore.getState().updateTitle(event.target.value)}
        />
        {dirty && <span className="text-[var(--craft-accent)]">•</span>}
        <span className="text-xs text-muted-foreground">
          {page ? `${page.width} × ${page.height}` : ''}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {onClose && mode !== "email" && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              <ArrowLeft />
              Queue
            </Button>
          )}
          <Button size="icon" variant="ghost" aria-label="Undo" onClick={() => useCraftStore.getState().undo()}>
            <Undo2 />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Redo" onClick={() => useCraftStore.getState().redo()}>
            <Redo2 />
          </Button>
          {mode !== "email" && (
            <>
              <Button size="sm" variant="outline" onClick={() => void useCraftStore.getState().save()}>
                <Save />
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={exportLocked}
                aria-disabled={exportLocked}
                title={exportReason}
                className={exportLocked ? LOCKED_EXPORT : undefined}
                onClick={() => void useCraftStore.getState().exportPng()}
              >
                <Download />
                PNG
              </Button>
              <Button
                size="sm"
                variant={exportLocked ? "outline" : "default"}
                disabled={exportLocked}
                aria-disabled={exportLocked}
                title={exportReason}
                className={exportLocked ? LOCKED_EXPORT : undefined}
                onClick={() => void useCraftStore.getState().exportPack()}
              >
                Export pack
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onClose?.();
                  void useCraftStore.getState().newBlank();
                }}
              >
                New
              </Button>
              <Button size="sm" variant="ghost" onClick={open}>Open</Button>
            </>
          )}
          {onClose && mode !== "email" && (
            <Button size="icon" variant="ghost" aria-label="Close design" onClick={onClose}>
              <X />
            </Button>
          )}
        </div>
      </div>
      <input {...getInputProps()} />
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void useCraftStore.getState().addImageFromFile(file);
          event.currentTarget.value = '';
        }}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <CraftTools onPickImage={() => imageInput.current?.click()} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {doc.week && <WeekRail />}
          <CraftCanvas onPickImage={() => imageInput.current?.click()} onCopyChange={onCopyChange} />
          <LiveStatusBar
            getZoom={() => useCraftStore.getState().zoom}
            subscribe={(fn) => useCraftStore.subscribe(fn)}
            onZoomOut={() => useCraftStore.getState().setZoom(useCraftStore.getState().zoom / 1.15)}
            onZoomIn={() => useCraftStore.getState().setZoom(useCraftStore.getState().zoom * 1.15)}
            onReset={() => {
              const host = document.querySelector("[data-craft-canvas]");
              const box = host?.getBoundingClientRect();
              if (box && box.width > 40 && box.height > 40) {
                useCraftStore.getState().fitView(box.width, box.height);
              }
            }}
            trailing={dirty ? 'Unsaved' : 'Saved'}
          />
        </div>
        <CraftInspector onPickImage={() => imageInput.current?.click()} onCopyChange={onCopyChange} yaffle={yaffle} mode={mode} />
      </div>
    </div>
  );
}

function WeekRail() {
  const doc = useCraftStore((state) => state.doc);
  const pageId = useCraftStore((state) => state.pageId);
  if (!doc?.week) return null;
  const active = doc.pages.find((page) => page.id === (pageId ?? doc.activePageId));
  return (
    <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] px-3 py-1.5">
      {doc.pages.filter((page) => page.daySlot).map((page) => (
        <Button
          key={page.id}
          size="sm"
          variant={page.id === active?.id ? "secondary" : "ghost"}
          onClick={() => useCraftStore.getState().setPage(page.id)}
        >
          {page.name}
        </Button>
      ))}
    </div>
  );
}

function ComplianceBadges({ zoom, panX, panY }: { zoom: number; panX: number; panY: number }) {
  const doc = useCraftStore((state) => state.doc);
  const pageId = useCraftStore((state) => state.pageId);
  if (!doc?.week) return null;
  const page = doc.pages.find((item) => item.id === (pageId ?? doc.activePageId)) ?? doc.pages[0];
  if (!page) return null;
  return (
    <>
      {reviewWeekPage(page).findings.filter((item) => item.nodeId).map((item) => {
        const node = page.nodes.find((entry) => entry.id === item.nodeId);
        if (!node) return null;
        return (
          <div
            key={`${item.nodeId}-${item.code}`}
            className="pointer-events-none absolute z-10 max-w-[14rem] rounded-sm bg-red-600 px-1.5 py-0.5 text-[9px] leading-tight text-white"
            style={{ left: panX + node.x * zoom, top: panY + node.y * zoom - 16 }}
          >
            {item.message}
          </div>
        );
      })}
    </>
  );
}

function MediaTray({ onPickImage }: { onPickImage: () => void }) {
  const doc = useCraftStore((state) => state.doc);
  const mediaSource = useCraftStore((state) => state.mediaSource);
  if (!doc) return null;
  const assets = doc.assets.filter((asset) => {
    if (mediaSource === "all") return true;
    if (!asset.source) return mediaSource === "upload";
    return asset.source === mediaSource;
  });
  const analogEmpty = !doc.assets.some((asset) => asset.source === "analog-capture");
  return (
    <div className="space-y-2">
      <p className="font-[family-name:var(--font-ui)] text-[10px] font-bold tracking-[0.14em] text-[var(--suite-accent)] uppercase">
        Media tray
      </p>
      <div className="flex flex-wrap gap-1">
        {MEDIA_SOURCES.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={mediaSource === item.id ? "secondary" : "ghost"}
            onClick={() => useCraftStore.getState().setMediaSource(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {analogEmpty && <InspectorHint>no analog still — shoot or scan</InspectorHint>}
      {assets.length > 0 && (
        <div className="grid grid-cols-3 gap-1">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              title={asset.name}
              className="overflow-hidden rounded-sm border border-input bg-white"
              onClick={() => useCraftStore.getState().hangAsset(asset.id)}
            >
              <img src={asset.dataUrl} alt={asset.name} className="h-14 w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <Button size="sm" variant="outline" className="w-full" onClick={onPickImage}>
        Add still
      </Button>
    </div>
  );
}

function CraftTools({ onPickImage }: { onPickImage: () => void }) {
  const tool = useCraftStore((state) => state.tool);
  return (
    <aside className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-r border-[var(--border-subtle)] bg-sidebar py-2">
      {TOOLS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            title={`${item.label} (${item.shortcut})`}
            aria-label={item.label}
            aria-pressed={tool === item.id}
            data-tool={item.id}
            onClick={() => {
              if (item.id === 'image') {
                onPickImage();
                useCraftStore.getState().setTool('image');
                return;
              }
              useCraftStore.getState().setTool(item.id);
            }}
            className={cn(
              'flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-[120ms] hover:bg-sidebar-accent hover:text-foreground',
              tool === item.id && 'bg-sidebar-accent text-[var(--craft-accent)]',
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </aside>
  );
}

function CraftCanvas({
  onPickImage,
  onCopyChange,
}: {
  onPickImage: () => void;
  onCopyChange?: (patch: CraftCopyPatch) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerPage = useRef<{ x: number; y: number } | null>(null);
  const clickPage = useRef<{ x: number; y: number } | null>(null);
  const spaceHeld = useRef(false);
  const altHeld = useRef(false);
  const fpsSample = useRef({ last: 0, frames: 0, fps: 0 });
  const drag = useRef<{
    mode: 'pan' | 'move' | 'resize' | 'rotate' | 'marquee';
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    handle?: Exclude<Handle, 'rotate'>;
    origin?: CraftNode;
    origins?: CraftNode[];
    moved?: boolean;
  } | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [needsPaint, setNeedsPaint] = useState(0);
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId: string | null } | null>(null);
  const [hud, setHud] = useState<{ fps: number; live: number } | null>(null);

  const doc = useCraftStore((state) => state.doc);
  const pageId = useCraftStore((state) => state.pageId);
  const selectedIds = useCraftStore((state) => state.selectedIds);
  const editingTextId = useCraftStore((state) => state.editingTextId);
  const tool = useCraftStore((state) => state.tool);
  const zoom = useCraftStore((state) => state.zoom);
  const panX = useCraftStore((state) => state.panX);
  const panY = useCraftStore((state) => state.panY);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeld.current = true;
      if (event.key === 'Alt') {
        altHeld.current = true;
        setNeedsPaint((n) => n + 1);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceHeld.current = false;
      if (event.key === 'Alt') {
        altHeld.current = false;
        const pinned = typeof localStorage !== 'undefined' && localStorage.craftMotionHud === '1';
        if (!pinned) {
          setDensityScale(1);
          setHud(null);
        }
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let raf = 0;
    let live = true;
    const paint = () => {
      raf = 0;
      const state = useCraftStore.getState();
      const page = pageOf(state);
      if (!page || !state.doc) return;
      const dpr = window.devicePixelRatio || 1;
      const w = host.clientWidth;
      const h = host.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = getComputedStyle(host).getPropertyValue('--bg-base') || '#0a0a0f';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(state.panX, state.panY);
      ctx.scale(state.zoom, state.zoom);
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 24 / state.zoom;
      ctx.fillStyle = page.background.color;
      ctx.fillRect(0, 0, page.width, page.height);
      ctx.shadowColor = 'transparent';
      const motion = pageHasMotion(page.nodes);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const liveIds = liveMotionIds(page.nodes, state.selectedIds, 2, {
        panX: state.panX,
        panY: state.panY,
        zoom: state.zoom,
        hostW: w,
        hostH: h,
      });
      retainMotionNodes(page.nodes.filter((node) => node.type === "motion").map((node) => node.id));
      syncMotionLiveSet(liveIds);
      const now = performance.now();
      const sample = fpsSample.current;
      if (!sample.last) sample.last = now;
      sample.frames += 1;
      if (now - sample.last >= 500) {
        sample.fps = Math.round((sample.frames * 1000) / Math.max(1, now - sample.last));
        sample.frames = 0;
        sample.last = now;
      }
      const hudOn =
        altHeld.current || (typeof localStorage !== 'undefined' && localStorage.craftMotionHud === '1');
      if (hudOn) {
        setDensityScale(sample.fps > 0 && sample.fps < 24 ? 0.8 : 1);
        const next = { fps: sample.fps, live: liveIds.size };
        setHud((prev) => (prev && prev.fps === next.fps && prev.live === next.live ? prev : next));
      } else {
        setDensityScale(1);
        setHud((prev) => (prev ? null : prev));
      }
      drawFrame(ctx, page, state.doc.assets, {
        selectedIds: state.selectedIds,
        zoom: state.zoom,
        showHandles: true,
        marquee,
        hideIds: state.editingTextId ? [state.editingTextId] : undefined,
        atMs: motion ? performance.now() - state.animOriginMs : Infinity,
        onImage: () => setNeedsPaint((n) => n + 1),
        motion: {
          liveIds,
          pointer: pointerPage.current,
          click: clickPage.current,
          reduced,
          signals: snapshotMotionSignals(),
        },
      });
      clickPage.current = null;
      ctx.restore();
      if (motion && live && !reduced) raf = requestAnimationFrame(paint);
    };
    paint();
    const unsub = useCraftStore.subscribe(() => {
      if (!raf) paint();
    });
    const ro = new ResizeObserver(() => {
      if (!raf) paint();
    });
    ro.observe(host);
    return () => {
      live = false;
      if (raf) cancelAnimationFrame(raf);
      unsub();
      ro.disconnect();
    };
  }, [doc, pageId, selectedIds, zoom, panX, panY, marquee, needsPaint]);

  useEffect(() => {
    return () => {
      disposeAll();
    };
  }, [doc?.id, pageId]);
  const toPage = (clientX: number, clientY: number) => {
    const rect = hostRef.current!.getBoundingClientRect();
    const { zoom: z, panX: x, panY: y } = useCraftStore.getState();
    return {
      x: (clientX - rect.left - x) / z,
      y: (clientY - rect.top - y) / z,
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const pt = toPage(event.clientX, event.clientY);
    pointerPage.current = pt;
    clickPage.current = pt;
    pulseMotion("link");
    const state = useCraftStore.getState();
    const page = pageOf(state);
    if (!page) return;

    if (event.button === 1 || spaceHeld.current) {
      drag.current = {
        mode: 'pan',
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
      };
      return;
    }

    if (state.tool === 'text') {
      state.addText(pt.x, pt.y);
      return;
    }
    if (state.tool === 'shape') {
      state.addShape(state.shapeVariant, pt.x, pt.y);
      return;
    }
    if (state.tool === 'image') {
      onPickImage();
      return;
    }

    const selected = page.nodes.filter((node) => state.selectedIds.includes(node.id));
    if (selected.length === 1) {
      const handle = hitHandle(selected[0], pt.x, pt.y, state.zoom);
      if (handle === 'rotate') {
        state.beginGesture();
        drag.current = {
          mode: 'rotate',
          startX: pt.x,
          startY: pt.y,
          lastX: pt.x,
          lastY: pt.y,
          origin: selected[0],
        };
        return;
      }
      if (handle) {
        state.beginGesture();
        drag.current = {
          mode: 'resize',
          startX: pt.x,
          startY: pt.y,
          lastX: pt.x,
          lastY: pt.y,
          handle,
          origin: selected[0],
        };
        return;
      }
    }

    const hit = page.nodes.slice().reverse().find((node) => {
      if (node.hidden || node.locked) return false;
      return pointInNode(pt.x, pt.y, node);
    });
    if (hit) {
      const nextIds = event.shiftKey
        ? (state.selectedIds.includes(hit.id)
          ? state.selectedIds.filter((id) => id !== hit.id)
          : [...state.selectedIds, hit.id])
        : (state.selectedIds.includes(hit.id) ? state.selectedIds : [hit.id]);
      state.select(nextIds);
      const origins = page.nodes.filter((node) => nextIds.includes(node.id));
      state.beginGesture();
      drag.current = {
        mode: 'move',
        startX: pt.x,
        startY: pt.y,
        lastX: pt.x,
        lastY: pt.y,
        origins,
      };
      return;
    }

    if (!event.shiftKey) state.select([]);
    drag.current = {
      mode: 'marquee',
      startX: pt.x,
      startY: pt.y,
      lastX: pt.x,
      lastY: pt.y,
    };
    setMarquee({ x: pt.x, y: pt.y, width: 0, height: 0 });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerPage.current = toPage(event.clientX, event.clientY);
    const current = drag.current;
    if (!current) return;
    const state = useCraftStore.getState();
    if (current.mode === 'pan') {
      state.setPan(
        state.panX + (event.clientX - current.lastX),
        state.panY + (event.clientY - current.lastY),
      );
      current.lastX = event.clientX;
      current.lastY = event.clientY;
      return;
    }
    const pt = toPage(event.clientX, event.clientY);
    if (current.mode === 'move' && current.origins) {
      current.moved = true;
      state.placeSelectedFrom(current.origins, pt.x - current.startX, pt.y - current.startY);
      return;
    }
    if (current.mode === 'resize' && current.origin && current.handle) {
      current.moved = true;
      state.resizeFrom(current.origin, current.handle, pt.x - current.startX, pt.y - current.startY, event.shiftKey);
      return;
    }
    if (current.mode === 'rotate' && current.origin) {
      current.moved = true;
      state.rotateFrom(current.origin, pt.x, pt.y);
      return;
    }
    if (current.mode === 'marquee') {
      setMarquee({
        x: current.startX,
        y: current.startY,
        width: pt.x - current.startX,
        height: pt.y - current.startY,
      });
    }
  };

  const onPointerUp = () => {
    const current = drag.current;
    const state = useCraftStore.getState();
    const page = pageOf(state);
    if (current?.mode === 'marquee' && page && marquee) {
      const hits = nodesInMarquee(page.nodes, marquee);
      state.select(hits.map((node) => node.id), Boolean(current.origins));
    }
    if (current?.moved && state.doc) {
      const next = { ...state.doc, updatedAt: new Date().toISOString() };
      useCraftStore.setState({ doc: next, dirty: true });
      pulseMotion("dock");
    }
    drag.current = null;
    setMarquee(null);
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let fitted = false;
    const fit = () => {
      const box = host.getBoundingClientRect();
      if (box.width < 40 || box.height < 40) return false;
      useCraftStore.getState().fitView(box.width, box.height);
      return true;
    };
    if (fit()) fitted = true;
    const ro = new ResizeObserver(() => {
      if (fitted) return;
      if (fit()) fitted = true;
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, [doc?.id, pageId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const state = useCraftStore.getState();
      if (event.ctrlKey || event.metaKey) {
        const rect = host.getBoundingClientRect();
        const next = zoomToward({
          zoom: state.zoom,
          panX: state.panX,
          panY: state.panY,
          originX: rect.left,
          originY: rect.top,
          clientX: event.clientX,
          clientY: event.clientY,
          factor: event.deltaY > 0 ? 1 / 1.08 : 1.08,
        });
        useCraftStore.setState({ zoom: next.zoom, panX: next.panX, panY: next.panY });
        return;
      }
      const pan = panFromWheel(event.deltaX, event.deltaY, event.shiftKey);
      state.setPan(state.panX + pan.dx, state.panY + pan.dy);
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  }, []);

  const editingNode = (() => {
    if (!editingTextId) return null;
    const page = pageOf(useCraftStore.getState());
    const node = page?.nodes.find((item) => item.id === editingTextId);
    return node?.type === "text" ? node : null;
  })();

  const onContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pt = toPage(event.clientX, event.clientY);
    const state = useCraftStore.getState();
    const page = pageOf(state);
    if (!page) return;
    const hit = page.nodes.slice().reverse().find((node) => {
      if (node.hidden || node.locked) return false;
      return pointInNode(pt.x, pt.y, node);
    });
    if (hit) state.select([hit.id]);
    else state.select([]);
    setMenu({ x: event.clientX, y: event.clientY, nodeId: hit?.id ?? null });
  };

  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const pt = toPage(event.clientX, event.clientY);
    const state = useCraftStore.getState();
    const page = pageOf(state);
    if (!page) return;
    const hit = page.nodes.slice().reverse().find((node) => {
      if (node.hidden || node.locked) return false;
      return pointInNode(pt.x, pt.y, node);
    });
    if (hit?.type === "text") {
      event.preventDefault();
      drag.current = null;
      state.beginTextEdit(hit.id);
    }
  };

  return (
    <div
      ref={hostRef}
      data-craft-canvas
      className="relative min-h-0 flex-1 cursor-crosshair touch-none overflow-hidden bg-[var(--bg-base)]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => {
        pointerPage.current = null;
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      <ComplianceBadges zoom={zoom} panX={panX} panY={panY} />
      {hud && (
        <div
          className="pointer-events-none absolute top-2 left-2 z-20 rounded bg-black/70 px-2 py-1 font-mono text-[11px] text-zinc-100"
          aria-hidden
        >
          {hud.fps} fps · {hud.live} live
        </div>
      )}
      <TypeBar />
      {menu && (
        <CraftContextMenu
          x={menu.x}
          y={menu.y}
          node={pageOf(useCraftStore.getState())?.nodes.find((item) => item.id === menu.nodeId) ?? null}
          onClose={() => setMenu(null)}
          onPickImage={onPickImage}
          onEditText={() => {
            if (menu.nodeId) useCraftStore.getState().beginTextEdit(menu.nodeId);
          }}
        />
      )}
      {editingNode && (
        <TextEditOverlay
          node={editingNode}
          zoom={zoom}
          panX={panX}
          panY={panY}
          onCommit={(text) => {
            useCraftStore.getState().endTextEdit(text);
            const patch = copyPatchFromNode(editingNode.name, text);
            if (patch) onCopyChange?.(patch);
          }}
          onCancel={() => useCraftStore.getState().endTextEdit()}
        />
      )}
    </div>
  );
}

function TextEditOverlay({
  node,
  zoom,
  panX,
  panY,
  onCommit,
  onCancel,
}: {
  node: TextNode;
  zoom: number;
  panX: number;
  panY: number;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(node.text);
  const box = textOverlayBox(node, zoom, panX, panY);
  const maxLength = canvasCopyLimit(node.name, useCraftStore.getState().assetId);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  return (
    <textarea
      ref={ref}
      aria-label="Edit text"
      value={value}
      maxLength={maxLength}
      onChange={(event) => {
        noteTyping();
        setValue(event.target.value);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onBlur={() => onCommit(value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onCommit(value);
        }
      }}
      className="absolute z-10 resize-none overflow-hidden rounded-sm border border-[var(--craft-accent)] bg-black/75 p-1 outline-none"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        fontSize: box.fontSize,
        fontFamily: box.fontFamily,
        fontWeight: box.fontWeight,
        color: box.color,
        textAlign: box.textAlign,
        letterSpacing: box.letterSpacing,
        lineHeight: box.lineHeight,
        transform: box.transform,
        transformOrigin: "center center",
        textTransform: node.uppercase ? "uppercase" : undefined,
        touchAction: "auto",
      }}
    />
  );
}

function DescribeCurrentField() {
  const [phrase, setPhrase] = useState("");
  return (
    <div className="space-y-1.5">
      <label className="grid gap-1 text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
        Describe a current
        <Input
          value={phrase}
          aria-label="Describe a current"
          placeholder="liquid glass wave sparks"
          className="text-xs normal-case tracking-normal"
          onChange={(event) => setPhrase(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && phrase.trim()) {
              event.preventDefault();
              useCraftStore.getState().applyCurrentDescription(phrase.trim());
            }
          }}
        />
      </label>
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        disabled={!phrase.trim()}
        onClick={() => useCraftStore.getState().applyCurrentDescription(phrase.trim())}
      >
        Apply current
      </Button>
    </div>
  );
}

function YafflePanel({ yaffle }: { yaffle: CraftYaffleProps }) {
  const [prompt, setPrompt] = useState(yaffle.prompt);
  useEffect(() => {
    setPrompt(yaffle.prompt);
  }, [yaffle.prompt]);
  return (
    <div className="space-y-2">
      <Textarea
        value={prompt}
        rows={5}
        aria-label="Image prompt"
        className="min-h-[6rem] text-xs"
        onChange={(event) => setPrompt(event.target.value)}
      />
      <Button
        size="sm"
        className="w-full"
        disabled={yaffle.generating || !prompt.trim()}
        onClick={() => yaffle.onGenerate(prompt)}
      >
        {yaffle.generating ? yaffle.progress || "Generating…" : "Generate still"}
      </Button>
    </div>
  );
}

function CraftInspector({
  onPickImage,
  onCopyChange,
  yaffle,
  mode = "social",
}: {
  onPickImage: () => void;
  onCopyChange?: (patch: CraftCopyPatch) => void;
  yaffle?: CraftYaffleProps;
  mode?: "social" | "email";
}) {
  const logoInput = useRef<HTMLInputElement>(null);
  const doc = useCraftStore((state) => state.doc);
  const pageId = useCraftStore((state) => state.pageId);
  const selectedIds = useCraftStore((state) => state.selectedIds);
  const releaseUnlocked = useCraftStore((state) => state.releaseUnlocked);
  const assetId = useCraftStore((state) => state.assetId);
  const history = useCraftStore((state) => state.history);
  const historyIndex = useCraftStore((state) => state.historyIndex);
  const shapeVariant = useCraftStore((state) => state.shapeVariant);
  const gifProgress = useCraftStore((state) => state.gifProgress);
  const firstFrameSettled = useCraftStore((state) => state.firstFrameSettled);
  const page = doc ? (doc.pages.find((item) => item.id === (pageId ?? doc.activePageId)) ?? doc.pages[0]) : null;
  if (!doc || !page) return null;
  const selected = page.nodes.filter((item) => selectedIds.includes(item.id));
  const node = selected[0];
  const textNode = node?.type === "text" ? node : null;
  const weekReasons = doc.week ? reviewWeekPage(page).findings.map((item) => item.message) : [];
  const exportLocked =
    Boolean(assetId?.startsWith("mkt-") && !releaseUnlocked) ||
    Boolean(doc.week && !reviewWeekPage(page).ok);
  const exportReason = weekReasons.join(" ") || (exportLocked ? "Marketing approve, then compliance sign-off, then export." : undefined);

  return (
    <InspectorRail
      title={mode === "email" ? "TEMPLATE" : "SWELL"}
      className="font-[family-name:var(--font-sans)]"
      lead={mode !== "email" ? <MediaTray onPickImage={onPickImage} /> : undefined}
    >
      <InspectorSection title="Type">
        {textNode ? (
          <TextTypeFields node={textNode} onCopyChange={onCopyChange} />
        ) : (
          <InspectorHint>Click a headline or any line on the board. Typefaces open here — Unbounded is the Strata hero.</InspectorHint>
        )}
      </InspectorSection>
      <InspectorSection title="Page">
        <div className="flex flex-wrap gap-1">
          {doc.pages.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={item.id === page.id ? 'secondary' : 'ghost'}
              onClick={() => useCraftStore.getState().setPage(item.id)}
            >
              {item.name}
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{page.width} × {page.height}</p>
        <ColorPicker
          label="Background"
          value={page.background.color}
          onChange={(color) => useCraftStore.getState().updatePage({
            background: { ...page.background, color },
          })}
        />
        {doc.week && page.daySlot && (
          <div className="space-y-2">
            <InspectorHint>{weekContractReminder(page.daySlot)}</InspectorHint>
            <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Route</p>
            <div className="grid gap-1">
              {ROUTES.map((route) => (
                <Button
                  key={route.id}
                  size="sm"
                  variant={doc.week?.route === route.id ? "secondary" : "ghost"}
                  className="justify-start"
                  onClick={() => useCraftStore.getState().setWeekRoute(route.id)}
                >
                  {route.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </InspectorSection>

      {mode === "email" && (
        <InspectorSection title="Merge">
          <InspectorHint>Click a tag onto the selected text. Campaigns replace these when they send.</InspectorHint>
          <div className="flex flex-wrap gap-1">
            {EMAIL_MERGE_CHIP.map((item) => (
              <Button
                key={item.tag}
                size="sm"
                variant="outline"
                title={item.description}
                onClick={() => useCraftStore.getState().insertMergeTag(item.tag)}
              >
                {item.tag}
              </Button>
            ))}
          </div>
        </InspectorSection>
      )}

      <InspectorSection title="Images">
        {yaffle && <YafflePanel yaffle={yaffle} />}
        <DescribeCurrentField />
      </InspectorSection>

      <InspectorSection title="Brand">
        <Input
          value={doc.brand.name}
          aria-label="Brand name"
          onChange={(event) => useCraftStore.getState().updateBrand({ name: event.target.value })}
        />
        {(() => {
          const logo = doc.assets.find((asset) => asset.id === doc.brand.logoAssetId);
          return (
            <div className="space-y-1.5">
              <p className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Logo</p>
              {logo && (
                <img
                  src={logo.dataUrl}
                  alt={logo.name}
                  className="h-14 w-full rounded-md border border-input bg-white object-contain p-1"
                />
              )}
              <input
                ref={logoInput}
                type="file"
                accept="image/*,.svg"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void useCraftStore.getState().setBrandLogo(file);
                  event.currentTarget.value = "";
                }}
              />
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => logoInput.current?.click()}>
                  {logo ? "Replace logo" : "Upload logo"}
                </Button>
                {logo && (
                  <Button size="sm" variant="ghost" onClick={() => useCraftStore.getState().clearBrandLogo()}>
                    Remove
                  </Button>
                )}
              </div>
              <InspectorHint>PNG, JPG or SVG. Colours update from the file and the mark lands on every size.</InspectorHint>
            </div>
          );
        })()}
        <div className="grid grid-cols-3 gap-2">
          {COLOR_ROLES.map((role) => (
            <label key={role} className="grid gap-1 text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
              {role}
              <input
                type="color"
                className="h-8 w-full cursor-pointer rounded border border-input"
                value={toColorInput(doc.brand.colors[role])}
                onChange={(event) => useCraftStore.getState().updateBrand({
                  colors: { [role]: event.target.value } as Partial<Record<ColorRole, string>>,
                })}
              />
            </label>
          ))}
        </div>
        <FontPicker
          label="Heading font"
          value={doc.brand.headingFont}
          onChange={(headingFont) => useCraftStore.getState().updateBrand({ headingFont })}
        />
        <FontPicker
          label="Body font"
          value={doc.brand.bodyFont}
          onChange={(bodyFont) => useCraftStore.getState().updateBrand({ bodyFont })}
        />
        <div className="flex gap-1">
          <Button size="sm" className="flex-1" onClick={() => useCraftStore.getState().applyBrandKit(doc.brand)}>
            Apply
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => useCraftStore.getState().saveBrandKit()}>
            Save kit
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => useCraftStore.getState().applyBrandKit()}>
            Use kit
          </Button>
        </div>
      </InspectorSection>

      {!doc.week && <InspectorSection title="Size">
        <div className="grid grid-cols-2 gap-1">
          {SIZE_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              variant={page.presetId === preset.id ? 'secondary' : 'ghost'}
              className="justify-start"
              onClick={() => useCraftStore.getState().applyPreset(preset.id)}
            >
              {preset.name}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="w-full" onClick={() => useCraftStore.getState().spawnPackPages()}>
          Spawn story / square / OG
        </Button>
      </InspectorSection>}

      {!doc.week && <InspectorSection title="Templates">
        <div className="grid grid-cols-1 gap-1">
          {DESIGN_TEMPLATES.map((template) => (
            <Button
              key={template.id}
              size="sm"
              variant="ghost"
              className="h-auto justify-start py-1.5 text-left"
              onClick={() => useCraftStore.getState().applyTemplate(template.id)}
            >
              <span>
                <span className="block">{template.name}</span>
                <span className="block text-[10px] font-normal text-muted-foreground">{template.description}</span>
              </span>
            </Button>
          ))}
        </div>
      </InspectorSection>}

      <InspectorSection title="Shapes">
        {SHAPE_GROUPS.map((group) => (
          <div key={group.id} className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{group.name}</p>
            <div className="grid grid-cols-4 gap-1">
              {group.variants.map((variant) => {
                const active = node?.type === "shape"
                  ? node.variant === variant
                  : shapeVariant === variant;
                return (
                  <button
                    key={variant}
                    type="button"
                    title={SHAPE_LABELS[variant]}
                    aria-label={SHAPE_LABELS[variant]}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[9px] text-muted-foreground hover:bg-muted",
                      active && "bg-muted text-foreground ring-1 ring-[var(--suite-accent)]",
                    )}
                    onClick={() => {
                      useCraftStore.getState().setShapeVariant(variant);
                      if (node?.type === "shape") useCraftStore.getState().updateNode(node.id, { variant });
                    }}
                  >
                    <ShapeGlyph id={variant} />
                    {SHAPE_LABELS[variant]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <InspectorHint>Pick a glyph, then click the board. Right-click a panel to swap shape.</InspectorHint>
      </InspectorSection>

      <InspectorSection title="Motion">
        {MOTION_PRESET_GROUPS.map((group) => (
          <div key={group} className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{MOTION_GROUP_LABELS[group]}</p>
            <div className="grid grid-cols-1 gap-1">
              {MOTION_PRESETS.filter((preset) => preset.group === group).map((preset) => (
                <Button
                  key={preset.id}
                  size="sm"
                  variant={
                    node?.type === "motion" && node.schema.meta?.title === preset.schema.meta?.title
                      ? "secondary"
                      : "ghost"
                  }
                  className="h-auto w-full justify-start py-1.5 text-left"
                  onClick={() => useCraftStore.getState().applyMotionPreset(preset.id)}
                >
                  <span>
                    <span className="block">{preset.name}</span>
                    <span className="block text-[10px] font-normal text-muted-foreground">{preset.schema.meta?.vibe}</span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        ))}
        {gifProgress != null && (
          <p className="text-[11px] text-muted-foreground">Recording GIF…</p>
        )}
        <InspectorHint>Living plate inside the node. Default week boards stay photo unless you insert this.</InspectorHint>
      </InspectorSection>

      <InspectorSection title="Selection">
        {!node && (
          <InspectorHint>Click a line to change its font. Double-click to edit the words. V select · T text · S shape · I image.</InspectorHint>
        )}
        {selected.length > 1 && (
          <p className="text-[11px] text-muted-foreground">{selected.length} objects</p>
        )}
        {node && (
          <NodeFields node={node} onPickImage={onPickImage} onCopyChange={onCopyChange} hideTextType={Boolean(textNode)} />
        )}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" onClick={() => useCraftStore.getState().duplicateSelected()}>Duplicate</Button>
            <Button size="sm" variant="outline" onClick={() => useCraftStore.getState().removeSelected()}>Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => useCraftStore.getState().alignSelected('left')}>Left</Button>
            <Button size="sm" variant="ghost" onClick={() => useCraftStore.getState().alignSelected('centerH')}>Center</Button>
            <Button size="sm" variant="ghost" onClick={() => useCraftStore.getState().alignSelected('right')}>Right</Button>
            <Button size="sm" variant="ghost" onClick={() => useCraftStore.getState().alignSelected('top')}>Top</Button>
            <Button size="sm" variant="ghost" onClick={() => useCraftStore.getState().alignSelected('centerV')}>Middle</Button>
            <Button size="sm" variant="ghost" onClick={() => useCraftStore.getState().alignSelected('bottom')}>Bottom</Button>
          </div>
        )}
      </InspectorSection>

      {mode !== "email" && <InspectorSection title="Export">
        {exportLocked && (
          <ul className="space-y-1">
            {(weekReasons.length ? weekReasons : [exportReason]).filter(Boolean).map((reason) => (
              <li key={reason} className="text-[11px] leading-relaxed text-red-500">
                {reason}
              </li>
            ))}
          </ul>
        )}
        {doc.week && !exportLocked && (
          <InspectorHint>Board is clear to export.</InspectorHint>
        )}
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Checkbox
            checked={firstFrameSettled}
            onCheckedChange={(value) => useCraftStore.getState().setFirstFrameSettled(value !== false)}
          />
          First frame settled
        </label>
        <Button
          size="sm"
          className={cn("w-full", exportLocked && LOCKED_EXPORT)}
          variant={exportLocked ? "outline" : "default"}
          disabled={exportLocked}
          aria-disabled={exportLocked}
          title={exportReason}
          onClick={() => void useCraftStore.getState().exportPng()}
        >
          Export PNG
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={cn("w-full", exportLocked && LOCKED_EXPORT)}
          disabled={exportLocked}
          aria-disabled={exportLocked}
          title={exportReason}
          onClick={() => void useCraftStore.getState().exportGif()}
        >
          Export GIF
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={cn("w-full", exportLocked && LOCKED_EXPORT)}
          disabled={exportLocked}
          aria-disabled={exportLocked}
          title={exportReason}
          onClick={() => void useCraftStore.getState().exportPack()}
        >
          Export pack (story / square / OG)
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={cn("w-full", exportLocked && LOCKED_EXPORT)}
          disabled={exportLocked}
          aria-disabled={exportLocked}
          title={exportReason}
          onClick={() => void useCraftStore.getState().exportFormats()}
        >
          PNG · JPEG · WebP · SVG
        </Button>
      </InspectorSection>}

      <InspectorSection title="History">
        <div className="max-h-36 space-y-0.5 overflow-auto">
          {history.map((_, index) => (
            <button
              key={index}
              type="button"
              className={cn(
                'flex w-full rounded-md px-2 py-1 text-left text-xs hover:bg-muted',
                index === historyIndex ? 'bg-muted font-medium' : 'text-muted-foreground',
              )}
              onClick={() => useCraftStore.getState().jumpHistory(index)}
            >
              {index === 0 ? 'Open' : `Edit ${index}`}
              {index === historyIndex ? ' · now' : ''}
            </button>
          ))}
        </div>
      </InspectorSection>
    </InspectorRail>
  );
}

const MOTION_TRIGGERS: MotionTrigger[] = ["none", "mousemove", "click", "scroll", "touch", "hover"];
const MOTION_BLENDS: MotionBlending[] = ["source-over", "screen", "multiply", "overlay"];
const MOTION_FPS: MotionFps[] = [24, 30, 60];
const MOTION_GROUP_LABELS = {
  Atmosphere: "Atmosphere",
  "Graphic devices": "Graphic devices",
  Structure: "Structure",
  Occasional: "Occasional",
} as const;

function MotionNodeFields({ node }: { node: MotionNode }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(node.schema, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    setJsonText(JSON.stringify(node.schema, null, 2));
    setJsonError(null);
  }, [node.id, node.schema]);

  const update = (updates: Partial<MotionNode>) => useCraftStore.getState().updateNode(node.id, updates);
  const sessionWarning = getMotionSessionWarning(node.id);

  const commitSchema = (schema: MotionNode["schema"]) => {
    const result = validateMotionSchema(schema);
    if (result.ok) update({ schema: result.schema });
  };

  const setPaletteSlot = (index: number, hex: string) => {
    const palette = node.schema.visual.palette.slice();
    while (palette.length <= index) palette.push(hex);
    palette[index] = hex;
    commitSchema({ ...node.schema, visual: { ...node.schema.visual, palette } });
  };

  const applyJson = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      const result = validateMotionSchema(parsed);
      if (!result.ok) {
        setJsonError(result.error ?? "illegal motion schema");
        return;
      }
      setJsonError(null);
      clearMotionSessionWarning(node.id);
      if (JSON.stringify(result.schema) === JSON.stringify(node.schema)) return;
      update({ schema: result.schema });
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "invalid JSON");
    }
  };

  const palette = node.schema.visual.palette;
  const physics = node.schema.physicsAndMath;
  const interaction = node.schema.interactionRules;

  return (
    <>
      {sessionWarning && <InspectorHint>{sessionWarning}</InspectorHint>}
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Frame</p>
      <div className="flex flex-wrap gap-1">
        {FRAME_SHAPES.map((shape) => (
          <Button
            key={shape.id}
            size="sm"
            variant={node.mask === shape.mask || (!node.mask && shape.id === "plain") ? "secondary" : "ghost"}
            onClick={() => useCraftStore.getState().applyFrameShape(shape.id)}
          >
            {shape.label}
          </Button>
        ))}
      </div>
      <ColorPicker
        compact
        label="Ground"
        value={node.schema.visual.background}
        onChange={(background) => commitSchema({ ...node.schema, visual: { ...node.schema.visual, background } })}
      />
      <ColorPicker compact label="Filament 1" value={palette[0] ?? "#1A1D21"} onChange={(hex) => setPaletteSlot(0, hex)} />
      <ColorPicker compact label="Filament 2" value={palette[1] ?? "#2F5199"} onChange={(hex) => setPaletteSlot(1, hex)} />
      <ColorPicker compact label="Accent" value={palette[2] ?? "#C69123"} onChange={(hex) => setPaletteSlot(2, hex)} />
      <InspectorSlider
        label="Density"
        value={physics.densityCount}
        min={8}
        max={4000}
        onChange={(densityCount) => commitSchema({ ...node.schema, physicsAndMath: { ...physics, densityCount } })}
      />
      <InspectorSlider
        label="Speed"
        value={Math.round(physics.speed * 100)}
        min={0}
        max={400}
        onChange={(value) => commitSchema({ ...node.schema, physicsAndMath: { ...physics, speed: value / 100 } })}
        format={(value) => (value / 100).toFixed(2)}
      />
      <InspectorSlider
        label="Friction"
        value={Math.round(physics.friction * 100)}
        min={0}
        max={100}
        onChange={(value) => commitSchema({ ...node.schema, physicsAndMath: { ...physics, friction: value / 100 } })}
        format={(value) => `${value}%`}
      />
      <InspectorSlider
        label="Amplitude"
        value={physics.amplitude}
        min={0}
        max={200}
        onChange={(amplitude) => commitSchema({ ...node.schema, physicsAndMath: { ...physics, amplitude } })}
      />
      <InspectorSlider
        label="Frequency"
        value={Math.round(physics.frequency * 10)}
        min={0}
        max={80}
        onChange={(value) => commitSchema({ ...node.schema, physicsAndMath: { ...physics, frequency: value / 10 } })}
        format={(value) => (value / 10).toFixed(1)}
      />
      <InspectorSlider
        label="Grain"
        value={Math.round(node.schema.visual.grain * 100)}
        min={0}
        max={40}
        onChange={(value) => commitSchema({ ...node.schema, visual: { ...node.schema.visual, grain: value / 100 } })}
        format={(value) => `${value}%`}
      />
      <InspectorSlider
        label="Field opacity"
        value={Math.round(node.schema.visual.opacity * 100)}
        min={0}
        max={100}
        onChange={(value) => commitSchema({ ...node.schema, visual: { ...node.schema.visual, opacity: value / 100 } })}
        format={(value) => `${value}%`}
      />
      <InspectorSlider
        label="Influence radius"
        value={interaction.influenceRadius}
        min={0}
        max={800}
        onChange={(influenceRadius) =>
          commitSchema({ ...node.schema, interactionRules: { ...interaction, influenceRadius } })
        }
      />
      <InspectorSlider
        label="Pull strength"
        value={Math.round(interaction.strength * 100)}
        min={0}
        max={400}
        onChange={(value) =>
          commitSchema({ ...node.schema, interactionRules: { ...interaction, strength: value / 100 } })
        }
        format={(value) => (value / 100).toFixed(2)}
      />
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Blend</p>
      <div className="flex flex-wrap gap-1">
        {MOTION_BLENDS.map((blend) => (
          <Button
            key={blend}
            size="sm"
            variant={node.schema.visual.blending === blend ? "secondary" : "ghost"}
            onClick={() => commitSchema({ ...node.schema, visual: { ...node.schema.visual, blending: blend } })}
          >
            {blend}
          </Button>
        ))}
      </div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Trigger</p>
      <div className="flex flex-wrap gap-1">
        {MOTION_TRIGGERS.map((trigger) => (
          <Button
            key={trigger}
            size="sm"
            variant={interaction.triggerType === trigger ? "secondary" : "ghost"}
            onClick={() => commitSchema({ ...node.schema, interactionRules: { ...interaction, triggerType: trigger } })}
          >
            {trigger}
          </Button>
        ))}
      </div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">FPS cap</p>
      <div className="flex flex-wrap gap-1">
        {MOTION_FPS.map((fps) => (
          <Button
            key={fps}
            size="sm"
            variant={node.schema.performance.fpsCap === fps ? "secondary" : "ghost"}
            onClick={() => commitSchema({ ...node.schema, performance: { ...node.schema.performance, fpsCap: fps } })}
          >
            {fps}
          </Button>
        ))}
      </div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Preview</p>
      <div className="flex flex-wrap gap-1">
        {(["live", "still", "reduced"] as MotionPreview[]).map((preview) => (
          <Button
            key={preview}
            size="sm"
            variant={node.preview === preview ? "secondary" : "ghost"}
            onClick={() => update({ preview })}
          >
            {preview}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" onClick={() => useCraftStore.getState().captureMotionStill(node.id)}>
          Capture still
        </Button>
        <Button size="sm" variant="outline" onClick={() => void useCraftStore.getState().recordMotionGif(node.id)}>
          Record GIF
        </Button>
        <Button size="sm" variant="ghost" onClick={() => update({ seed: Date.now() })}>
          Reset seed
        </Button>
      </div>
      {!advancedOpen ? (
        <>
          <p className="text-[11px] text-muted-foreground">Category {node.schema.category}</p>
          <p className="text-[11px] text-muted-foreground">Library {node.schema.engine.library}</p>
          <Button size="sm" variant="ghost" onClick={() => setAdvancedOpen(true)}>
            Advanced JSON
          </Button>
        </>
      ) : (
        <>
          <Textarea
            value={jsonText}
            rows={10}
            aria-label="Advanced JSON"
            className="min-h-[8rem] font-mono text-[11px]"
            onChange={(event) => {
              const text = event.target.value;
              setJsonText(text);
              try {
                const parsed = JSON.parse(text);
                const result = validateMotionSchema(parsed);
                setJsonError(result.ok ? null : (result.error ?? "illegal motion schema"));
              } catch (error) {
                setJsonError(error instanceof Error ? error.message : "invalid JSON");
              }
            }}
            onBlur={() => applyJson(jsonText)}
          />
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" onClick={() => applyJson(jsonText)}>
              Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdvancedOpen(false)}>
              Close
            </Button>
          </div>
          {jsonError && <InspectorHint>{jsonError}</InspectorHint>}
        </>
      )}
    </>
  );
}

function NodeFields({
  node,
  onPickImage,
  onCopyChange,
  hideTextType = false,
}: {
  node: CraftNode;
  onPickImage: () => void;
  onCopyChange?: (patch: CraftCopyPatch) => void;
  hideTextType?: boolean;
}) {
  const update = (updates: Partial<CraftNode>) => useCraftStore.getState().updateNode(node.id, updates);
  return (
    <div className="space-y-2">
      <Input value={node.name} aria-label="Layer name" onChange={(event) => update({ name: event.target.value })} />
      <InspectorSlider
        label="Opacity"
        value={Math.round(node.opacity * 100)}
        min={5}
        max={100}
        onChange={(value) => useCraftStore.getState().setOpacity(value / 100)}
        format={(value) => `${value}%`}
      />
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Shadow</p>
      <div className="flex flex-wrap gap-1">
        {SHADOW_PRESETS.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={
              (item.id === "none" && !node.shadow) ||
              (item.id === "soft" && node.shadow?.blur === 18) ||
              (item.id === "drop" && (node.shadow?.blur ?? 0) > 20) ||
              (item.id === "hard" && node.shadow?.blur === 8)
                ? "secondary"
                : "ghost"
            }
            onClick={() => useCraftStore.getState().applyShadow(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Motion</p>
      <div className="flex flex-wrap gap-1">
        {IMAGE_MOTIONS.map((motion) => (
          <Button
            key={motion.id}
            size="sm"
            variant={node.animation?.type === motion.id || (!node.animation && motion.id === "none") ? "secondary" : "ghost"}
            onClick={() => useCraftStore.getState().applyMotion(motion.id as ImageMotionId)}
          >
            {motion.label}
          </Button>
        ))}
      </div>
      {node.type === 'text' && !hideTextType && (
        <TextTypeFields node={node} onCopyChange={onCopyChange} />
      )}
      {node.type === 'shape' && (
        <ColorPicker label="Fill" value={node.fill} onChange={(fill) => update({ fill })} />
      )}
      {node.type === "motion" && (
        <MotionNodeFields node={node} />
      )}
      {node.type === 'image' && (
        <>
          <select
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-xs"
            value={node.objectFit}
            aria-label="Fit"
            onChange={(event) => update({ objectFit: event.target.value as 'cover' | 'contain' | 'fill' })}
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="fill">Fill</option>
          </select>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Frame</p>
          <div className="flex flex-wrap gap-1">
            {FRAME_SHAPES.map((shape) => (
              <Button
                key={shape.id}
                size="sm"
                variant={node.mask === shape.mask || (!node.mask && shape.id === "plain") ? "secondary" : "ghost"}
                onClick={() => useCraftStore.getState().applyFrameShape(shape.id)}
              >
                {shape.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {IMAGE_LOOKS.filter((look) => !FRAME_SHAPES.some((shape) => shape.id === look.id)).map((look) => (
              <Button
                key={look.id}
                size="sm"
                variant="ghost"
                onClick={() => useCraftStore.getState().applyLook(look.id as ImageLookId)}
              >
                {look.label}
              </Button>
            ))}
          </div>
          <InspectorSlider
            label="Bright"
            value={Math.round(node.brightness * 100)}
            min={40}
            max={160}
            onChange={(value) => update({ brightness: value / 100 })}
          />
          <InspectorSlider
            label="Contrast"
            value={Math.round(node.contrast * 100)}
            min={40}
            max={180}
            onChange={(value) => update({ contrast: value / 100 })}
          />
          <ColorPicker
            label="Wash"
            value={node.tint || "#0f172a"}
            onChange={(tint) => update({ tint, tintOpacity: node.tintOpacity && node.tintOpacity > 0 ? node.tintOpacity : 0.28 })}
          />
          <Button size="sm" variant="outline" onClick={onPickImage}>Replace image</Button>
        </>
      )}
      <div className="grid grid-cols-2 gap-1">
        <NumberField label="X" value={node.x} onChange={(x) => update({ x })} />
        <NumberField label="Y" value={node.y} onChange={(y) => update({ y })} />
        <NumberField label="W" value={node.width} onChange={(width) => update({ width })} />
        <NumberField label="H" value={node.height} onChange={(height) => update({ height })} />
      </div>
    </div>
  );
}

function TypeBar() {
  const node = useCraftStore((state) => {
    const page = pageOf(state);
    if (!page || state.selectedIds.length !== 1) return null;
    const hit = page.nodes.find((item) => item.id === state.selectedIds[0]);
    return hit?.type === "text" ? hit : null;
  });
  if (!node) return null;
  return (
    <div
      className="absolute left-1/2 top-3 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 rounded-lg border border-white/15 bg-black/80 p-1 shadow-lg backdrop-blur"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {STRATA_SITE_FONTS.map((name) => (
        <button
          key={name}
          type="button"
          title={name === "Unbounded" ? "Strata hero" : name}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-sm text-white/90 hover:bg-white/10",
            node.fontFamily === name && "bg-white/15 ring-1 ring-[var(--suite-accent)]",
          )}
          style={{ fontFamily: `"${name}", Inter, sans-serif` }}
          onClick={() => useCraftStore.getState().updateNode(node.id, { fontFamily: name })}
        >
          {name === "Unbounded" ? "Unbounded" : name === "Plus Jakarta Sans" ? "Jakarta" : "Mono"}
        </button>
      ))}
    </div>
  );
}

function TextTypeFields({
  node,
  onCopyChange,
}: {
  node: TextNode;
  onCopyChange?: (patch: CraftCopyPatch) => void;
}) {
  const update = (updates: Partial<CraftNode>) => useCraftStore.getState().updateNode(node.id, updates);
  return (
    <div className="space-y-2">
      <FontFaceGrid value={node.fontFamily} onChange={(fontFamily) => update({ fontFamily })} />
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Weight</p>
      <div className="flex flex-wrap gap-1">
        {FONT_WEIGHTS.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={node.fontWeight === item.id ? "secondary" : "ghost"}
            onClick={() => update({ fontWeight: item.id })}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Input
          type="number"
          value={Math.round(node.fontSize)}
          aria-label="Font size"
          onChange={(event) => update({ fontSize: Number(event.target.value) || node.fontSize })}
        />
        <CraftMenuSelect
          label="Align"
          value={node.align}
          onChange={(align) => update({ align: align as TextAlign })}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ]}
        />
      </div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Type style</p>
      <div className="flex flex-wrap gap-1">
        {TEXT_STYLES.map((style) => (
          <Button
            key={style.id}
            size="sm"
            variant="ghost"
            onClick={() => update({
              fontSize: style.size,
              fontWeight: style.weight,
              fontRole: style.fontRole,
              letterSpacing: style.id === "eyebrow" ? 3 : node.letterSpacing,
              uppercase: style.id === "eyebrow" ? true : node.uppercase,
            })}
          >
            {style.name}
          </Button>
        ))}
      </div>
      <InspectorSlider
        label="Tracking"
        value={node.letterSpacing}
        min={-2}
        max={12}
        step={0.5}
        onChange={(letterSpacing) => update({ letterSpacing })}
      />
      <Button
        size="sm"
        variant={node.uppercase ? "secondary" : "outline"}
        onClick={() => update({ uppercase: !node.uppercase })}
      >
        {node.uppercase ? "Uppercase on" : "Uppercase"}
      </Button>
      <ColorPicker label="Colour" value={node.color} onChange={(color) => update({ color })} />
      <Textarea
        value={node.text}
        rows={4}
        aria-label="Text"
        className="min-h-[5rem] text-sm"
        onChange={(event) => update({ text: event.target.value })}
        onBlur={(event) => {
          const patch = copyPatchFromNode(node.name, event.target.value);
          if (patch) onCopyChange?.(patch);
        }}
      />
    </div>
  );
}

function FontFaceGrid({ value, onChange }: { value: string; onChange: (font: string) => void }) {
  const fonts = documentFonts(useCraftStore.getState().doc);
  const more = fonts.filter((name) => !(STRATA_SITE_FONTS as readonly string[]).includes(name));
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Typeface</p>
      <div className="grid gap-1">
        {STRATA_SITE_FONTS.map((name) => (
          <button
            key={name}
            type="button"
            className={cn(
              "rounded-md border px-3 py-2 text-left text-foreground hover:bg-muted/60",
              value === name ? "border-[var(--suite-accent)] bg-muted" : "border-input",
            )}
            style={{ fontFamily: `"${name}", Inter, sans-serif` }}
            onClick={() => onChange(name)}
          >
            <span className="block text-base leading-tight">Aa · {name}</span>
            {name === "Unbounded" && (
              <span className="block font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Strata hero
              </span>
            )}
          </button>
        ))}
      </div>
      <CraftMenuSelect
        label="More typefaces"
        value={more.includes(value) ? value : ""}
        placeholder="Other…"
        onChange={onChange}
        options={more.map((name) => ({ value: name, label: name }))}
      />
    </div>
  );
}

function CraftMenuSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  groups,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  groups?: Array<{ label: string; options: Array<{ value: string; label: string }> }>;
}) {
  const rows = groups ?? [{ label: "", options: options ?? [] }];
  return (
    <label className="grid gap-1 text-[11px] text-muted-foreground">
      {label}
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger
          aria-label={label}
          className="h-8 bg-zinc-900 text-zinc-50 border-white/20 text-xs font-[family-name:var(--font-ui)]"
        >
          <SelectValue placeholder={placeholder ?? "Choose…"} />
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="z-[80] max-h-64 min-w-[12rem] border-white/20 bg-zinc-900 text-zinc-50"
        >
          {rows.map((group) => (
            <SelectGroup key={group.label || "items"}>
              {group.label ? (
                <SelectLabel className="pl-8 text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                  {group.label}
                </SelectLabel>
              ) : null}
              {group.options.map((item) => (
                <SelectItem
                  key={item.value}
                  value={item.value}
                  className="text-zinc-50 font-[family-name:var(--font-ui)] focus:bg-white/15 focus:text-white"
                >
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function FontPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (font: string) => void;
}) {
  const fonts = documentFonts(useCraftStore.getState().doc);
  const list = fonts.includes(value) ? fonts : [value, ...fonts];
  const site = STRATA_SITE_FONTS.filter((name) => list.includes(name));
  const rest = list.filter((name) => !site.includes(name as (typeof STRATA_SITE_FONTS)[number]));
  const named = (name: string) => ({
    value: name,
    label: name === "Unbounded" ? "Unbounded — hero" : name,
  });
  return (
    <CraftMenuSelect
      label={label}
      value={value}
      onChange={onChange}
      groups={[
        ...(site.length ? [{ label: "Strata site", options: site.map(named) }] : []),
        ...(rest.length ? [{ label: "More", options: rest.map(named) }] : []),
      ]}
    />
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="grid gap-1 text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
      {label}
      <Input
        type="number"
        value={Math.round(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function TemplateStrip({ empty }: { empty?: boolean }) {
  if (!empty) return null;
  return (
    <div className="mx-auto max-w-3xl px-6 pb-10">
      <h3 className="mb-2 font-[family-name:var(--font-ui)] text-[10px] font-bold tracking-[0.14em] text-[var(--craft-accent)] uppercase">
        Templates
      </h3>
      <div className="flex flex-wrap justify-center gap-2">
        {DESIGN_TEMPLATES.slice(0, 8).map((template) => (
          <Button
            key={template.id}
            size="sm"
            variant="outline"
            onClick={() => useCraftStore.getState().applyTemplate(template.id)}
          >
            {template.name}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() => useCraftStore.getState().addMotion("ledger-current")}
        >
          Ledger Current
        </Button>
      </div>
    </div>
  );
}


