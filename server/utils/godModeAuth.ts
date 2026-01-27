import { Request, Response, NextFunction } from "express";

export const GOD_MODE_USER_ID = "Auond2MCDRlSuiOXZQDo";

export function requireGodMode(req: Request, res: Response, next: NextFunction) {
    console.log("[GodModeAuth] Checking access...");
    if (!req.isAuthenticated()) {
        console.warn("[GodModeAuth] Not authenticated");
        return res.status(401).send("Not authenticated");
    }

    const user = req.user as any;
    console.log("[GodModeAuth] User ID:", user?.id);

    // Strict check for the specific God Mode user ID
    if (user?.id !== GOD_MODE_USER_ID) {
        console.warn(`Unauthorized access attempt to God Mode by user: ${user?.id}`);
        return res.status(403).send("Access Denied: God Mode Required");
    }

    console.log("[GodModeAuth] Access granted");
    next();
}
