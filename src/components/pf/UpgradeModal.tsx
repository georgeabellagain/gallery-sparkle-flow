import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Modal } from "./Chrome";
import { Button } from "@/components/ui/button";
import { getDoc, MAX_PORTFOLIOS, PERSONAL_UPLOAD_LIMIT_MB, PRICE } from "@/lib/portfolia/store";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment, openCheckout } from "@/lib/paddle";

/** Secure checkout for larger PDFs and multiple portfolios. */
export function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = getDoc().portfolio;
  const [billing, setBilling] = useState<"month" | "year">("year");
  const [err, setErr] = useState<string | null>(null);

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
      return setErr("You already have the Personal plan — it will switch on here in a few seconds.");
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
      setErr("Checkout couldn’t open. Nothing was charged — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={paid ? "Personal plan" : "Upgrade to Personal"}>
      <p className="text-muted-foreground">{paid ? "Your plan includes larger PDFs and multiple portfolios." : "Pay securely by card. Personal features unlock as soon as payment is confirmed."}</p>
      {!p ? (
        <div className="mt-4">
          <p>Upload your first PDF to start creating your portfolio.</p>
          <Button asChild className="mt-4"><Link to="/" hash="upload" onClick={onClose}>Upload your PDF</Link></Button>
        </div>
      ) : (
        <>
          {!paid && <fieldset className="mt-5 flex gap-2 text-sm">
            <legend className="sr-only">Billing period</legend>
            {(["month", "year"] as const).map((b) => (
              <label key={b} className={`flex-1 cursor-pointer rounded-full border px-4 py-2.5 ${billing === b ? "border-foreground" : "border-border"}`}>
                <input type="radio" name="billing" className="sr-only" checked={billing === b} onChange={() => setBilling(b)} />
                {b === "month" ? `${PRICE.month} / month` : `${PRICE.year} / year`}
              </label>
            ))}
          </fieldset>}

          <ul className="mt-5 space-y-1.5 text-sm">
            <li>✓ Up to {MAX_PORTFOLIOS} portfolios</li>
            <li>✓ PDFs up to {PERSONAL_UPLOAD_LIMIT_MB} MB each</li>
          </ul>
          <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            <li>Your free link /p/{p.code} keeps working, so links you’ve already shared stay useful.</li>
            <li>If you cancel, access continues until the end of your paid period. Your portfolio links keep working and nothing is deleted when you cancel.</li>
            <li>Switching between monthly and yearly takes effect straight away; the difference is charged or credited.</li>
          </ul>
          {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="line" onClick={onClose}>Cancel</Button>
            <Button onClick={() => void confirm()} disabled={busy}>{paid ? "Done" : busy ? "Opening checkout…" : "Continue to payment"}</Button>
          </div>
          {!getDoc().account.signedIn && <p className="mt-3 text-xs text-muted-foreground">You’ll need to <Link to="/signin" className="underline">sign in</Link> before paying.</p>}
        </>
      )}
    </Modal>
  );
}
