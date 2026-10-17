import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Modal } from "./Chrome";
import type { Billing } from "./PricingPlans";
import { Button } from "@/components/ui/button";
import { getDoc, PRICE } from "@/lib/portfolia/store";
import { PERSONAL_FEATURES, YEARLY_PER_MONTH, YEARLY_SAVING } from "@/lib/portfolia/plans";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment, openCheckout } from "@/lib/paddle";

/** Secure checkout for Personal. `reason` names the feature that prompted the upgrade, when there is one. */
export function UpgradeModal({ open, onClose, initialBilling = "year", reason }: { open: boolean; onClose: () => void; initialBilling?: Billing; reason?: string }) {
  const p = getDoc().portfolio;
  const [billing, setBilling] = useState<Billing>(initialBilling);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setBilling(initialBilling); setErr(null); } }, [open, initialBilling]);

  const [busy, setBusy] = useState(false);
  const paid = p?.plan === "personal";
  const confirm = async () => {
    if (paid) return onClose();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return setErr("Please sign in first so your plan is linked to your account.");
    setBusy(true);
    // Guard against paying twice (e.g. already subscribed from another browser).
    const { data: existing } = await supabase.from("subscriptions").select("status, current_period_end")
      .eq("user_id", data.user.id).eq("environment", getPaddleEnvironment())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing && (["active", "trialing", "past_due"].includes(existing.status) || (existing.status === "canceled" && existing.current_period_end && Date.parse(existing.current_period_end) > Date.now()))) {
      setBusy(false);
      return setErr("You already have the Personal plan. It will switch on here in a few seconds.");
    }
    try {
      await openCheckout({
        priceId: billing === "month" ? "personal_monthly" : "personal_yearly",
        email: data.user.email,
        userId: data.user.id,
        successUrl: `${window.location.origin}/dashboard?checkout=success`,
      });
      onClose();
    } catch {
      setErr("Checkout couldn’t open. Nothing was charged. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={paid ? "Personal plan" : "Make it yours with Personal"}>
      {reason && !paid && <p className="mb-3 rounded-xl bg-leaf-soft px-3 py-2 text-xs text-leaf">{reason} is part of Personal.</p>}
      <p className="text-muted-foreground">{paid ? "Your plan is active. Thank you for supporting Portfolia." : "Your own address, privacy controls and no Portfolia branding. Unlocks as soon as payment is confirmed."}</p>
      {!p ? (
        <div className="mt-4">
          <p>Upload your first PDF, then upgrade whenever you’re ready. Everything you set up carries over.</p>
          <Button asChild className="mt-4"><Link to="/" hash="upload" onClick={onClose}>Upload your PDF</Link></Button>
        </div>
      ) : (
        <>
          {!paid && <fieldset className="mt-5 grid grid-cols-2 gap-2 text-sm">
            <legend className="sr-only">Billing period</legend>
            {(["year", "month"] as const).map((b) => (
              <label key={b} className={`relative cursor-pointer rounded-2xl border px-4 py-3 ${billing === b ? "border-foreground ring-1 ring-foreground" : "border-border"}`}>
                <input type="radio" name="billing" className="sr-only" checked={billing === b} onChange={() => setBilling(b)} />
                <span className="block font-medium">{b === "year" ? "Yearly" : "Monthly"}</span>
                <span className="block text-xs text-muted-foreground">{b === "year" ? `${PRICE.year}/year · ${YEARLY_PER_MONTH}/mo` : `${PRICE.month}/month`}</span>
                {b === "year" && <span className="absolute -top-2 right-3 rounded-full bg-leaf px-2 py-0.5 text-xxs font-medium text-white">Save {YEARLY_SAVING}%</span>}
              </label>
            ))}
          </fieldset>}

          <ul className="mt-5 space-y-2 text-sm">
            {PERSONAL_FEATURES.map(f => <li key={f} className="flex gap-2.5"><Check className="mt-0.5 size-3.5 shrink-0 text-leaf" aria-hidden />{f}</li>)}
          </ul>
          <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            <li>Your free link /p/{p.code} keeps working, so links you’ve already shared stay useful.</li>
            <li>Cancel anytime: access continues to the end of your paid period and nothing is deleted.</li>
          </ul>
          {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="line" onClick={onClose}>{paid ? "Close" : "Not now"}</Button>
            <Button onClick={() => void confirm()} disabled={busy}>{paid ? "Done" : busy ? "Opening checkout…" : "Continue to secure payment"}</Button>
          </div>
          {!getDoc().account.signedIn && <p className="mt-3 text-xs text-muted-foreground">You’ll need to <Link to="/signin" className="underline">sign in</Link> before paying.</p>}
        </>
      )}
    </Modal>
  );
}
