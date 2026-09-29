import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

let _sb: ReturnType<typeof createClient> | null = null;
const db = () => (_sb ??= createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!));

async function created(data: any, env: PaddleEnv) {
  const userId = data.customData?.userId;
  if (!userId) return console.error("No userId in customData");
  const item = data.items[0];
  const priceId = item.price.importMeta?.externalId;
  const productId = item.product.importMeta?.externalId;
  if (!priceId || !productId) return console.warn("Skipping subscription: missing importMeta.externalId");
  const { error } = await (db().from("subscriptions") as any).upsert(
    {
      user_id: userId,
      paddle_subscription_id: data.id,
      paddle_customer_id: data.customerId,
      product_id: productId,
      price_id: priceId,
      status: data.status,
      current_period_start: data.currentBillingPeriod?.startsAt,
      current_period_end: data.currentBillingPeriod?.endsAt,
      cancel_at_period_end: data.scheduledChange?.action === "cancel",
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "paddle_subscription_id" },
  );
  // Throwing makes Paddle retry, so a failed write never silently loses a purchase.
  if (error) throw new Error(`Subscription save failed: ${error.message}`);
}

async function updated(data: any, env: PaddleEnv) {
  const priceId = data.items?.[0]?.price?.importMeta?.externalId;
  // Arrives before (or without) subscription.created: create the row instead.
  const { data: row } = await (db().from("subscriptions") as any).select("id").eq("paddle_subscription_id", data.id).maybeSingle();
  if (!row) return created(data, env);
  const { error } = await (db().from("subscriptions") as any)
    .update({
      status: data.status,
      ...(priceId ? { price_id: priceId } : {}),
      current_period_start: data.currentBillingPeriod?.startsAt,
      current_period_end: data.currentBillingPeriod?.endsAt,
      cancel_at_period_end: data.scheduledChange?.action === "cancel",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);
  if (error) throw new Error(`Subscription update failed: ${error.message}`);
}

async function canceled(data: any, env: PaddleEnv) {
  const end = data.currentBillingPeriod?.endsAt ?? data.canceledAt ?? new Date().toISOString();
  const { error } = await (db().from("subscriptions") as any)
    .update({ status: "canceled", cancel_at_period_end: false, current_period_end: end, updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);
  if (error) throw new Error(`Subscription cancel failed: ${error.message}`);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = (new URL(request.url).searchParams.get("env") === "live" ? "live" : "sandbox") as PaddleEnv;
        try {
          const event = await verifyWebhook(request, env);
          if (event.eventType === EventName.SubscriptionCreated) await created(event.data, env);
          else if (event.eventType === EventName.SubscriptionUpdated) await updated(event.data, env);
          else if (event.eventType === EventName.SubscriptionCanceled) await canceled(event.data, env);
          else console.log("Unhandled event:", event.eventType);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
