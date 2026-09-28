import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Modal } from "./Chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkUsername, getDoc, GRACE_DAYS, patchPortfolio, PRICE } from "@/lib/portfolia/store";

/** Demo upgrade flow. No card details, no billing. */
export function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = getDoc().portfolio;
  const [name, setName] = useState(p?.username ?? "");
  const [billing, setBilling] = useState<"month" | "year">("year");
  const [err, setErr] = useState<string | null>(null);
  const check = checkUsername(name);
  const u = name.trim().toLowerCase();

  const confirm = () => {
    if (!check.ok) return;
    if (!patchPortfolio({ plan: "personal", billing, username: u, cancelledAt: undefined }))
      return setErr("Couldn’t save the change in this browser. Nothing was upgraded.");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Personal plan — demo upgrade">
      <p className="text-muted-foreground">This is a prototype. No payment is taken and no card details are collected.</p>
      {!p ? (
        <div className="mt-4">
          <p>Upload a PDF first — you can choose a personalised address from your dashboard.</p>
          <Button className="mt-4" onClick={onClose}>OK</Button>
        </div>
      ) : (
        <>
          <Label htmlFor="uname" className="mt-5 block text-xs">Personalised Portfolia address</Label>
          <div className="mt-1.5 flex items-center border border-input focus-within:ring-1 focus-within:ring-ring">
            <Input id="uname" value={name} onChange={(e) => setName(e.target.value)} className="border-0 shadow-none focus-visible:ring-0" placeholder="georgebell" autoComplete="off" aria-describedby="uname-msg" />
            <span className="pr-3 text-sm text-muted-foreground">.portfolia.com</span>
          </div>
          <p id="uname-msg" className={`mt-1.5 text-xs ${check.ok ? "text-foreground" : "text-muted-foreground"}`}>{name ? check.msg : "Lowercase letters, numbers and hyphens, 3–30 characters."}</p>
          {check.ok && <p className="mt-2 font-mono text-xs">{u}.portfolia.com <span className="text-muted-foreground">(preview)</span></p>}

          <fieldset className="mt-5 flex gap-2 text-sm">
            <legend className="sr-only">Billing period</legend>
            {(["month", "year"] as const).map((b) => (
              <label key={b} className={`flex-1 cursor-pointer border px-3 py-2 ${billing === b ? "border-foreground" : "border-border"}`}>
                <input type="radio" name="billing" className="sr-only" checked={billing === b} onChange={() => setBilling(b)} />
                {b === "month" ? `${PRICE.month} / month` : `${PRICE.year} / year`}
              </label>
            ))}
          </fieldset>

          <ul className="mt-5 space-y-1.5 text-xs text-muted-foreground">
            <li>This is a personalised Portfolia address, not a separately owned domain.</li>
            <li>Your free link /p/{p.code} keeps working, so links you’ve already shared stay useful.</li>
            <li>If you cancel, your portfolio stays at its free address and the personalised address stays active for {GRACE_DAYS} days. The name isn’t reassigned straight away.</li>
            <li>Real subdomains aren’t connected in this prototype — the address opens as a local preview route.</li>
          </ul>
          {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="line" onClick={onClose}>Cancel</Button>
            <Button onClick={confirm} disabled={!check.ok}>Upgrade (demo)</Button>
          </div>
          {!getDoc().account.signedIn && <p className="mt-3 text-xs text-muted-foreground">You’ll need a <Link to="/signin" className="underline">demo account</Link> to publish.</p>}
        </>
      )}
    </Modal>
  );
}
