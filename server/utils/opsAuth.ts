import type { NextFunction, Request, Response } from "express";
import { GOD_MODE_USER_ID } from "./godModeAuth";

export function isOpsUser(user: { id?: string; role?: string } | null | undefined): boolean {
  if (!user) return false;
  return user.role === "super_admin" || user.id === GOD_MODE_USER_ID;
}

export function requireOps(req: Request, res: Response, next: NextFunction) {
  if (typeof req.isAuthenticated === "function" && !req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!isOpsUser(req.user as { id?: string; role?: string } | undefined)) {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
}
