/**
 * Stripe Product Seeding Script
 * 
 * Run this script to create subscription products in Stripe:
 *   npx tsx scripts/seed-stripe-products.ts
 * 
 * Products are synced to the local database automatically via webhooks.
 */

import { getUncachableStripeClient } from "../server/stripeClient";

interface ProductConfig {
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: {
    nickname: string;
    unit_amount: number;
    currency: string;
    interval?: "month" | "year";
    metadata?: Record<string, string>;
  }[];
}

const SUBSCRIPTION_PRODUCTS: ProductConfig[] = [
  {
    name: "Starter Plan",
    description: "Perfect for independent brokers. Includes 50 prospects and full due diligence suite.",
    metadata: {
      tier: "starter",
      prospectLimit: "50",
      features: "companies_house,due_diligence,contact_management,activity_tracking,pdf_reports",
    },
    prices: [
      {
        nickname: "Starter Monthly",
        unit_amount: 3900, // £39/month
        currency: "gbp",
        interval: "month",
        metadata: { billing_period: "monthly" },
      },
      {
        nickname: "Starter Annual",
        unit_amount: 39000, // £390/year
        currency: "gbp",
        interval: "year",
        metadata: { billing_period: "annual" },
      },
    ],
  },
  {
    name: "Team Plan",
    description: "For growing sales teams. 5 seats, 250 prospects, role-based access, and internal underwriting workflow.",
    metadata: {
      tier: "team",
      prospectLimit: "250",
      seats: "5",
      features: "role_based_access,underwriting_workflow,team_dashboard,priority_support,onboarding",
    },
    prices: [
      {
        nickname: "Team Monthly",
        unit_amount: 22900, // £229/month
        currency: "gbp",
        interval: "month",
        metadata: { billing_period: "monthly" },
      },
      {
        nickname: "Team Annual",
        unit_amount: 229000, // £2290/year
        currency: "gbp",
        interval: "year",
        metadata: { billing_period: "annual" },
      },
    ],
  },
  {
    name: "Lender Plan",
    description: "Enterprise credit teams & lenders. Unlimited prospects, AI credit underwriting, white-label branding, and API access.",
    metadata: {
      tier: "lender",
      prospectLimit: "unlimited",
      seats: "unlimited",
      features: "ai_underwriting,credit_committee,custom_scoring,white_label,api_access,dedicated_manager,sla_support",
    },
    prices: [
      {
        nickname: "Lender Monthly",
        unit_amount: 99900, // £999/month
        currency: "gbp",
        interval: "month",
        metadata: { billing_period: "monthly" },
      },
      {
        nickname: "Lender Annual",
        unit_amount: 999000, // £9990/year
        currency: "gbp",
        interval: "year",
        metadata: { billing_period: "annual" },
      },
    ],
  },
];

const ADDON_PRODUCTS: ProductConfig[] = [
  {
    name: "Prospect Pack - 25",
    description: "Add 25 additional prospects to your account.",
    metadata: {
      type: "addon",
      prospectCredits: "25",
    },
    prices: [
      {
        nickname: "25 Prospect Pack",
        unit_amount: 1500, // £15 one-time
        currency: "gbp",
      },
    ],
  },
  {
    name: "Prospect Pack - 100",
    description: "Add 100 additional prospects to your account.",
    metadata: {
      type: "addon",
      prospectCredits: "100",
    },
    prices: [
      {
        nickname: "100 Prospect Pack",
        unit_amount: 5000, // £50 one-time
        currency: "gbp",
      },
    ],
  },
  {
    name: "AI Credit Underwriting Add-on",
    description: "Unlock AI-powered credit underwriting analysis for your prospects.",
    metadata: {
      type: "addon",
      feature: "ai_underwriting",
    },
    prices: [
      {
        nickname: "AI Underwriting Monthly",
        unit_amount: 2900, // £29/month
        currency: "gbp",
        interval: "month",
      },
    ],
  },
];

async function seedProducts() {
  console.log("Connecting to Stripe...");
  const stripe = await getUncachableStripeClient();

  console.log("\n=== Creating Subscription Products ===\n");
  
  for (const product of SUBSCRIPTION_PRODUCTS) {
    // Check if product already exists
    const existing = await stripe.products.search({
      query: `name:'${product.name}'`,
    });

    if (existing.data.length > 0) {
      console.log(`✓ ${product.name} already exists (${existing.data[0].id})`);
      continue;
    }

    console.log(`Creating ${product.name}...`);
    const stripeProduct = await stripe.products.create({
      name: product.name,
      description: product.description,
      metadata: product.metadata,
    });

    for (const price of product.prices) {
      const priceData: any = {
        product: stripeProduct.id,
        nickname: price.nickname,
        unit_amount: price.unit_amount,
        currency: price.currency,
        metadata: price.metadata,
      };

      if (price.interval) {
        priceData.recurring = { interval: price.interval };
      }

      const stripePrice = await stripe.prices.create(priceData);
      console.log(`  Created price: ${price.nickname} (${stripePrice.id})`);
    }

    console.log(`✓ Created ${product.name} (${stripeProduct.id})`);
  }

  console.log("\n=== Creating Add-on Products ===\n");

  for (const product of ADDON_PRODUCTS) {
    // Check if product already exists
    const existing = await stripe.products.search({
      query: `name:'${product.name}'`,
    });

    if (existing.data.length > 0) {
      console.log(`✓ ${product.name} already exists (${existing.data[0].id})`);
      continue;
    }

    console.log(`Creating ${product.name}...`);
    const stripeProduct = await stripe.products.create({
      name: product.name,
      description: product.description,
      metadata: product.metadata,
    });

    for (const price of product.prices) {
      const priceData: any = {
        product: stripeProduct.id,
        nickname: price.nickname,
        unit_amount: price.unit_amount,
        currency: price.currency,
        metadata: price.metadata,
      };

      if (price.interval) {
        priceData.recurring = { interval: price.interval };
      }

      const stripePrice = await stripe.prices.create(priceData);
      console.log(`  Created price: ${price.nickname} (${stripePrice.id})`);
    }

    console.log(`✓ Created ${product.name} (${stripeProduct.id})`);
  }

  console.log("\n=== Done! ===");
  console.log("Products will sync to your database via webhooks.");
}

seedProducts().catch(console.error);
