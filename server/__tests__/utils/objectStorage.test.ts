import { describe, expect, it } from "vitest";
import { getObjectStorage } from "../../utils/routerHelpers";

describe("getObjectStorage", () => {
  it("can store files locally when no cloud bucket is configured", () => {
    delete process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    expect(() => getObjectStorage()).not.toThrow();
  });
});
