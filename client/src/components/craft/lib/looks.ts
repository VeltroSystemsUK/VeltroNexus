import type { CraftNode, ImageNode, MotionNode } from "./types";

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

export const FRAME_SHAPES = [
  { id: "plain", label: "Rect", mask: undefined },
  { id: "round", label: "Round", mask: "ellipse" },
  { id: "arch", label: "Arch", mask: "arch" },
  { id: "diamond", label: "Diamond", mask: "diamond" },
  { id: "hex", label: "Hex", mask: "hexagon" },
  { id: "polaroid", label: "Polaroid", mask: "rounded-rect" },
  { id: "ticket", label: "Ticket", mask: "ticket" },
  { id: "star", label: "Star", mask: "star" },
  { id: "triangle", label: "Triangle", mask: "triangle" },
  { id: "heart", label: "Heart", mask: "heart" },
  { id: "speech", label: "Speech", mask: "speech" },
  { id: "banner", label: "Banner", mask: "banner" },
  { id: "cloud", label: "Cloud", mask: "cloud" },
  { id: "chevron", label: "Chevron", mask: "chevron" },
] as const;

export type FrameShapeId = (typeof FRAME_SHAPES)[number]["id"];

export const SHADOW_PRESETS = [
  { id: "none", label: "None" },
  { id: "soft", label: "Soft" },
  { id: "drop", label: "Drop" },
  { id: "hard", label: "Hard" },
] as const;

export type ShadowPresetId = (typeof SHADOW_PRESETS)[number]["id"];

const SHADOWS: Record<Exclude<ShadowPresetId, "none">, NonNullable<ImageNode["shadow"]>> = {
  soft: { color: "rgba(0,0,0,0.28)", blur: 18, x: 0, y: 10 },
  drop: { color: "rgba(0,0,0,0.45)", blur: 36, x: 0, y: 22 },
  hard: { color: "rgba(0,0,0,0.4)", blur: 8, x: 4, y: 6 },
};

export function applyFrameShape(node: ImageNode | MotionNode, id: FrameShapeId): ImageNode | MotionNode {
  const spec = FRAME_SHAPES.find((item) => item.id === id);
  if (!spec || id === "plain") {
    return { ...node, mask: undefined, stroke: id === "plain" ? undefined : node.stroke, strokeWidth: id === "plain" ? 0 : node.strokeWidth };
  }
  if (id === "polaroid") {
    return { ...node, mask: "rounded-rect", stroke: "#f8fafc", strokeWidth: 28 };
  }
  return { ...node, mask: spec.mask };
}

export function applyNodeShadow(node: CraftNode, id: ShadowPresetId): CraftNode {
  if (id === "none") return { ...node, shadow: undefined };
  return { ...node, shadow: SHADOWS[id] };
}

export const IMAGE_MOTIONS = [
  { id: "none", label: "Still" },
  { id: "fadeIn", label: "Fade in" },
  { id: "slideIn", label: "Slide in" },
  { id: "pop", label: "Pop" },
  { id: "pulse", label: "Pulse" },
  { id: "hook-turn", label: "Hook turn" },
  { id: "stamp-down", label: "Stamp down" },
] as const;

export type ImageMotionId = (typeof IMAGE_MOTIONS)[number]["id"];

export const CRAFT_SWATCHES = [
  "#0f172a",
  "#1e293b",
  "#334155",
  "#64748b",
  "#94a3b8",
  "#e2e8f0",
  "#f8fafc",
  "#ffffff",
  "#111827",
  "#059669",
  "#10b981",
  "#34d399",
  "#0f766e",
  "#0ea5e9",
  "#2563eb",
  "#1e3a5f",
  "#7c3aed",
  "#c026d3",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#d97706",
  "#c4a35a",
  "#ca8a04",
  "#854d0e",
  "#7c2d12",
  "#fef3c7",
  "#fde68a",
  "#bbf7d0",
  "#bae6fd",
  "#e9d5ff",
  "#fecdd3",
] as const;

export function toColorInput(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return "#059669";
}

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
  "hook-turn": 900,
  "stamp-down": 420,
};

export function applyNodeMotion(node: CraftNode, motion: ImageMotionId): CraftNode {
  if (motion === "none") return { ...node, animation: undefined };
  return { ...node, animation: { type: motion, duration: MOTION_MS[motion], delay: 0 } };
}

export function pageHasMotion(nodes: CraftNode[]): boolean {
  return nodes.some(
    (node) =>
      (node.animation && node.animation.type !== "none") ||
      (node.type === "motion" && node.preview === "live"),
  );
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
