declare module 'better-sqlite3';
declare module 'better-sqlite3-session-store';

declare module 'gifenc' {
  type WriteFrameOpts = {
    palette?: number[][];
    first?: boolean;
    transparent?: boolean;
    transparentIndex?: number;
    delay?: number;
    repeat?: number;
    dispose?: number;
  };

  type Encoder = {
    writeFrame: (index: Uint8Array, width: number, height: number, ops?: WriteFrameOpts) => void;
    finish: () => void;
    bytes: () => Uint8Array;
  };

  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): Encoder;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: string },
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array;
}
