import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { slugifyLearnTitle } from "@shared/learn";

it("maps four start-here videos and a promo hero", () => {
  const corpus = JSON.parse(readFileSync("scripts/learn_corpus.json", "utf8"));
  expect(corpus.hero.slug).toBe("promo");
  expect(corpus.hero.pathPosition).toBeNull();
  expect(corpus.videos.map((v: any) => v.pathPosition)).toEqual([1, 2, 3, 4]);
  expect(corpus.videos.map((v: any) => v.slug)).toEqual([
    "payday-lenders",
    "cashflow",
    "time-to-pay",
    "bad-brokers",
  ]);
  expect(slugifyLearnTitle(corpus.videos[2].title)).toMatch(/time-to-pay/);
  expect(corpus.videos.every((v: any) => v.inboxFile.endsWith(".mp4"))).toBe(true);
});
