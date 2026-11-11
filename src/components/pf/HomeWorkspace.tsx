import { HomeScrollContext } from "./home-scroll";
import { HomeMarketing } from "./HomeMarketing";
import { LandingHero } from "./LandingHero";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import type { Billing } from "./PricingPlans";
import { MarketingHeader, Modal } from "./Chrome";
import { Button } from "@/components/ui/button";
import { DropZone } from "./DropZone";
import { UpgradeModal } from "./UpgradeModal";
import { deleteBlob } from "@/lib/portfolia/assets";
import { acceptPdf } from "@/lib/portfolia/pdf";
import { PORTFOLIO_TICKS, PRODUCT_TICKS } from "@/lib/portfolia/landing-demo";
import { allPortfolios, canAddPortfolio, getDoc, startPortfolio, switchPortfolio, uploadLimitMb, useDoc, type PdfFile } from "@/lib/portfolia/store";

type Dialog = "upload" | "portfolios" | "help" | null;

/** Public landing page: signed-in users keep the same example and open their own editor separately. */
export function HomeWorkspace() {
  const doc = useDoc(), p = doc.portfolio, navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  // The stage-height measurement, the live example and whole-page drag and drop now live in LandingHero.
  const [dialog, setDialog] = useState<Dialog>(null);
  const [workspaceTab, setWorkspaceTab] = useState<"portfolios" | "products">("portfolios");
  // The tab choice is kept in the address (/?for=products) so other pages can link straight to it.
  useEffect(() => { if (new URLSearchParams(window.location.search).get("for") === "products") setWorkspaceTab("products"); }, []);
  const chooseTab = (tab: "portfolios" | "products") => {
    setWorkspaceTab(tab);
    const url = new URL(window.location.href);
    if (tab === "products") url.searchParams.set("for", "products"); else url.searchParams.delete("for");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
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
    <MarketingHeader uploadHere onHelp={() => setDialog("help")} />
    <HomeScrollContext.Provider value={true}><main id="upload" className="relative flex-1">
      <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Upload portfolio PDF" onChange={e => void upload(e.target.files?.[0])} />
      <LandingHero
        headerOffset="4rem"
        clampIntro={false}
        eyebrow={workspaceTab === "portfolios" ? "Free PDF portfolio hosting" : "Digital Product Studio"}
        tabs={<div role="tablist" aria-label="Choose your workspace" className="mb-1 flex gap-2 text-xs">{(["portfolios", "products"] as const).map(t => <button key={t} role="tab" aria-selected={workspaceTab === t} onClick={() => chooseTab(t)} className={workspaceTab === t ? "rounded-full bg-foreground px-4 py-2 text-background" : "rounded-full border border-border px-4 py-2 hover:bg-muted"}>{t === "portfolios" ? "Share a portfolio" : "Sell a digital product"}</button>)}</div>}
        heading={workspaceTab === "portfolios" ? "Turn your PDF into a portfolio people remember." : <>Let shoppers look inside <em>before they buy.</em></>}
        intro={workspaceTab === "portfolios" ? "Upload the portfolio you already have and share it as a beautifully lit 3D flipbook, with one link, a QR code or an embed on your own site." : "Turn your digital book or zine into a lit 3D preview, then deliver the full edition to customers through a private link."}
        demo={workspaceTab === "portfolios" ? "portfolio" : "product"}
        upload={workspaceTab === "portfolios" ? "portfolio" : "product"}
        ticks={workspaceTab === "portfolios" ? PORTFOLIO_TICKS : PRODUCT_TICKS}
        onDropFile={workspaceTab === "portfolios" ? file => void upload(file) : undefined}
        uploadNode={workspaceTab === "portfolios" ? <button type="button" onClick={() => input.current?.click()} disabled={Boolean(phase)} className="group flex w-full max-w-md items-center gap-4 rounded-2xl border border-dashed border-border-strong bg-canvas p-4 text-left transition-colors hover:border-foreground hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Drop a PDF here or choose a PDF to upload">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-white shadow-soft transition-transform group-hover:-translate-y-0.5"><Upload className="size-5" aria-hidden /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Drop your PDF here</span><span className="block text-xs text-muted-foreground">or click to choose · publish up to {uploadLimitMb(doc)} MB</span></span>
          <span className="hidden rounded-full bg-foreground px-4 py-2 text-sm text-background sm:inline">Choose PDF</span>
        </button> : undefined}
        secondary={workspaceTab === "products" ? <p className="text-sm"><a href="/digital-product-studio" className="underline underline-offset-4">How it works</a></p> : undefined}
      />
      {phase && <div role="status" className="pointer-events-none absolute inset-0 z-[70] flex items-center justify-center bg-background/90"><p className="display-title text-3xl">{`${phase}…`}</p></div>}
      {error && <p role="alert" className="absolute left-1/2 top-20 z-[80] w-[min(90vw,32rem)] -translate-x-1/2 rounded-xl border border-destructive/20 bg-background p-3 text-sm text-destructive shadow-soft">{error}</p>}
    </main></HomeScrollContext.Provider>
    <HomeMarketing onUpgrade={(b, plan = "personal") => { setBilling(b); setUpgradePlan(plan); setUpgrade(true); }} />
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
