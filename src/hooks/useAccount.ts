import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { getDoc, setPlanAll, update } from "@/lib/portfolia/store";

export type Sub = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

/** Signed-in user plus their latest subscription; keeps the local plan in step with payments. */
export function useAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null);
      if (!s?.user) syncPlan(null); // signed out: never leave paid features on in this browser
      update((d) => ({ ...d, account: { signedIn: Boolean(s?.user) } }));
    });
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let stop = false;
    const load = async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, price_id, current_period_end, cancel_at_period_end")
        .eq("user_id", user.id)
        .eq("environment", getPaddleEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (stop) return;
      setSub(data as Sub | null);
      setLoading(false);
      syncPlan(data as Sub | null);
    };
    void load();
    // Right after checkout, check every 3s so the plan unlocks quickly.
    const fast = typeof window !== "undefined" && window.location.search.includes("checkout=success");
    const t = setInterval(load, fast ? 3000 : 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [user]);

  return { user, sub, loading, refresh: () => setUser((u) => (u ? { ...u } : u)) };
}

/** Active = paid up. past_due keeps access while Paddle retries the card; paused does not. */
export function subActive(sub: Sub | null): boolean {
  if (!sub) return false;
  const end = sub.current_period_end ? Date.parse(sub.current_period_end) : null;
  if (["active", "trialing", "past_due"].includes(sub.status)) return true;
  return sub.status === "canceled" && end !== null && end > Date.now();
}

function syncPlan(sub: Sub | null) {
  const d = getDoc();
  if (!d.portfolio) return;
  const billing = sub?.price_id === "personal_yearly" ? "year" : "month";
  if (subActive(sub)) {
    setPlanAll({ plan: "personal", billing, cancelledAt: undefined });
  } else if (d.portfolio.plan === "personal") {
    // Plan ended (or none on this account): 30-day address grace from the end of the paid period.
    const end = sub?.current_period_end ? Date.parse(sub.current_period_end) : Date.now();
    setPlanAll({ plan: "free", cancelledAt: sub ? Math.min(end, Date.now()) : Date.now() });
  }
}
