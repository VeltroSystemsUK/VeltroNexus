
import Stripe from "stripe";

async function testStripe() {
    console.log("Testing Stripe Connection...");

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
        console.error("❌ STRIPE_SECRET_KEY is missing from environment variables.");
        process.exit(1);
    }
    console.log("✅ STRIPE_SECRET_KEY is present.");

    if (secretKey.startsWith("sk_test_")) {
        console.log("ℹ️ Using Test Mode Key");
    } else {
        console.log("ℹ️ Using Live Mode Key");
    }

    const stripe = new Stripe(secretKey, {
        apiVersion: "2024-06-20" as any,
    });

    try {
        const balance = await stripe.balance.retrieve();
        console.log("✅ Stripe Connection Successful!");
        console.log("   Balance available:", balance.available);
    } catch (error: any) {
        console.error("❌ Stripe Connection Failed:");
        console.error("   Message:", error.message);
    }
}

testStripe();
