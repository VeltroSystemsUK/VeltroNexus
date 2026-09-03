// 1x1 transparent GIF, shared by every open-tracking endpoint.
export const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export function sendTrackingPixel(res: { set: (headers: Record<string, string>) => void; end: (buf: Buffer) => void }) {
  res.set({
    "Content-Type": "image/gif",
    "Content-Length": TRACKING_PIXEL.length.toString(),
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  res.end(TRACKING_PIXEL);
}
