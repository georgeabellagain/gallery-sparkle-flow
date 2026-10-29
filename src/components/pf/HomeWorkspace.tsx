import { HomeScrollContext } from "./home-scroll";
import { HomeMarketing } from "./HomeMarketing";
import { BookLoader } from "./book-loader";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Upload } from "lucide-react";
import type { Billing } from "./PricingPlans";
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
  const [billing, setBilling] = useState<Billing>("year");
  const [upgradePlan, setUpgradePlan] = useState<"personal" | "business">("personal");
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
    try { accepted(await acceptPdf(file, setPhase, uploadLimitMb(getDoc()), { allowPreview: true })); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t upload this PDF."); setDialog("upload"); }
    finally { busy.current = false; setPhase(null); if (input.current) input.current.value = ""; }
  };
  return <div className="pf-home-workspace flex min-h-[100dvh] flex-col bg-[#eae6df]">
    <header className="relative z-50 flex h-14 shrink-0 items-center justify-between gap-3 bg-background/95 px-4 sm:px-8">
      <Wordmark className="shrink-0" />
      {/* On phones: only what a visitor needs first; the rest is in the footer. Every label stays on one line. */}
      <nav aria-label="Main" className="flex min-w-0 items-center gap-3 whitespace-nowrap text-xs sm:gap-5 sm:text-sm">
        <Link to="/book-marketing" className="hidden underline-offset-4 hover:underline sm:inline">For authors</Link>
        <Link to="/pricing" className="underline-offset-4 hover:underline">Pricing</Link>
        {(doc.account.signedIn || allPortfolios(doc).length > 0) && <Link to="/dashboard" className="underline-offset-4 hover:underline"><span className="sm:hidden">Portfolios</span><span className="hidden sm:inline">My portfolios</span></Link>}
        {!doc.account.signedIn && <Link to="/signin" search={{ next: "home" }} className="rounded-full bg-foreground px-3 py-1.5 font-medium text-background hover:opacity-90">Sign in</Link>}
        <button onClick={() => setDialog("help")} className="hidden text-muted-foreground hover:text-foreground sm:inline">Help</button>
      </nav>
    </header>
    <HomeScrollContext.Provider value={true}><main id="upload" className="relative flex-1" onDragOver={e => { if (!e.defaultPrevented && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }} onDrop={e => { if (e.defaultPrevented || !e.dataTransfer.files.length) return; e.preventDefault(); setOver(false); void upload(e.dataTransfer.files[0]); }}>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Upload portfolio PDF" onChange={e => void upload(e.target.files?.[0])} />
      <div className="pf-home-example pf-home-split relative grid lg:grid-cols-[minmax(24rem,2fr)_3fr]">
        <div className="flex flex-col justify-center gap-6 bg-background px-6 py-10 sm:px-10 lg:min-h-[calc(100dvh-3.5rem)] lg:border-r lg:border-border lg:px-12 xl:px-16">
          <p className="label-xs text-leaf">Free PDF portfolio hosting</p>
          <h1 className="display-title max-w-lg text-4xl leading-[1.05] sm:text-5xl xl:text-6xl">Turn your PDF into a portfolio people remember.</h1>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">Upload the portfolio you already have and share it as a beautifully lit 3D flipbook, with one link, a QR code or an embed on your own site.</p>
          <button type="button" onClick={() => input.current?.click()} disabled={Boolean(phase)} className="group flex w-full max-w-md items-center gap-4 rounded-2xl border border-dashed border-border-strong bg-canvas p-4 text-left transition-colors hover:border-foreground hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Drop a PDF here or choose a PDF to upload">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-white shadow-soft transition-transform group-hover:-translate-y-0.5"><Upload className="size-5" aria-hidden /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Drop your PDF here</span><span className="block text-xs text-muted-foreground">or click to choose · publish up to {uploadLimitMb(doc)} MB</span></span>
            <span className="hidden rounded-full bg-foreground px-4 py-2 text-sm text-background sm:inline">Choose PDF</span>
          </button>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {["No sign-up to preview", "Free forever for one portfolio", "Looks great on phones"].map(t => <li key={t} className="flex items-center gap-1.5"><Check className="size-3.5 text-leaf" aria-hidden />{t}</li>)}
          </ul>
        </div>
        <div className="relative min-w-0 h-[70svh] min-h-[30rem] lg:h-[calc(100dvh-3.5rem)] lg:min-h-0">
        <div className="absolute inset-0"><Suspense fallback={<div className="flex h-full items-center justify-center"><BookLoader tone="light" label="" /></div>}><StudioDemo workspace className="relative h-full w-full" /></Suspense></div>
        <span className="pointer-events-none absolute left-4 top-5 z-20 rounded-full bg-background/90 px-3 py-1.5 text-[11px] shadow-soft">Live example</span>

        </div>
      </div>
      {(over || phase) && <div role="status" className="pointer-events-none absolute inset-0 z-[70] flex items-center justify-center bg-background/90"><p className="display-title text-3xl">{phase ? `${phase}…` : "Drop your PDF here"}</p></div>}
      {error && <p role="alert" className="absolute left-1/2 top-20 z-[80] w-[min(90vw,32rem)] -translate-x-1/2 rounded-xl border border-destructive/20 bg-background p-3 text-sm text-destructive shadow-soft">{error}</p>}
    </main></HomeScrollContext.Provider>
    <HomeMarketing onUpgrade={(b, plan = "personal") => { setBilling(b); setUpgradePlan(plan); setUpgrade(true); }} onAccepted={accepted} limitMb={uploadLimitMb(doc)} />
    <Modal open={dialog === "upload"} onClose={closeUpload} title="Start a new portfolio">
      {canCreate() ? <><p className="mb-4 text-sm text-muted-foreground">Upload a PDF to open its own editor. Your existing portfolios stay separate.</p><DropZone small allowPreview limitMb={uploadLimitMb(doc)} onAccepted={accepted} /><p className="mt-3 text-xs text-muted-foreground">No sign-up to preview. Sign in to save and publish.</p></> : <><p className="text-sm">Your plan’s portfolio limit has been reached. Open a portfolio from My portfolios to replace its PDF, or choose Personal for more portfolios.</p><Button className="mt-5" onClick={() => { setDialog(null); setUpgrade(true); }}>View Personal</Button></>}
    </Modal>
    <Modal open={dialog === "portfolios"} onClose={() => setDialog(null)} title="My portfolios" description="Pick one to open it in the editor.">
      <div className="grid gap-2">{allPortfolios(doc).map(item => <Button key={item.code} variant="line" className="justify-start" onClick={() => { if (item.code !== p?.code && !switchPortfolio(item.code)) { setError("Couldn’t open this portfolio. Please try again."); return; } setDialog(null); void navigate({ to: "/edit" }); }}>{item.name?.trim() || item.pdf?.name?.replace(/\.pdf$/i, "") || item.profile.name || "Untitled portfolio"}{item.code === p?.code ? " · Current" : ""}</Button>)}</div>
      <Button className="mt-5 w-full" onClick={() => { if (canCreate()) { setDialog("upload"); } else { setDialog(null); setUpgrade(true); } }}>New portfolio</Button>
    </Modal>
    <Modal open={dialog === "help"} onClose={() => setDialog(null)} title="About Portfolia">
      <div id="about" className="space-y-4 text-sm"><p>Upload a PDF to open its editor, customise its presentation and share one link. Visit My portfolios to return to an existing portfolio.</p><p>Contact <a href="mailto:hello@portfolia.site" className="underline">hello@portfolia.site</a> for help.</p><div className="flex flex-wrap gap-4"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/refund">Refund policy</Link><Link to="/marketing-portfolio">Marketing portfolios</Link><Link to="/flipbook-alternatives">Portfolio guides</Link></div></div>
    </Modal>
    <UpgradeModal open={upgrade} initialBilling={billing} plan={upgradePlan} onClose={() => setUpgrade(false)} />
  </div>;
}
