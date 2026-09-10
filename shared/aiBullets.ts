/** Shared shape for every Auto Write / rewrite used on the credit file. */

export const AI_BULLET_INSTRUCTIONS =
  "Write 4 to 6 short bullet points. One fact per line. No paragraphs, no essay, no numbered report, no title heading.";

export function toAiBullets(text: string | null | undefined, cap = 8): string[] {
  if (!text || !String(text).trim()) return [];
  const raw = String(text).replace(/\r\n/g, "\n").trim();
  let lines = raw
    .split("\n")
    .map(stripBulletLine)
    .filter((line) => line.length > 1);
  if (lines.length <= 1) {
    lines = raw
      .split(/(?<=[.!?])\s+(?=[A-Z“"'‘])/)
      .map(stripBulletLine)
      .filter((line) => line.length > 1);
  }
  return lines.slice(0, cap);
}

export function joinAiBullets(items: string[]): string {
  return items.filter((item) => item.trim()).join("\n");
}

function stripBulletLine(line: string): string {
  return line
    .replace(/^\s*#{1,6}\s+/, "")
    .replace(/^\s*[-•*]\s+/, "")
    .replace(/\*\*/g, "")
    .trim();
}
