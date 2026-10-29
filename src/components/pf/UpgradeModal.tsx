import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { Modal } from "./Chrome";
import type { Billing } from "./PricingPlans";
import { Button } from "@/components/ui/button";
import { getDoc, isBusiness, isPaid } from "@/lib/portfolia/store";
import {
  BUSINESS_FEATURES, BUSINESS_MONTHLY_BILLING, BUSINESS_YEARLY_BILLING, BUSINESS_YEARLY_SAVING,
  MONTHLY_BILLING, YEARLY_BILLING, PERSONAL_FEATURES, YEARLY_SAVING,
} from "@/lib/portfolia/plans";
import { priceFor } from "@/lib/portfolia/plan-prices";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment, openCheckout } from "@/lib/paddle";
import { switchBilling } from "@/lib/payments.functions";

export type PlanChoice = "personal" | "business";

/**
 * Secure checkout for Personal or Business. `reason` names the feature that prompted the upgrade, when there is one.
 * Someone already on Personal moves up to Business on their existing subscription (charged for the time left).
 */
export function UpgradeModal({ open, onClose, initialBilling = "year", reason, plan: initialPlan = "personal" }: { open: boolean; onClose: () => void; initialBilling?: Billing; reason?: string; plan?: PlanChoice }) {
  const doc = getDoc();
  const p = doc.portfolio;
  const [billing, setBilling] = useState<Billing>(initialBilling);
  const [plan, setPlan] = useState<PlanChoice>(initialPlan);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const change = useServerFn(switchBilling);
  useEffect(() => { if (open) { setBilling(initialBilling); setPlan(initialPlan); setErr(null); setDone(false); } }, [open, initialBilling, initialPlan]);

  const [busy, setBusy] = useState(false);
  const onPersonal = isPaid(doc), onBusiness = isBusiness(doc);
  // Already has everything this choice offers.
  const covered = plan === "business" ? onBusiness : onPersonal;
  // On Personal and choosing Business: an upgrade of the existing subscription, not a second one.
  const moveUp = plan === "business" && onPersonal && !onBusiness;
  const business = plan === "business";
  const confirm = async () => {
    if (covered || done) return onClose();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return setErr("Please sign in first so your plan is linked to your account.");
    setBusy(true);
    try {
      if (moveUp) {
        await change({ data: { environment: getPaddleEnvironment(), priceId: priceFor("business", billing) } });
        setDone(true);
        return;
      }
      // Guard against paying twice (e.g. already subscribed from another browser).
      const { data: existing } = await supabase.from("subscriptions").select("status, current_period_end")
        .eq("user_id", data.user.id).eq("environment", getPaddleEnvironment())
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existing && (["active", "trialing", "past_due"].includes(existing.status) || (existing.status === "canceled" && existing.current_period_end && Date.parse(existing.current_period_end) > Date.now()))) {
        return setErr("You already have a paid plan. It will switch on here in a few seconds; to change plan, use Manage billing in your dashboard.");
      }
      await openCheckout({
        priceId: priceFor(plan, billing),
        email: data.user.email,
        userId: data.user.id,
        successUrl: `${window.location.origin}/dashboard?checkout=success`,
      });
      onClose();
    } catch (e) {
      setErr(moveUp ? (e instanceof Error && e.message ? e.message : "Your plan couldn’t be changed. Nothing was charged.") : "Checkout couldn’t open. Nothing was charged. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const name = business ? "Business" : "Personal";
  const title = covered ? `${name} plan` : moveUp ? "Move up to Business" : business ? "Publish more with Business" : "Make it yours with Personal";
  return (
    <Modal open={open} onClose={onClose} title={title}
      description={covered ? "Your plan is active. Thank you for supporting Portfolia." : done ? "Done. Business switches on here within a minute." : business ? "Everything in Personal, for studios, brands and teams publishing more." : "Your own address, privacy controls and no Portfolia branding. Unlocks as soon as payment is confirmed."}>
      {reason && !covered && <p className="mb-3 rounded-xl bg-leaf-soft px-3 py-2 text-xs text-leaf">{reason} is part of {name}.</p>}
      {!p ? (
        <div>
          <p>Upload your first PDF, then upgrade whenever you’re ready. Everything you set up carries over.</p>
          <Button asChild className="mt-4"><Link to="/" hash="upload" onClick={onClose}>Upload your PDF</Link></Button>
        </div>
      ) : (
        <>
          {!covered && !done && (
            <>
              <div role="radiogroup" aria-label="Plan" className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-sm">
                {(["personal", "business"] as const).map((choice) => (
                  <button key={choice} type="button" role="radio" aria-checked={plan === choice} disabled={choice === "personal" && onPersonal}
                    onClick={() => setPlan(choice)} className="rounded-full px-3 py-1.5 transition-colors aria-checked:bg-background aria-checked:font-medium aria-checked:shadow-soft disabled:opacity-40">
                    {choice === "personal" ? "Personal" : "Business"}
                  </button>
                ))}
              </div>
              <fieldset className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <legend className="sr-only">Billing period</legend>
                {(["year", "month"] as const).map((b) => (
                  <label key={b} className={`relative cursor-pointer rounded-2xl border px-4 py-3 ${billing === b ? "border-foreground ring-1 ring-foreground" : "border-border"}`}>
                    <input type="radio" name="billing" className="sr-only" checked={billing === b} onChange={() => setBilling(b)} />
                    <span className="block font-medium">{b === "year" ? "Yearly" : "Monthly"}</span>
                    <span className="block text-xs text-muted-foreground">{b === "year" ? (business ? BUSINESS_YEARLY_BILLING : YEARLY_BILLING) : (business ? BUSINESS_MONTHLY_BILLING : MONTHLY_BILLING)}</span>
                    {b === "year" && <span className="absolute -top-2 right-3 rounded-full bg-leaf px-2 py-0.5 text-xxs font-medium text-white">Save {business ? BUSINESS_YEARLY_SAVING : YEARLY_SAVING}%</span>}
                  </label>
                ))}
              </fieldset>
            </>
          )}

          <ul className="mt-5 space-y-2 text-sm">
            {business && <li className="text-xs font-medium text-muted-foreground">Everything in Personal, plus:</li>}
            {(business ? BUSINESS_FEATURES : PERSONAL_FEATURES).map(f => <li key={f} className="flex gap-2.5"><Check className="mt-0.5 size-3.5 shrink-0 text-leaf" aria-hidden />{f}</li>)}
          </ul>
          <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            {moveUp ? <li>Your Personal subscription becomes Business straight away; you pay only the difference for the time left.</li>
              : <li>Your free link /p/{p.code} keeps working, so links you’ve already shared stay useful.</li>}
            <li>Cancel anytime: access continues to the end of your paid period and nothing is deleted.</li>
          </ul>
          {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="line" onClick={onClose}>{covered || done ? "Close" : "Not now"}</Button>
            <Button onClick={() => void confirm()} disabled={busy}>{covered || done ? "Done" : busy ? (moveUp ? "Changing plan…" : "Opening checkout…") : moveUp ? "Move up to Business" : "Continue to secure payment"}</Button>
          </div>
          {!doc.account.signedIn && <p className="mt-3 text-xs text-muted-foreground">You’ll need to <Link to="/signin" className="underline">sign in</Link> before paying.</p>}
        </>
      )}
    </Modal>
  );
}
