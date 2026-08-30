import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { copyFieldForNodeName } from "../lib/composePost";
import { IMAGE_LOOKS, IMAGE_MOTIONS, OPACITY_PRESETS, type ImageLookId, type ImageMotionId } from "../lib/looks";
import type { CraftNode } from "../lib/types";
import { useCraftStore } from "../store";

const SWATCHES = ["#0f172a", "#f8fafc", "#059669", "#c4a35a", "#1e3a5f", "#dc2626", "#e2e8f0"];

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

  const left = Math.min(x, window.innerWidth - 240);
  const top = Math.min(y, window.innerHeight - 420);
  const copyField = node?.type === "text" ? copyFieldForNodeName(node.name) : null;
  const editLabel =
    copyField === "hook" ? "Edit hook 1"
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
      className="fixed z-[80] w-56 rounded-lg border border-white/10 bg-[#12141c]/95 p-1 shadow-2xl backdrop-blur-md"
      style={{ left, top }}
      role="menu"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <p className="px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white/35">
        {node ? node.name : "Board"}
      </p>
      {node?.type === "text" && (
        <Item onClick={() => run(onEditText)}>{editLabel}</Item>
      )}
      {node && (
        <Group label="Opacity">
          {OPACITY_PRESETS.map((item) => (
            <Item key={item.value} onClick={() => run(() => useCraftStore.getState().setOpacity(item.value))}>
              {item.label}
            </Item>
          ))}
        </Group>
      )}
      {node && (
        <Group label="Colour">
          <div className="flex flex-wrap gap-1 px-2 py-1.5">
            {SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                className="size-5 rounded-sm border border-white/20"
                style={{ background: color }}
                aria-label={color}
                onClick={() => paint(color)}
              />
            ))}
          </div>
        </Group>
      )}
      {node?.type === "image" && (
        <Group label="Frame">
          {IMAGE_LOOKS.map((look) => (
            <Item
              key={look.id}
              onClick={() => run(() => useCraftStore.getState().applyLook(look.id as ImageLookId))}
            >
              {look.label}
            </Item>
          ))}
        </Group>
      )}
      {node && (
        <Group label="Motion">
          {IMAGE_MOTIONS.map((motion) => (
            <Item
              key={motion.id}
              onClick={() => run(() => useCraftStore.getState().applyMotion(motion.id as ImageMotionId))}
            >
              {motion.label}
            </Item>
          ))}
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
      {!node && <p className="px-2 py-2 text-[11px] text-white/40">Right-click a layer to frame, fade, or recolour it.</p>}
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
