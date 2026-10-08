import { useEffect, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptPdf } from "@/lib/portfolia/pdf";
import { FREE_UPLOAD_LIMIT_MB, type PdfFile } from "@/lib/portfolia/store";
import { cn } from "@/lib/utils";

export function DropZone({ onAccepted, label = "Upload your PDF", small, limitMb = FREE_UPLOAD_LIMIT_MB }: { onAccepted: (pdf: PdfFile) => void; label?: string; small?: boolean; limitMb?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [optimise, setOptimise] = useState(false);
  const [candidate, setCandidate] = useState<{ original: File; smaller: File | null } | null>(null);
  const [download, setDownload] = useState<string>();
  const busy = useRef(false);
  useEffect(() => {
    if (!candidate?.smaller) { setDownload(undefined); return; }
    const url = URL.createObjectURL(candidate.smaller);
    setDownload(url);
    return () => URL.revokeObjectURL(url);
  }, [candidate]);

  const accept = async (file: File) => {
    setPhase("Checking PDF");
    try { const pdf = await acceptPdf(file, setPhase, limitMb); setCandidate(null); onAccepted(pdf); }
    catch (e) { setError(e instanceof Error ? e.message : "The upload didn’t finish."); }
    finally { setPhase(null); busy.current = false; }
  };
  const handle = async (file?: File) => {
    if (!file || busy.current) return;
    busy.current = true;
    setError(null);
    setCandidate(null);
    try {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Please choose a PDF file.");
      if (optimise) {
        setPhase("Trying a smaller copy on your device");
        const { optimiseFile } = await import("@/lib/portfolia/optimise-file");
        setCandidate({ original: file, smaller: await optimiseFile(file) });
      } else await accept(file);
    } catch (e) { setError(e instanceof Error ? e.message : "The upload didn’t finish."); }
    finally { busy.current = false; setPhase(null); if (input.current) input.current.value = ""; }
  };

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
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-leaf-soft text-leaf" aria-hidden>
          <FileUp className="size-5" />
        </span>
        <p role="status" aria-live="polite" className="mt-3 text-sm">{phase ? `${phase}…` : "Drag your PDF here"}</p>
        <p className="mt-1 text-xs text-muted-foreground">PDF only · up to {limitMb} MB on your current plan</p>
        <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void handle(e.target.files?.[0])} />
        <Button className="mt-5" onClick={() => input.current?.click()} disabled={Boolean(phase)}>
          {label}
        </Button>
      </div>
      <details className="mt-3 text-xs text-muted-foreground" open={optimise || undefined}>
        <summary className="cursor-pointer py-1 underline underline-offset-4">Large PDF? Upload options</summary>
      <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={optimise} disabled={Boolean(phase)} onChange={(e) => setOptimise(e.target.checked)} />
        Try PDF compression on my device before upload
      </label>
        <p className="mt-2 leading-relaxed">Keep your original and try a smaller copy. Image-heavy PDFs may need a compressed web export from your design app. Personal accepts files up to 50 MB.</p>
      </details>
      {candidate && <div className="mt-3 rounded-xl border border-border p-4 text-sm" role="status">
        <p>{candidate.smaller ? `Original: ${(candidate.original.size / 1048576).toFixed(2)} MB → smaller copy: ${(candidate.smaller.size / 1048576).toFixed(2)} MB.` : "This PDF is already compact; no smaller copy was produced."}</p>
        <p className="mt-2 text-xs text-muted-foreground">Your original file is unchanged. Pages are not converted to images or downsampled. Review the smaller copy before using it; image-heavy PDFs may need a smaller export from your design app.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {candidate.smaller && <Button size="sm" disabled={Boolean(phase) || candidate.smaller.size > limitMb * 1048576} onClick={() => { if (!busy.current && candidate.smaller) { busy.current = true; void accept(candidate.smaller); } }}>Use smaller copy</Button>}
          {download && <a href={download} download={candidate.smaller?.name} className="text-xs underline">Download to review</a>}
          <Button size="sm" variant="line" disabled={Boolean(phase) || candidate.original.size > limitMb * 1048576} onClick={() => { if (!busy.current) { busy.current = true; void accept(candidate.original); } }}>Use original</Button>
          <button type="button" disabled={Boolean(phase)} className="text-xs underline" onClick={() => setCandidate(null)}>Discard</button>
        </div>
        {(candidate.smaller ?? candidate.original).size > limitMb * 1048576 && <p className="mt-2 text-xs">This copy still exceeds your {limitMb} MB limit. Try a smaller web export.</p>}
      </div>}
      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

