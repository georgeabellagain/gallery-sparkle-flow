import { HomeScrollContext } from "./home-scroll";
import { HomeMarketing } from "./HomeMarketing";
import { BookLoader } from "./book-loader";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { Wordmark, Modal } from "./Chrome";
import { Button } from "@/components/ui/button";
import { DropZone } from "./DropZone";
import { UpgradeModal } from "./UpgradeModal";
import { deleteBlob } from "@/lib/portfolia/assets";
import { acceptPdf } from "@/lib/portfolia/pdf";
import { allPortfolios, canAddPortfolio, getDoc, startPortfolio, switchPortfolio, uploadLimitMb, useDoc, type PdfFile } from "@/lib/portfolia/store";

const StudioDemo = lazy(() => import("./StudioDemo").then(m => ({ default: m.StudioDemo })));
type Dialog = "upload" | "portfolios" | "help" | null;

/** Public landing page: signed-in users keep the same example and open their own editor separately. */
export function HomeWorkspace() {
  const doc = useDoc(), p = doc.portfolio, navigate = useNavigate();
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
  const closeUpload = () => setDialog(null);
  const canCreate = () => !allPortfolios(getDoc()).length || canAddPortfolio(getDoc());
  const accepted = (pdf: PdfFile) => {
    if (!canCreate() || !startPortfolio(pdf, { newPortfolio: true })) {
      void deleteBlob(pdf.blobKey); if (pdf.coverKey) void deleteBlob(pdf.coverKey);
      setError(canCreate() ? "Couldn’t save this PDF in your browser. Free some storage and try again." : "Your plan’s portfolio limit has been reached. Open an existing portfolio to replace its PDF, or choose Personal for more portfolios.");
      return;
    }
    setError(null); setDialog(null);
    void navigate({ to: "/edit" });
  };
  const upload = async (file?: File) => {
    if (!file || busy.current) return;
    if (!canCreate()) { setDialog("portfolios"); setError("Open an existing portfolio to replace its PDF, or choose Personal to create more portfolios."); return; }
    busy.current = true; setError(null);
    try { accepted(await acceptPdf(file, setPhase, uploadLimitMb(getDoc()))); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t upload this PDF."); setDialog("upload"); }
    finally { busy.current = false; setPhase(null); if (input.current) input.current.value = ""; }
  };
  return <div className="pf-home-workspace flex min-h-[100dvh] flex-col bg-[#eae6df]">
    <header className="relative z-50 flex h-14 shrink-0 items-center justify-between gap-3 bg-background/95 px-5 sm:px-8">
      <Wordmark />
      <div className="flex items-center gap-4 text-xs sm:text-sm">
        <Link to="/pricing">Pricing</Link>
        {(doc.account.signedIn || allPortfolios(doc).length > 0) && <button onClick={() => setDialog("portfolios")}>My portfolios</button>}
        {!doc.account.signedIn && <Link to="/signin" search={{ next: "home" }}>Sign in</Link>}
        <button onClick={() => setDialog("help")} className="text-muted-foreground">Help</button>
      </div>
    </header>
    <HomeScrollContext.Provider value={true}><main id="upload" className="relative flex-1" onDragOver={e => { if (!e.defaultPrevented && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }} onDrop={e => { if (e.defaultPrevented || !e.dataTransfer.files.length) return; e.preventDefault(); setOver(false); void upload(e.dataTransfer.files[0]); }}>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Upload portfolio PDF" onChange={e => void upload(e.target.files?.[0])} />
      <div className="pf-home-example pf-home-split relative grid lg:grid-cols-[1fr_3fr]">
        <button type="button" onClick={() => input.current?.click()} disabled={Boolean(phase)} className="group flex min-h-[22rem] w-full flex-col items-center justify-center gap-5 border-b border-dashed border-border-strong bg-background/90 px-8 py-14 text-center transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:min-h-[calc(100dvh-3.5rem)] lg:border-b-0 lg:border-r" aria-label="Drop a PDF here or choose a PDF to upload">
          <span className="flex size-16 items-center justify-center rounded-2xl border border-border bg-white shadow-soft transition-transform group-hover:-translate-y-1"><Upload className="size-6" aria-hidden /></span>
          <span className="display-title max-w-xs text-3xl leading-tight sm:text-4xl">Drop your PDF here.</span>
          <span className="text-sm text-muted-foreground">Or click anywhere in this box to choose a file.</span>
          <span className="rounded-full bg-foreground px-5 py-2.5 text-sm text-background">Choose PDF</span>
          <span className="text-xs text-muted-foreground">PDF only · up to {uploadLimitMb(doc)} MB · No sign-up to preview</span>
        </button>
        <div className="relative min-w-0 h-[70svh] min-h-[30rem] lg:h-[calc(100dvh-3.5rem)] lg:min-h-0">
        <div className="absolute inset-0"><Suspense fallback={<div className="flex h-full items-center justify-center"><BookLoader tone="light" label="" /></div>}><StudioDemo workspace className="relative h-full w-full" /></Suspense></div>
        <h1 className="sr-only">Portfolia portfolio workspace</h1>
        <span className="pointer-events-none absolute left-4 top-5 z-20 rounded-full bg-background/90 px-3 py-1.5 text-[11px] shadow-soft">Example portfolio</span>

        </div>
      </div>
      {(over || phase) && <div role="status" className="pointer-events-none absolute inset-0 z-[70] flex items-center justify-center bg-background/90"><p className="display-title text-3xl">{phase ? `${phase}…` : "Drop your PDF here"}</p></div>}
      {error && <p role="alert" className="absolute left-1/2 top-20 z-[80] w-[min(90vw,32rem)] -translate-x-1/2 rounded-xl border border-destructive/20 bg-background p-3 text-sm text-destructive shadow-soft">{error}</p>}
    </main></HomeScrollContext.Provider>
    <HomeMarketing onUpgrade={() => setUpgrade(true)} />
    <Modal open={dialog === "upload"} onClose={closeUpload} title="Start a new portfolio">
      {canCreate() ? <><p className="mb-4 text-sm text-muted-foreground">Upload a PDF to open its own editor. Your existing portfolios stay separate.</p><DropZone small limitMb={uploadLimitMb(doc)} onAccepted={accepted} /><p className="mt-3 text-xs text-muted-foreground">No sign-up to preview. Sign in to save and publish.</p></> : <><p className="text-sm">Your plan’s portfolio limit has been reached. Open a portfolio from My portfolios to replace its PDF, or choose Personal for more portfolios.</p><Button className="mt-5" onClick={() => { setDialog(null); setUpgrade(true); }}>View Personal</Button></>}
    </Modal>
    <Modal open={dialog === "portfolios"} onClose={() => setDialog(null)} title="My portfolios">
      <div className="grid gap-2">{allPortfolios(doc).map(item => <Button key={item.code} variant="line" className="justify-start" onClick={() => { if (item.code !== p?.code && !switchPortfolio(item.code)) { setError("Couldn’t open this portfolio. Please try again."); return; } setDialog(null); void navigate({ to: "/edit" }); }}>{item.name?.trim() || item.pdf?.name?.replace(/\.pdf$/i, "") || item.profile.name || "Untitled portfolio"}{item.code === p?.code ? " · Current" : ""}</Button>)}</div>
      <Button className="mt-5" onClick={() => { if (canCreate()) { setDialog("upload"); } else { setDialog(null); setUpgrade(true); } }}>New portfolio</Button>
    </Modal>
    <Modal open={dialog === "help"} onClose={() => setDialog(null)} title="About Portfolia">
      <div id="about" className="space-y-4 text-sm"><p>Upload a PDF to open its editor, customise its presentation and share one link. Visit My portfolios to return to an existing portfolio.</p><p>Contact <a href="mailto:hello@portfolia.site" className="underline">hello@portfolia.site</a> for help.</p><div className="flex flex-wrap gap-4"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/refund">Refund policy</Link><Link to="/marketing-portfolio">Marketing portfolios</Link><Link to="/flipbook-alternatives">Portfolio guides</Link></div></div>
    </Modal>
    <UpgradeModal open={upgrade} onClose={() => setUpgrade(false)} />
  </div>;
}
