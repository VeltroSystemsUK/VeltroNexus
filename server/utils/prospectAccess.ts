import type { Request } from "express";
import type { ProspectWithCompany } from "@shared/schema";
import { storage } from "../storage";

const STAFF_READ_ROLES = new Set(["underwriter", "super_admin", "sales_admin"]);

export async function getReadableProspect(
  req: Request,
  prospectId: number
): Promise<ProspectWithCompany | undefined> {
  const userId = req.user!.id;
  const owned = await storage.getProspect(prospectId, userId);
  if (owned) return owned;

  const user = await storage.getUser(userId);
  if (user && STAFF_READ_ROLES.has(user.role || "")) {
    return storage.getProspectById(prospectId);
  }

  return undefined;
}
