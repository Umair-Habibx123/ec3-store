import { auth } from "../firebase";

/**
 * Starts a Stripe Checkout session for the given order and redirects the
 * browser to Stripe's hosted payment page. Pricing is recomputed and trusted
 * server-side; we only send productId/quantity + the shipping address.
 */
export async function startStripeCheckout({ items, shippingAddress }) {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be signed in to pay by card.");

    const token = await user.getIdToken();

    const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            items: items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
            })),
            shippingAddress,
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start card payment.");
    }

    window.location.href = data.url;
}
