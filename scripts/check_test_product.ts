import { getUncachableStripeClient } from '../server/stripeClient';

async function checkProduct() {
  const stripe = await getUncachableStripeClient();
  
  try {
    const product = await stripe.products.retrieve('prod_TeMxY7JyLikMlR');
    console.log("Product found:", product.name);
    console.log("Active:", product.active);
    console.log("Metadata:", JSON.stringify(product.metadata));
    
    // Check for prices
    const prices = await stripe.prices.list({ product: product.id, active: true });
    console.log("\nPrices:");
    for (const p of prices.data) {
      console.log(`- ${p.id}: ${p.unit_amount} ${p.currency} (${p.type})`);
    }
  } catch (err: any) {
    console.log("Error:", err.message);
  }
}

checkProduct();
