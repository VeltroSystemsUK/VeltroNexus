import { getUncachableStripeClient } from '../server/stripeClient';

async function listProducts() {
  const stripe = await getUncachableStripeClient();
  const products = await stripe.products.list({ limit: 20 });
  
  console.log("Products in Stripe API:");
  for (const p of products.data) {
    console.log(`- ${p.name} (${p.id}) active=${p.active} metadata=`, JSON.stringify(p.metadata));
  }
}

listProducts().catch(console.error);
