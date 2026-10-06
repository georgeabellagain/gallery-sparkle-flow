import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ownerAccessSettings, saveAccessSettings } from "@/lib/portfolia/access.functions";
import { Button } from "@/components/ui/button";
export function AccessSettings({ code }: { code: string }) {
  const [settings, setSettings] = useState<{ password: boolean; expiresAt: string | null; personal: boolean } | null>(null);
  const [password, setPassword] = useState("");
  const [remove, setRemove] = useState(false);
  const [expiry, setExpiry] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const headers = async () => { const { data } = await supabase.auth.getSession(); if (!data.session) throw new Error("Sign in to manage access."); return { Authorization: `Bearer ${data.session.access_token}` }; };
  useEffect(() => {
    let live = true; setSettings(null); setMessage(""); setPassword(""); setRemove(false);
    void headers().then(h => ownerAccessSettings({ data: { code }, headers: h })).then(r => {
      if (!live) return; setSettings(r);
      const date = r.expiresAt ? new Date(r.expiresAt) : null;
      setExpiry(date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
    }).catch(e => { if (live) setMessage(e instanceof Error ? e.message : "Couldn’t load access settings."); });
    return () => { live = false; };
  }, [code, attempt]);
  return <section className="mt-6 border-t border-border pt-5"><h3 className="text-sm font-medium">Password and link expiry</h3>
    <p className="mt-1 text-xs text-muted-foreground">Personal adds access controls for this portfolio’s link and embed. These settings save separately from appearance.</p>
    {!settings ? <><p role="status" className="mt-3 text-xs">{message || "Loading access settings…"}</p>{message && <button className="mt-2 text-xs underline" onClick={()=>setAttempt(n=>n+1)}>Retry access settings</button>}</> : <form className="mt-4 space-y-3" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setMessage("");
      try { await saveAccessSettings({ data: { code, ...(password && !remove ? { password } : {}), removePassword: remove, expiresAt: expiry ? new Date(expiry).toISOString() : null }, headers: await headers() }); setPassword(""); setMessage("Access settings saved. Existing unlocked sessions are reset. File links issued before protection was added can remain valid for up to one hour."); setSettings({ ...settings, password: remove ? false : Boolean(password) || settings.password, expiresAt: expiry ? new Date(expiry).toISOString() : null }); setRemove(false); }
      catch(e) { setMessage(e instanceof Error ? e.message : "Couldn’t save access settings."); }
      finally { setBusy(false); }
    }}>
      {!settings.personal && <p className="text-xs text-muted-foreground">An active Personal subscription is needed to add protection. Existing protection remains in place after cancellation; you can remove it.</p>}
      <p className="text-xs">Password: {settings.password ? "set" : "not set"}</p>
      <label className="block text-xs">{settings.password ? "Replace password (leave blank to keep)" : "New password"}<input type="password" autoComplete="new-password" minLength={8} maxLength={256} disabled={!settings.personal || remove} value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm" /></label>
      {settings.password && <label className="flex gap-2 text-xs"><input type="checkbox" checked={remove} onChange={e=>setRemove(e.target.checked)} />Remove password</label>}
      <label className="block text-xs">Expiry date and time (your timezone)<input type="datetime-local" disabled={!settings.personal} value={expiry} onChange={e=>setExpiry(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm" /></label>
      {expiry && <button type="button" className="text-xs underline" onClick={()=>setExpiry("")}>Remove expiry</button>}
      <p className="text-xs text-muted-foreground">Expiry stops new access. It cannot erase files a visitor already viewed, downloaded or saved. Protected work has no public cover preview.</p>
      <Button size="sm" type="submit" disabled={busy}>{busy ? "Saving…" : "Save access settings"}</Button>
      {message && <p role="status" className="text-xs">{message}</p>}
    </form>}
  </section>;
}
