import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SiteHeader, SiteFooter, DemoNote, LOCAL_NOTE, Modal, useBlob } from "@/components/pf/Chrome";
import { StyleForm } from "@/components/pf/StyleForm";
import { PortfolioPage, useStoredMedia } from "@/components/pf/PortfolioPage";
import { DropZone } from "@/components/pf/DropZone";
import { PdfViewer } from "@/components/pf/PdfViewer";
import { Button } from "@/components/ui/button";
import { deleteBlob, formatBytes } from "@/lib/portfolia/assets";
import { deletePortfolio, patchPortfolio, replacePdf, uploadLimitMb, useDoc, type PdfFile } from "@/lib/portfolia/store";
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
  const [dialog, setDialog] = useState<null | "replace" | "unpublish" | "delete">(null);
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
          <section className="mt-7 rule-t pt-5">
            <h2 className="text-sm font-medium">Portfolio file and publishing</h2>
            <p className="mt-1 text-xs text-muted-foreground">{p.pdf.name} · {p.pdf.pages} pages · {formatBytes(p.pdf.bytes)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="line" onClick={() => setDialog("replace")}>Replace PDF</Button>
              {p.status === "published" ? <Button size="sm" variant="line" onClick={() => setDialog("unpublish")}>Unpublish</Button> : <Button size="sm" onClick={() => setSaveErr(patchPortfolio({ status: "published", publishedAt: Date.now() }) ? null : "Publishing failed — nothing changed.")}>Publish</Button>}
              <Button size="sm" variant="quiet" onClick={() => setDialog("delete")}>Delete</Button>
            </div>
          </section>
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
      <EditReplaceModal open={dialog === "replace"} onClose={() => setDialog(null)} current={p.pdf} limitMb={uploadLimitMb(doc)} />
      <Modal open={dialog === "unpublish"} onClose={() => setDialog(null)} title="Unpublish portfolio?">
        <p className="text-muted-foreground">Its public link will stop working, but your PDF, details and address will be kept.</p>
        <div className="mt-6 flex justify-end gap-2"><Button variant="line" onClick={() => setDialog(null)}>Cancel</Button><Button variant="destructive" onClick={() => { setSaveErr(patchPortfolio({ status: "draft" }) ? null : "Couldn’t unpublish — nothing changed."); setDialog(null); }}>Unpublish</Button></div>
      </Modal>
      <Modal open={dialog === "delete"} onClose={() => setDialog(null)} title="Delete portfolio?">
        <p className="text-muted-foreground">This permanently removes the PDF, details and statistics. It cannot be undone.</p>
        <div className="mt-6 flex justify-end gap-2"><Button variant="line" onClick={() => setDialog(null)}>Cancel</Button><Button variant="destructive" onClick={() => { void deletePortfolio().then(() => navigate({ to: "/dashboard" })); }}>Delete permanently</Button></div>
      </Modal>
    </div>
  );
}

function EditReplaceModal({ open, onClose, current, limitMb }: { open: boolean; onClose: () => void; current: PdfFile; limitMb: number }) {
  const [next, setNext] = useState<PdfFile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const blob = useBlob(next?.blobKey);
  const close = () => { if (next) void deleteBlob(next.blobKey); setNext(null); setErr(null); onClose(); };
  return <Modal open={open} onClose={close} title="Replace PDF">
    <p className="text-muted-foreground">{current.name} stays published until you confirm its replacement.</p>
    <div className="mt-4">{!next ? <DropZone small label="Choose replacement PDF" limitMb={limitMb} onAccepted={setNext} /> : <>
      <p className="text-xs">{next.name} · {next.pages} pages · {formatBytes(next.bytes)}</p>
      <div className="mt-2 h-72 overflow-hidden border border-border"><PdfViewer source={blob ? { blob } : null} fileName={next.name} compact viewer={{ mode: "paged", look: "clean", background: "paper", finish: "matte", paper: "smooth", light: "soft", shadow: "none", thickness: "thin", spreads: "single", showHeader: false }} /></div>
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
      <div className="mt-4 flex justify-end gap-2"><Button variant="line" onClick={close}>Cancel</Button><Button onClick={async () => { if (!(await replacePdf(next))) return setErr("Couldn’t save — your current PDF is still published."); setNext(null); onClose(); }}>Confirm replacement</Button></div>
    </>}</div>
  </Modal>;
}
