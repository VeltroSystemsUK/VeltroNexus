import { toAiBullets } from "@shared/aiBullets";

export function formatAsBulletPoints(text: string | undefined | null): string[] {
  return toAiBullets(text, 24);
}
