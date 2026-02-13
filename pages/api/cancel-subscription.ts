import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

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

  const { userId } = req.body as { userId?: string };

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  const { data: userData, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, stripe_subscription_id, stripe_customer_id, subscription_status",
    )
    .eq("id", userId)
    .single();

  if (error || !userData?.stripe_subscription_id) {
    return res.status(400).json({ error: "No active subscription" });
  }

  try {
    const subscription = await stripe.subscriptions.update(
      userData.stripe_subscription_id,
      { cancel_at_period_end: true },
    );

    const subscriptionData = subscription as unknown as Stripe.Subscription;

    const currentPeriodEnd = (subscriptionData as any).current_period_end as
      | number
      | null
      | undefined;

    await supabaseAdmin
      .from("users")
      .update({
        cancel_at_period_end: subscriptionData.cancel_at_period_end,
        cancel_at: subscriptionData.cancel_at
          ? new Date(subscriptionData.cancel_at * 1000).toISOString()
          : null,
        subscription_status: subscriptionData.status,
        current_period_end: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Cancel subscription error", err);
    const message =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : "Unable to cancel subscription";
    return res.status(500).json({ error: message });
  }
}
