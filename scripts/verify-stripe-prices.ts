
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-06-20" as any,
});

async function verifyPrices() {
    console.log("Verifying Price IDs with Stripe API...");

    const prices = [
        { name: "Broker Monthly", id: process.env.STRIPE_PRICE_BROKER_MONTHLY },
        { name: "Broker Annual", id: process.env.STRIPE_PRICE_BROKER_ANNUAL },
        { name: "Team Monthly", id: process.env.STRIPE_PRICE_TEAM_MONTHLY },
        { name: "Team Annual", id: process.env.STRIPE_PRICE_TEAM_ANNUAL },
    ];

    for (const price of prices) {
        if (!price.id) {
            console.log(`❌ Missing ENV for ${price.name}`);
            continue;
        }

        try {
            const p = await stripe.prices.retrieve(price.id);
            console.log(`✅ Valid: ${price.name} (${price.id}) - ${p.currency.toUpperCase()} ${(p.unit_amount || 0) / 100}`);
        } catch (error: any) {
            console.log(`❌ INVALID: ${price.name} (${price.id})`);
            console.log(`   Error: ${error.message}`);
        }
    }
}

verifyPrices();
