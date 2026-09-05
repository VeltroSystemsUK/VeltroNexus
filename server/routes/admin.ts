import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { hashPassword, isAuthenticated } from "../auth";
import { User } from "@shared/schema";
import { discoverNewLenders } from "../services/discoveryService";
import { toPublicUser } from "../utils/publicUser";

const adminUserPatchSchema = z.object({
    role: z.enum(["broker", "underwriter", "sales_admin", "super_admin"]).optional(),
    subscriptionTier: z.string().min(1).max(40).optional(),
    suspended: z.boolean().optional(),
    prospectLimit: z.number().int().min(0).max(1_000_000).optional(),
    password: z.string().min(8).max(200).optional(),
});

const router = Router();

// Middleware to ensure user is an admin
// We'll allow super_admin and sales_admin for now, but restrict certain actions inside
const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
        return res.status(401).send("Not authenticated");
    }
    const user = req.user as User;
    if (user.role !== "super_admin" && user.role !== "sales_admin") {
        return res.status(403).send("Access Denied: Admin privileges required");
    }
    next();
};

router.use(isAuthenticated);
router.use(requireAdmin);

// Get all users
router.get("/users", async (req, res) => {
    try {
        const users = await storage.getAllUsers();
        res.json(users.map((row) => toPublicUser(row as any)));
    } catch (error) {
        console.error("Admin: Failed to fetch users", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Update user (Role, Subscription, Suspension)
router.patch("/users/:id", async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUser = req.user as User;
        const parsed = adminUserPatchSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid user update" });
        }
        const updates: Record<string, unknown> = { ...parsed.data };
        if (typeof updates.password === "string") {
            updates.password = await hashPassword(updates.password);
        }

        // Prevent self-lockout (cannot suspend/delete/demote self)
        if (userId === currentUser.id) {
            if (updates.suspended || updates.role || updates.subscriptionTier) {
                return res.status(400).json({ error: "Cannot modify your own critical settings" });
            }
        }

        // Only super_admin can change roles to super_admin or modify other super_admins
        if (updates.role === "super_admin" && currentUser.role !== "super_admin") {
            return res.status(403).json({ error: "Only Super Admins can promote users to Super Admin" });
        }

        const targetUser = await storage.getUser(userId);
        if (!targetUser) return res.status(404).json({ error: "User not found" });

        if (targetUser.role === "super_admin" && currentUser.role !== "super_admin") {
            return res.status(403).json({ error: "Cannot modify Super Admin accounts" });
        }

        const updatedUser = await storage.updateUser(userId, updates as any);
        res.json(toPublicUser(updatedUser as any));
    } catch (error) {
        console.error("Admin: Failed to update user", error);
        res.status(500).json({ error: "Update failed" });
    }
});

// Delete user
router.delete("/users/:id", async (req, res) => {
    try {
        const userId = req.params.id;
        const currentUser = req.user as User;

        if (userId === currentUser.id) {
            return res.status(400).json({ error: "Cannot delete yourself" });
        }

        const targetUser = await storage.getUser(userId);
        if (!targetUser) return res.status(404).json({ error: "User not found" });

        if (targetUser.role === "super_admin" && currentUser.role !== "super_admin") {
            return res.status(403).json({ error: "Cannot delete Super Admin accounts" });
        }

        await storage.deleteUser(userId);
        res.status(204).send();
    } catch (error) {
        console.error("Admin: Failed to delete user", error);
        res.status(500).json({ error: "Delete failed" });
    }
});

// Bulk update lenders
router.patch("/lenders/bulk-update", async (req, res) => {
    try {
        const currentUser = req.user as User;
        if (currentUser.role !== "super_admin") {
            return res.status(403).json({ error: "Only Super Admins can perform bulk updates" });
        }

        const { ids, updates } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "Lender IDs are required" });
        }

        await storage.adminBulkUpdateLenders(ids, updates);
        res.json({ success: true, message: `Successfully updated ${ids.length} lenders` });
    } catch (error) {
        console.error("Admin: Failed to bulk update lenders", error);
        res.status(500).json({ error: "Bulk update failed" });
    }
});

// Bulk delete lenders
router.delete("/lenders/bulk-delete", async (req, res) => {
    try {
        const currentUser = req.user as User;
        if (currentUser.role !== "super_admin") {
            return res.status(403).json({ error: "Only Super Admins can perform bulk deletions" });
        }

        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "Lender IDs are required" });
        }

        await storage.adminBulkDeleteLenders(ids);
        res.json({ success: true, message: `Successfully deleted ${ids.length} lenders` });
    } catch (error) {
        console.error("Admin: Failed to bulk delete lenders", error);
        res.status(500).json({ error: "Bulk deletion failed" });
    }
});

// Lender Discovery
router.post("/lenders/discover", async (req, res) => {
    try {
        const currentUser = req.user as User;
        if (currentUser.role !== "super_admin") {
            return res.status(403).json({ error: "Only Super Admins can use lender discovery" });
        }

        const { query } = req.body;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: "Search query is required" });
        }

        const results = await discoverNewLenders(query);
        res.json(results);
    } catch (error) {
        console.error("Admin: Discovery failed", error);
        res.status(500).json({ error: "Discovery failed" });
    }
});

export default router;
