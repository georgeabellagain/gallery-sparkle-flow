import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { CenteredPage, SiteHeader, SiteFooter } from "@/components/pf/Chrome";
import { TwoStepSettings } from "@/components/pf/TwoStepSettings";
import { YourData } from "@/components/pf/YourData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { update } from "@/lib/portfolia/store";

export const Route = createFileRoute("/account")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Account — Portfolia" },
      { name: "description", content: "Your Portfolia sign-in, email, password, two-step sign-in and data." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Account,
});

const PROVIDERS: Record<string, string> = { email: "Email and password", google: "Google", apple: "Apple", azure: "Microsoft" };

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-border py-8 md:grid-cols-[14rem_minmax(0,1fr)]">
      <div><h2 className="text-sm font-medium">{title}</h2>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div>
      <div className="min-w-0 max-w-xl">{children}</div>
    </section>
  );
}

function Account() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  const signOut = async (scope: "local" | "global") => {
    await supabase.auth.signOut({ scope });
    update((d) => ({ ...d, account: { signedIn: false } }));
    void navigate({ to: "/" });
  };

  if (loading) return <CenteredPage title="Account" intro={<span role="status" aria-busy="true">Loading your account…</span>} />;
  if (!user) {
    return (
      <CenteredPage title="Account" intro="Sign in to manage your email, password and two-step sign-in.">
        <Button asChild className="w-full"><Link to="/signin" search={{ next: "account" }}>Sign in</Link></Button>
      </CenteredPage>
    );
  }
  const providers = [...new Set((user.identities ?? []).map((i) => i.provider))];
  const hasPassword = providers.includes("email");
  return (
    <div className="min-h-screen">
      <SiteHeader right={<Link to="/dashboard" className="text-sm hover:underline underline-offset-4">Your portfolios</Link>} />
      <main className="shell py-10">
        <p className="label-xs">Settings</p>
        <h1 className="display-title mt-1 text-4xl">Account</h1>
        <div className="mt-8">
          <Section title="Email" hint="Where sign-in links, receipts and lead alerts go.">
            <EmailForm user={user} />
          </Section>
          <Section title="Password" hint={hasPassword ? "At least 8 characters." : "You sign in with " + providers.map((p) => PROVIDERS[p] ?? p).join(" and ") + ". Add a password to sign in with your email too."}>
            <PasswordForm hasPassword={hasPassword} />
          </Section>
          <Section title="Two-step sign-in" hint="A code from an app on your phone, as well as your password or Google.">
            <TwoStepSettings />
          </Section>
          <Section title="Ways to sign in" hint="Sign in with Google or Apple using this same email to use either.">
            <ul className="space-y-1.5 text-sm">
              {providers.map((p) => <li key={p} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-leaf" aria-hidden />{PROVIDERS[p] ?? p}</li>)}
            </ul>
          </Section>
          <Section title="Signed-in devices" hint="Signs you out everywhere, for example after using a shared computer.">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="line" onClick={() => void signOut("local")}>Sign out</Button>
              <Button size="sm" variant="line" onClick={() => void signOut("global")}>Sign out of all devices</Button>
            </div>
          </Section>
          <Section title="Plan and billing">
            <p className="text-sm">Upgrade, change card or cancel from <Link to="/dashboard" className="underline underline-offset-4">your dashboard</Link>.</p>
          </Section>
          <Section title="Your data" hint="Download a copy, or delete your account and everything in it.">
            <YourData email={user.email} open />
          </Section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function EmailForm({ user }: { user: User }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const pending = user.new_email;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMessage(null);
    const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${window.location.origin}/account` });
    setBusy(false);
    if (error) return setMessage({ ok: false, text: error.message });
    setEmail("");
    setMessage({ ok: true, text: "Check both inboxes: confirm the change from your current and your new address." });
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3 text-sm">
      <p>Current: <span className="font-medium">{user.email}</span></p>
      {pending && <p className="text-xs text-muted-foreground">Waiting for confirmation of {pending}.</p>}
      <label className="block text-xs">New email
        <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 rounded-full" />
      </label>
      <Button size="sm" type="submit" disabled={busy || !email.trim() || email.trim() === user.email}>{busy ? "Sending…" : "Change email"}</Button>
      {message && <p role={message.ok ? "status" : "alert"} className={message.ok ? "" : "text-destructive"}>{message.text}</p>}
    </form>
  );
}

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [nonce, setNonce] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const mismatch = again.length > 0 && again !== password;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== again) return;
    setBusy(true); setMessage(null);
    const { error } = await supabase.auth.updateUser(nonce ? { password, nonce: nonce.trim() } : { password });
    if (error?.code === "reauthentication_needed") {
      // For safety, changing a password can need a code sent to the account's email first.
      await supabase.auth.reauthenticate();
      setBusy(false);
      setNonce("");
      return setMessage({ ok: true, text: "We’ve emailed you a code. Enter it below to save your new password." });
    }
    setBusy(false);
    if (error) return setMessage({ ok: false, text: error.code === "same_password" ? "That’s already your password." : error.code === "weak_password" ? "Choose a longer password that’s harder to guess." : error.code === "reauthentication_not_valid" ? "That code didn’t match. Check the newest email." : error.message });
    setPassword(""); setAgain(""); setNonce(null);
    setMessage({ ok: true, text: hasPassword ? "Password changed." : "Password added. You can now sign in with your email too." });
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3 text-sm">
      <label className="block text-xs">{hasPassword ? "New password" : "Password"}
        <Input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 rounded-full" />
      </label>
      <label className="block text-xs">Type it again
        <Input type="password" required minLength={8} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} aria-invalid={mismatch} className="mt-1.5 rounded-full" />
      </label>
      {mismatch && <p className="text-xs text-destructive">The two passwords don’t match.</p>}
      {nonce !== null && (
        <label className="block text-xs">Code from your email
          <Input inputMode="numeric" autoComplete="one-time-code" value={nonce} onChange={(e) => setNonce(e.target.value)} className="mt-1.5 w-40 rounded-full" />
        </label>
      )}
      <Button size="sm" type="submit" disabled={busy || password.length < 8 || password !== again}>{busy ? "Saving…" : hasPassword ? "Change password" : "Add password"}</Button>
      {message && <p role={message.ok ? "status" : "alert"} className={message.ok ? "" : "text-destructive"}>{message.text}</p>}
    </form>
  );
}
