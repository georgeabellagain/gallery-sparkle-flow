import { HomeScrollContext } from "./home-scroll";
import { HomeMarketing } from "./HomeMarketing";
import { BookLoader } from "./book-loader";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Share2, SlidersHorizontal, Upload } from "lucide-react";
import { Wordmark, Modal } from "./Chrome";
import { Button } from "@/components/ui/button";
import { DropZone } from "./DropZone";
import { EditorStage } from "./EditorStage";
import { PortfolioPage, useStoredMedia } from "./PortfolioPage";
import { ProfileForm } from "./ProfileForm";
import { StyleForm } from "./StyleForm";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { UpgradeModal } from "./UpgradeModal";
import { deleteBlob } from "@/lib/portfolia/assets";
import { acceptPdf } from "@/lib/portfolia/pdf";
import { allPortfolios, beginNewPortfolio, canAddPortfolio, deletePortfolio, getDoc, patchPortfolio, replacePdf, startPortfolio, switchPortfolio, uploadLimitMb, useDoc, type PdfFile } from "@/lib/portfolia/store";
import { markPortfolioDeleted, retrySync, useSyncStatus } from "@/lib/portfolia/cloud";

const StudioDemo = lazy(() => import("./StudioDemo").then(m => ({ default: m.StudioDemo })));
type Dialog = "upload" | "profile" | "portfolios" | "unpublish" | "delete" | "help" | null;

/** The homepage is the product: the sample and uploaded PDF occupy the same workspace. */
export function HomeWorkspace() {
  const doc = useDoc(), p = doc.portfolio, navigate = useNavigate(), sync = useSyncStatus();
  const media = useStoredMedia(p?.pdf?.blobKey, p?.profile.photoKey);
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  useEffect(() => {
    const about = () => { if (window.location.hash === "#about") setDialog("help"); };
    about(); window.addEventListener("hashchange", about);
    return () => window.removeEventListener("hashchange", about);
  }, []);
  const [pending, setPending] = useState<{ pdf: PdfFile; target: string } | null>(null);
  const status = error || sync.status === "error" ? <button onClick={retrySync}>Couldn’t save · Retry</button> : sync.status === "saving" ? "Saving…" : doc.account.signedIn ? "Saved to your account" : "Preview freely. Sign in to save.";
  const closeUpload = () => {
    if (pending) { void deleteBlob(pending.pdf.blobKey); if (pending.pdf.coverKey) void deleteBlob(pending.pdf.coverKey); }
    setPending(null); setDialog(null);
  };
  const accepted = (pdf: PdfFile) => {
    const current = getDoc().portfolio;
    if (current?.pdf) { setPending({ pdf, target: current.code }); setDialog("upload"); return; }
    if (!startPortfolio(pdf)) { void deleteBlob(pdf.blobKey); if (pdf.coverKey) void deleteBlob(pdf.coverKey); setError("Couldn’t save this PDF in your browser. Free some storage and try again."); return; }
    setError(null); setDialog(null);
  };
  const upload = async (file?: File) => {
    if (!file || busy.current) return;
    busy.current = true; setError(null);
    try { accepted(await acceptPdf(file, setPhase, uploadLimitMb(getDoc()))); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t upload this PDF."); setDialog("upload"); }
    finally { busy.current = false; setPhase(null); if (input.current) input.current.value = ""; }
  };
  const publish = () => {
    const current = getDoc().portfolio;
    if (!current?.pdf) return setDialog("upload");
    if (!current.profile.name.trim()) return setDialog("profile");
    if (!getDoc().account.signedIn) { void navigate({ to: "/signin", search: { next: "home" } }); return; }
    setError(patchPortfolio({ status: "published", publishedAt: current.publishedAt ?? Date.now() }) ? null : "Couldn’t publish. Your draft is still available.");
  };
  const preview = p?.pdf ? <PortfolioPage showCredit={p.plan === "free"} profile={p.profile} pdf={media.pdf} photoUrl={media.photoUrl} allowDownload={p.allowDownload} pageStyle={p.plan === "personal" ? p.style : undefined} viewer={p.viewer} projects={p.pdf.projects} foldouts={p.pdf.foldouts} tags={p.pdf.tags} links={p.pdf.links} cvBlobKey={p.plan === "personal" ? p.profile.cv?.blobKey : undefined} compact /> : null;
  const profile = p ? <><ProfileForm key={p.code} p={p} onSaveError={setError} /><details className="mt-5"><summary className="cursor-pointer text-sm">Profile appearance</summary><StyleForm sidebar part="appearance" p={p} onSaveError={setError} /></details></> : null;
  return <div className="pf-home-workspace flex min-h-[100dvh] flex-col bg-[#eae6df]">
    <header className="relative z-50 flex h-14 shrink-0 items-center justify-between gap-3 bg-background/95 px-5 sm:px-8">
      <Wordmark />
      <div className="flex items-center gap-4 text-xs sm:text-sm">
        <Link to="/pricing">Pricing</Link>
        {doc.account.signedIn ? <button onClick={() => setDialog("portfolios")}>My portfolios</button> : <Link to="/signin" search={{ next: "home" }}>Sign in</Link>}
        <button onClick={() => setDialog("help")} className="text-muted-foreground">Help</button>
      </div>
    </header>
    <HomeScrollContext.Provider value={true}><main id="upload" className="relative flex-1" onDragOver={e => { if (!e.defaultPrevented && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }} onDrop={e => { if (e.defaultPrevented || !e.dataTransfer.files.length) return; e.preventDefault(); setOver(false); void upload(e.dataTransfer.files[0]); }}>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Upload portfolio PDF" onChange={e => void upload(e.target.files?.[0])} />
      {p?.pdf ? <>
        <h1 className="sr-only">Your portfolio workspace</h1>
        <EditorStage key={p.code} home p={p} preview={preview} profile={profile} statistics={doc.account.signedIn ? <AnalyticsPanel data={doc.analytics} title="This portfolio" description={p.pdf.name} /> : undefined} onUpload={() => input.current?.click()} onSaveError={setError} onDialog={d => setDialog(d === "replace" ? "upload" : d)} onPublish={publish} onUnpublish={() => setDialog("unpublish")} />
        <div className="absolute inset-x-0 bottom-1 z-40 text-center text-[10px] text-muted-foreground">{status}</div>
      </> : <div className="pf-home-example relative h-[calc(100dvh-3.5rem)] min-h-[34rem]">
        <div className="absolute inset-0"><Suspense fallback={<div className="flex h-full items-center justify-center"><BookLoader tone="light" label="" /></div>}><StudioDemo workspace className="relative h-full w-full" /></Suspense></div>
        <h1 className="sr-only">Portfolia portfolio workspace</h1>
        <span className="pointer-events-none absolute left-4 top-5 z-20 rounded-full bg-background/90 px-3 py-1.5 text-[11px] shadow-soft">Example portfolio</span>
        <nav aria-label="Portfolio workspace tools" className="pf-home-toolbar absolute bottom-7 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-border bg-background/95 p-2 shadow-lift backdrop-blur">
          <Button size="sm" onClick={() => input.current?.click()}><Upload className="size-4" /><span>Upload PDF</span></Button>
          <Button size="sm" variant="quiet" onClick={() => setDialog("upload")}><SlidersHorizontal className="size-4" /><span>Customise</span></Button>
          <Button size="sm" variant="quiet" onClick={() => setDialog("upload")}><Plus className="size-4" /><span>Add</span></Button>
          <Button size="sm" variant="quiet" onClick={() => setDialog("upload")}><Share2 className="size-4" /><span>Share</span></Button>
        </nav>
      </div>}
      {(over || phase) && <div role="status" className="pointer-events-none absolute inset-0 z-[70] flex items-center justify-center bg-background/90"><p className="display-title text-3xl">{phase ? `${phase}…` : "Drop your PDF here"}</p></div>}
      {error && <p role="alert" className="absolute left-1/2 top-20 z-[80] w-[min(90vw,32rem)] -translate-x-1/2 rounded-xl border border-destructive/20 bg-background p-3 text-sm text-destructive shadow-soft">{error}</p>}
    </main></HomeScrollContext.Provider>
    <HomeMarketing onUpgrade={() => setUpgrade(true)} />
    <Modal open={dialog === "upload"} onClose={closeUpload} title={pending ? "Replace your PDF?" : p?.pdf ? "Upload a PDF" : "Start with your PDF"}>
      {pending ? <><p className="text-sm">Replace your current PDF with <strong>{pending.pdf.name}</strong>? Your link and profile stay the same. Page-specific projects, notes, tabs and links will reset.</p><div className="mt-5 flex justify-end gap-2"><Button variant="line" onClick={closeUpload}>Cancel</Button><Button onClick={async () => { if (getDoc().portfolio?.code !== pending.target) return setError("Your active portfolio changed. Cancel and upload again."); if (!(await replacePdf(pending.pdf))) return setError("Couldn’t replace the PDF. Your original is unchanged."); setPending(null); setDialog(null); }}>Replace PDF</Button></div></> : <><p className="mb-4 text-sm text-muted-foreground">Upload your PDF to customise its display, add notes and links, and share it from this workspace.</p><DropZone small limitMb={uploadLimitMb(doc)} onAccepted={accepted} /><p className="mt-3 text-xs text-muted-foreground">No sign-up to preview. Your uploaded PDF replaces the example here.</p></>}
    </Modal>
    <Modal open={dialog === "profile"} onClose={() => setDialog(null)} title="Your profile">
      {profile}<Button className="mt-5 w-full" disabled={!p?.profile.name.trim()} onClick={() => { setDialog(null); publish(); }}>Continue to publish</Button>
    </Modal>
    <Modal open={dialog === "portfolios"} onClose={() => setDialog(null)} title="My portfolios">
      <div className="grid gap-2">{allPortfolios(doc).map(item => <Button key={item.code} variant="line" className="justify-start" onClick={() => { if (item.code !== p?.code) switchPortfolio(item.code); setDialog(null); }}>{item.name?.trim() || item.pdf?.name?.replace(/\.pdf$/i, "") || item.profile.name || "Untitled portfolio"}{item.code === p?.code ? " · Current" : ""}</Button>)}</div>
      <Button className="mt-5" onClick={() => { if (!p || canAddPortfolio(doc)) { if (p) beginNewPortfolio(); setDialog("upload"); } else { setDialog(null); setUpgrade(true); } }}>New portfolio</Button>
    </Modal>
    <Modal open={dialog === "unpublish"} onClose={() => setDialog(null)} title="Unpublish portfolio?">
      <p>Your public link will stop working. Your PDF and edits will be kept.</p><Button className="mt-5" variant="destructive" onClick={() => { setError(patchPortfolio({ status: "draft" }) ? null : "Couldn’t unpublish."); setDialog(null); }}>Unpublish</Button>
    </Modal>
    <Modal open={dialog === "delete"} onClose={() => setDialog(null)} title="Delete portfolio?">
      <p>This permanently removes this portfolio and cannot be undone.</p><Button className="mt-5" variant="destructive" onClick={async () => { if (p) markPortfolioDeleted(p.code); await deletePortfolio(); setDialog(null); }}>Delete permanently</Button>
    </Modal>
    <Modal open={dialog === "help"} onClose={() => setDialog(null)} title="About Portfolia">
      <div id="about" className="space-y-4 text-sm"><p>Upload a PDF, customise its presentation and share one link. Simple, Studio, Scroll and Page by page are all available in the workspace.</p><p>Contact <a href="mailto:hello@portfolia.site" className="underline">hello@portfolia.site</a> for help.</p><div className="flex flex-wrap gap-4"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/refund">Refund policy</Link><Link to="/marketing-portfolio">Marketing portfolios</Link><Link to="/flipbook-alternatives">Portfolio guides</Link></div></div>
    </Modal>
    <UpgradeModal open={upgrade} onClose={() => setUpgrade(false)} />
  </div>;
}
