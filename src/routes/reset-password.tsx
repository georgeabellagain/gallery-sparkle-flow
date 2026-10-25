import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CenteredPage } from "@/components/pf/Chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  staticData: { sitemap: false },
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
    <CenteredPage title="Choose a new password" intro={ready ? "At least 8 characters." : "Open this page from the link in your reset email."}>
      {!ready ? (
        <div className="space-y-4 text-center text-sm text-muted-foreground">
          <p>If the link has expired, ask for a new one from the sign-in page.</p>
          <Button asChild variant="line" className="w-full"><Link to="/signin">Back to sign in</Link></Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="pw" className="text-xs">New password</Label>
            <Input id="pw" type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="mt-1.5 rounded-full" />
          </div>
          {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
        </form>
      )}
    </CenteredPage>
  );
}
