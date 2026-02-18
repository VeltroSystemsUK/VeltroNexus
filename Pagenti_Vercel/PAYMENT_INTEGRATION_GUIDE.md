# Payment Gateway Integration Guide

## Overview
The Ares Deployment Report now includes:
1. **Download Assessment** button - Generates and downloads a formatted text report
2. **Payment-gated Deployment** - Requires payment before agent deployment

## Current Implementation

### Download Assessment Feature ✅
- **Location**: Executive Summary section
- **Functionality**: Generates a professionally formatted `.txt` file with:
  - Agent details and certification status
  - Executive summary
  - Mastered knowledge domains
  - Guardrail manifesto
  - Performance metrics  
  - Validation case study
  - Architect's note from Ares
- **File naming**: `ARES_Assessment_{AgentName}_{Date}.txt`

### Payment Integration (Ready for Setup) 🔧

The deployment button now triggers `handlePaymentAndDeploy()` which is prepared for payment gateway integration.

## Payment Gateway Options

### Option 1: Stripe (Recommended) 💳

**Why Stripe:**
- Industry standard for SaaS payments
- Excellent developer experience
- Built-in fraud protection
- Supports subscriptions and one-time payments
- Strong compliance (PCI-DSS Level 1)

**Setup Steps:**

1. **Install Stripe:**
```bash
npm install @stripe/stripe-js
```

2. **Add Environment Variables:**
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

3. **Create Backend Endpoint** (`server/routes.ts`):
```typescript
app.post('/api/create-checkout-session', async (req, res) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `Deploy ${req.body.agentName}`,
          description: 'ARES Certified Digital Associate Deployment',
        },
        unit_amount: 99900, // $999.00
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.CLIENT_URL}/deploy/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/forge`,
  });

  res.json({ id: session.id });
});
```

4. **Update Frontend** (`AresDeploymentReport.tsx`):
Uncomment the Stripe integration code in `handlePaymentAndDeploy()`:
```typescript
const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentName, price: 99900 })
});
const session = await response.json();
await stripe.redirectToCheckout({ sessionId: session.id });
```

### Option 2: Revolut Business 🔄

**Why Revolut:**
- Lower fees in UK/Europe
- Multi-currency support
- Modern banking integration
- Good for European customers

**Setup Steps:**

1. **Install Revolut SDK:**
```bash
npm install @revolut/checkout
```

2. **Create Backend Endpoint:**
```typescript
app.get('/api/revolut-checkout', async (req, res) => {
  // Redirect to Revolut payment page
  const paymentLink = `https://pay.revolut.com/checkout/${YOUR_MERCHANT_ID}`;
  res.redirect(paymentLink);
});
```

3. **Update Frontend:**
Uncomment Revolut code in `handlePaymentAndDeploy()`.

## Pricing Structure

Recommended pricing tiers:

| Tier | Price | Description |
|------|-------|-------------|
| **Basic Deploy** | $499 | Single agent deployment |
| **Professional** | $999 | Agent + 3 months support |
| **Enterprise** | $2,499 | Multiple agents + training |

## Security Considerations

1. **Never store payment details** - Let Stripe/Revolut handle PCI compliance
2. **Validate on backend** - Always verify payment server-side
3. **Use webhooks** - Listen for `checkout.session.completed` events
4. **Enable 3D Secure** - For fraud protection

## Testing

### Stripe Test Cards:
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **3D Secure**: 4000 0025 0000 3155

### Test the flow:
1. Complete Ares training for an agent
2. Click "Initialise & Deploy Associate"
3. Verify payment modal appears
4. Complete test payment
5. Verify agent deploys successfully

## Next Steps

1. Choose payment provider (Stripe recommended)
2. Set up merchant account
3. Add API keys to environment variables
4. Implement backend endpoint
5. Update frontend with real integration
6. Test with test cards
7. Go live with production keys

## Support

- **Stripe Docs**: https://stripe.com/docs/checkout
- **Revolut Docs**: https://developer.revolut.com/docs/accept-payments
