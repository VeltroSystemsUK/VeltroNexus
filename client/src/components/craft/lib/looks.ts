import type { CraftNode, ImageNode } from "./types";

export const IMAGE_LOOKS = [
  { id: "plain", label: "Plain" },
  { id: "editorial", label: "Editorial" },
  { id: "framed", label: "White frame" },
  { id: "thick", label: "Gallery frame" },
  { id: "ink", label: "Ink frame" },
  { id: "gold", label: "Gold frame" },
  { id: "round", label: "Round" },
  { id: "arch", label: "Arch" },
  { id: "diamond", label: "Diamond" },
  { id: "hex", label: "Hex" },
  { id: "polaroid", label: "Polaroid" },
  { id: "ticket", label: "Ticket" },
  { id: "shadow", label: "Drop shadow" },
  { id: "dim", label: "Dim" },
  { id: "wash", label: "Colour wash" },
  { id: "mono", label: "Mono" },
  { id: "punch", label: "Punch" },
] as const;

export type ImageLookId = (typeof IMAGE_LOOKS)[number]["id"];

export const IMAGE_MOTIONS = [
  { id: "none", label: "Still" },
  { id: "fadeIn", label: "Fade in" },
  { id: "slideIn", label: "Slide in" },
  { id: "pop", label: "Pop" },
  { id: "pulse", label: "Pulse" },
] as const;

export type ImageMotionId = (typeof IMAGE_MOTIONS)[number]["id"];

export const OPACITY_PRESETS = [
  { label: "100%", value: 1 },
  { label: "85%", value: 0.85 },
  { label: "70%", value: 0.7 },
  { label: "50%", value: 0.5 },
  { label: "25%", value: 0.25 },
] as const;

function asImage(node: ImageNode, patch: Partial<ImageNode>): ImageNode {
  return { ...node, ...patch };
}

export function applyImageLook(node: ImageNode, look: ImageLookId): ImageNode {
  const reset: Partial<ImageNode> = {
    opacity: 1,
    brightness: 1,
    contrast: 1,
    grayscale: 0,
    tint: undefined,
    tintOpacity: 0,
    stroke: undefined,
    strokeWidth: 0,
    mask: undefined,
    shadow: undefined,
  };
  if (look === "plain") return asImage(node, reset);
  if (look === "framed") {
    return asImage(node, { ...reset, stroke: "#f8fafc", strokeWidth: 14, shadow: { color: "rgba(0,0,0,0.28)", blur: 18, x: 0, y: 10 } });
  }
  if (look === "thick") {
    return asImage(node, { ...reset, stroke: "#f4f1ea", strokeWidth: 28, shadow: { color: "rgba(0,0,0,0.32)", blur: 24, x: 0, y: 14 } });
  }
  if (look === "ink") {
    return asImage(node, { ...reset, stroke: "#0f172a", strokeWidth: 10 });
  }
  if (look === "gold") {
    return asImage(node, { ...reset, stroke: "#c4a35a", strokeWidth: 12, shadow: { color: "rgba(80,50,10,0.28)", blur: 16, x: 0, y: 8 } });
  }
  if (look === "round") {
    return asImage(node, { ...reset, mask: "ellipse", shadow: { color: "rgba(0,0,0,0.3)", blur: 22, x: 0, y: 12 } });
  }
  if (look === "arch") {
    return asImage(node, { ...reset, mask: "arch", stroke: "#f8fafc", strokeWidth: 10, shadow: { color: "rgba(0,0,0,0.28)", blur: 20, x: 0, y: 12 } });
  }
  if (look === "diamond") {
    return asImage(node, { ...reset, mask: "diamond", stroke: "#f8fafc", strokeWidth: 8, shadow: { color: "rgba(0,0,0,0.3)", blur: 18, x: 0, y: 10 } });
  }
  if (look === "hex") {
    return asImage(node, { ...reset, mask: "hexagon", stroke: "#e2e8f0", strokeWidth: 8, shadow: { color: "rgba(0,0,0,0.28)", blur: 18, x: 0, y: 10 } });
  }
  if (look === "polaroid") {
    return asImage(node, { ...reset, mask: "rounded-rect", stroke: "#f8fafc", strokeWidth: 28, shadow: { color: "rgba(0,0,0,0.32)", blur: 22, x: 0, y: 14 } });
  }
  if (look === "ticket") {
    return asImage(node, { ...reset, mask: "ticket", stroke: "#f8fafc", strokeWidth: 8, shadow: { color: "rgba(0,0,0,0.26)", blur: 16, x: 0, y: 10 } });
  }
  if (look === "shadow") {
    return asImage(node, { ...reset, shadow: { color: "rgba(0,0,0,0.45)", blur: 36, x: 0, y: 22 } });
  }
  if (look === "dim") {
    return asImage(node, { ...reset, opacity: 0.55, brightness: 0.86 });
  }
  if (look === "wash") {
    return asImage(node, { ...reset, tint: "#0f172a", tintOpacity: 0.32, contrast: 1.08 });
  }
  if (look === "mono") {
    return asImage(node, { ...reset, grayscale: 1, contrast: 1.15, brightness: 0.96 });
  }
  if (look === "punch") {
    return asImage(node, { ...reset, contrast: 1.22, brightness: 0.94 });
  }
  return asImage(node, {
    ...reset,
    stroke: "#f8fafc",
    strokeWidth: 12,
    tint: "#0f172a",
    tintOpacity: 0.2,
    contrast: 1.12,
    brightness: 0.94,
    shadow: { color: "rgba(0,0,0,0.38)", blur: 28, x: 0, y: 16 },
  });
}

export function applyNodeOpacity(node: CraftNode, opacity: number): CraftNode {
  return { ...node, opacity: Math.min(1, Math.max(0, opacity)) };
}

const MOTION_MS: Record<Exclude<ImageMotionId, "none">, number> = {
  fadeIn: 700,
  slideIn: 720,
  pop: 460,
  pulse: 1400,
};

export function applyNodeMotion(node: CraftNode, motion: ImageMotionId): CraftNode {
  if (motion === "none") return { ...node, animation: undefined };
  return { ...node, animation: { type: motion, duration: MOTION_MS[motion], delay: 0 } };
}

export function pageHasMotion(nodes: CraftNode[]): boolean {
  return nodes.some((node) => node.animation && node.animation.type !== "none");
}

export function nudgeNodeOrder(nodes: CraftNode[], id: string, direction: 1 | -1): CraftNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index < 0) return nodes;
  const next = index + direction;
  if (next < 0 || next >= nodes.length) return nodes;
  const copy = nodes.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}
