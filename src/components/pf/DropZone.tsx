import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptPdf } from "@/lib/portfolia/pdf";
import { UPLOAD_LIMIT_MB, type PdfFile } from "@/lib/portfolia/store";
import { cn } from "@/lib/utils";

export function DropZone({ onAccepted, label = "Upload your PDF", small }: { onAccepted: (pdf: PdfFile) => void; label?: string; small?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handle = async (file?: File) => {
    if (!file) return;
    setError(null);
    setPhase("Reading file");
    try {
      const pdf = await acceptPdf(file, setPhase);
      setPhase(null);
      onAccepted(pdf);
    } catch (e) {
      setPhase(null);
      setError(e instanceof Error ? e.message : "The upload didn’t finish.");
    }
    if (input.current) input.current.value = "";
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
          "flex flex-col items-center justify-center border border-dashed text-center transition-colors",
          small ? "px-5 py-8" : "px-6 py-14",
          over ? "border-foreground bg-muted" : "border-border-strong",
        )}
      >
        <FileUp className="size-5 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm">{phase ? `${phase}…` : "Drag your PDF here"}</p>
        <p className="mt-1 text-xs text-muted-foreground">PDF only · up to {UPLOAD_LIMIT_MB} MB</p>
        <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void handle(e.target.files?.[0])} />
        <Button className="mt-5" onClick={() => input.current?.click()} disabled={Boolean(phase)}>
          {label}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 border-l-2 border-destructive pl-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
