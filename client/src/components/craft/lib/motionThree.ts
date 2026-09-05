import { THREE_CDN } from "./motionSchema";
import type { MotionNode } from "./types";

const THREE_SCRIPT_SRC = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js";

type Uniform = { value: unknown };
type Geom = { dispose: () => void };
type ShaderMat = { uniforms: Record<string, Uniform>; dispose: () => void };
type Mesh = { geometry: Geom; material: ShaderMat };
type Renderer = {
  setSize: (w: number, h: number, updateStyle?: boolean) => void;
  setClearColor: (color: number, alpha?: number) => void;
  render: (scene: unknown, camera: unknown) => void;
  dispose: () => void;
  forceContextLoss?: () => void;
  domElement: HTMLCanvasElement;
};
type Scene = { add: (obj: unknown) => void };
type ThreeNS = {
  Scene: new () => Scene;
  OrthographicCamera: new (l: number, r: number, t: number, b: number, n: number, f: number) => unknown;
  PlaneGeometry: new (w: number, h: number) => Geom;
  ShaderMaterial: new (opts: Record<string, unknown>) => ShaderMat;
  Mesh: new (g: Geom, m: ShaderMat) => Mesh;
  WebGLRenderer: new (opts: Record<string, unknown>) => Renderer;
};

type WarpGL = {
  renderer: Renderer;
  scene: Scene;
  camera: unknown;
  mesh: Mesh;
  width: number;
  height: number;
};

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
varying vec2 vUv;
uniform float uTime;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uBlue;
uniform float uAmp;
uniform float uFreq;
uniform float uSpeed;
uniform float uGrain;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float t = uTime * uSpeed;
  vec2 uv = vUv;
  float w1 = sin((uv.y + t * 0.15) * 6.28318 * uFreq);
  float w2 = cos((uv.x - t * 0.11) * 6.28318 * uFreq * 0.85);
  uv += vec2(w1, w2) * uAmp;
  float vein = 0.5 + 0.5 * sin(uv.x * 9.0 + uv.y * 6.5 + t * 0.35);
  vec3 inkBlue = mix(uInk, uBlue, smoothstep(0.25, 0.8, vein));
  float mixAmt = 0.05 + 0.09 * abs(w1 * w2);
  vec3 col = mix(uPaper, inkBlue, mixAmt);
  col += (hash(vUv * 220.0 + t) - 0.5) * uGrain * 0.07;
  gl_FragColor = vec4(col, 1.0);
}
`;

let loading: Promise<void> | null = null;
let warpGL: WarpGL | null = null;

function threeRoot(): ThreeNS | undefined {
  return (globalThis as { THREE?: ThreeNS }).THREE;
}

function threeSrc(): string {
  return THREE_CDN || THREE_SCRIPT_SRC;
}

function hexToRgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return [0.97, 0.96, 0.95];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function hexToInt(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return Number.isFinite(n) ? n : 0xf7f5f1;
}

export function ensureThree(): Promise<void> {
  if (threeRoot()) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    try {
      if (typeof document === "undefined") {
        reject(new Error("no document"));
        return;
      }
      const src = threeSrc();
      const found = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
      const script = found ?? document.createElement("script");
      const onOk = () => {
        if (threeRoot()) resolve();
        else reject(new Error("THREE missing after load"));
      };
      const onErr = () => reject(new Error("three.js failed to load"));
      script.addEventListener("load", onOk, { once: true });
      script.addEventListener("error", onErr, { once: true });
      if (!found) {
        script.src = src;
        script.async = true;
        document.head.appendChild(script);
      } else if (threeRoot()) {
        resolve();
      }
    } catch (err) {
      reject(err);
    }
  }).catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

function acquire(THREE: ThreeNS, width: number, height: number): WarpGL | null {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (warpGL) {
    if (warpGL.width !== w || warpGL.height !== h) {
      warpGL.renderer.setSize(w, h, false);
      warpGL.width = w;
      warpGL.height = h;
    }
    return warpGL;
  }
  const aux = document.createElement("canvas");
  aux.width = w;
  aux.height = h;
  const renderer = new THREE.WebGLRenderer({
    canvas: aux,
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
    powerPreference: "low-power",
    stencil: false,
    depth: false,
  });
  renderer.setSize(w, h, false);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPaper: { value: [0.969, 0.961, 0.945] },
      uInk: { value: [0.102, 0.114, 0.129] },
      uBlue: { value: [0.184, 0.318, 0.6] },
      uAmp: { value: 0.03 },
      uFreq: { value: 1.1 },
      uSpeed: { value: 0.4 },
      uGrain: { value: 0.05 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  warpGL = { renderer, scene, camera, mesh, width: w, height: h };
  return warpGL;
}

export function drawWarp(canvas: HTMLCanvasElement, node: MotionNode, atMs: number): boolean {
  try {
    const THREE = threeRoot();
    if (!THREE) return false;
    const dst = canvas.getContext("2d");
    if (!dst) return false;
    const gl = acquire(THREE, canvas.width, canvas.height);
    if (!gl) return false;
    const paper = node.schema.visual.background || "#F7F5F1";
    const ink = node.schema.visual.palette[0] ?? "#1A1D21";
    const blue = node.schema.visual.palette[1] ?? "#2F5199";
    const uniforms = gl.mesh.material.uniforms;
    uniforms.uTime!.value = Math.max(0, atMs) / 1000;
    uniforms.uPaper!.value = hexToRgb01(paper);
    uniforms.uInk!.value = hexToRgb01(ink);
    uniforms.uBlue!.value = hexToRgb01(blue);
    uniforms.uAmp!.value = Math.min(0.045, (node.schema.physicsAndMath.amplitude || 18) / 600);
    uniforms.uFreq!.value = Math.max(0.2, node.schema.physicsAndMath.frequency || 1.1);
    uniforms.uSpeed!.value = node.schema.physicsAndMath.speed || 0.4;
    uniforms.uGrain!.value = node.schema.visual.grain;
    gl.renderer.setClearColor(hexToInt(paper), 1);
    gl.renderer.render(gl.scene, gl.camera);
    dst.save();
    dst.setTransform(1, 0, 0, 1, 0, 0);
    dst.globalCompositeOperation = "source-over";
    dst.globalAlpha = 1;
    dst.fillStyle = paper;
    dst.fillRect(0, 0, canvas.width, canvas.height);
    dst.globalAlpha = node.schema.visual.opacity;
    dst.drawImage(gl.renderer.domElement, 0, 0, canvas.width, canvas.height);
    dst.restore();
    return true;
  } catch {
    return false;
  }
}

export function dispose(_nodeId?: string): void {
  if (!warpGL) return;
  try {
    warpGL.mesh.geometry.dispose();
    warpGL.mesh.material.dispose();
    warpGL.renderer.dispose();
    warpGL.renderer.forceContextLoss?.();
    warpGL.renderer.domElement.width = 0;
    warpGL.renderer.domElement.height = 0;
  } catch {
    /* keep the 2D last frame */
  }
  warpGL = null;
}
