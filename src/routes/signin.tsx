import { reportSignup } from "@/lib/conversions";
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
  staticData: { sitemap: false },
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
  // Two-step sign-in: after the password, Google or Apple, the code from the authenticator app.
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");

  // Returning from Google or Apple: finish once the session is ready.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { if (data.session) void finish(); });
    const { data } = supabase.auth.onAuthStateChange((e, sess) => { if (e === "SIGNED_IN" && sess) void finish(); });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const oauth = async (provider: "google" | "apple") => {
    setErr(null);
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/signin${next ? `?next=${encodeURIComponent(next)}` : ""}` });
    if (r.error) setErr(`Couldn’t sign in with ${provider === "google" ? "Google" : "Apple"} — please try again.`);
  };

  const forgot = async () => {
    setErr(null); setInfo(null);
    if (!email) return setErr("Enter your email above first.");
    // The auth service only returns readers to addresses it knows, so a request from a local copy returns to the site.
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${local ? "https://portfolia.site" : window.location.origin}/reset-password` });
    if (error) return setErr(error.message);
    setInfo("If an account exists for that email, a reset link is on its way. Signed up with Google or Apple? You can simply use that button below; the link lets you add a password as well.");
  };

  const done = () => {
    update((d) => ({ ...d, account: { signedIn: true } }));
    void navigate({ to: next === "home" ? "/" : next === "account" ? "/account" : next === "create" && getDoc().portfolio?.status === "draft" ? "/create" : "/dashboard" });
  };

  /** Signed in: on to the account, unless two-step sign-in still wants its code. */
  const finish = async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") return setNeedsCode(true);
    done();
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp[0];
    const result = factor ? await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() }) : { error: new Error("No authenticator") };
    setBusy(false);
    if (result.error) return setErr("That code didn’t match. Try the newest code in your authenticator app.");
    done();
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
      if (data.user?.identities?.length) reportSignup(data.user.id);
      if (data.session) return done();
      setInfo("Check your inbox and click the confirmation link, then sign in.");
      setMode("in");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setErr(error.message);
      void finish();
    }
  };

  if (needsCode) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-sm px-5 py-20">
          <h1 className="display-title text-3xl">Enter your code</h1>
          <p className="mt-3 text-sm text-muted-foreground">Open your authenticator app and enter the six-digit code for Portfolia.</p>
          <form onSubmit={(e) => void verify(e)} className="mt-6 space-y-4">
            <Input aria-label="Six-digit code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="rounded-full text-center tracking-[0.4em]" />
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Continue"}</Button>
          </form>
          <p className="mt-5 text-xs text-muted-foreground">Lost your phone? Use your spare authenticator, or email <a className="underline underline-offset-4" href="mailto:hello@portfolia.site">hello@portfolia.site</a> from your account address.</p>
          <button type="button" className="mt-3 text-xs underline underline-offset-4 text-muted-foreground" onClick={() => { void supabase.auth.signOut(); setNeedsCode(false); setCode(""); setErr(null); }}>Use a different account</button>
        </main>
        <SiteFooter />
      </div>
    );
  }

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
        <div className="space-y-2">
          <Button type="button" variant="line" className="w-full" onClick={() => void oauth("google")}>Continue with Google</Button>
          <Button type="button" variant="line" className="w-full" onClick={() => void oauth("apple")}>Continue with Apple</Button>
        </div>
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
