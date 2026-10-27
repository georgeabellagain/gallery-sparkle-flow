import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

import type { Database } from "@/integrations/supabase/types";

let _sb: ReturnType<typeof createClient<Database>> | null = null;
const db = () => (_sb ??= createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!));

/** The database applies complete snapshots atomically, including cancellation-first delivery. */
async function apply(data: unknown, env: PaddleEnv, occurredAt: string, canceled: boolean) {
  const { subscriptionSnapshot } = await import("@/lib/subscription-event");
  const snapshot = subscriptionSnapshot(data, env, occurredAt, canceled);
  const { error } = await db().rpc("apply_subscription_event", { snapshot });
  if (error) throw new Error(`Subscription save failed: ${error.message}`);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = (new URL(request.url).searchParams.get("env") === "live" ? "live" : "sandbox") as PaddleEnv;
        try {
          const event = await verifyWebhook(request, env);
          const at = (event as { occurredAt?: string }).occurredAt ?? new Date().toISOString();
          if (event.eventType === EventName.SubscriptionCreated) await apply(event.data, env, at, false);
          else if (event.eventType === EventName.SubscriptionUpdated) await apply(event.data, env, at, false);
          else if (event.eventType === EventName.SubscriptionCanceled) await apply(event.data, env, at, true);
          else console.log("Unhandled event:", event.eventType);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 500 });
        }
      },
    },
  },
});
