import type { Request, Response, NextFunction } from "express";

type Role = "broker" | "underwriter" | "sales_admin" | "super_admin" | string;



export type AuthUser = {
  id: string;
  role?: Role;
  hasUnderwritingAccess?: number; // 0 or 1
  underwritingAccessExpiresAt?: Date | string | null;
};

export type UnderwritingSubmission = {
  id: number;
  brokerId: string;
  status?: string | null;
  underwriterId?: string | null;
};

export type Ctx = {
  user: AuthUser;
  submission: UnderwritingSubmission;
};

// Extend Express Request with ctx property via module augmentation
declare module "express-serve-static-core" {
  interface Request {
    ctx?: Ctx;
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

function isUnderwriter(user: AuthUser) {
  // Check explicit role
  if (user.role === "underwriter") return true;

  // Check specific access permission (e.g. from add-on)
  // Ensure access hasn't expired if an expiry date is set
  if (user.hasUnderwritingAccess) {
    if (user.underwritingAccessExpiresAt) {
      return new Date(user.underwritingAccessExpiresAt) > new Date();
    }
    return true;
  }

  return false;
}

function canReadSubmission(
  submission: UnderwritingSubmission,
  user: AuthUser,
  opts: { allowTriage?: boolean }
) {
  if (isSuperAdmin(user.role)) return true;

  const isSubmittingBroker = submission.brokerId === user.id;
  const isAssignedUnderwriter = submission.underwriterId === user.id;

  if (isSubmittingBroker || isAssignedUnderwriter) return true;

  const triageAllowed =
    !!opts.allowTriage &&
    isUnderwriter(user) &&
    submission.status === "submitted" &&
    submission.underwriterId == null;

  return triageAllowed;
}

function canWriteSubmission(submission: UnderwritingSubmission, user: AuthUser) {
  // Admins (super_admin and sales_admin) can update any submission
  if (isAdmin(user.role)) return true;

  // Brokers cannot write to submissions (they can only withdraw via separate path)
  if (submission.brokerId === user.id) return false;

  // Underwriters can only write to submissions assigned to them
  return isUnderwriter(user) && submission.underwriterId === user.id;
}

export function requireSubmissionReadAccess(params: { storage: any; allowTriage?: boolean }) {
  const { storage, allowTriage } = params;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.claims?.sub || (req as any).user?.id;
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

      // Pass full user object including underwriting access flags
      const authUser: AuthUser = {
        id: userId,
        role: user?.role,
        hasUnderwritingAccess: user?.hasUnderwritingAccess,
        underwritingAccessExpiresAt: user?.underwritingAccessExpiresAt
      };

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
      const userId = (req as any).user?.claims?.sub || (req as any).user?.id;
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

      // Pass full user object including underwriting access flags
      const authUser: AuthUser = {
        id: userId,
        role: user?.role,
        hasUnderwritingAccess: user?.hasUnderwritingAccess,
        underwritingAccessExpiresAt: user?.underwritingAccessExpiresAt
      };

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


export function requireUnderwritingAccess(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Lenders and Underwriters always have access
  if (user.role === "lender" || user.role === "underwriter") {
    return next();
  }

  // Check generic access flag
  if (!user.hasUnderwritingAccess) {
    return res.status(403).json({
      error: "This feature requires the AI Underwriting add-on",
      code: "UNDERWRITING_ACCESS_REQUIRED"
    });
  }

  // Check expiration if set
  if (user.underwritingAccessExpiresAt) {
    const expiresAt = new Date(user.underwritingAccessExpiresAt);
    if (expiresAt < new Date()) {
      return res.status(403).json({
        error: "Your AI Underwriting access has expired",
        code: "UNDERWRITING_ACCESS_EXPIRED"
      });
    }
  }

  next();
}
