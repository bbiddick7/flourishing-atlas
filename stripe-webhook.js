// POST /api/stripe-webhook
// Stripe calls this after a payment. This is the ONLY place credits are granted.
//
// Security: we verify the Stripe signature against the raw request body using the
// webhook signing secret. Without this, anyone could POST a fake "payment
// succeeded" event and mint themselves free credits. The signature proves the
// event genuinely came from Stripe.
//
// Vercel note: signature verification needs the RAW body, so we disable the
// default body parser below and read the stream ourselves.

import Stripe from "stripe";
import { getAdminClient } from "./_lib/supabaseAdmin.js";

export const config = {
  api: { bodyParser: false }, // we need the raw body for signature verification
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    console.error("Webhook missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET.");
    return res.status(500).json({ error: "Webhook not configured." });
  }

  const stripe = new Stripe(stripeKey);
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch (err) {
    // Bad/forged signature ends here — no credits granted.
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature." });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const email = session.metadata?.email || session.customer_email || null;
    const credits = parseInt(session.metadata?.credits || "0", 10);

    if (userId && credits > 0) {
      try {
        const admin = getAdminClient();
        // grant_credits is idempotent on the event id, so Stripe retries are safe.
        const { error } = await admin.rpc("grant_credits", {
          p_user_id: userId,
          p_email: email,
          p_amount: credits,
          p_stripe_event: event.id,
        });
        if (error) {
          console.error("grant_credits failed:", error);
          // Return 500 so Stripe retries later rather than dropping the purchase.
          return res.status(500).json({ error: "Could not record purchase." });
        }
      } catch (err) {
        console.error("Webhook grant error:", err);
        return res.status(500).json({ error: "Could not record purchase." });
      }
    } else {
      console.error("Webhook missing metadata; cannot grant.", { userId, credits });
    }
  }

  // Acknowledge all other event types so Stripe doesn't keep retrying them.
  return res.status(200).json({ received: true });
}
