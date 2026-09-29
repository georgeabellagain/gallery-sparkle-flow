import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { getDoc, GRACE_DAYS, setPlanAll, update } from "@/lib/portfolia/store";

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
    const ch = supabase
      .channel(`subs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` }, () => void load())
      .subscribe();
    const t = setInterval(load, 15000);
    return () => {
      stop = true;
      clearInterval(t);
      void supabase.removeChannel(ch);
    };
  }, [user]);

  return { user, sub, loading };
}

function syncPlan(sub: Sub | null) {
  if (!getDoc().portfolio || !sub) return;
  const end = sub.current_period_end ? Date.parse(sub.current_period_end) : null;
  const billing = sub.price_id === "personal_yearly" ? "year" : "month";
  const ended = sub.status === "canceled" && (!end || end <= Date.now());
  if (!ended) {
    // Paid and current (including cancelled-but-paid-up): full Personal.
    setPlanAll({ plan: "personal", billing, cancelledAt: undefined });
  } else {
    // Paid period over: 30-day grace starts from the end of the period.
    const since = end ?? Date.now();
    if (Date.now() < since + GRACE_DAYS * 864e5) setPlanAll({ plan: "free", cancelledAt: since });
    else setPlanAll({ plan: "free", cancelledAt: since });
  }
}
