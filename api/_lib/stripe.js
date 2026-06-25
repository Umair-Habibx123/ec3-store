// api/_lib/stripe.js
// Stripe client + helpers for ONE-TIME order payments (adapted from the
// subscription-billing helpers — trimmed to payment mode for this store).
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("❌ Missing STRIPE_SECRET_KEY in environment variables");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
  typescript: false,
});

/**
 * Create a Stripe Checkout Session in one-time `payment` mode for an order.
 * Line items are built server-side from trusted amounts (never trust the
 * client for pricing).
 */
export async function createOrderCheckoutSession({
  currency,
  items, // [{ title, image, unit_amount (in minor units), quantity }]
  orderId,
  userId,
  customerEmail,
  successUrl,
  cancelUrl,
}) {
  return stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail ?? undefined,
    line_items: items.map((item) => ({
      price_data: {
        currency,
        unit_amount: item.unit_amount,
        product_data: {
          name: item.title,
          images: item.image ? [item.image] : undefined,
        },
      },
      quantity: item.quantity,
    })),
    metadata: { order_id: orderId, user_id: userId },
    payment_intent_data: {
      metadata: { order_id: orderId, user_id: userId },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export function constructStripeWebhookEvent(rawBody, signature) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook secret not configured");
  }
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}
