import Stripe from 'stripe';

export async function getUncachableStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  return new Stripe(secretKey, {
    apiVersion: '2024-06-20' as any,
  });
}

export async function getStripePublishableKey() {
  return process.env.STRIPE_PUBLISHABLE_KEY;
}

export async function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY;
}

// Emulate getStripeSync but throw or no-op since we removed the lib
export async function getStripeSync() {
  throw new Error("Stripe Sync (stripe-replit-sync) has been removed.");
}
