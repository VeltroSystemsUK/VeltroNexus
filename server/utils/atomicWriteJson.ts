import fs from "fs";
import path from "path";

function replaceFileSync(tmp: string, file: string) {
  try {
    fs.renameSync(tmp, file);
    return;
  } catch (error: any) {
    if (error?.code !== "EEXIST" && error?.code !== "EPERM" && error?.code !== "EACCES") {
      throw error;
    }
  }
  const bak = `${file}.bak`;
  try {
    fs.unlinkSync(bak);
  } catch {
    /* no previous bak */
  }
  try {
    fs.renameSync(file, bak);
  } catch {
    /* dest missing */
  }
  fs.renameSync(tmp, file);
  try {
    fs.unlinkSync(bak);
  } catch {
    /* bak already gone */
  }
}

export function atomicWriteFileSync(file: string, contents: string) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, contents, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  replaceFileSync(tmp, file);
}

export function readJsonArrayFile(file: string): unknown[] | null {
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(raw) ? raw : null;
  } catch {
    return null;
  }
}
