import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase";
import { User } from "@/lib/types";
import { getTrialEndDate } from "@/lib/subscription";

export default function Pricing() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<"monthly" | "annual" | null>(
    null,
  );
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);

  const fetchUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setCurrentUser(null);
      setLoadingUser(false);
      return;
    }

    const { data: userData } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setCurrentUser(userData || null);
    setLoadingUser(false);
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const startCheckout = async (plan: "monthly" | "annual") => {
    try {
      setCheckoutError(null);
      setLoadingPlan(plan);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan,
          userId: session.user.id,
          email: session.user.email,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Checkout failed");
      }

      window.location.href = data.url;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to start checkout. Please try again.";
      console.error(error);
      setCheckoutError(message);
    } finally {
      setLoadingPlan(null);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
  };

  const handleCancelSubscription = async () => {
    setMembershipError(null);
    setCancelLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Unable to cancel subscription");
      }

      // Wait a moment for webhook to process, then refresh
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await fetchUser();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to cancel subscription";
      setMembershipError(message);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    setMembershipError(null);
    setResumeLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/resume-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Unable to resume subscription");
      }

      // Wait a moment for webhook to process, then refresh
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await fetchUser();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to resume subscription";
      setMembershipError(message);
    } finally {
      setResumeLoading(false);
    }
  };

  const trialEndDate = currentUser ? getTrialEndDate(currentUser) : null;
  const trialEnded = trialEndDate ? trialEndDate <= new Date() : false;
  const trialEndLabel = trialEndDate
    ? formatDate(trialEndDate.toISOString())
    : "—";
  const nextPaymentLabel = currentUser?.current_period_end
    ? formatDate(currentUser.current_period_end)
    : trialEndLabel;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="px-6 py-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition"
          >
            ← Back to dashboard
          </Link>
          <span className="text-sm font-semibold text-gray-900">
            Bits Shake
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16">
        <div className="text-center mb-12">
          <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
            Pricing
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-semibold text-gray-900">
            Simple plans for every team
          </h1>
          <p className="mt-3 text-gray-600">
            Limited time offer applied automatically at checkout.
          </p>
          {checkoutError && (
            <p className="mt-4 text-sm text-red-600">{checkoutError}</p>
          )}
        </div>

        {!loadingUser && currentUser && (
          <div className="mb-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Membership
                </h2>
                <p className="text-sm text-gray-600">
                  {currentUser.subscription_status === "active" ||
                  currentUser.subscription_status === "trialing"
                    ? "Your subscription is active."
                    : trialEnded
                      ? "Your free trial has ended."
                      : "You are on a free trial."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {currentUser.subscription_status === "active" ||
                currentUser.subscription_status === "trialing" ? (
                  currentUser.cancel_at_period_end ? (
                    <button
                      type="button"
                      onClick={handleResumeSubscription}
                      disabled={resumeLoading}
                      className="px-5 py-2 rounded-full border border-gray-300 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:border-gray-400 transition disabled:opacity-50"
                    >
                      {resumeLoading ? "Resuming..." : "Resume membership"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCancelSubscription}
                      disabled={cancelLoading}
                      className="px-5 py-2 rounded-full border border-gray-300 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:border-gray-400 transition disabled:opacity-50"
                    >
                      {cancelLoading ? "Cancelling..." : "Cancel membership"}
                    </button>
                  )
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase text-gray-500">Plan</p>
                <p className="text-sm font-semibold text-gray-900">
                  {currentUser.subscription_status === "active"
                    ? currentUser.plan_interval === "annual"
                      ? "Annual"
                      : "Monthly"
                    : "Free trial"}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase text-gray-500">Status</p>
                <p className="text-sm font-semibold text-gray-900">
                  {currentUser.subscription_status === "active"
                    ? "Active"
                    : trialEnded
                      ? "Expired"
                      : "Trial"}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase text-gray-500">
                  {currentUser.subscription_status === "active"
                    ? currentUser.cancel_at_period_end
                      ? "Expires"
                      : "Next payment"
                    : "Trial ends"}
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {currentUser.subscription_status === "active" &&
                  currentUser.current_period_end
                    ? formatDate(currentUser.current_period_end)
                    : trialEndLabel}
                </p>
              </div>
            </div>
            {membershipError && (
              <p className="mt-4 text-sm text-red-600">{membershipError}</p>
            )}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Monthly</h2>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                Limited time
              </span>
            </div>
            <div className="mt-6">
              <div className="text-sm text-gray-500 line-through">
                $10 / month
              </div>
              <div className="text-4xl font-semibold text-gray-900">$5</div>
              <div className="text-sm text-gray-600">per month</div>
            </div>
            {!loadingUser && currentUser?.subscription_status === "active" ? (
              <div className="mt-8 rounded-full bg-gray-100 px-6 py-3 text-center text-sm font-semibold text-gray-700">
                You are already a member
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startCheckout("monthly")}
                disabled={loadingPlan !== null}
                className="mt-8 w-full rounded-full bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] px-6 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_8px_20px_rgba(0,0,0,0.2)]"
              >
                {loadingPlan === "monthly" ? "Redirecting..." : "Continue"}
              </button>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Stripe checkout will be connected here.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Annual</h2>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                Limited time
              </span>
            </div>
            <div className="mt-6">
              <div className="text-sm text-gray-500 line-through">
                $84 / year
              </div>
              <div className="text-4xl font-semibold text-gray-900">$48</div>
              <div className="text-sm text-gray-600">per year</div>
            </div>
            {!loadingUser && currentUser?.subscription_status === "active" ? (
              <div className="mt-8 rounded-full bg-gray-100 px-6 py-3 text-center text-sm font-semibold text-gray-700">
                You are already a member
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startCheckout("annual")}
                disabled={loadingPlan !== null}
                className="mt-8 w-full rounded-full bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] px-6 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),_0_8px_20px_rgba(0,0,0,0.2)]"
              >
                {loadingPlan === "annual" ? "Redirecting..." : "Continue"}
              </button>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Stripe checkout will be connected here.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
