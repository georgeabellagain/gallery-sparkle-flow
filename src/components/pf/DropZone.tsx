import { useEffect, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptPdf } from "@/lib/portfolia/pdf";
import { FREE_UPLOAD_LIMIT_MB, PERSONAL_UPLOAD_LIMIT_MB, PREVIEW_LIMIT_MB, type PdfFile } from "@/lib/portfolia/store";
import type { OptimiseMode } from "@/lib/portfolia/optimise-file";
import { cn } from "@/lib/utils";

/**
 * allowPreview: new portfolios may preview PDFs above the plan allowance (kept in this browser); publishing then
 * asks for a smaller copy or an upgrade. Replacing a published PDF keeps the strict limit.
 */
export function DropZone({ onAccepted, label = "Upload your PDF", small, className, buttonClassName, limitMb = FREE_UPLOAD_LIMIT_MB, allowPreview = false }: { onAccepted: (pdf: PdfFile) => void; label?: string; small?: boolean; className?: string; buttonClassName?: string; limitMb?: number; allowPreview?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<OptimiseMode | "none">("none");
  const [rejected, setRejected] = useState<File | null>(null);
  const [candidate, setCandidate] = useState<{ original: File; smaller: File | null; mode: OptimiseMode } | null>(null);
  const [download, setDownload] = useState<string>();
  const busy = useRef(false);
  const limitBytes = limitMb * 1048576;
  useEffect(() => {
    if (!candidate?.smaller) { setDownload(undefined); return; }
    const url = URL.createObjectURL(candidate.smaller);
    setDownload(url);
    return () => URL.revokeObjectURL(url);
  }, [candidate]);

  const accept = async (file: File) => {
    setPhase("Checking PDF");
    try { const pdf = await acceptPdf(file, setPhase, limitMb, { allowPreview }); setCandidate(null); setRejected(null); onAccepted(pdf); }
    catch (e) {
      setError(e instanceof Error ? e.message : "The upload didn’t finish.");
      if (file.size > limitBytes) setRejected(file);
    }
    finally { setPhase(null); busy.current = false; }
  };
  const shrink = async (file: File, how: OptimiseMode) => {
    setError(null);
    setRejected(null);
    setPhase(how === "web" ? "Making a smaller web copy on your device" : "Trying a smaller copy on your device");
    try {
      const { optimiseFile } = await import("@/lib/portfolia/optimise-file");
      setCandidate({ original: file, smaller: await optimiseFile(file, how), mode: how });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not make a smaller copy."); }
    finally { setPhase(null); busy.current = false; }
  };
  const handle = async (file?: File) => {
    if (!file || busy.current) return;
    busy.current = true;
    setError(null);
    setRejected(null);
    setCandidate(null);
    try {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Please choose a PDF file.");
      if (mode !== "none") await shrink(file, mode);
      else await accept(file);
    } catch (e) { setError(e instanceof Error ? e.message : "The upload didn’t finish."); }
    finally { busy.current = false; setPhase(null); if (input.current) input.current.value = ""; }
  };
  const pick = (file: File) => { if (!busy.current) { busy.current = true; void accept(file); } };
  const mb = (f: File) => (f.size / 1048576).toFixed(1);

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-[1.75rem] border border-dashed bg-card text-center transition-colors duration-200",
          small ? "px-5 py-8" : "px-6 py-12",
          over ? "border-foreground bg-accent" : "border-border-strong hover:border-border-strong hover:bg-accent/40",
          className,
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-leaf-soft text-leaf" aria-hidden>
          <FileUp className="size-5" />
        </span>
        <p role="status" aria-live="polite" className="mt-3 text-sm">{phase ? `${phase}…` : "Drag your PDF here"}</p>
        <p className="mt-1 text-xs text-muted-foreground">PDF only · {allowPreview ? `publish up to ${limitMb} MB on your plan` : `up to ${limitMb} MB on your current plan`}</p>
        <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void handle(e.target.files?.[0])} />
        <Button className={cn("mt-5", buttonClassName)} onClick={() => input.current?.click()} disabled={Boolean(phase)}>
          {label}
        </Button>
      </div>
      <details className="mt-3 text-xs text-muted-foreground" open={mode !== "none" || undefined}>
        <summary className="cursor-pointer py-1 underline underline-offset-4">Large PDF? Upload options</summary>
        <fieldset className="mt-3 space-y-2" disabled={Boolean(phase)}>
          <legend className="sr-only">Before uploading</legend>
          {([
            ["none", "Use my PDF as it is"],
            ["web", "Make a smaller web copy: resizes large photos to screen resolution (about 200 dpi). Text and vector artwork stay sharp."],
            ["repack", "Repack only: keeps every image at full quality (smaller savings)."],
          ] as const).map(([value, text]) => (
            <label key={value} className="flex items-start gap-2">
              <input type="radio" name="pdf-optimise" className="mt-0.5" checked={mode === value} onChange={() => setMode(value)} />
              <span>{text}</span>
            </label>
          ))}
        </fieldset>
        <p className="mt-2 leading-relaxed">Everything happens on your device and your original file is never changed. Free publishes PDFs up to {FREE_UPLOAD_LIMIT_MB} MB, Personal up to {PERSONAL_UPLOAD_LIMIT_MB} MB{allowPreview ? `, and you can preview files up to ${PREVIEW_LIMIT_MB} MB first` : ""}.</p>
      </details>
      {candidate && <div className="mt-3 rounded-xl border border-border p-4 text-sm" role="status">
        <p>{candidate.smaller ? `Original: ${mb(candidate.original)} MB → smaller copy: ${mb(candidate.smaller)} MB.` : candidate.mode === "web" ? "This PDF has no large photos to resize, so no smaller copy was produced." : "This PDF is already compact; no smaller copy was produced."}</p>
        <p className="mt-2 text-xs text-muted-foreground">{candidate.mode === "web" ? "Large photos were resized for screens; text, vector artwork and links are unchanged. Download it to check before publishing." : "Pages are not converted to images or downsampled."} Your original file is unchanged.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {candidate.smaller && <Button size="sm" disabled={Boolean(phase) || (!allowPreview && candidate.smaller.size > limitBytes)} onClick={() => candidate.smaller && pick(candidate.smaller)}>Use smaller copy</Button>}
          {download && <a href={download} download={candidate.smaller?.name} className="text-xs underline">Download to review</a>}
          <Button size="sm" variant="line" disabled={Boolean(phase) || (!allowPreview && candidate.original.size > limitBytes)} onClick={() => pick(candidate.original)}>Use original</Button>
          {candidate.mode === "repack" && <button type="button" disabled={Boolean(phase)} className="text-xs underline" onClick={() => { if (!busy.current) { busy.current = true; void shrink(candidate.original, "web"); } }}>Try a smaller web copy</button>}
          <button type="button" disabled={Boolean(phase)} className="text-xs underline" onClick={() => setCandidate(null)}>Discard</button>
        </div>
        {(candidate.smaller ?? candidate.original).size > limitBytes && <p className="mt-2 text-xs">This copy is still above your {limitMb} MB allowance{allowPreview ? ", so you can preview it but not publish it yet" : ""}. Try a smaller export from your design app, or upgrade.</p>}
      </div>}
      {error && (
        <div role="alert" className="mt-3 rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <p>{error}</p>
          {rejected && rejected.size <= PREVIEW_LIMIT_MB * 1048576 && <button type="button" disabled={Boolean(phase)} className="mt-2 font-medium underline underline-offset-4" onClick={() => { if (!busy.current) { busy.current = true; void shrink(rejected, "web"); } }}>Make a smaller web copy of {rejected.name}</button>}
        </div>
      )}
    </div>
  );
}
