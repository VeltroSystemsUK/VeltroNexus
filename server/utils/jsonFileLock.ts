import fs from "fs";

const depths = new Map<string, number>();

function removeStaleLock(lockPath: string) {
  try {
    const ownerPid = Number(fs.readFileSync(lockPath, "utf8").trim());
    if (!Number.isInteger(ownerPid) || ownerPid <= 0) {
      fs.unlinkSync(lockPath);
      return;
    }
    try {
      process.kill(ownerPid, 0);
    } catch (error: any) {
      // ESRCH means the process that created the lock has gone away.
      // EPERM means it is alive but inaccessible, so leave the lock intact.
      if (error?.code === "ESRCH") fs.unlinkSync(lockPath);
    }
  } catch {
    // The lock may have been released between the read and this check.
  }
}

function acquireLockFile(lockPath: string) {
  const start = Date.now();
  while (true) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: "wx" });
      return;
    } catch {
      removeStaleLock(lockPath);
      if (Date.now() - start > 8000) {
        throw new Error("json store lock timeout");
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
}

export function withJsonFileLock(filePath: string, fn: () => void) {
  const depth = depths.get(filePath) || 0;
  if (depth > 0) {
    depths.set(filePath, depth + 1);
    try {
      fn();
    } finally {
      depths.set(filePath, depth);
    }
    return;
  }

  const lockPath = `${filePath}.lock`;
  acquireLockFile(lockPath);
  depths.set(filePath, 1);
  try {
    fn();
  } finally {
    depths.delete(filePath);
    try {
      fs.unlinkSync(lockPath);
    } catch {
      /* lock file already gone */
    }
  }
}
