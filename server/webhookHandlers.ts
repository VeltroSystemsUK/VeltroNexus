import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import Stripe from 'stripe';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    
    // Process with stripe-replit-sync for automatic data sync
    await sync.processWebhook(payload, signature);

    // Parse the event for custom handling
    const stripe = await getUncachableStripeClient();
    const webhookSecret = await sync.getWebhookSecret();
    
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return;
    }

    // Handle subscription-related events
    await WebhookHandlers.handleSubscriptionEvents(event);
  }

  static async handleSubscriptionEvents(event: Stripe.Event): Promise<void> {
    console.log(`Processing Stripe event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await WebhookHandlers.handleCheckoutCompleted(session);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await WebhookHandlers.handleSubscriptionUpdate(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await WebhookHandlers.handleSubscriptionDeleted(subscription);
        break;
      }
    }
  }

  static async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    console.log('Checkout session completed:', session.id);
    
    if (session.mode !== 'subscription' || !session.subscription || !session.customer) {
      return;
    }

    const customerId = typeof session.customer === 'string' 
      ? session.customer 
      : session.customer.id;
    
    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;

    // Find user by stripe customer ID
    const user = await storage.getUserByStripeCustomerId(customerId);
    if (!user) {
      console.error(`No user found for Stripe customer: ${customerId}`);
      return;
    }

    // Get subscription details to determine tier
    const stripe = await getUncachableStripeClient();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    const tier = await WebhookHandlers.getTierFromSubscription(subscription);
    const prospectLimit = WebhookHandlers.getProspectLimitForTier(tier);

    console.log(`Updating user ${user.id} with subscription: ${subscriptionId}, tier: ${tier}`);

    await storage.updateUserSubscription(user.id, {
      stripeSubscriptionId: subscriptionId,
      subscriptionTier: tier,
      prospectLimit: prospectLimit,
    });
  }

  static async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    console.log('Subscription updated:', subscription.id, 'Status:', subscription.status);
    
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    const user = await storage.getUserByStripeCustomerId(customerId);
    if (!user) {
      console.error(`No user found for Stripe customer: ${customerId}`);
      return;
    }

    if (subscription.status === 'active' || subscription.status === 'trialing') {
      const tier = await WebhookHandlers.getTierFromSubscription(subscription);
      const prospectLimit = WebhookHandlers.getProspectLimitForTier(tier);

      await storage.updateUserSubscription(user.id, {
        stripeSubscriptionId: subscription.id,
        subscriptionTier: tier,
        prospectLimit: prospectLimit,
      });
    } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
      await storage.updateUserSubscription(user.id, {
        stripeSubscriptionId: null,
        subscriptionTier: 'free',
        prospectLimit: 10,
      });
    }
  }

  static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    console.log('Subscription deleted:', subscription.id);
    
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

    const user = await storage.getUserByStripeCustomerId(customerId);
    if (!user) {
      return;
    }

    await storage.updateUserSubscription(user.id, {
      stripeSubscriptionId: null,
      subscriptionTier: 'free',
      prospectLimit: 10,
    });
  }

  static async getTierFromSubscription(subscription: Stripe.Subscription): Promise<string> {
    const stripe = await getUncachableStripeClient();
    
    // Get product from the first subscription item
    const item = subscription.items.data[0];
    if (!item) return 'free';

    const priceId = typeof item.price === 'string' ? item.price : item.price.id;
    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    
    const product = price.product as Stripe.Product;
    const tier = product.metadata?.tier || 'free';
    
    return tier.toLowerCase();
  }

  static getProspectLimitForTier(tier: string): number {
    const limits: Record<string, number> = {
      'starter': 50,
      'team': 250,
      'lender': 999999,
      'free': 10,
    };
    return limits[tier.toLowerCase()] || 10;
  }
}
