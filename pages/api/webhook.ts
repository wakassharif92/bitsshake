import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { buffer } from "micro";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || "";

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-01-28.clover",
});

const resolvePlanInterval = (priceId?: string | null) => {
  const monthlyPriceId =
    process.env.STRIPE_MONTHLY_PRICE_ID ||
    process.env.STRIPE_PRICE_MONTHLY ||
    process.env.STRIPE_PRICE_ID_MONTHLY;
  const annualPriceId =
    process.env.STRIPE_YEARLY_PRICE_ID ||
    process.env.STRIPE_PRICE_ANNUAL ||
    process.env.STRIPE_PRICE_ID_ANNUAL;

  if (!priceId) return null;
  if (priceId === annualPriceId) return "annual";
  if (priceId === monthlyPriceId) return "monthly";
  return null;
};

const getSupabaseAdmin = () => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return supabase;
};

const updateUserById = async (userId: string, updates: Record<string, any>) => {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("users")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    throw error;
  }
};

const updateUserByCustomerId = async (
  customerId: string,
  updates: Record<string, any>,
) => {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin
    .from("users")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", customerId);

  if (error) {
    throw error;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log("[WEBHOOK START]", req.method, req.url);

  // Validate env vars at runtime
  if (!stripeSecretKey) {
    console.error("[WEBHOOK] Missing STRIPE_SECRET_KEY");
    return res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });
  }

  if (!webhookSecret) {
    console.error("[WEBHOOK] Missing STRIPE_WEBHOOK_SECRET");
    return res.status(500).json({ error: "Missing STRIPE_WEBHOOK_SECRET" });
  }

  if (!supabaseUrl) {
    console.error("[WEBHOOK] Missing NEXT_PUBLIC_SUPABASE_URL");
    return res.status(500).json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" });
  }

  if (!supabaseServiceKey) {
    console.error("[WEBHOOK] Missing NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
    return res
      .status(500)
      .json({ error: "Missing NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method not allowed");
  }

  let event: Stripe.Event;

  try {
    console.log("[WEBHOOK] Parsing request body...");
    const rawBody = await buffer(req);
    console.log("[WEBHOOK] Raw body received, size:", rawBody.length);

    const signatureHeader = req.headers["stripe-signature"];
    console.log(
      "[WEBHOOK] Signature header:",
      signatureHeader ? "present" : "missing",
    );

    if (typeof signatureHeader !== "string") {
      console.warn("[WEBHOOK] Invalid signature header");
      return res.status(400).send("Missing Stripe signature");
    }

    console.log("[WEBHOOK] Constructing event...");
    event = stripe.webhooks.constructEvent(
      rawBody,
      signatureHeader,
      webhookSecret,
    );
    console.log("[WEBHOOK] Event constructed:", event.type);
  } catch (err) {
    console.error("Webhook signature verification failed.", err);
    return res.status(400).send("Webhook Error");
  }

  try {
    const handledEvents = new Set([
      "checkout.session.completed",
      "invoice.payment_succeeded",
      "invoice.payment_failed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ]);

    console.log("[WEBHOOK] Event type:", event.type);
    console.log("[WEBHOOK] Is handled event:", handledEvents.has(event.type));

    if (!handledEvents.has(event.type)) {
      console.log("[WEBHOOK] Ignoring unhandled event type:", event.type);
      return res.status(200).json({ received: true });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.user_id;
        const subscriptionId = session.subscription as string | null;
        const customerId = session.customer as string | null;

        console.log("[WEBHOOK] checkout.session.completed", {
          userId,
          customerId,
          subscriptionId,
        });

        if (userId && subscriptionId) {
          // Fetch full subscription details to get current_period_end and plan
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          const subscriptionData = subscription as any;
          console.log("[WEBHOOK] Subscription retrieved:", {
            subscriptionId,
            current_period_end: subscriptionData.current_period_end,
            status: subscriptionData.status,
          });

          const priceId = subscriptionData.items?.data?.[0]?.price?.id || null;
          const planInterval = resolvePlanInterval(priceId);
          const periodEnd = subscriptionData.current_period_end
            ? new Date(subscriptionData.current_period_end * 1000).toISOString()
            : null;

          console.log("[WEBHOOK] Extracted period end:", {
            periodEnd,
            planInterval,
            priceId,
          });

          await updateUserById(userId, {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: "active",
            current_period_end: periodEnd,
            plan_interval: planInterval,
          });
          console.log(
            "[WEBHOOK] User updated with subscription details:",
            userId,
          );
        } else if (userId) {
          await updateUserById(userId, {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: "active",
          });
          console.log(
            "[WEBHOOK] User updated (no subscription details):",
            userId,
          );
        } else {
          console.warn("[WEBHOOK] No userId found in session");
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceData = invoice as any;
        const customerId = invoiceData.customer as string | null;
        const subscriptionId = invoiceData.subscription as string | null;
        const priceId = invoiceData.lines?.data?.[0]?.price?.id || null;
        const planInterval = resolvePlanInterval(priceId);
        const periodEnd = invoiceData.lines?.data?.[0]?.period?.end
          ? new Date(invoiceData.lines.data[0].period.end * 1000).toISOString()
          : null;

        console.log("[WEBHOOK] invoice.payment_succeeded", {
          customerId,
          subscriptionId,
          planInterval,
          periodEnd,
        });

        if (customerId) {
          await updateUserByCustomerId(customerId, {
            stripe_subscription_id: subscriptionId,
            subscription_status: "active",
            current_period_end: periodEnd,
            plan_interval: planInterval,
          });
          console.log("[WEBHOOK] User updated by customerId:", customerId);
        } else {
          console.warn("[WEBHOOK] No customerId found in invoice");
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceData = invoice as any;
        const customerId = invoiceData.customer as string | null;

        if (customerId) {
          await updateUserByCustomerId(customerId, {
            subscription_status: "past_due",
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionData = subscription as any;
        const customerId = subscriptionData.customer as string | null;
        const status = subscriptionData.status as string;
        const priceId = subscriptionData.items?.data?.[0]?.price?.id || null;
        const planInterval = resolvePlanInterval(priceId);
        const periodEnd = subscriptionData.current_period_end
          ? new Date(subscriptionData.current_period_end * 1000).toISOString()
          : null;
        const cancelAt = subscriptionData.cancel_at
          ? new Date(subscriptionData.cancel_at * 1000).toISOString()
          : null;

        if (customerId) {
          await updateUserByCustomerId(customerId, {
            subscription_status: status,
            current_period_end: periodEnd,
            plan_interval: planInterval,
            cancel_at_period_end: subscriptionData.cancel_at_period_end,
            cancel_at: cancelAt,
          });
        }
        break;
      }
      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handler error", err);
    const message =
      err instanceof Error ? err.message : "Webhook handler failed";
    return res.status(500).json({ error: message });
  }
}
