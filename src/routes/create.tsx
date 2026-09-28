import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader, DemoNote, LOCAL_NOTE } from "@/components/pf/Chrome";
import { ProfileForm } from "@/components/pf/ProfileForm";
import { PortfolioPage, useStoredMedia } from "@/components/pf/PortfolioPage";
import { Button } from "@/components/ui/button";
import { patchPortfolio, useDoc } from "@/lib/portfolia/store";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Add your details — Portfolia" },
      { name: "description", content: "Add a few details to your PDF portfolio, preview it, and publish." },
      { property: "og:title", content: "Add your details — Portfolia" },
      { property: "og:description", content: "Add a few details to your PDF portfolio, preview it, and publish." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Create,
});

function Create() {
  const doc = useDoc();
  const p = doc.portfolio;
  const navigate = useNavigate();
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [pubErr, setPubErr] = useState<string | null>(null);
  const { pdf, photoUrl } = useStoredMedia(p?.pdf?.blobKey, p?.profile.photoKey);

  if (!p || !p.pdf) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-md px-5 py-24 text-center text-sm">
          <p>Start by uploading your PDF.</p>
          <Button asChild className="mt-4"><Link to="/">Upload a PDF</Link></Button>
        </main>
      </div>
    );
  }

  const canPublish = p.profile.name.trim().length > 0;
  const publish = () => {
    if (!doc.account.signedIn) return void navigate({ to: "/signin", search: { next: "create" } });
    if (!patchPortfolio({ status: "published", publishedAt: Date.now() }))
      return setPubErr("Publishing failed — this browser couldn’t save. Your portfolio is still a draft.");
    void navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader right={<span className="text-xs text-muted-foreground">{saveErr ? "Couldn’t save" : "Saved in this browser"}</span>} />
      <div className="grid flex-1 lg:grid-cols-[380px_1fr]">
        <aside className="border-border p-5 lg:border-r lg:p-7">
          <h1 className="display-title text-2xl">Add your details</h1>
          <p className="mt-1 text-xs text-muted-foreground">{p.pdf.name} · {p.pdf.pages} pages</p>
          <div className="mt-6"><ProfileForm p={p} onSaveError={setSaveErr} /></div>
          {saveErr && <p role="alert" className="mt-4 text-sm text-destructive">{saveErr}</p>}
          <div className="mt-8 rule-t pt-5">
            <p className="text-xs text-muted-foreground">Will be published at <span className="font-mono text-foreground">/p/{p.code}</span>. Unlisted: anyone with your link can view. Your portfolio will not appear in a public directory.</p>
            {p.status === "published" ? (
              <Button asChild className="mt-4 w-full"><Link to="/dashboard">Back to dashboard</Link></Button>
            ) : (
              <Button className="mt-4 w-full" disabled={!canPublish} onClick={publish}>Publish portfolio</Button>
            )}
            {!canPublish && <p className="mt-2 text-xs text-muted-foreground">Add your name to publish.</p>}
            {!doc.account.signedIn && canPublish && <p className="mt-2 text-xs text-muted-foreground">You’ll continue with a demo account (no real sign-in).</p>}
            {pubErr && <p role="alert" className="mt-2 text-sm text-destructive">{pubErr}</p>}
            <DemoNote className="mt-6">{LOCAL_NOTE}</DemoNote>
          </div>
        </aside>
        <section aria-label="Preview" className="bg-muted/50 p-3 sm:p-6">
          <p className="label-xs mb-2">Preview</p>
          <div className="border border-border">
            <PortfolioPage profile={p.profile} pdf={pdf} photoUrl={photoUrl} allowDownload={p.allowDownload} showCredit={p.plan === "free"} compact />
          </div>
        </section>
      </div>
    </div>
  );
}
