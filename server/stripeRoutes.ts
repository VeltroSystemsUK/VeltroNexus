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

// Schema for direct subscription creation (Custom Flow)
const createSubscriptionSchema = z.object({
    paymentMethodId: z.string(),
    email: z.string().email(),
    plan: z.enum(["broker", "team"]),
    interval: z.enum(["monthly", "annual"]),
    addOns: z.array(z.string()).optional(),
});

router.post("/create-subscription", isAuthenticated, async (req, res) => {
    try {
        const userId = (req.user as any).id;
        const user = await storage.getUser(userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const result = createSubscriptionSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ error: "Invalid request data", details: result.error });
        }

        const { paymentMethodId, email, plan, interval, addOns = [] } = result.data;
        const priceId = PRICE_ID_MAP[plan]?.[interval];

        if (!priceId) {
            return res.status(500).json({
                error: "Price configuration missing"
            });
        }

        const stripe = await getUncachableStripeClient();

        // 1. Get or Create Customer
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: email,
                name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
                metadata: { userId: user.id },
            });
            customerId = customer.id;
            await storage.updateUser(userId, { stripeCustomerId: customerId });
        }

        // 2. Attach Payment Method to Customer
        try {
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId,
            });
        } catch (error: any) {
            return res.status(400).json({ error: "Failed to attach payment method: " + error.message });
        }

        // 3. Set Default Payment Method for Customer
        await stripe.customers.update(customerId, {
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });

        // 4. Calculate One-off Items and Credits
        const addInvoiceItems: any[] = [];
        let creditsToAdd = 0;

        // Base plan credits
        if (plan === 'broker') creditsToAdd += 50;
        if (plan === 'team') creditsToAdd += 250;

        // Process Add-ons
        if (addOns.includes('prospect_package_1')) {
            creditsToAdd += 100;
            addInvoiceItems.push({
                price_data: {
                    currency: 'gbp',
                    product_data: { name: 'Prospect Package 1 (100 credits)' },
                    unit_amount: 5000, // £50.00
                },
            });
        }

        if (addOns.includes('prospect_package_2')) {
            creditsToAdd += 300;
            addInvoiceItems.push({
                price_data: {
                    currency: 'gbp',
                    product_data: { name: 'Prospect Package 2 (300 credits)' },
                    unit_amount: 10000, // £100.00
                },
            });
        }

        if (addOns.includes('prospect_package_team_1')) {
            creditsToAdd += 500;
            addInvoiceItems.push({
                price_data: {
                    currency: 'gbp',
                    product_data: { name: 'Prospect Package 1 (500 credits)' },
                    unit_amount: 24900, // £249.00
                },
            });
        }

        if (addOns.includes('prospect_package_team_2')) {
            creditsToAdd += 1000;
            addInvoiceItems.push({
                price_data: {
                    currency: 'gbp',
                    product_data: { name: 'Prospect Package 2 (1000 credits)' },
                    unit_amount: 49900, // £499.00
                },
            });
        }

        // Note: active recurring add-ons (AI Underwriting, etc) would go into 'items' if we had Price IDs.
        // For now, we only handle the one-off prospect packages as requested.

        // 5. Create Subscription
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            add_invoice_items: addInvoiceItems.length > 0 ? addInvoiceItems : undefined,
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
            metadata: {
                userId: user.id,
                plan,
                interval
            }
        });

        // 6. Update User Credits
        // "Credits will accrue... Any one off packages purchased will add to this"
        // We add the credits to the existing limit.
        const currentLimit = user.prospectLimit || 0;
        await storage.updateUser(userId, {
            prospectLimit: currentLimit + creditsToAdd,
            subscriptionTier: plan // Update tier as well
        });

        // 7. Handle Payment Status
        const invoice = subscription.latest_invoice as any;
        const paymentIntent = invoice.payment_intent;

        if (paymentIntent.status === 'succeeded') {
            // Fully paid (no 3DS required)
            res.json({ subscriptionId: subscription.id, status: 'active' });
        } else {
            // Requires 3DS or other action
            res.json({
                subscriptionId: subscription.id,
                status: 'requires_action',
                clientSecret: paymentIntent.client_secret
            });
        }

    } catch (error: any) {
        console.error("Create Subscription Error:", error);
        res.status(500).json({ error: error.message || "Failed to create subscription" });
    }
});

export const stripeRoutes = router;
