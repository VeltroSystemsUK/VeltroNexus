export const ZOOM_MIN = 0.08;
export const ZOOM_MAX = 8;
export const ZOOM_FACTOR = 1.08;

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/** Keep the document point under the cursor still while zooming. */
export function zoomToward(input: {
  zoom: number;
  panX: number;
  panY: number;
  originX: number;
  originY: number;
  clientX: number;
  clientY: number;
  factor: number;
}): { zoom: number; panX: number; panY: number } {
  const next = clampZoom(input.zoom * input.factor);
  const mx = input.clientX - input.originX;
  const my = input.clientY - input.originY;
  return {
    zoom: next,
    panX: mx - ((mx - input.panX) * next) / input.zoom,
    panY: my - ((my - input.panY) * next) / input.zoom,
  };
}

export function createPanRaf(apply: (dx: number, dy: number) => void): {
  add: (dx: number, dy: number) => void;
  cancel: () => void;
} {
  let raf = 0;
  let accX = 0;
  let accY = 0;
  return {
    add(dx, dy) {
      accX += dx;
      accY += dy;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        apply(accX, accY);
        accX = 0;
        accY = 0;
        raf = 0;
      });
    },
    cancel() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      accX = 0;
      accY = 0;
    },
  };
}

export const VIEWPORT_HINT = 'Scroll pans · Ctrl+scroll zooms · Space-drag pans';

/** Place the whole artboard — including bottom copy — inside the canvas host. */
export function fitPageInView(
  pageW: number,
  pageH: number,
  availW: number,
  availH: number,
  pad = 24,
): { zoom: number; panX: number; panY: number } {
  const innerW = Math.max(64, availW - pad * 2);
  const innerH = Math.max(64, availH - pad * 2);
  const zoom = clampZoom(Math.min(innerW / Math.max(1, pageW), innerH / Math.max(1, pageH)));
  return {
    zoom,
    panX: (availW - pageW * zoom) / 2,
    panY: (availH - pageH * zoom) / 2,
  };
}

export function panFromWheel(deltaX: number, deltaY: number, shiftKey: boolean): { dx: number; dy: number } {
  if (shiftKey && deltaX === 0) return { dx: -deltaY, dy: 0 };
  return { dx: -deltaX, dy: -deltaY };
}

/** Keep a fixed menu inside the viewport. Flip up if it would clip the bottom. */
export function placeMenu(
  x: number,
  y: number,
  menuW: number,
  menuH: number,
  vw: number,
  vh: number,
  pad = 8,
): { left: number; top: number; maxHeight: number } {
  const maxHeight = Math.max(120, vh - pad * 2);
  const h = Math.min(menuH, maxHeight);
  const w = Math.min(menuW, Math.max(120, vw - pad * 2));
  let left = x;
  let top = y;
  if (y + h > vh - pad) top = y - h;
  if (top < pad) top = pad;
  if (top + h > vh - pad) top = Math.max(pad, vh - h - pad);
  if (left + w > vw - pad) left = vw - w - pad;
  if (left < pad) left = pad;
  return { left, top, maxHeight };
}
