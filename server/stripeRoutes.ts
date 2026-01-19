import { Router } from "express";
import { z } from "zod";
import { getUncachableStripeClient } from "./stripeClient";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";

const router = Router();

// Schema for creating a checkout session
const createCheckoutSchema = z.object({
    plan: z.enum(["broker", "team"]),
    interval: z.enum(["monthly", "annual"]),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
});

// Map plans to Environment Variable definitions for Price IDs
// These keys must match what is in the .env file
const PRICE_ID_MAP: Record<string, Record<string, string | undefined>> = {
    broker: {
        monthly: process.env.STRIPE_PRICE_BROKER_MONTHLY,
        annual: process.env.STRIPE_PRICE_BROKER_ANNUAL,
    },
    team: {
        monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY,
        annual: process.env.STRIPE_PRICE_TEAM_ANNUAL,
    },
};

router.post("/create-checkout-session", isAuthenticated, async (req, res) => {
    try {
        const userId = (req.user as any).id;
        const user = await storage.getUser(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const result = createCheckoutSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ error: "Invalid request data", details: result.error });
        }

        const { plan, interval, successUrl, cancelUrl } = result.data;
        const priceId = PRICE_ID_MAP[plan]?.[interval];
        if (!priceId) {
            console.error(`Missing Price ID for ${plan} ${interval}`);
            return res.status(500).json({
                error: "Price configuration missing. Please contact support."
            });
        }

        const stripe = await getUncachableStripeClient();

        // Ensure user has a stripe customer ID
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email || undefined,
                name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
                metadata: {
                    userId: user.id,
                },
            });
            customerId = customer.id;
            await storage.updateUser(userId, { stripeCustomerId: customerId });
        }

        // Create Checkout Session
        const origin = req.headers.origin || "http://localhost:5000";
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: "subscription",
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: successUrl || `${origin}/subscription/complete?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${origin}/pricing`,
            subscription_data: {
                metadata: {
                    plan,
                    interval,
                    userId: user.id
                }
            },
            metadata: {
                plan,
                interval,
                userId: user.id
            }
        });

        res.json({ url: session.url });
    } catch (error: any) {
        console.error("Stripe Checkout Error:", error);
        res.status(500).json({ error: error.message || "Failed to create checkout session" });
    }
});

export const stripeRoutes = router;
