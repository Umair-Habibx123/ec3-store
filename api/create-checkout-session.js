// api/create-checkout-session.js
// Creates a pending order in Firestore and a Stripe Checkout Session for it.
// Pricing is recomputed server-side from the products collection — the client
// is never trusted for amounts.
import { adminDb, verifyRequestUser } from "./_lib/firebaseAdmin.js";
import { createOrderCheckoutSession } from "./_lib/stripe.js";

const CURRENCY = "pkr"; // store sells in Rs.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── 1. Authenticate ─────────────────────────────────────────────
  const decoded = await verifyRequestUser(req);
  if (!decoded) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { items, shippingAddress } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items provided" });
    }
    if (!shippingAddress) {
      return res.status(400).json({ error: "Shipping address required" });
    }

    // ── 2. Recompute prices from Firestore (trusted source) ───────
    const lineItems = [];
    const orderItems = [];
    let totalPrice = 0;

    for (const item of items) {
      const productId = String(item.productId || "");
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      if (!productId) {
        return res.status(400).json({ error: "Item missing productId" });
      }

      const snap = await adminDb.collection("products").doc(productId).get();
      if (!snap.exists) {
        return res.status(400).json({ error: `Product not found: ${productId}` });
      }
      const product = snap.data();
      const price = Number(product.discountedPrice ?? product.originalPrice ?? 0);
      if (!price || price <= 0) {
        return res.status(400).json({ error: `Invalid price for ${productId}` });
      }

      totalPrice += price * quantity;
      orderItems.push({
        productId,
        title: product.title ?? "Product",
        price,
        quantity,
        image: product.image ?? "",
      });
      lineItems.push({
        title: product.title ?? "Product",
        image: product.image ?? "",
        unit_amount: Math.round(price * 100),
        quantity,
      });
    }

    // ── 3. Create the pending order ───────────────────────────────
    const orderRef = adminDb.collection("orders").doc();
    await orderRef.set({
      userId: decoded.uid,
      items: orderItems,
      totalPrice: Number(totalPrice.toFixed(2)),
      shippingAddress,
      status: "pending",
      paymentStatus: "unpaid",
      paymentMethod: "card",
      createdAt: new Date().toISOString(),
    });

    // ── 4. Create the Stripe Checkout Session ─────────────────────
    const origin =
      req.headers.origin ||
      (req.headers.host ? `https://${req.headers.host}` : "");

    const session = await createOrderCheckoutSession({
      currency: CURRENCY,
      items: lineItems,
      orderId: orderRef.id,
      userId: decoded.uid,
      customerEmail: decoded.email,
      successUrl: `${origin}/order-confirmation?order_id=${orderRef.id}&status=success`,
      cancelUrl: `${origin}/checkout?status=cancelled`,
    });

    await orderRef.update({ stripeSessionId: session.id });

    return res.status(200).json({ url: session.url, orderId: orderRef.id });
  } catch (err) {
    console.error("❌ create-checkout-session error:", err);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
}
