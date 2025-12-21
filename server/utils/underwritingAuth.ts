import type { Request, Response, NextFunction } from "express";

type Role = "broker" | "underwriter" | "sales_admin" | "super_admin" | string;

export type AuthUser = {
  id: string;
  role?: Role;
};

export type UnderwritingSubmission = {
  id: number;
  brokerId: string;
  status?: string | null;
  assignedUnderwriterId?: string | null;
};

export type Ctx = {
  user: AuthUser;
  submission: UnderwritingSubmission;
};

declare global {
  namespace Express {
    interface Request {
      ctx?: Ctx;
    }
  }
}

function isSuperAdmin(role?: Role) {
  return role === "super_admin";
}

function isSalesAdmin(role?: Role) {
  return role === "sales_admin";
}

function isAdmin(role?: Role) {
  return isSuperAdmin(role) || isSalesAdmin(role);
}

function isUnderwriter(role?: Role) {
  return role === "underwriter";
}

function canReadSubmission(
  submission: UnderwritingSubmission,
  user: AuthUser,
  opts: { allowTriage?: boolean }
) {
  if (isSuperAdmin(user.role)) return true;

  const isSubmittingBroker = submission.brokerId === user.id;
  const isAssignedUnderwriter = submission.assignedUnderwriterId === user.id;

  if (isSubmittingBroker || isAssignedUnderwriter) return true;

  const triageAllowed =
    !!opts.allowTriage &&
    isUnderwriter(user.role) &&
    submission.status === "submitted" &&
    submission.assignedUnderwriterId == null;

  return triageAllowed;
}

function canWriteSubmission(submission: UnderwritingSubmission, user: AuthUser) {
  // Admins (super_admin and sales_admin) can update any submission
  if (isAdmin(user.role)) return true;

  // Brokers cannot write to submissions (they can only withdraw via separate path)
  if (submission.brokerId === user.id) return false;

  // Underwriters can only write to submissions assigned to them
  return isUnderwriter(user.role) && submission.assignedUnderwriterId === user.id;
}

export function requireSubmissionReadAccess(params: {
  storage: any;
  allowTriage?: boolean;
}) {
  const { storage, allowTriage } = params;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthenticated" });

      const submissionId = Number(req.params.id);
      if (!Number.isFinite(submissionId)) {
        return res.status(400).json({ error: "Invalid submission id" });
      }

      const [user, submission] = await Promise.all([
        storage.getUser(userId),
        storage.getUnderwritingSubmission(submissionId),
      ]);

      if (!submission) return res.status(404).json({ error: "Not found" });

      const authUser: AuthUser = { id: userId, role: user?.role };
      if (!canReadSubmission(submission, authUser, { allowTriage })) {
        return res.status(403).json({ error: "Access denied" });
      }

      req.ctx = { user: authUser, submission };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireSubmissionWriteAccess(params: { storage: any }) {
  const { storage } = params;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthenticated" });

      const submissionId = Number(req.params.id);
      if (!Number.isFinite(submissionId)) {
        return res.status(400).json({ error: "Invalid submission id" });
      }

      const [user, submission] = await Promise.all([
        storage.getUser(userId),
        storage.getUnderwritingSubmission(submissionId),
      ]);

      if (!submission) return res.status(404).json({ error: "Not found" });

      const authUser: AuthUser = { id: userId, role: user?.role };
      if (!canWriteSubmission(submission, authUser)) {
        return res.status(403).json({ error: "Only the assigned underwriter can do that" });
      }

      req.ctx = { user: authUser, submission };
      next();
    } catch (err) {
      next(err);
    }
  };
}
