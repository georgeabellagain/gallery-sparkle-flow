import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Modal } from "./Chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkUsername, getDoc, GRACE_DAYS, MAX_PORTFOLIOS, patchPortfolio, PRICE } from "@/lib/portfolia/store";
import { supabase } from "@/integrations/supabase/client";
import { openCheckout } from "@/lib/paddle";

/** Upgrade flow: saves the chosen address, then opens secure checkout. The plan unlocks once payment is confirmed. */
export function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = getDoc().portfolio;
  const [name, setName] = useState(p?.username ?? "");
  const [billing, setBilling] = useState<"month" | "year">("year");
  const [err, setErr] = useState<string | null>(null);
  const check = checkUsername(name);
  const u = name.trim().toLowerCase();

  const [busy, setBusy] = useState(false);
  const paid = p?.plan === "personal";
  const confirm = async () => {
    if (!check.ok) return;
    if (!patchPortfolio({ username: u })) return setErr("Couldn’t save your address in this browser.");
    if (paid) return onClose();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return setErr("Please sign in first so your plan is linked to your account.");
    setBusy(true);
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
    <Modal open={open} onClose={onClose} title={paid ? "Personalised address" : "Upgrade to Personal"}>
      <p className="text-muted-foreground">{paid ? "Change your personalised address." : "Pay securely by card. Personal features unlock as soon as payment is confirmed."}</p>
      {!p ? (
        <div className="mt-4">
          <p>Upload a PDF first — you can choose a personalised address from your dashboard.</p>
          <Button className="mt-4" onClick={onClose}>OK</Button>
        </div>
      ) : (
        <>
          <Label htmlFor="uname" className="mt-5 block text-xs">Personalised Portfolia address</Label>
          <div className="mt-1.5 flex items-center rounded-full border border-input focus-within:ring-1 focus-within:ring-ring">
            <span className="pl-4 text-sm text-muted-foreground">portfolia.site/</span>
            <Input id="uname" value={name} onChange={(e) => setName(e.target.value)} className="rounded-full border-0 shadow-none focus-visible:ring-0" placeholder="marksmith" autoComplete="off" aria-describedby="uname-msg" />
          </div>
          <p id="uname-msg" className={`mt-1.5 text-xs ${check.ok ? "text-foreground" : "text-muted-foreground"}`}>{name ? check.msg : "Lowercase letters, numbers and hyphens, 3–30 characters."}</p>
          {check.ok && <p className="mt-2 font-mono text-xs">portfolia.site/{u}</p>}

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
            <li>✓ Upload a CV in your details</li>
            <li>✓ Connect a domain you already own (free), or buy one through Portfolia</li>
          </ul>
          <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            <li>This is a personalised Portfolia address, not a separately owned domain.</li>
            <li>Your free link /p/{p.code} keeps working, so links you’ve already shared stay useful.</li>
            <li>If you cancel, your portfolios stay at their free addresses, nothing is deleted, and the personalised address stays active for {GRACE_DAYS} days. The name isn’t reassigned straight away.</li>
            <li>Switching between monthly and yearly takes effect straight away; the difference is charged or credited.</li>
            <li>Portfolios are still stored in this browser, so the address works here but not on another device yet.</li>
          </ul>
          {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="line" onClick={onClose}>Cancel</Button>
            <Button onClick={() => void confirm()} disabled={!check.ok || busy}>{paid ? "Save address" : busy ? "Opening checkout…" : "Continue to payment"}</Button>
          </div>
          {!getDoc().account.signedIn && <p className="mt-3 text-xs text-muted-foreground">You’ll need to <Link to="/signin" className="underline">sign in</Link> before paying.</p>}
        </>
      )}
    </Modal>
  );
}
