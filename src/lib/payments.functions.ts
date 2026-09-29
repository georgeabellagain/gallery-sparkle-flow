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
  return data as { paddle_subscription_id: string; paddle_customer_id: string; status: string } | null;
}

/** Opens Paddle's customer portal (cancel, card details, invoices). */
export const getPortalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ environment: envSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const sub = await currentSub(context.supabase, context.userId, data.environment);
    if (!sub) throw new Error("No subscription found");
    const s = await getPaddleClient(data.environment).customerPortalSessions.create(sub.paddle_customer_id, [sub.paddle_subscription_id]);
    return s.urls.subscriptions[0]?.cancelSubscription ?? s.urls.general.overview;
  });

/** Switch monthly <-> yearly immediately, charging or crediting the difference. */
export const switchBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ environment: envSchema, priceId: z.enum(PRICE_IDS) }).parse(d))
  .handler(async ({ data, context }) => {
    const sub = await currentSub(context.supabase, context.userId, data.environment);
    if (!sub || sub.status === "canceled") throw new Error("No active subscription");
    const price = await paddlePriceId(data.environment, data.priceId);
    await getPaddleClient(data.environment).subscriptions.update(sub.paddle_subscription_id, {
      items: [{ priceId: price, quantity: 1 }],
      prorationBillingMode: "prorated_immediately",
    });
    return { ok: true };
  });
