import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageFileDrop } from "@/components/pf/use-page-drop";
import { supabase } from "@/integrations/supabase/client";
import { productAuth } from "@/lib/products/client";
import { createProduct } from "@/lib/products/functions";
import { keepPendingProductPdf, pendingPdfProblem } from "@/lib/products/pending";
import { cn } from "@/lib/utils";

/**
 * The upload box for product pages. Products live in an account (the file goes to private storage), so the PDF waits
 * in this browser while the visitor signs in; then a product is made and its editor uploads the file.
 */
export function ProductUploadBox({ id = "upload", pageDrop = false, className }: { id?: string; pageDrop?: boolean; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const handle = async (file?: File) => {
    if (!file || busy.current) return;
    busy.current = true;
    setError(null);
    // Once a sign-in or editor page load has started the box stays busy until the page changes.
    let leaving = false;
    try {
      const problem = pendingPdfProblem(file);
      if (problem) { setError(problem); return; }
      setPhase("Keeping your PDF safe on this device");
      const kept = await keepPendingProductPdf(file);
      if (!kept.ok) { setError(kept.message); return; }
      const { data } = await supabase.auth.getSession();
      if (!data.session) { leaving = true; setPhase("Taking you to sign in"); window.location.assign("/signin?next=products-upload"); return; }
      setPhase("Making your product");
      leaving = true;
      try {
        const productId = await createProduct({ headers: await productAuth() });
        window.location.assign(`/product-studio/${productId}?pending=1`);
      } catch {
        // Most likely the plan's product limit: the product list shows the upgrade prompt and keeps the file for 10 minutes.
        window.location.assign("/products?pending=1");
      }
    } catch (e) {
      leaving = false;
      setError(e instanceof Error ? e.message : "The upload didn’t finish.");
    } finally {
      if (!leaving) { busy.current = false; setPhase(null); }
      if (input.current) input.current.value = "";
    }
  };
  const pageOver = usePageFileDrop(file => void handle(file), pageDrop);
  return <div id={id} className={cn("w-full max-w-md scroll-mt-6", className)}>
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); void handle(e.dataTransfer.files[0]); }}
      onClick={() => { if (!phase) input.current?.click(); }}
      className={cn("flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed bg-canvas p-4 text-left transition-colors duration-200", over || pageOver ? "border-foreground bg-accent" : "border-border-strong hover:border-foreground hover:bg-white")}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-leaf shadow-soft" aria-hidden><FileUp className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span role="status" aria-live="polite" className="block text-sm font-medium">{phase ? `${phase}…` : "Drop your product PDF here"}</span>
        <span className="block text-xs text-muted-foreground">or click to choose · PDF only</span>
      </span>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-hidden onClick={e => e.stopPropagation()} onChange={e => void handle(e.target.files?.[0])} />
      <Button size="sm" className="shrink-0" disabled={Boolean(phase)}>Choose PDF</Button>
    </div>
    {error && <p role="alert" className="mt-3 rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</p>}
    <p className="mt-3 text-xs text-muted-foreground">Free to try. Your PDF stays private.</p>
  </div>;
}
