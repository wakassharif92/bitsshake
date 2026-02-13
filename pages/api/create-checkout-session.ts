import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY env var");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-01-28.clover",
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { plan, userId, email } = req.body as {
    plan?: "monthly" | "annual";
    userId?: string;
    email?: string | null;
  };
  const monthlyPriceId =
    process.env.STRIPE_MONTHLY_PRICE_ID ||
    process.env.STRIPE_PRICE_MONTHLY ||
    process.env.STRIPE_PRICE_ID_MONTHLY;
  const annualPriceId =
    process.env.STRIPE_YEARLY_PRICE_ID ||
    process.env.STRIPE_PRICE_ANNUAL ||
    process.env.STRIPE_PRICE_ID_ANNUAL;

  const priceId = plan === "annual" ? annualPriceId : monthlyPriceId;

  if (!priceId) {
    return res.status(400).json({
      error:
        "Missing price configuration. Set STRIPE_MONTHLY_PRICE_ID and STRIPE_YEARLY_PRICE_ID (or STRIPE_PRICE_MONTHLY/STRIPE_PRICE_ANNUAL).",
    });
  }

  const origin = req.headers.origin || process.env.NEXT_PUBLIC_APP_URL;

  if (!origin) {
    return res.status(400).json({
      error: "Missing app URL. Set NEXT_PUBLIC_APP_URL.",
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email || undefined,
      client_reference_id: userId || undefined,
      metadata: userId ? { user_id: userId } : undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error", error);
    const message =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : "Unable to create checkout session";
    return res.status(500).json({ error: message });
  }
}
