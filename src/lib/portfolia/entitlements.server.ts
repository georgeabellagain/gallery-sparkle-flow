import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Only webhook-managed live billing records grant public paid benefits. */
export async function ownerHasPersonal(ownerId: string, db: any = supabaseAdmin, now = Date.now()): Promise<boolean> {
  const { data: sub, error } = await db.from("subscriptions")
    .select("status,current_period_end,price_id")
    .eq("user_id", ownerId).eq("environment", "live")
    .order("created_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false })
    .limit(1).maybeSingle();
  if (error) throw new Error("Couldn’t verify the owner’s subscription. Please try again.");
  if (!sub || !["personal_monthly", "personal_yearly"].includes(sub.price_id)) return false;
  // Keep the existing billing grace while Paddle retries a past-due payment.
  if (["active", "trialing", "past_due"].includes(sub.status)) return true;
  return sub.status === "canceled" && sub.current_period_end != null && Date.parse(sub.current_period_end) > now;
}
