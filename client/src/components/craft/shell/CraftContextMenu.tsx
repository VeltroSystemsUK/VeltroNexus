import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { placeMenu } from "../canvas/viewport";
import { ColorPicker } from "./Inspector";
import { FrameGlyph, ShapeGlyph } from "./glyphs";
import { copyFieldForNodeName } from "../lib/composePost";
import {
  FRAME_SHAPES,
  IMAGE_MOTIONS,
  OPACITY_PRESETS,
  SHADOW_PRESETS,
  type ImageMotionId,
} from "../lib/looks";
import { ALL_SHAPE_VARIANTS, type CraftNode, type MotionPreview } from "../lib/types";
import { SHAPE_LABELS } from "../lib/templates";
import { MOTION_PRESETS, MOTION_PRESET_GROUPS } from "../lib/motionPresets";
import { useCraftStore } from "../store";

const MOTION_PREVIEWS: MotionPreview[] = ["live", "still", "reduced"];

export function CraftContextMenu({
  x,
  y,
  node,
  onClose,
  onPickImage,
  onEditText,
}: {
  x: number;
  y: number;
  node: CraftNode | null;
  onClose: () => void;
  onPickImage: () => void;
  onEditText: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState(() =>
    placeMenu(x, y, 256, 480, typeof window === "undefined" ? 1280 : window.innerWidth, typeof window === "undefined" ? 720 : window.innerHeight),
  );

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = placeMenu(x, y, el.offsetWidth, el.scrollHeight, window.innerWidth, window.innerHeight);
    setBox((prev) =>
      prev.left === next.left && prev.top === next.top && prev.maxHeight === next.maxHeight ? prev : next,
    );
  }, [x, y, node]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    let onDown: ((event: MouseEvent) => void) | undefined;
    const timer = window.setTimeout(() => {
      onDown = (event: MouseEvent) => {
        if (ref.current && !ref.current.contains(event.target as Node)) onClose();
      };
      window.addEventListener("mousedown", onDown);
    }, 0);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      if (onDown) window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const copyField = node?.type === "text" ? copyFieldForNodeName(node.name) : null;
  const editLabel =
    copyField === "eyebrow" ? "Edit eyebrow"
    : copyField === "hook" ? "Edit hook 1"
    : copyField === "hook2" ? "Edit hook 2"
    : copyField === "body" ? "Edit body"
    : copyField === "cta" ? "Edit CTA"
    : copyField === "hashtags" ? "Edit hashtags"
    : copyField === "links" ? "Edit link"
    : "Edit text";

  const run = (fn: () => void) => {
    if (node) useCraftStore.getState().select([node.id]);
    fn();
    onClose();
  };

  const paint = (color: string) => {
    if (!node) return;
    run(() => {
      if (node.type === "text") useCraftStore.getState().updateNode(node.id, { color });
      else if (node.type === "shape") useCraftStore.getState().updateNode(node.id, { fill: color });
      else if (node.type === "image") {
        useCraftStore.getState().updateNode(node.id, {
          tint: color,
          tintOpacity: node.tintOpacity && node.tintOpacity > 0 ? node.tintOpacity : 0.28,
        });
      }
    });
  };

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[80] w-64 overflow-y-auto overscroll-contain rounded-lg border border-white/10 bg-[#12141c]/95 p-1 shadow-2xl backdrop-blur-md [scrollbar-width:thin]"
      style={{ left: box.left, top: box.top, maxHeight: box.maxHeight }}
      role="menu"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <p className="px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white/35">
        {node ? node.name : "Board"}
      </p>
      {(node?.type === "text" || node?.type === "motion") && (
        <Item onClick={() => run(onEditText)}>{node.type === "motion" ? "Edit line on plate" : editLabel}</Item>
      )}
      {node?.type === "motion" && (
        <>
          {MOTION_PRESET_GROUPS.map((group) => (
            <Group key={group} label={group}>
              <div className="flex flex-wrap gap-1 px-2 py-1">
                {MOTION_PRESETS.filter((preset) => preset.group === group).map((preset) => {
                  const active = node.schema.meta?.title === preset.schema.meta?.title;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      title={preset.schema.meta?.vibe}
                      className={`rounded-md px-1.5 py-1 text-[10px] hover:bg-white/10 ${active ? "bg-white/15 text-white ring-1 ring-white/25" : "text-white/80"}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => run(() => useCraftStore.getState().replaceMotionPreset(preset.id))}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>
            </Group>
          ))}
          <Group label="Preview">
            <div className="flex flex-wrap gap-1 px-2 py-1">
              {MOTION_PREVIEWS.map((preview) => (
                <button
                  key={preview}
                  type="button"
                  className={`rounded-md px-1.5 py-1 text-[10px] hover:bg-white/10 ${node.preview === preview ? "bg-white/15 text-white" : "text-white/80"}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => run(() => useCraftStore.getState().updateNode(node.id, { preview }))}
                >
                  {preview}
                </button>
              ))}
            </div>
          </Group>
          <Item onClick={() => run(() => useCraftStore.getState().captureMotionStill(node.id))}>Capture still</Item>
          <Item onClick={() => run(() => void useCraftStore.getState().recordMotionGif(node.id))}>Record GIF</Item>
        </>
      )}
      {node?.type === "shape" && (
        <Group label="Shape">
          <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
            {ALL_SHAPE_VARIANTS.map((variant) => (
              <button
                key={variant}
                type="button"
                title={SHAPE_LABELS[variant]}
                aria-label={SHAPE_LABELS[variant]}
                className="flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[9px] text-white/70 hover:bg-white/10"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run(() => useCraftStore.getState().updateNode(node.id, { variant }))}
              >
                <ShapeGlyph id={variant} />
                {SHAPE_LABELS[variant]}
              </button>
            ))}
          </div>
        </Group>
      )}
      {node?.type === "image" && (
        <Group label="Frame">
          <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
            {FRAME_SHAPES.map((shape) => (
              <button
                key={shape.id}
                type="button"
                title={shape.label}
                aria-label={shape.label}
                className="flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[9px] text-white/70 hover:bg-white/10"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run(() => useCraftStore.getState().applyFrameShape(shape.id))}
              >
                <FrameGlyph id={shape.id} />
                {shape.label}
              </button>
            ))}
          </div>
        </Group>
      )}
      {node && (
        <Group label="Shadow">
          <div className="flex flex-wrap gap-1 px-2 py-1">
            {SHADOW_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-md px-1.5 py-1 text-[10px] text-white/80 hover:bg-white/10"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run(() => useCraftStore.getState().applyShadow(item.id))}
              >
                {item.label}
              </button>
            ))}
          </div>
        </Group>
      )}
      {node && (
        <Group label="Opacity">
          <div className="flex flex-wrap gap-1 px-2 py-1">
            {OPACITY_PRESETS.map((item) => (
              <button
                key={item.value}
                type="button"
                className="rounded-md px-1.5 py-1 text-[10px] text-white/80 hover:bg-white/10"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run(() => useCraftStore.getState().setOpacity(item.value))}
              >
                {item.label}
              </button>
            ))}
          </div>
        </Group>
      )}
      {node && node.type !== "motion" && (
        <Group label="Colour">
          <div className="px-2 py-1.5">
            <ColorPicker
              compact
              value={
                node.type === "text" ? node.color
                : node.type === "shape" ? node.fill
                : node.type === "image" ? node.tint || "#0f172a"
                : "#059669"
              }
              onChange={paint}
            />
          </div>
        </Group>
      )}
      {node && node.type !== "motion" && (
        <Group label="Motion">
          <div className="flex flex-wrap gap-1 px-2 py-1">
            {IMAGE_MOTIONS.map((motion) => (
              <button
                key={motion.id}
                type="button"
                className="rounded-md px-1.5 py-1 text-[10px] text-white/80 hover:bg-white/10"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run(() => useCraftStore.getState().applyMotion(motion.id as ImageMotionId))}
              >
                {motion.label}
              </button>
            ))}
          </div>
        </Group>
      )}
      {node && (
        <>
          <Item onClick={() => run(() => useCraftStore.getState().nudgeZ(1))}>Bring forward</Item>
          <Item onClick={() => run(() => useCraftStore.getState().nudgeZ(-1))}>Send back</Item>
          <Item onClick={() => run(() => useCraftStore.getState().duplicateSelected())}>Duplicate</Item>
        </>
      )}
      {node?.type === "image" && (
        <Item onClick={() => run(onPickImage)}>Replace image</Item>
      )}
      {node && (
        <Item danger onClick={() => run(() => useCraftStore.getState().removeSelected())}>Delete</Item>
      )}
      {!node && <p className="px-2 py-2 text-[11px] text-white/40">Right-click the still for frames and motion.</p>}
    </div>,
    document.body,
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-white/5 py-1">
      <p className="px-2 pb-0.5 text-[9px] uppercase tracking-[0.16em] text-white/30">{label}</p>
      {children}
    </div>
  );
}

function Item({
  children,
  onClick,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/10 ${danger ? "text-rose-300" : "text-white/85"}`}
    >
      {children}
    </button>
  );
}
