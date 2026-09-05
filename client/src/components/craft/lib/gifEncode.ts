import { GIFEncoder, quantize, applyPalette } from "gifenc";

export function encodeGif(frames: Uint8Array[], width: number, height: number, fps: number): Uint8Array {
  const gif = GIFEncoder();
  const delay = Math.max(2, Math.round(100 / Math.max(1, fps))); // GIF hundredths
  frames.forEach((frame, i) => {
    const palette = quantize(frame, 256);
    const index = applyPalette(frame, palette);
    gif.writeFrame(index, width, height, { palette, delay, first: i === 0, repeat: 0 });
  });
  gif.finish();
  return gif.bytes();
}
