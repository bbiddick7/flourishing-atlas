// POST /api/create-checkout
// Creates a Stripe Checkout session for a credit pack. Requires a logged-in user
// (we verify their Supabase access token). The user's id + email travel with the
// session as metadata so the webhook can credit the right account after payment.

import Stripe from "stripe";
import { getUserFromToken } from "./_lib/supabaseAdmin.js";

// Define your credit packs here. price_id values come from YOUR Stripe dashboard
// (Products → create a product → copy its price ID, looks like "price_...").
// credits = how many surveys that pack grants. Set these after you've checked
// your real per-run cost so each pack clears your cost with margin.
const PACKS = {
  small:  { priceId: process.env.STRIPE_PRICE_SMALL,  credits: 5 },
  medium: { priceId: process.env.STRIPE_PRICE_MEDIUM, credits: 15 },
  large:  { priceId: process.env.STRIPE_PRICE_LARGE,  credits: 50 },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: "Payments aren't configured yet." });

  const { pack, accessToken } = req.body || {};
  const chosen = PACKS[pack];
  if (!chosen || !chosen.priceId) {
    return res.status(400).json({ error: "Unknown credit pack." });
  }

  const user = await getUserFromToken(accessToken);
  if (!user) return res.status(401).json({ error: "Please sign in before buying credits." });

  const stripe = new Stripe(stripeKey);
  const origin = req.headers.origin || `https://${req.headers.host}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: chosen.priceId, quantity: 1 }],
      success_url: `${origin}/?purchase=success`,
      cancel_url: `${origin}/?purchase=cancelled`,
      customer_email: user.email,
      // Metadata is how the webhook knows who to credit and by how much.
      metadata: {
        user_id: user.id,
        email: user.email || "",
        credits: String(chosen.credits),
      },
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-checkout error:", err);
    return res.status(502).json({ error: "Could not start checkout. Please try again." });
  }
}
