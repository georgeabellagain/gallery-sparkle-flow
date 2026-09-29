import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/pf/Chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Portfolia" },
      { name: "description", content: "Set a new password for your Portfolia account." },
      { property: "og:title", content: "Choose a new password — Portfolia" },
      { property: "og:description", content: "Set a new password for your Portfolia account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((e, s) => { if (e === "PASSWORD_RECOVERY" || s) setReady(true); });
    void supabase.auth.getSession().then(({ data: d }) => { if (d.session) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    void navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-sm px-5 py-20">
        <h1 className="display-title text-3xl">Choose a new password</h1>
        {!ready ? (
          <p className="mt-6 text-sm text-muted-foreground">Open this page from the link in your reset email. If the link has expired, request a new one from the sign-in page.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="pw" className="text-xs">New password</Label>
              <Input id="pw" type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1.5 rounded-full" />
            </div>
            {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
          </form>
        )}
      </main>
    </div>
  );
}
