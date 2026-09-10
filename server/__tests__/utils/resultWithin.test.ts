import { describe, expect, it } from "vitest";
import { resultWithin } from "../../utils/resultWithin";

describe("resultWithin", () => {
  it("returns the value when work finishes in time", async () => {
    expect(await resultWithin(Promise.resolve(7), 200)).toBe(7);
  });

  it("returns null when work throws fetch failed", async () => {
    expect(await resultWithin(Promise.reject(new Error("fetch failed")), 200)).toBeNull();
  });

  it("returns null when work exceeds the deadline", async () => {
    expect(await resultWithin(new Promise<number>(() => undefined), 20)).toBeNull();
  });
});
