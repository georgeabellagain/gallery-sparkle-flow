import { z } from "zod";

const eventData = z.object({
  id: z.string().min(1), customerId: z.string().min(1), status: z.string().min(1),
  customData: z.object({ userId: z.string().uuid() }),
  items: z.array(z.object({
    price: z.object({ importMeta: z.object({ externalId: z.string().min(1) }) }),
    product: z.object({ importMeta: z.object({ externalId: z.string().min(1) }) }),
  })).min(1),
  currentBillingPeriod: z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime() }).nullish(),
  scheduledChange: z.object({ action: z.string() }).nullish(),
  canceledAt: z.string().datetime().nullish(),
});

export function subscriptionSnapshot(input: unknown, environment: "live" | "sandbox", occurredAt: string, canceled = false) {
  const data = eventData.parse(input);
  const at = z.string().datetime().parse(occurredAt);
  return {
    paddle_subscription_id: data.id, paddle_customer_id: data.customerId,
    user_id: data.customData.userId, environment,
    price_id: data.items[0]!.price.importMeta.externalId,
    product_id: data.items[0]!.product.importMeta.externalId,
    status: canceled ? "canceled" : data.status,
    current_period_start: data.currentBillingPeriod?.startsAt ?? null,
    current_period_end: canceled ? (data.currentBillingPeriod?.endsAt ?? data.canceledAt ?? at) : (data.currentBillingPeriod?.endsAt ?? null),
    cancel_at_period_end: !canceled && data.scheduledChange?.action === "cancel",
    updated_at: at,
  };
}
