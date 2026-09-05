import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { withJsonFileLock } from "../../utils/jsonFileLock";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-json-lock-"));

afterEach(() => {
  for (const name of fs.readdirSync(tmpRoot)) {
    fs.rmSync(path.join(tmpRoot, name), { force: true });
  }
});

describe("withJsonFileLock", () => {
  it("runs the critical section exclusively and leaves the payload file in place", () => {
    const file = path.join(tmpRoot, "store.json");
    fs.writeFileSync(file, '{"ok":true}');
    const order: number[] = [];
    withJsonFileLock(file, () => {
      order.push(1);
      withJsonFileLock(file, () => {
        order.push(2);
      });
      order.push(3);
    });
    expect(order).toEqual([1, 2, 3]);
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ ok: true });
    expect(fs.existsSync(file + ".lock")).toBe(false);
  });
});
