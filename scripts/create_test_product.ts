import { getUncachableStripeClient } from '../server/stripeClient';

async function createTestProduct() {
  const stripe = await getUncachableStripeClient();
  
  // Create the test product
  const product = await stripe.products.create({
    name: 'Test Plan',
    description: 'Test payment gateway - for development only',
    metadata: {
      tier: 'test',
      prospectLimit: '5'
    }
  });
  console.log("Created product:", product.id, product.name);
  
  // Create a price for it (£1 one-time)
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 100, // £1.00 in pence
    currency: 'gbp',
    metadata: {
      tier: 'test'
    }
  });
  console.log("Created price:", price.id, "£1.00 one-time");
  
  console.log("\nTest product ready! Restart the app to sync.");
}

createTestProduct();
