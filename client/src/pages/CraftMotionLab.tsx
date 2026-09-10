import { useEffect, useState } from "react";
import { IMAGE_MOTIONS, applyNodeMotion } from "@/components/craft/lib/looks";
import { MOTION_PRESETS, type MotionPreset } from "@/components/craft/lib/motionPresets";
import {
  disposeAll,
  disposeNode,
  makeMotionNode,
  motionBitmap,
} from "@/components/craft/lib/motionRuntime";
import {
  noteTyping,
  pulseMotion,
  resetMotionSignals,
  setMotionBusy,
  setMotionFocus,
  snapshotMotionSignals,
} from "@/components/craft/lib/motionSignals";
import { drawFrame } from "@/components/craft/lib/renderer";
import {
  DEFAULT_CONSTRAINTS,
  blankDocument,
  type CraftPage,
  type TextNode,
} from "@/components/craft/lib/types";

const W = 480;
const H = 300;

const LOOPING = new Set([
  "ledger-current",
  "paper-sparks",
  "grain-breath",
  "after-hours-warp",
  "vapor-drift",
  "static-shiver",
  "vignette-breathing",
  "horizon-shift",
  "parchment-heat",
  "liquid-quartz",
  "liquid-glass-shift",
  "thermal-heat-bloom",
  "redact-sweep",
  "ink-bleed",
  "light-leak",
  "cybernetic-scanline",
  "ledger-margin-glow",
  "resin-gloss-sweep",
  "holographic-foil",
  "vellum-crease",
  "guilloche-wave",
  "glowing-pill-pulse",
  "corporate-ribbon",
  "perspective-grid",
  "network-map",
  "hook-turn",
  "ledger-ticker",
  "ledger-stitch",
  "acoustic-waveform-pulse",
  "topographic-contour",
  "liquid-text-mask",
  "odometer-roll",
  "goo-merge",
  "quantum-glitch",
  "typewriter-cursor",
  "mechanical-escapement",
]);

const CLICK = new Set([
  "stamp-pulse",
  "ledger-fracture",
  "shatter-plate",
  "ink-splash-bloom",
  "ink-ripple",
  "magnetic-ripple",
  "prismatic-focal-shift",
  "magnetic-edge-snap",
  "redact-highlight",
]);

type FrameStats = {
  paperRatio: number;
  mae: number;
  opaque: number;
};

export type LabLook = {
  id: string;
  name: string;
  group: string;
  category: string;
  issues: string[];
  paperRatio: number;
  loopMae: number;
  clickMae: number;
  restPng: string;
  clickPng: string;
};

export type LabTween = {
  id: string;
  issues: string[];
  midMae: number;
  restPng: string;
  midPng: string;
};

function paperRatio(data: Uint8ClampedArray): { paperRatio: number; opaque: number } {
  let paper = 0;
  let opaque = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]!;
    if (a < 8) continue;
    opaque += 1;
    const dist = Math.abs(data[i]! - 247) + Math.abs(data[i + 1]! - 245) + Math.abs(data[i + 2]! - 241);
    if (dist < 18) paper += 1;
  }
  return { paperRatio: opaque ? paper / opaque : 1, opaque: opaque / n };
}

function mae(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  const n = Math.min(a.length, b.length) / 4;
  for (let i = 0; i < n * 4; i += 4) {
    sum += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
  }
  return n ? sum / (n * 3) : 0;
}

function snapshot(canvas: HTMLCanvasElement): { data: Uint8ClampedArray; png: string } {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { data: new Uint8ClampedArray(), png: "" };
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const copy = document.createElement("canvas");
  copy.width = width;
  copy.height = height;
  const copyCtx = copy.getContext("2d");
  if (copyCtx) {
    copyCtx.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  }
  return { data: new Uint8ClampedArray(data), png: copy.toDataURL("image/png") };
}

function statsOf(data: Uint8ClampedArray, against?: Uint8ClampedArray): FrameStats {
  const ratio = paperRatio(data);
  return {
    paperRatio: ratio.paperRatio,
    opaque: ratio.opaque,
    mae: against ? mae(data, against) : 0,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sampleText(): TextNode {
  return {
    id: "hook-lab",
    name: "Hook 1",
    type: "text",
    text: "FILE FIRST",
    fontFamily: "Unbounded",
    fontWeight: "800",
    fontSize: 64,
    align: "center",
    letterSpacing: 0,
    lineHeight: 1.1,
    color: "#1A1D21",
    x: 80,
    y: 110,
    width: 920,
    height: 120,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    constraints: { ...DEFAULT_CONSTRAINTS },
  };
}

async function paintLook(preset: MotionPreset): Promise<LabLook> {
  resetMotionSignals();
  disposeAll();
  const node = makeMotionNode({
    id: `lab-${preset.id}`,
    name: preset.name,
    width: W,
    height: H,
    schema: preset.schema,
    seed: 11,
    preview: "live",
    text: "FILE FIRST",
    text2: "THEN THE LENDER",
  });
  const base = {
    live: true,
    reduced: false,
    dpr: 1 as const,
    hooks: { hook1: "FILE FIRST", hook2: "THEN THE LENDER" },
  };
  motionBitmap(node, [], { ...base, atMs: 0 });
  if (preset.id === "after-hours-warp") await sleep(1400);
  const restA = snapshot(motionBitmap(node, [], { ...base, atMs: 80 }));
  const restB = snapshot(motionBitmap(node, [], { ...base, atMs: 1280 }));
  const clicked = snapshot(
    motionBitmap(node, [], {
      ...base,
      atMs: 220,
      click: { x: node.x + W / 2, y: node.y + H / 2 },
    }),
  );
  setMotionBusy(true);
  noteTyping(1000);
  noteTyping(1080);
  setMotionFocus(true, 900);
  pulseMotion("dock", 1100);
  const busy = snapshot(
    motionBitmap(node, [], {
      ...base,
      atMs: 1400,
      signals: snapshotMotionSignals(1600, { wordCount: 18, selected: true }),
    }),
  );
  setMotionBusy(false);
  setMotionFocus(false);

  const rest = statsOf(restB.data);
  const loop = statsOf(restB.data, restA.data);
  const click = statsOf(clicked.data, restA.data);
  const busyDelta = statsOf(busy.data, restB.data);
  const issues: string[] = [];
  if (rest.paperRatio > 0.992 && rest.opaque > 0.5) issues.push("blank-rest");
  if (preset.schema.visual.background === "transparent" && rest.opaque < 0.01) issues.push("empty-overlay");
  if (LOOPING.has(preset.id) && loop.mae < 0.35) issues.push("frozen-loop");
  if (CLICK.has(preset.id) && click.mae < 0.35) issues.push("dead-click");
  if ((preset.id === "kinetic-strobe-pulse" || preset.id === "thermal-heat-bloom") && busyDelta.mae < 0.2) {
    issues.push("dead-busy");
  }

  const result: LabLook = {
    id: preset.id,
    name: preset.name,
    group: preset.group,
    category: preset.schema.category,
    issues,
    paperRatio: Number(rest.paperRatio.toFixed(4)),
    loopMae: Number(loop.mae.toFixed(3)),
    clickMae: Number(click.mae.toFixed(3)),
    restPng: restB.png,
    clickPng: clicked.png,
  };
  disposeNode(node.id);
  return result;
}

function paintTweens(): LabTween[] {
  const page: CraftPage = {
    ...blankDocument().pages[0]!,
    width: 1080,
    height: 360,
    background: "#F7F5F1",
    nodes: [],
  };
  const host = document.createElement("canvas");
  host.width = page.width;
  host.height = page.height;
  const ctx = host.getContext("2d");
  if (!ctx) return [];
  const out: LabTween[] = [];
  for (const motion of IMAGE_MOTIONS) {
    const node = applyNodeMotion(sampleText(), motion.id);
    page.nodes = [node];
    const spec = node.animation;
    drawFrame(ctx, page, [], { atMs: spec ? spec.duration + 80 : 0 });
    const restSnap = snapshot(host);
    const midAt = spec ? spec.duration / 4 : 0;
    drawFrame(ctx, page, [], { atMs: midAt });
    const midSnap = snapshot(host);
    const midMae = mae(restSnap.data, midSnap.data);
    const issues: string[] = [];
    if (motion.id !== "none" && midMae < 0.2) issues.push("tween-no-change");
    out.push({
      id: motion.id,
      issues,
      midMae: Number(midMae.toFixed(3)),
      restPng: restSnap.png,
      midPng: midSnap.png,
    });
  }
  return out;
}

async function runLab() {
  const looks: LabLook[] = [];
  for (const preset of MOTION_PRESETS) {
    looks.push(await paintLook(preset));
    await sleep(16);
  }
  const tweens = paintTweens();
  disposeAll();
  return { looks, tweens, at: new Date().toISOString() };
}

export default function CraftMotionLab() {
  const [status, setStatus] = useState("running");
  const [looks, setLooks] = useState<LabLook[]>([]);
  const [tweens, setTweens] = useState<LabTween[]>([]);

  useEffect(() => {
    let cancelled = false;
    void runLab().then((report) => {
      if (cancelled) return;
      setLooks(report.looks);
      setTweens(report.tweens);
      setStatus("done");
      (window as unknown as { __MOTION_LAB__?: unknown }).__MOTION_LAB__ = {
        done: true,
        looks: report.looks,
        tweens: report.tweens,
      };
      document.documentElement.dataset.motionLab = "done";
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const failed = looks.filter((look) => look.issues.length > 0);
  const tweenFails = tweens.filter((tween) => tween.issues.length > 0);

  return (
    <div className="min-h-screen bg-[#111] p-6 text-[#F7F5F1]">
      <h1 className="font-[Unbounded] text-xl">Craft motion lab</h1>
      <p id="motion-lab-status" className="mt-1 text-sm text-white/60">
        {status === "running"
          ? `Painting ${MOTION_PRESETS.length} house looks in the live compositor…`
          : `${looks.length} looks, ${failed.length} flagged, ${tweenFails.length} tween flags`}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {looks.map((look) => (
          <figure key={look.id} className="overflow-hidden rounded-lg bg-[#1A1D21] ring-1 ring-white/10">
            <img src={look.restPng} alt={look.name} className="aspect-[8/5] w-full object-cover" />
            <figcaption className="space-y-1 p-2 text-xs">
              <div className="font-medium">{look.name}</div>
              <div className="text-white/45">{look.group}</div>
              <div className={look.issues.length ? "text-red-400" : "text-emerald-400"}>
                {look.issues.length ? look.issues.join(", ") : "ok"} · paper {look.paperRatio} · Δ {look.loopMae}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      {tweens.length > 0 && (
        <section className="mt-10">
          <h2 className="font-[Unbounded] text-lg">CSS tweens</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {tweens.map((tween) => (
              <figure key={tween.id} className="overflow-hidden rounded-lg bg-[#1A1D21] ring-1 ring-white/10">
                <img src={tween.midPng} alt={tween.id} className="h-24 w-full object-cover" />
                <figcaption className="p-2 text-xs">
                  {tween.id} · {tween.issues.length ? tween.issues.join(", ") : "ok"} · Δ {tween.midMae}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
