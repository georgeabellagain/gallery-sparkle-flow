import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/pf/Chrome";
import { loadPdfjs, describePdfError } from "@/lib/portfolia/pdf";
import { inspectPdf } from "@/lib/portfolia/check-pdf";
import { formatBytes } from "@/lib/portfolia/assets";
export const Route = createFileRoute("/portfolio-checker")({ staticData: { sitemap: true }, head: () => ({ meta: [{ title: "Free local PDF portfolio checker | Portfolia" }, { name: "description", content: "Check your portfolio’s file size, page count and links on your device, with a first-page preview. Your PDF is not uploaded." }], links: [{ rel: "canonical", href: "https://portfolia.site/portfolio-checker" }] }), component: Checker });
function Checker() {
  const [result, setResult] = useState<Awaited<ReturnType<typeof inspectPdf>> | null>(null);
  const [cover, setCover] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  return <div className="flex min-h-screen flex-col"><SiteHeader /><main className="shell w-full max-w-4xl flex-1 py-14"><p className="label-xs">Free tool</p><h1 className="display-title mt-3 text-4xl">Check your portfolio PDF.</h1><p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">Check file size, pages and external links before sharing. Processing stays on this device: your PDF is not uploaded or saved to a Portfolia account.</p>
    <label className="mt-8 block rounded-2xl border border-border bg-card p-6 text-sm shadow-soft">Choose a PDF (up to 75 MB)<input type="file" accept="application/pdf,.pdf" disabled={busy} className="mt-4 block w-full cursor-pointer text-sm text-muted-foreground file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-primary file:px-5 file:py-3 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90 disabled:cursor-wait disabled:opacity-50" onChange={async e=>{
      const file = e.target.files?.[0]; if (!file || running.current) return;
      e.target.value = ""; running.current = true; setBusy(true); setError(""); setResult(null); setCover("");
      let doc: import("pdfjs-dist").PDFDocumentProxy | undefined;
      try {
        if (file.size > 75 * 1024 * 1024) throw new Error("Choose a PDF up to 75 MB, or export a smaller web copy.");
        const pdfjs = await loadPdfjs(); doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const report = await inspectPdf(doc, file.size);
        const first = await doc.getPage(1); const base = first.getViewport({scale:1}); const viewport = first.getViewport({scale: Math.min(600/base.width,800/base.height)});
        const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height;
        const ctx = canvas.getContext("2d"); if (ctx) { await first.render({canvasContext:ctx,viewport}).promise; setCover(canvas.toDataURL("image/jpeg",.85)); }
        setResult(report);
      } catch(err) { setError(err instanceof Error && err.message.startsWith("Choose a PDF") ? err.message : describePdfError(err)); }
      finally { await doc?.destroy().catch(() => {}); running.current=false; setBusy(false); }
    }} /></label>
    {busy && <p role="status" className="mt-4 text-sm">Checking pages and links…</p>}{error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {result && <section aria-label="PDF check results" className="mt-8 grid gap-8 sm:grid-cols-[1fr_1fr]"><div><h2 className="text-xl font-medium">Your PDF at a glance</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-muted-foreground">File size</dt><dd>{formatBytes(result.bytes)} · {result.bytes <= 10*1024*1024 ? "Fits Free and Personal" : result.bytes <= 50*1024*1024 ? "Fits Personal; too large for Free" : "Above the 50 MB Personal limit"}</dd></div><div><dt className="text-muted-foreground">Pages</dt><dd>{result.pages}{result.inspected<result.pages ? ` (first ${result.inspected} checked)` : ""}</dd></div><div><dt className="text-muted-foreground">External links</dt><dd>{result.links} link annotations in the checked pages</dd></div></dl><ul className="mt-6 list-disc space-y-3 pl-4 text-sm text-muted-foreground"><li>{result.links ? "PDF links work in Scroll and Page by page. They are not currently clickable in Flipbook." : "No external links detected in the checked pages. Consider adding project or contact links before export."}</li>{result.variedSizes && <li>Page sizes vary. Check each spread in the preview.</li>}<li>{result.landscape ? "Your first page is landscape. Choose ready-made spreads only if each PDF sheet contains two book pages." : "Your first page is portrait. Check the book’s page setting matches your exported layout."}</li><li>Review the cover at phone size: is your name readable and your strongest work easy to identify? This tool checks the file, not the quality of the design.</li></ul><a href="/#upload" className="mt-6 inline-block text-sm text-leaf underline">Preview it as a flipbook</a></div>{cover && <figure><img src={cover} alt="First page of your selected PDF" className="max-h-[32rem] w-full object-contain" /><figcaption className="mt-3 text-xs text-muted-foreground">First-page preview, generated locally.</figcaption></figure>}</section>}
  </main><SiteFooter /></div>;
}
