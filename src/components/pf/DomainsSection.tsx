import { useState } from "react";
import { Globe, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Modal } from "./Chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDomain, checkDomain, domainPrice, removeDomain, type Portfolio } from "@/lib/portfolia/store";

/** Custom domains for paid accounts. Demo only: no purchase, no DNS checks. */
export function DomainsSection({ p, paid, onUpgrade }: { p: Portfolio; paid: boolean; onUpgrade: () => void }) {
  const [mode, setMode] = useState<null | "buy" | "own">(null);
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [dns, setDns] = useState<string | null>(null);
  const check = checkDomain(raw);
  const price = check.ok ? domainPrice(check.name) : null;
  const domains = p.domains ?? [];

  const close = () => { setMode(null); setRaw(""); setErr(null); };
  const confirm = async () => {
    if (!check.ok || !mode) return;
    const { data: free, error } = await supabase.rpc("domain_available", { _name: check.name, _code: p.code });
    if (error) return setErr("Couldn’t check that domain. Please try again.");
    if (!free) return setErr("That domain is already connected to another Portfolia account.");
    if (!addDomain({ name: check.name, kind: mode === "buy" ? "purchased" : "owned", addedAt: Date.now() })) return setErr("Couldn’t save. Nothing was added.");
    if (mode === "own") setDns(check.name);
    close();
  };

  return (
    <div>
      <h2 className="flex items-center gap-2 text-sm font-medium"><Globe className="size-4 text-leaf" /> Custom domains</h2>
      {!paid ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">With the Personal plan, connect a domain you already own for free, or buy a new one through Portfolia.</p>
          <Button size="sm" variant="line" className="mt-4" onClick={onUpgrade}>See Personal plan</Button>
        </>
      ) : (
        <>
          {domains.length > 0 && (
            <ul className="mt-3 space-y-2">
              {domains.map((d) => (
                <li key={d.name} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm">
                  <span className="font-mono text-xs">{d.name}</span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xxs text-muted-foreground">{d.kind === "purchased" ? "Bought (demo)" : "Your domain · free"}</span>
                  <span className="flex-1 text-xxs text-muted-foreground">Not connected in this prototype</span>
                  {d.kind === "owned" && <Button size="xs" variant="quiet" onClick={() => setDns(d.name)}>DNS setup</Button>}
                  <Button size="icon-sm" variant="quiet" aria-label={`Remove ${d.name}`} onClick={() => removeDomain(d.name)}><X /></Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setMode("own")}>Connect a domain I own — free</Button>
            <Button size="sm" variant="line" onClick={() => setMode("buy")}>Buy a domain</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Your free link keeps working either way.</p>
        </>
      )}

      <Modal open={mode !== null} onClose={close} title={mode === "buy" ? "Buy a domain — demo" : "Connect a domain you own"}>
        <p className="text-muted-foreground">
          {mode === "buy" ? "Search for a name. This is a prototype: no payment is taken and no domain is registered." : "Connecting a domain you already own is free on the Personal plan."}
        </p>
        <div className="mt-4">
          <Input aria-label="Domain" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="yourname.com" autoComplete="off" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {raw && !check.ok ? check.msg : check.ok && mode === "buy" ? (price ? `${check.name} — ${price} (illustrative price, availability not checked)` : "That ending isn’t offered in this demo. Try .com, .co.uk, .studio, .art or .design.") : "\u00a0"}
          </p>
        </div>
        {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="line" onClick={close}>Cancel</Button>
          <Button disabled={!check.ok || (mode === "buy" && !price)} onClick={() => void confirm()}>{mode === "buy" ? "Buy (demo)" : "Add domain"}</Button>
        </div>
      </Modal>

      <Modal open={dns !== null} onClose={() => setDns(null)} title={`DNS setup for ${dns ?? ""}`}>
        <p className="text-muted-foreground">At your domain provider you would add these records. In this prototype nothing is checked or connected.</p>
        <table className="mt-4 w-full text-left font-mono text-xs">
          <thead className="text-muted-foreground"><tr><th className="py-1 font-normal">Type</th><th className="font-normal">Name</th><th className="font-normal">Value</th></tr></thead>
          <tbody>
            <tr><td className="py-1">A</td><td>@</td><td>185.158.133.1</td></tr>
            <tr><td className="py-1">CNAME</td><td>www</td><td>sites.portfolia.site</td></tr>
          </tbody>
        </table>
        <div className="mt-6 flex justify-end"><Button onClick={() => setDns(null)}>Done</Button></div>
      </Modal>
    </div>
  );
}
