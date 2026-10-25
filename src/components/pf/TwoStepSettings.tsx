import { useEffect, useState } from "react";
import type { Factor } from "@supabase/supabase-js";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Enrolling = { id: string; qr: string; secret: string };

/**
 * Two-step sign-in with an authenticator app (Google Authenticator, 1Password, Authy…): after the password or Google,
 * the app's six-digit code is asked for. A second authenticator can be added as a spare in case a phone is lost.
 */
export function TwoStepSettings() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [level, setLevel] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const load = async () => {
    const [{ data }, aal] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
    setFactors(data?.totp ?? []);
    setLevel(aal.data?.currentLevel ?? null);
    return data;
  };
  useEffect(() => { void load(); }, []);

  const start = async () => {
    setError(""); setInfo(""); setBusy(true);
    try {
      // An earlier set-up left unfinished would block a new one.
      const listed = await load();
      for (const f of listed?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${Date.now().toString(36)}` });
      if (error || !data) throw error ?? new Error();
      setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn’t start setting up two-step sign-in.");
    } finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!enrolling) return;
    setError(""); setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: code.trim() });
    setBusy(false);
    if (error) return setError("That code didn’t match. Check the time on your phone and try the newest code.");
    setEnrolling(null); setCode("");
    setInfo(factors.length ? "Spare authenticator added." : "Two-step sign-in is on. You’ll be asked for a code each time you sign in.");
    await load();
  };
  const cancel = async () => {
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.id });
    setEnrolling(null); setCode(""); setError("");
  };
  const remove = async (factor: Factor) => {
    setError(""); setInfo(""); setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (error) return setError(level !== "aal2" ? "Sign out and back in with your code first, then remove it." : "Couldn’t remove that authenticator. Please try again.");
    setInfo(factors.length > 1 ? "Authenticator removed." : "Two-step sign-in is off.");
    await load();
  };

  return (
    <div className="space-y-4 text-sm">
      <p className="flex items-center gap-2">
        <ShieldCheck className={factors.length ? "size-4 text-leaf" : "size-4 text-muted-foreground"} aria-hidden />
        {factors.length ? "On. Signing in asks for a code from your authenticator app." : "Off. Add a code from an authenticator app to every sign-in."}
      </p>
      {factors.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {factors.map((f, i) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span>{i === 0 ? "Authenticator app" : "Spare authenticator"}<span className="block text-xs text-muted-foreground">Added {new Date(f.created_at).toLocaleDateString()}</span></span>
              <Button size="xs" variant="quiet" disabled={busy} onClick={() => void remove(f)} aria-label={`Remove ${i === 0 ? "authenticator app" : "spare authenticator"}`}><Trash2 className="size-3.5" />Remove</Button>
            </li>
          ))}
        </ul>
      )}
      {enrolling ? (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p>1. Scan this with your authenticator app.</p>
          <img src={enrolling.qr} alt="QR code for your authenticator app" className="size-44 rounded-lg bg-white p-2" />
          <p className="text-xs text-muted-foreground">Can’t scan? Enter this key instead: <code className="break-all rounded bg-muted px-1 py-0.5">{enrolling.secret}</code></p>
          <label className="block">2. Enter the six-digit code it shows
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="mt-1.5 w-40 rounded-full tracking-[0.3em]" />
          </label>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || code.length !== 6} onClick={() => void confirm()}>{busy ? "Checking…" : "Turn on"}</Button>
            <Button size="sm" variant="quiet" disabled={busy} onClick={() => void cancel()}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant={factors.length ? "line" : "default"} disabled={busy || factors.length >= 2} onClick={() => void start()}>
          {factors.length ? "Add a spare authenticator" : "Set up two-step sign-in"}
        </Button>
      )}
      {factors.length === 1 && !enrolling && <p className="text-xs text-muted-foreground">Tip: add a spare on a second device, in case you lose your phone.</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {info && <p role="status">{info}</p>}
    </div>
  );
}
