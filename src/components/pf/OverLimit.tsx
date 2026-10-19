import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getBlob } from "@/lib/portfolia/assets";
import { acceptPdf } from "@/lib/portfolia/pdf";
import { deleteUnusedPortfolioAsset, getDoc, isPaid, patchPortfolio, pdfOverLimit, PERSONAL_UPLOAD_LIMIT_MB, replacePdf, uploadLimitMb, useDoc } from "@/lib/portfolia/store";
import { DropZone } from "./DropZone";

/**
 * Shown when a previewed PDF is above the plan allowance. It stays in this browser until it fits:
 * make a smaller web copy here, upgrade, or choose another PDF. Pages, notes and links carry over.
 */
export function OverLimitPanel({ onUpgrade, className = "" }: { onUpgrade?: () => void; className?: string }) {
  const doc = useDoc();
  const pdf = doc.portfolio?.pdf;
  const [phase, setPhase] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  if (!pdf) return null;
  // Once it fits, keep the confirmation visible instead of the panel vanishing silently.
  if (!pdfOverLimit(doc)) return note ? <p role="status" className={`rounded-2xl border border-leaf bg-leaf-soft p-4 text-sm ${className}`}>{note}</p> : null;
  const limit = uploadLimitMb(doc), paid = isPaid(doc);
  const shrink = async () => {
    setNote(null);
    setPhase("Making a smaller web copy on your device");
    try {
      const blob = await getBlob(pdf.blobKey);
      if (!blob) throw new Error("Your PDF is no longer in this browser. Choose it again.");
      const { optimiseFile } = await import("@/lib/portfolia/optimise-file");
      const smaller = await optimiseFile(new File([blob], pdf.name, { type: "application/pdf" }), "web");
      if (!smaller) throw new Error("This PDF has no large photos to resize. Export a smaller copy from your design app" + (paid ? "." : ", or upgrade."));
      const next = await acceptPdf(smaller, setPhase, uploadLimitMb(getDoc()), { allowPreview: true });
      const old = getDoc().portfolio?.pdf;
      if (!old || old.blobKey !== pdf.blobKey) return;
      if (!patchPortfolio({ pdf: { ...old, blobKey: next.blobKey, coverKey: next.coverKey ?? old.coverKey, bytes: next.bytes, name: next.name } })) throw new Error("Couldn’t use the smaller copy. Your original is unchanged.");
      void deleteUnusedPortfolioAsset(old.blobKey);
      if (next.coverKey && old.coverKey !== next.coverKey) void deleteUnusedPortfolioAsset(old.coverKey);
      const mb = (next.bytes / 1048576).toFixed(1);
      setNote(pdfOverLimit(getDoc()) ? `The web copy is ${mb} MB, still above ${limit} MB. Export a smaller copy from your design app${paid ? "." : ", or upgrade."}` : `Done: your PDF is now ${mb} MB and ready to publish. Check the pages look right.`);
    } catch (e) { setNote(e instanceof Error ? e.message : "Couldn’t make a smaller copy."); }
    finally { setPhase(null); }
  };
  return (
    <div role="status" className={`rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-[#5b4300] ${className}`}>
      <p className="font-medium">This PDF is {(pdf.bytes / 1048576).toFixed(1)} MB. {paid ? "Personal" : "Free"} publishes PDFs up to {limit} MB.</p>
      <p className="mt-1 text-xs leading-relaxed">You can keep previewing and editing; it stays on this device until it fits. A smaller web copy resizes large photos for screens and keeps text, notes and links.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={Boolean(phase)} onClick={() => void shrink()}>{phase ? `${phase}…` : "Make a smaller web copy"}</Button>
        {!paid && (onUpgrade
          ? <Button size="sm" variant="line" disabled={Boolean(phase)} onClick={onUpgrade}>Upgrade: {PERSONAL_UPLOAD_LIMIT_MB} MB on Personal</Button>
          : <Button size="sm" variant="line" asChild><Link to="/pricing">Upgrade: {PERSONAL_UPLOAD_LIMIT_MB} MB on Personal</Link></Button>)}
        <button type="button" disabled={Boolean(phase)} onClick={() => setPicking((v) => !v)} className="text-xs underline underline-offset-4">Choose another PDF</button>
      </div>
      {picking && <div className="mt-3"><DropZone small allowPreview label="Choose PDF" limitMb={limit} onAccepted={(next) => { setPicking(false); void replacePdf(next).then((ok) => setNote(ok ? null : "Couldn’t use that PDF. Please try again.")); }} /></div>}
      {note && <p className="mt-3 text-xs" role="alert">{note}</p>}
    </div>
  );
}
