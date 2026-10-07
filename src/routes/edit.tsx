import { AnalyticsPanel } from "@/components/pf/AnalyticsPanel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SiteFooter, DemoNote, LOCAL_NOTE, Modal, useBlob } from "@/components/pf/Chrome";
import { EditorBar, EditorStage } from "@/components/pf/EditorStage";
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

  const publish = () => setSaveErr(patchPortfolio({ status: "published", publishedAt: Date.now() }) ? null : "Publishing failed — nothing changed.");
  const status = saveErr || sync.status === "error" ? <>Couldn’t save · <button className="underline" onClick={retrySync}>Retry</button></> : !doc.account.signedIn ? "Draft — sign in to save" : sync.status === "saving" ? "Saving…" : "Saved";
  return (
    <div className="flex min-h-screen flex-col">
      <EditorBar p={p} status={status} onPublish={publish} onUnpublish={() => setDialog("unpublish")} />
      <main className="flex-1">
        <EditorStage
          p={p}
          onSaveError={setSaveErr}
          onDialog={setDialog}
          onPublish={publish}
          onUnpublish={() => setDialog("unpublish")}
          preview={<PortfolioPage showCredit={p.plan === "free"} profile={p.profile} pdf={pdf} photoUrl={photoUrl} allowDownload={p.allowDownload} pageStyle={p.plan === "personal" ? p.style : undefined} viewer={p.viewer} projects={p.pdf.projects} foldouts={p.pdf.foldouts} tags={p.pdf.tags} links={p.pdf.links} cvBlobKey={p.plan === "personal" ? p.profile.cv?.blobKey : undefined} compact />}
        />
        {saveErr && <p role="alert" className="shell py-3 text-sm text-destructive">{saveErr}</p>}
        <section aria-label="Statistics" className="shell py-6 sm:py-8">
          <div className="max-w-xl space-y-6">
            {doc.account.signedIn && <section id="statistics"><AnalyticsPanel data={doc.analytics} title="This portfolio’s statistics" description={p.pdf.name} /></section>}
            <DemoNote>{LOCAL_NOTE}</DemoNote>
          </div>
        </section>
      </main>
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
  const close = () => { if (next) { void deleteBlob(next.blobKey); if (next.coverKey) void deleteBlob(next.coverKey); } setNext(null); setErr(null); onClose(); };
  return <Modal open={open} onClose={close} title="Replace PDF">
    <p className="text-muted-foreground">{current.name} stays published until you confirm its replacement. Named project ranges and scrapbook fold-outs will be cleared because the new file may have different pages.</p>
    <div className="mt-4">{!next ? <DropZone small label="Choose replacement PDF" limitMb={limitMb} onAccepted={setNext} /> : <>
      <p className="text-xs">{next.name} · {next.pages} pages · {formatBytes(next.bytes)}</p>
      <div className="mt-2 h-72 overflow-hidden border border-border"><PdfViewer source={blob ? { blob } : null} fileName={next.name} compact viewer={{ mode: "paged", look: "clean", background: "paper", finish: "matte", paper: "smooth", light: "soft", shadow: "none", thickness: "thin", spreads: "single", showHeader: false }} /></div>
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
      <div className="mt-4 flex justify-end gap-2"><Button variant="line" onClick={close}>Cancel</Button><Button onClick={async () => { if (!(await replacePdf(next))) return setErr("Couldn’t save — your current PDF is still published."); setNext(null); onClose(); }}>Confirm replacement</Button></div>
    </>}</div>
  </Modal>;
}

