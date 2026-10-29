import { priceValue } from "@/lib/portfolia/plan-prices";
import { reportConversion, SIGNUP_SEND_TO, SUBSCRIPTION_SEND_TO } from "./ads-consent";

/**
 * Google Ads conversions. Each is offered once per browser (a marker in storage) and carries a transaction id, so
 * Google never counts it twice. Consent is checked inside reportConversion: where it is required and not given,
 * nothing is sent, and the moment is not replayed later.
 */
function firstTime(key: string) {
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
  } catch {
    /* storage blocked: the transaction id still stops double counting */
  }
  return true;
}

/** True for an account created in the last 15 minutes: its first sign-in (email or Google). */
export function isNewAccount(user: { created_at?: string }, now = Date.now()) {
  const created = user.created_at ? Date.parse(user.created_at) : NaN;
  return Number.isFinite(created) && now - created >= -60_000 && now - created < 15 * 60_000;
}

export function reportSignup(userId: string) {
  if (firstTime(`pf_conversion_signup_${userId}`)) void reportConversion(SIGNUP_SEND_TO, { transaction_id: `signup-${userId}` });
}

/** The Personal price in pounds for a stored price id. */
export const subscriptionValue = (priceId: string) => priceValue(priceId) || 3;

/** A Personal subscription confirmed by the payment webhook, reported once with its Paddle id. */
export function reportSubscription(sub: { paddle_subscription_id?: string | null; price_id: string; status: string }) {
  const id = sub.paddle_subscription_id;
  if (!id || !["active", "trialing"].includes(sub.status)) return;
  if (firstTime(`pf_conversion_subscription_${id}`)) void reportConversion(SUBSCRIPTION_SEND_TO, { value: subscriptionValue(sub.price_id), currency: "GBP", transaction_id: id });
}
