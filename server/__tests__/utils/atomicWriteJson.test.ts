import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { atomicWriteFileSync } from "../../utils/atomicWriteJson";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atomic-json-"));
  dirs.push(dir);
  return path.join(dir, "store.json");
}

describe("atomicWriteFileSync", () => {
  it("replaces an existing file and leaves no tmp behind", () => {
    const file = tmpFile();
    fs.writeFileSync(file, "old");
    atomicWriteFileSync(file, "new");
    expect(fs.readFileSync(file, "utf8")).toBe("new");
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
    expect(fs.existsSync(`${file}.bak`)).toBe(false);
  });
});
