import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { withJsonFileLock } from "../../utils/jsonFileLock";

const dirs: string[] = [];

function tmpFile(name: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-json-lock-"));
  dirs.push(dir);
  return path.join(dir, name);
}

afterEach(() => {
  while (dirs.length) {
    fs.rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

describe("withJsonFileLock", () => {
  it("runs the critical section exclusively and leaves the payload file in place", () => {
    const file = tmpFile("store.json");
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

  it("steals a lock left by a dead process instead of timing out", () => {
    const file = tmpFile("stale.json");
    fs.writeFileSync(file, '{"ok":true}');
    fs.writeFileSync(file + ".lock", "99999999");
    const started = Date.now();
    withJsonFileLock(file, () => {
      fs.writeFileSync(file, '{"ok":false}');
    });
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual({ ok: false });
    expect(fs.existsSync(file + ".lock")).toBe(false);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
