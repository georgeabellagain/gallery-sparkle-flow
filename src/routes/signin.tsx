import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/pf/Chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useEffect } from "react";
import { getDoc, update } from "@/lib/portfolia/store";

export const Route = createFileRoute("/signin")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => (typeof s["next"] === "string" ? { next: s["next"] } : {}),
  head: () => ({
    meta: [
      { title: "Sign in — Portfolia" },
      { name: "description", content: "Sign in or create your Portfolia account." },
      { property: "og:title", content: "Sign in — Portfolia" },
      { property: "og:description", content: "Sign in or create your Portfolia account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Returning from Google: finish once the session is ready.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { if (data.session) done(); });
    const { data } = supabase.auth.onAuthStateChange((e, sess) => { if (e === "SIGNED_IN" && sess) done(); });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const google = async () => {
    setErr(null);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/signin${next ? `?next=${encodeURIComponent(next)}` : ""}` });
    if (r.error) setErr("Couldn’t sign in with Google — please try again.");
  };

  const forgot = async () => {
    setErr(null); setInfo(null);
    if (!email) return setErr("Enter your email above first.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) return setErr(error.message);
    setInfo("If an account exists for that email, a reset link is on its way.");
  };

  const done = () => {
    update((d) => ({ ...d, account: { signedIn: true } }));
    void navigate({ to: next === "create" && getDoc().portfolio?.status === "draft" ? "/create" : "/dashboard" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setInfo(null);
    if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/dashboard` } });
      setBusy(false);
      if (error) return setErr(error.message);
      if (data.session) return done();
      setInfo("Check your inbox and click the confirmation link, then sign in.");
      setMode("in");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setErr(error.message);
      done();
    }
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-sm px-5 py-20">
        <h1 className="display-title text-3xl">{mode === "in" ? "Sign in" : "Create account"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 rounded-full" />
          </div>
          <div>
            <Label htmlFor="pw" className="text-xs">Password</Label>
            <Input id="pw" type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 rounded-full" />
          </div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          {info && <p role="status" className="text-sm">{info}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</Button>
        </form>
        {mode === "in" && <button type="button" className="mt-3 text-xs underline underline-offset-4 text-muted-foreground" onClick={() => void forgot()}>Forgot password?</button>}
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
        <Button type="button" variant="line" className="w-full" onClick={() => void google()}>Continue with Google</Button>
        <p className="mt-5 text-sm text-muted-foreground">
          {mode === "in" ? "New to Portfolia? " : "Already have an account? "}
          <button type="button" className="underline underline-offset-4" onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(null); }}>
            {mode === "in" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
