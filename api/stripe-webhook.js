// api/stripe-webhook.js
// Stripe webhook receiver. Verifies the signature against the raw body, then
// marks the matching Firestore order as paid. Always returns 200 after a
// verified event — retrying a handled event won't help (mirrors the original
// withStripeWebhook contract).
import { randomUUID } from "crypto";
import { adminDb } from "./_lib/firebaseAdmin.js";
import { constructStripeWebhookEvent } from "./_lib/stripe.js";

// Vercel must NOT parse the body — Stripe signature verification needs the raw bytes.
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const requestId = req.headers["x-request-id"] || randomUUID();

  // ── 1. Verify signature ─────────────────────────────────────────
  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Missing Stripe signature" });
    }
    event = constructStripeWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error(`[${requestId}] ❌ Webhook signature verification failed:`, err?.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  // ── 2. Dispatch ─────────────────────────────────────────────────
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await handleCheckoutFailed(event.data.object);
        break;
      default:
        console.log(`[${requestId}] ℹ️ Unhandled event: ${event.type}`);
    }
  } catch (err) {
    // Logged but still 200 — a verified event shouldn't be retried into a loop.
    console.error(`[${requestId}] ❌ Webhook handler error:`, err);
  }

  return res.status(200).json({ received: true });
}

async function findOrderRef(session) {
  const orderId = session.metadata?.order_id;
  if (orderId) {
    const ref = adminDb.collection("orders").doc(orderId);
    if ((await ref.get()).exists) return ref;
  }
  // Fallback: look up by stored session id.
  const q = await adminDb
    .collection("orders")
    .where("stripeSessionId", "==", session.id)
    .limit(1)
    .get();
  return q.empty ? null : q.docs[0].ref;
}

async function handleCheckoutCompleted(session) {
  if (session.mode !== "payment") return;
  const ref = await findOrderRef(session);
  if (!ref) {
    console.warn("⚠️ No matching order for session", session.id);
    return;
  }
  const paid = session.payment_status === "paid";
  await ref.update({
    paymentStatus: paid ? "paid" : "unpaid",
    status: paid ? "confirmed" : "pending",
    stripePaymentIntentId: session.payment_intent ?? null,
    transactionId: session.payment_intent ?? null,
    paidAt: paid ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  });
  console.log(`✅ Order ${ref.id} marked ${paid ? "paid" : "unpaid"}`);
}

async function handleCheckoutFailed(session) {
  const ref = await findOrderRef(session);
  if (!ref) return;
  await ref.update({
    paymentStatus: "failed",
    updatedAt: new Date().toISOString(),
  });
  console.log(`⚠️ Order ${ref.id} payment failed/expired`);
}
