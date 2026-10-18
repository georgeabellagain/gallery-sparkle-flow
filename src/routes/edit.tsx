import { UpgradeModal } from "@/components/pf/UpgradeModal";
import { personalSaveEntitlement } from "@/lib/portfolia/entitlements.functions";
import { premiumAppearance } from "@/lib/portfolia/premium-appearance";
import { bookPurchaseUrl } from "@/lib/portfolia/book-marketing";
import { beginPortfolioDraft, discardPortfolioDraft, savePortfolioDraft, portfolioDraftDirty, getDoc } from "@/lib/portfolia/store";
import { ProfileForm } from "@/components/pf/ProfileForm";
import { StyleForm } from "@/components/pf/StyleForm";
import { AnalyticsPanel } from "@/components/pf/AnalyticsPanel";
import { createFileRoute, Link, useNavigate, useBlocker, useHydrated } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Modal, useBlob } from "@/components/pf/Chrome";
import { EditorBar, EditorStage } from "@/components/pf/EditorStage";
import { PortfolioPage, useStoredMedia } from "@/components/pf/PortfolioPage";
import { DropZone } from "@/components/pf/DropZone";
import { PdfViewer } from "@/components/pf/PdfViewer";
import { Button } from "@/components/ui/button";
import { deleteBlob, formatBytes } from "@/lib/portfolia/assets";
import { deletePortfolio, patchPortfolio, replacePdf, uploadLimitMb, useDoc, type PdfFile } from "@/lib/portfolia/store";
import { markPortfolioDeleted, retrySync, useSyncStatus } from "@/lib/portfolia/cloud";

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
  const [saving, setSaving] = useState(false), [upgrade, setUpgrade] = useState(false);
  const dirty = portfolioDraftDirty();
  useEffect(() => { if (p?.code) beginPortfolioDraft(p.code); return () => discardPortfolioDraft(); }, [p?.code]);
  const blocker = useBlocker({ shouldBlockFn: () => portfolioDraftDirty(), enableBeforeUnload: dirty, withResolver: true });
  const save = async (skipPremium = false): Promise<boolean> => {
    if (saving) return false;
    setSaving(true); setSaveErr(null);
    try {
      const current = getDoc().portfolio;
      if (!current) return false;
      if (current.bookMarketing?.buyUrl && !bookPurchaseUrl(current.bookMarketing.buyUrl)) throw new Error("Enter a valid purchase link before saving.");
      // Only newly added Personal options are gated: choices made while they were free stay grandfathered.
      const saved = getSavedDoc().portfolio;
      const legacy = saved?.code === current.code ? premiumAppearance(saved) : [];
      const premium = premiumAppearance(current).filter(f => !legacy.includes(f));
      if (!skipPremium && premium.length) {
        const entitlement = doc.account.signedIn ? await personalSaveEntitlement() : { personal: false };
        if (!entitlement.personal) { setUpgrade(true); throw new Error(`Choose Free options or upgrade to save: ${premium.join(", ")}. Your preview is still available.`); }
      }
      if (!savePortfolioDraft()) throw new Error("Couldn’t save your changes. Your previous version is unchanged.");
      return true;
    } catch (error) { setSaveErr(error instanceof Error ? error.message : "Couldn’t save. Please try again."); return false; }
    finally { setSaving(false); }
  };
  const { pdf, photoUrl } = useStoredMedia(p?.pdf?.blobKey, p?.profile.photoKey);

  // The saved portfolio only appears once the page has hydrated; redirecting before then sent a reload of
  // the editor to the dashboard even when a portfolio was saved on this device.
  const hydrated = useHydrated();
  useEffect(() => {
    if (hydrated && !p) {
      void navigate({ to: "/dashboard" });
    }
  }, [hydrated, p, navigate]);

  if (!p || !p.pdf) return null;

  const publish = async () => {
    if (!p.profile.name.trim()) return void navigate({ to: "/create" });
    if (!doc.account.signedIn) return void navigate({ to: "/signin", search: { next: "create" } });
    if (!await save()) return;
    setSaveErr(patchPortfolio({ status: "published", publishedAt: Date.now() }) && savePortfolioDraft() ? null : "Publishing failed — nothing changed.");
  };
  const status = saveErr ? "Changes not saved" : dirty ? "Unsaved preview" : sync.status === "error" ? <>Couldn’t sync · <button className="underline" onClick={retrySync}>Retry</button></> : !doc.account.signedIn ? "Saved on this device" : sync.status === "saving" ? "Syncing…" : "Saved";
  return (
    <div className="flex min-h-screen flex-col">
      <EditorBar p={p} status={status} onSave={() => void save()} saving={saving} onPublish={publish} onUnpublish={() => setDialog("unpublish")} />
      <main className="flex-1">
        <EditorStage
          key={p.code}
          home
          onUpload={() => setDialog("replace")}
          p={p}
          profile={<><ProfileForm key={p.code} p={p} onSaveError={setSaveErr} /><details className="mt-5"><summary className="cursor-pointer text-sm">Profile appearance</summary><StyleForm sidebar part="appearance" p={p} onSaveError={setSaveErr} /></details></>}
          statistics={doc.account.signedIn ? <AnalyticsPanel data={doc.analytics} title="This portfolio" description={p.pdf.name} /> : undefined}
          onSaveError={setSaveErr}
          onDialog={setDialog}
          onPublish={publish}
          onUnpublish={() => setDialog("unpublish")}
          preview={<PortfolioPage bookMarketing={p.bookMarketing} showCredit={p.plan === "free"} profile={p.profile} pdf={pdf} photoUrl={photoUrl} allowDownload={p.allowDownload} pageStyle={p.style} viewer={p.viewer} projects={p.pdf.projects} foldouts={p.pdf.foldouts} tags={p.pdf.tags} links={p.pdf.links} cvBlobKey={p.profile.cv?.blobKey} compact />}
        />
        {saveErr && <p role="alert" className="fixed bottom-4 left-1/2 z-50 w-[min(90vw,32rem)] -translate-x-1/2 rounded-xl border border-destructive/20 bg-background p-3 text-sm text-destructive shadow-soft">{saveErr}</p>}
      </main>
      <UpgradeModal open={upgrade} onClose={() => setUpgrade(false)} />
      <Modal open={blocker.status === "blocked"} onClose={() => blocker.reset?.()} title="Save changes before leaving?">
        <p>Your preview has unsaved changes. Discarding restores the last saved version.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button disabled={saving} onClick={() => void save().then(ok => { if (ok) blocker.proceed?.(); })}>Save & leave</Button>
          <Button variant="line" disabled={saving} onClick={() => { discardPortfolioDraft(); blocker.proceed?.(); }}>Discard & leave</Button>
          <Button variant="quiet" onClick={() => blocker.reset?.()}>Keep editing</Button>
        </div>
      </Modal>
      <EditReplaceModal open={dialog === "replace"} onClose={() => setDialog(null)} current={p.pdf} limitMb={uploadLimitMb(doc)} />
      <Modal open={dialog === "unpublish"} onClose={() => setDialog(null)} title="Unpublish portfolio?">
        <p className="text-muted-foreground">Its public link will stop working, but your PDF, details and address will be kept.</p>
        <div className="mt-6 flex justify-end gap-2"><Button variant="line" onClick={() => setDialog(null)}>Cancel</Button><Button variant="destructive" onClick={() => void save().then(ok => { if (!ok) return; setSaveErr(patchPortfolio({ status: "draft" }) && savePortfolioDraft() ? null : "Couldn’t unpublish — nothing changed."); setDialog(null); })}>Unpublish</Button></div>
      </Modal>
      <Modal open={dialog === "delete"} onClose={() => setDialog(null)} title="Delete portfolio?">
        <p className="text-muted-foreground">This permanently removes the PDF, details and statistics. It cannot be undone.</p>
        <div className="mt-6 flex justify-end gap-2"><Button variant="line" onClick={() => setDialog(null)}>Cancel</Button><Button variant="destructive" onClick={() => { discardPortfolioDraft(); if (p) markPortfolioDeleted(p.code); void deletePortfolio().then(() => navigate({ to: "/dashboard" })); }}>Delete permanently</Button></div>
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

