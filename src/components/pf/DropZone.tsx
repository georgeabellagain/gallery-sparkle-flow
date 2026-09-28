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
          "flex flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed bg-card text-center shadow-soft transition-colors duration-200",
          small ? "px-5 py-8" : "px-6 py-12",
          over ? "border-foreground bg-accent" : "border-border-strong hover:border-border-strong hover:bg-accent/40",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-leaf-soft text-leaf" aria-hidden>
          <FileUp className="size-5" />
        </span>
        <p className="mt-3 text-sm">{phase ? `${phase}…` : "Drag your PDF here"}</p>
        <p className="mt-1 text-xs text-muted-foreground">PDF only · up to {UPLOAD_LIMIT_MB} MB</p>
        <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void handle(e.target.files?.[0])} />
        <Button className="mt-5" onClick={() => input.current?.click()} disabled={Boolean(phase)}>
          {label}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
