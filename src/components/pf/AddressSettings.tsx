import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkUsername, isPortfolioDraft, patchPortfolio, type Portfolio } from "@/lib/portfolia/store";
import { Button } from "@/components/ui/button";

/** Claim portfolia.site/<name>. Routing only honours it while Personal is active (see personalActive). */
export function AddressSettings({ p, onUpgrade }: { p: Portfolio; onUpgrade?: () => void }) {
  const paid = p.plan === "personal";
  const [name, setName] = useState(p.username ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.host : "portfolia.site";
  const pending = isPortfolioDraft(p.code);
  const claim = async (e: FormEvent) => {
    e.preventDefault();
    const u = name.trim().toLowerCase();
    if (!u) {
      setMsg(patchPortfolio({ username: undefined }) ? { ok: true, text: pending ? "Save your changes to remove the address." : "Personalised address removed." } : { ok: false, text: "Couldn’t save. Please try again." });
      return;
    }
    const check = checkUsername(u);
    if (!check.ok) return setMsg({ ok: false, text: check.msg });
    setBusy(true);
    const { data, error } = await supabase.rpc("name_available", { _code: p.code, _username: u });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: "Couldn’t check that name. Please try again." });
    if (!data) return setMsg({ ok: false, text: "That address is already taken. Try another." });
    if (!patchPortfolio({ username: u })) return setMsg({ ok: false, text: "Couldn’t save. Please try again." });
    setName(u);
    setMsg({ ok: true, text: pending ? `Save your changes to claim ${origin}/${u}.` : `Your portfolio now lives at ${origin}/${u}.` });
  };
  return (
    <form onSubmit={e => void claim(e)} className="mt-3 space-y-3">
      <p className="text-xs text-muted-foreground">A short, memorable link for your CV, email signature and business cards. Your /p/{p.code} link keeps working too.</p>
      <label className="block text-xs">
        <span className="sr-only">Personalised address</span>
        <span className="flex items-stretch overflow-hidden rounded-lg border border-border bg-background focus-within:ring-1 focus-within:ring-ring">
          <span className="flex items-center bg-muted px-2.5 text-muted-foreground">{origin}/</span>
          <input value={name} onChange={e => { setName(e.target.value); setMsg(null); }} disabled={!paid || busy} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="yourname" className="min-w-0 flex-1 bg-transparent p-2 text-sm outline-none disabled:opacity-60" />
        </span>
      </label>
      {paid ? <Button size="sm" type="submit" disabled={busy}>{busy ? "Checking…" : p.username ? "Update address" : "Claim address"}</Button>
        : <Button size="sm" type="button" onClick={onUpgrade}>Unlock with Personal</Button>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-xs ${msg.ok ? "text-leaf" : "text-destructive"}`}>{msg.text}</p>}
    </form>
  );
}
