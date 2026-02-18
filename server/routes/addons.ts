import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";

const router = Router();

// ── Add-On Products ──────────────────────────────────────────────────────────

router.get("/", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const products = await storage.listAddOnProducts(true);
        res.json(products);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.get("/purchases", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const purchases = await storage.listUserAddOnPurchases(userId);
        res.json(purchases);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

router.get("/credits", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const credits = await storage.getUserProspectCredits(userId);
        res.json({ credits });
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

// Purchase an add-on — payment processing temporarily unavailable
router.post("/purchase", isAuthenticated, async (req: Request, res: Response) => {
    return res.status(503).json({
        error: "Payment processing is temporarily unavailable. Please contact support.",
        unavailable: true,
    });
});

// Admin: Create add-on product (Super Admin only)
router.post("/products", isAuthenticated, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const user = await storage.getUser(userId);

        if (user?.role !== "super_admin") {
            return res.status(403).json({ error: "Super Admin access required" });
        }

        const { title, description, category, quantityIncluded, featureKey, priceInPence, currency } =
            req.body;

        const product = await storage.createAddOnProduct({
            title,
            description,
            category: category || "prospects",
            quantityIncluded: quantityIncluded || 0,
            featureKey,
            priceInPence,
            currency: currency || "GBP",
            isActive: 1,
            displayOrder: 0,
        });

        res.status(201).json(product);
    } catch (error) {
        handleApiError(res, error, "api-error");
    }
});

export default router;
