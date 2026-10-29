import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isBusinessPrice, isPaidPrice } from "./plan-prices";

export type OwnerPlan = "free" | "personal" | "business";

/** Only webhook-managed live billing records grant public paid benefits. */
export async function ownerPlan(ownerId: string, db: any = supabaseAdmin, now = Date.now()): Promise<OwnerPlan> {
  const { data: sub, error } = await db.from("subscriptions")
    .select("status,current_period_end,price_id")
    .eq("user_id", ownerId).eq("environment", "live")
    .order("created_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false })
    .limit(1).maybeSingle();
  if (error) throw new Error("Couldn’t verify the owner’s subscription. Please try again.");
  if (!sub || !isPaidPrice(sub.price_id)) return "free";
  // Keep the existing billing grace while Paddle retries a past-due payment.
  const live = ["active", "trialing", "past_due"].includes(sub.status)
    || (sub.status === "canceled" && sub.current_period_end != null && Date.parse(sub.current_period_end) > now);
  return !live ? "free" : isBusinessPrice(sub.price_id) ? "business" : "personal";
}

/** Personal or Business: everything in Personal. */
export async function ownerHasPersonal(ownerId: string, db: any = supabaseAdmin, now = Date.now()): Promise<boolean> {
  return (await ownerPlan(ownerId, db, now)) !== "free";
}

/** Business extras (Google Analytics, team lead alerts, a branded tab icon…). */
export async function ownerHasBusiness(ownerId: string, db: any = supabaseAdmin, now = Date.now()): Promise<boolean> {
  return (await ownerPlan(ownerId, db, now)) === "business";
}
