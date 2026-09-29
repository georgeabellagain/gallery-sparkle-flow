import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch, getPaddleClient, type PaddleEnv } from "./paddle.server";

const envSchema = z.enum(["sandbox", "live"]);
const PRICE_IDS = ["personal_monthly", "personal_yearly"] as const;

async function paddlePriceId(env: PaddleEnv, externalId: string): Promise<string> {
  const res = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(externalId)}`);
  if (!res.ok) throw new Error(`Price lookup failed [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as { data?: { id: string }[] };
  const id = json.data?.[0]?.id;
  if (!id) throw new Error("Price not found");
  return id;
}

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ priceId: z.enum(PRICE_IDS), environment: envSchema }).parse(d))
  .handler(async ({ data }) => paddlePriceId(data.environment, data.priceId));

async function currentSub(supabase: any, userId: string, env: PaddleEnv) {
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("environment", env)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { paddle_subscription_id: string; paddle_customer_id: string; status: string; cancel_at_period_end: boolean | null } | null;
}

/** Opens Paddle's customer portal (cancel, card details, invoices). */
export const getPortalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ environment: envSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const sub = await currentSub(context.supabase, context.userId, data.environment);
    if (!sub) throw new Error("No subscription found");
    const s = await getPaddleClient(data.environment).customerPortalSessions.create(sub.paddle_customer_id, [sub.paddle_subscription_id]);
    // Overview covers card updates, invoices and cancellation in one place.
    return s.urls.general.overview;
  });

/** Switch monthly <-> yearly immediately, charging or crediting the difference. */
export const switchBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ environment: envSchema, priceId: z.enum(PRICE_IDS) }).parse(d))
  .handler(async ({ data, context }) => {
    const sub = await currentSub(context.supabase, context.userId, data.environment);
    if (!sub || sub.status === "canceled") throw new Error("No active subscription");
    if (sub.cancel_at_period_end) throw new Error("Keep your plan first, then switch billing.");
    if (sub.status !== "active" && sub.status !== "trialing") throw new Error("Please update your card before switching billing.");
    const price = await paddlePriceId(data.environment, data.priceId);
    await getPaddleClient(data.environment).subscriptions.update(sub.paddle_subscription_id, {
      items: [{ priceId: price, quantity: 1 }],
      prorationBillingMode: "prorated_immediately",
    });
    return { ok: true };
  });

/** Undo a scheduled cancellation — the plan simply renews on its normal date. */
export const keepSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ environment: envSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const sub = await currentSub(context.supabase, context.userId, data.environment);
    if (!sub || sub.status === "canceled" || !sub.cancel_at_period_end) throw new Error("Nothing to undo");
    await getPaddleClient(data.environment).subscriptions.update(sub.paddle_subscription_id, { scheduledChange: null });
    return { ok: true };
  });
