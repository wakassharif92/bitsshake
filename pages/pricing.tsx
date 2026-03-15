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
  const membershipDateLabel =
    currentUser?.subscription_status === "active" &&
    currentUser.current_period_end
      ? formatDate(currentUser.current_period_end)
      : trialEndLabel;
  return (
    <div className="min-h-screen bg-gray-50 text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/dashboard">
              <button className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-950 text-white shadow-sm transition-colors hover:bg-slate-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            </Link>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Billing
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                Bits Shake
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 lg:py-10">
        <section className="overflow-hidden rounded-[36px] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="bg-[linear-gradient(135deg,#f8fafc,white_50%,#eef2ff)] px-8 py-10 sm:px-10 lg:px-12">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Pricing
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Limited-time launch offer
                  </span>
                </div>
                <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-slate-950 md:text-5xl">
                  Simple plans for every team
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
                  Upgrade from trial to unlock document creation, templates,
                  invoice workflows, collaboration tools, and continued access
                  across your workspace.
                </p>
                {checkoutError && (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {checkoutError}
                  </div>
                )}
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Trial status
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {trialEnded ? "Ended" : "Active"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {trialEnded ? "Upgrade to continue" : `Ends ${trialEndLabel}`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-white shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                      Best offer
                    </p>
                    <p className="mt-2 text-lg font-semibold">$48 annual</p>
                    <p className="mt-1 text-xs text-white/70">
                      Save more with one yearly payment
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Monthly
                    </p>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                      Flexible
                    </span>
                  </div>
                  <div className="mt-6">
                    <p className="text-sm text-slate-400 line-through">$10</p>
                    <p className="mt-1 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
                      $5
                    </p>
                    <p className="mt-2 text-sm text-slate-500">per month</p>
                  </div>
                  <div className="mt-6 space-y-2 text-sm text-slate-600">
                    <p>Best for flexible monthly billing</p>
                    <p>Full access to documents and invoices</p>
                  </div>
                </div>
                <div className="rounded-[28px] border border-slate-950 bg-slate-950 px-6 py-6 text-white shadow-[0_22px_48px_rgba(15,23,42,0.16)]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                      Annual
                    </p>
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80">
                      Best value
                    </span>
                  </div>
                  <div className="mt-6">
                    <p className="text-sm text-white/35 line-through">$84</p>
                    <p className="mt-1 text-4xl font-semibold tracking-[-0.04em]">
                      $48
                    </p>
                    <p className="mt-2 text-sm text-white/70">per year</p>
                  </div>
                  <div className="mt-6 space-y-2 text-sm text-white/75">
                    <p>Lower effective monthly cost</p>
                    <p>Ideal for teams using the workspace every week</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {!loadingUser && currentUser && (
          <div className="mt-8 rounded-[32px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] px-6 py-5 sm:px-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Membership
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                    Billing overview
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
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
                        className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {resumeLoading ? "Resuming..." : "Resume membership"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCancelSubscription}
                        disabled={cancelLoading}
                        className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {cancelLoading ? "Cancelling..." : "Cancel membership"}
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4 sm:p-8">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Plan
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {currentUser.subscription_status === "active"
                    ? currentUser.plan_interval === "annual"
                      ? "Annual"
                      : "Monthly"
                    : "Free trial"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Status</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {currentUser.subscription_status === "active"
                    ? "Active"
                    : trialEnded
                      ? "Expired"
                      : "Trial"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {currentUser.subscription_status === "active"
                    ? currentUser.cancel_at_period_end
                      ? "Expires"
                      : "Next payment"
                    : "Trial ends"}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {membershipDateLabel}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Billing cycle
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {currentUser.subscription_status === "active"
                    ? currentUser.plan_interval === "annual"
                      ? "Yearly renewal"
                      : "Monthly renewal"
                    : "Trial access"}
                </p>
              </div>
            </div>
            {membershipError && (
              <div className="px-6 pb-6 sm:px-8">
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {membershipError}
                </p>
              </div>
            )}
          </div>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Monthly</h2>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  Flexible
                </span>
              </div>
              <div className="mt-8">
                <div className="text-sm text-slate-400 line-through">
                  $10 / month
                </div>
                <div className="mt-1 text-5xl font-semibold tracking-[-0.04em] text-slate-950">
                  $5
                </div>
                <div className="mt-2 text-sm text-slate-600">per month</div>
              </div>
              <div className="mt-8 space-y-3 text-sm text-slate-600">
                <p>Unlimited document creation</p>
                <p>Templates, invoices, and signature flows</p>
                <p>Ideal for freelancers and small teams</p>
              </div>
            </div>
            <div className="border-t border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-8">
              {!loadingUser && currentUser?.subscription_status === "active" ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-center text-sm font-semibold text-slate-700">
                  You are already a member
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startCheckout("monthly")}
                  disabled={loadingPlan !== null}
                  className="w-full rounded-2xl bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  {loadingPlan === "monthly" ? "Redirecting..." : "Choose Monthly"}
                </button>
              )}
              <p className="mt-3 text-xs text-slate-500">
                Stripe checkout opens securely in the next step.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-slate-950 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
            <div className="bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_38%),linear-gradient(180deg,#0f172a,#111827)] p-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Annual</h2>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  Best value
                </span>
              </div>
              <div className="mt-8">
                <div className="text-sm text-slate-400 line-through">
                  $84 / year
                </div>
                <div className="mt-1 text-5xl font-semibold tracking-[-0.04em]">
                  $48
                </div>
                <div className="mt-2 text-sm text-slate-300">per year</div>
              </div>
              <div className="mt-8 space-y-3 text-sm text-slate-300">
                <p>Save more with one yearly payment</p>
                <p>Best for growing teams using documents weekly</p>
                <p>Full workflow access across your workspace</p>
              </div>
            </div>
            <div className="border-t border-white/10 bg-black/10 p-8">
              {!loadingUser && currentUser?.subscription_status === "active" ? (
                <div className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-center text-sm font-semibold text-white/85">
                  You are already a member
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startCheckout("annual")}
                  disabled={loadingPlan !== null}
                  className="w-full rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100"
                >
                  {loadingPlan === "annual" ? "Redirecting..." : "Choose Annual"}
                </button>
              )}
              <p className="mt-3 text-xs text-slate-400">
                Limited-time pricing is applied automatically at checkout.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
