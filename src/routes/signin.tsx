import { reportSignup } from "@/lib/conversions";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CenteredPage } from "@/components/pf/Chrome";
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

/** The providers' own marks, as their brand guidelines ask sign-in buttons to show. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-4">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="currentColor">
      <path d="M16.37 12.73c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.65-.39 6.57 1.1 8.72.73 1.05 1.6 2.23 2.73 2.19 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.28-.88-2.3-3.47zM14.2 6.27c.6-.73 1.01-1.75.9-2.77-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.69.97.07 1.96-.5 2.56-1.23z" />
    </svg>
  );
}

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
      <CenteredPage title="Enter your code" intro="Open your authenticator app and enter the six-digit code for Portfolia.">
        <form onSubmit={(e) => void verify(e)} className="space-y-4">
          <Input aria-label="Six-digit code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="h-12 rounded-full text-center text-lg tracking-[0.4em]" />
          {err && <p role="alert" className="text-center text-sm text-destructive">{err}</p>}
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Continue"}</Button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">Lost your phone? Use your spare authenticator, or email <a className="underline underline-offset-4" href="mailto:hello@portfolia.site">hello@portfolia.site</a> from your account address.</p>
        <button type="button" className="mx-auto mt-3 block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={() => { void supabase.auth.signOut(); setNeedsCode(false); setCode(""); setErr(null); }}>Use a different account</button>
      </CenteredPage>
    );
  }

  return (
    <CenteredPage title={mode === "in" ? "Welcome back" : "Create your account"} intro={mode === "in" ? "Sign in to edit and share your portfolios." : "Free forever for one portfolio. No card needed."}>
      <div className="space-y-2">
        <Button type="button" variant="line" className="w-full" onClick={() => void oauth("google")}><GoogleMark />Continue with Google</Button>
        <Button type="button" variant="line" className="w-full" onClick={() => void oauth("apple")}><AppleMark />Continue with Apple</Button>
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or with email<span className="h-px flex-1 bg-border" /></div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email" className="text-xs">Email</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 rounded-full" />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="pw" className="text-xs">Password</Label>
            {mode === "in" && <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => void forgot()}>Forgot password?</button>}
          </div>
          <Input id="pw" type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 rounded-full" />
          {mode === "up" && <p className="mt-1.5 text-xs text-muted-foreground">At least 8 characters.</p>}
        </div>
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        {info && <p role="status" className="rounded-xl bg-muted px-3 py-2 text-sm">{info}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "in" ? "New to Portfolia? " : "Already have an account? "}
        <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(null); setInfo(null); }}>
          {mode === "in" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </CenteredPage>
  );
}
