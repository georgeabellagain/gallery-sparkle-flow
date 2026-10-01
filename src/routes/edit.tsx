import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SiteHeader, SiteFooter, DemoNote, LOCAL_NOTE } from "@/components/pf/Chrome";
import { StyleForm } from "@/components/pf/StyleForm";
import { PortfolioPage, useStoredMedia } from "@/components/pf/PortfolioPage";
import { Button } from "@/components/ui/button";
import { useDoc } from "@/lib/portfolia/store";
import { retrySync, useSyncStatus } from "@/lib/portfolia/cloud";

export const Route = createFileRoute("/edit")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Edit portfolio style — Portfolia" },
      { name: "description", content: "Choose how your Portfolia PDF portfolio looks and reads." },
      { property: "og:title", content: "Edit portfolio — Portfolia" },
      { property: "og:description", content: "Choose how your Portfolia PDF portfolio looks and reads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditPortfolio,
});

function EditPortfolio() {
  const doc = useDoc();
  const p = doc.portfolio;
  const navigate = useNavigate();
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const sync = useSyncStatus();
  const { pdf, photoUrl } = useStoredMedia(p?.pdf?.blobKey, p?.profile.photoKey);

  useEffect(() => {
    if (!p) {
      void navigate({ to: "/dashboard" });
    }
  }, [p, navigate]);

  if (!p || !p.pdf) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader right={<span className="text-xs text-muted-foreground">{saveErr || sync.status === "error" ? <>Couldn’t save · <button className="underline" onClick={retrySync}>Retry</button></> : !doc.account.signedIn ? "Draft — sign in to save" : sync.status === "saving" ? "Saving…" : "Saved"}</span>} />
      <div className="grid flex-1 lg:grid-cols-[380px_1fr]">
        <aside className="border-border p-5 lg:border-r lg:p-7">
          <h1 className="display-title text-2xl">Edit portfolio</h1>
          <p className="mt-1 text-xs text-muted-foreground">Style and experience settings</p>
          <div className="mt-6"><StyleForm p={p} onSaveError={setSaveErr} /></div>
          {saveErr && <p role="alert" className="mt-4 text-sm text-destructive">{saveErr}</p>}
          <div className="mt-8 rule-t pt-5 space-y-3">
            <Button asChild className="w-full" variant="line"><Link to="/dashboard">Back to dashboard</Link></Button>
            <Button asChild className="w-full" variant="quiet"><Link to="/create">Edit profile details</Link></Button>
            <DemoNote className="mt-6">{LOCAL_NOTE}</DemoNote>
          </div>
        </aside>
        <section aria-label="Preview" className="bg-muted/50 p-3 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="label-xs">Preview</p>
            <Link to="/p/$slug" params={{ slug: p.code }} search={{ preview: "1" }} className="text-xxs underline underline-offset-4 text-muted-foreground hover:text-foreground">Full preview</Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <PortfolioPage profile={p.profile} pdf={pdf} photoUrl={photoUrl} allowDownload={p.allowDownload} showCredit={p.plan === "free"} pageStyle={p.plan === "personal" ? p.style : undefined} viewer={p.viewer} cvBlobKey={p.plan === "personal" ? p.profile.cv?.blobKey : undefined} compact />
          </div>
        </section>
      </div>
      <SiteFooter />
    </div>
  );
}
