import { User } from "@/lib/types";

export const getTrialEndDate = (user: User | null) => {
  if (!user) return null;
  // Always use trial_end_at if available
  if (user.trial_end_at) {
    const date = new Date(user.trial_end_at);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  // Fallback to created_at + 1 month (for backwards compatibility)
  if (user.created_at) {
    const created = new Date(user.created_at);
    if (Number.isNaN(created.getTime())) return null;
    created.setMonth(created.getMonth() + 1);
    return created;
  }
  return null;
};

export const hasPremiumAccess = (user: User | null) => {
  if (!user) return false;
  const subscriptionActive =
    user.subscription_status === "active" ||
    user.subscription_status === "trialing";
  const trialEnd = getTrialEndDate(user);
  const trialActive = trialEnd ? trialEnd > new Date() : false;
  return subscriptionActive || trialActive;
};
