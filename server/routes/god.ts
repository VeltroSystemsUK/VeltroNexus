import { Router } from "express";
import { storage } from "../storage";
import { requireGodMode } from "../utils/godModeAuth";
import { User } from "@shared/schema";

const router = Router();

// Protect all routes with God Mode middleware
router.use(requireGodMode);

// Get all users
router.get("/users", async (req, res) => {
    console.log("[API] /api/god/users hit");
    try {
        const users = await storage.getAllUsers();
        res.json(users);
    } catch (error) {
        console.error("God Mode: Failed to fetch users", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Suspend a user
router.post("/users/:id/suspend", async (req, res) => {
    try {
        const userId = req.params.id;
        if (userId === req.user!.id) {
            return res.status(400).json({ error: "Cannot suspend yourself" });
        }

        await storage.updateUser(userId, { suspended: true });
        res.json({ success: true, message: "User suspended" });
    } catch (error) {
        console.error("God Mode: Failed to suspend user", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Unsuspend a user
router.post("/users/:id/unsuspend", async (req, res) => {
    try {
        const userId = req.params.id;
        await storage.updateUser(userId, { suspended: false });
        res.json({ success: true, message: "User unsuspended" });
    } catch (error) {
        console.error("God Mode: Failed to unsuspend user", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Delete a user
router.delete("/users/:id", async (req, res) => {
    try {
        const userId = req.params.id;
        if (userId === req.user!.id) {
            return res.status(400).json({ error: "Cannot delete yourself" });
        }
        await storage.deleteUser(userId);
        res.json({ success: true, message: "User deleted" });
    } catch (error) {
        console.error("God Mode: Failed to delete user", error);
        res.status(500).json({ error: "Delete failed" });
    }
});

// Upgrade/Downgrade user tier
router.post("/users/:id/upgrade", async (req, res) => {
    try {
        const userId = req.params.id;
        const { tier } = req.body;

        if (!["free", "basic", "premium", "lender"].includes(tier)) {
            return res.status(400).json({ error: "Invalid tier" });
        }

        await storage.updateUser(userId, { subscriptionTier: tier });
        res.json({ success: true, message: `User upgraded to ${tier}` });
    } catch (error) {
        console.error("God Mode: Failed to upgrade user", error);
        res.status(500).json({ error: "Upgrade failed" });
    }
});

// Get System Stats
router.get("/stats", async (req, res) => {
    try {
        const users = await storage.getAllUsers();
        const activeUsers = users.filter(u => !u.suspended);
        const suspendedUsers = users.filter(u => u.suspended);
        const lenders = users.filter(u => u.subscriptionTier === 'lender');

        // Calculate new users in last 7 days
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const newUsers = users.filter(u => u.createdAt && new Date(u.createdAt) > oneWeekAgo);

        res.json({
            totalUsers: users.length,
            activeUsers: activeUsers.length,
            suspendedUsers: suspendedUsers.length,
            lenders: lenders.length,
            newUsersLastWeek: newUsers.length
        });
    } catch (error) {
        console.error("God Mode: Failed to fetch stats", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
