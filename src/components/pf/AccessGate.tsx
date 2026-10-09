import { useEffect, useState } from "react";
import { portfolioAccessStatus, unlockPortfolio } from "@/lib/portfolia/access.functions";
import { Missing, LOCAL_MISSING } from "./Visitor";
import { Button } from "@/components/ui/button";

type AccessResult = { state: string; code: string | null };
export function AccessGate({ by, value, initial }: { by: "code" | "username"; value: string; initial?: AccessResult | null }) {
  const [result, setResult] = useState<AccessResult | null>(initial ?? null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (initial) { setResult(initial); return; } let live = true; setResult(null); void portfolioAccessStatus({ data: { by, value } }).then(r => { if (live) setResult(r); }).catch(() => { if (live) setMessage("Couldn’t check access. Please refresh and try again."); }); return () => { live = false; }; }, [by, value, initial]);
  if (!result) return <Missing title="Checking portfolio access" body={message || "Please wait…"} />;
  if (result.state === "expired") return <Missing title="This portfolio link has expired" body="Ask the portfolio owner for renewed access." />;
  if (result.state !== "locked" || !result.code) return <Missing title="No portfolio here" body={LOCAL_MISSING} />;
  return <main className="shell flex min-h-[70svh] items-center justify-center py-12"><form className="w-full max-w-sm space-y-4" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setMessage("");
    try { const r = await unlockPortfolio({ data: { code: result.code!, password } }); setPassword(""); if (r.ok) window.location.reload(); else setMessage(r.message); }
    catch { setMessage("Couldn’t unlock this portfolio. Please try again."); }
    finally { setBusy(false); }
  }}>
    <h1 className="display-title text-3xl">Password required</h1>
    <p className="text-sm text-muted-foreground">Enter the password supplied by the portfolio owner.</p>
    <label className="block text-sm">Portfolio password<input type="password" autoComplete="off" required maxLength={256} value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background p-3" /></label>
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    <Button type="submit" disabled={busy}>{busy ? "Checking…" : "Open portfolio"}</Button>
    <p className="text-xs text-muted-foreground">If an embedded viewer returns here after unlocking, open the portfolio in a new tab. Your browser may block cookies in embeds.</p>
    <a className="block text-sm text-leaf underline" href={`/p/${result.code}`} target="_blank" rel="noopener noreferrer">Open in a new tab</a>
  </form></main>;
}
