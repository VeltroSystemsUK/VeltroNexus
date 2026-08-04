import type { Request, Response, NextFunction } from "express";

// Env-configured IP/CIDR allowlist for sensitive routes (broker portal, admin).
// Unset IP_ALLOWLIST = allow all, so local/normal access is never broken by default.
// ponytail: IPv4 only — add IPv6 CIDR matching if this ever needs to gate a
// non-local deployment reachable over IPv6.

function ipToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return null;
  return parts.reduce((acc, p) => (acc << 8) + p, 0) >>> 0;
}

function matchesEntry(ip: string, entry: string): boolean {
  const trimmed = entry.trim();
  if (!trimmed) return false;

  if (trimmed.includes("/")) {
    const [range, bitsStr] = trimmed.split("/");
    const bits = parseInt(bitsStr, 10);
    const rangeInt = ipToInt(range);
    const ipInt = ipToInt(ip);
    if (rangeInt === null || ipInt === null || isNaN(bits)) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (rangeInt & mask) === (ipInt & mask);
  }

  return trimmed === ip;
}

export function ipAllowlist() {
  const raw = process.env.IP_ALLOWLIST?.trim();
  const entries = raw ? raw.split(",").map((e) => e.trim()).filter(Boolean) : [];

  return (req: Request, res: Response, next: NextFunction) => {
    if (entries.length === 0) return next(); // no allowlist configured — allow all

    const ip = (req.ip || req.socket.remoteAddress || "").replace(/^::ffff:/, "");
    if (entries.some((entry) => matchesEntry(ip, entry))) {
      return next();
    }

    console.warn(`[IP Allowlist] Blocked request from ${ip} to ${req.path}`);
    res.status(403).json({ error: "Access denied from this network" });
  };
}
