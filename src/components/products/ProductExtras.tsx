import { useRef } from "react";
import { Lock, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/portfolia/assets";
import { uploadProductExtra } from "@/lib/products/client";
import { EXTRA_KINDS, MAX_EXTRAS, extraKindFor, type ProductExtra } from "@/lib/products/model";

/**
 * Feature E: up to five extra files only customers can download (printables, an EPUB, audio…). Allowed types are
 * zip, epub, png, jpg, mp3 and txt; video is left out because of size (owner decision, default).
 */
export function ProductExtras({ id, extras, onChange, paid, available, limitMb, onUpgrade, run }: {
  id: string;
  extras: ProductExtra[];
  onChange: (next: ProductExtra[]) => void;
  paid: boolean;
  available: boolean;
  limitMb: number;
  onUpgrade: () => void;
  run: (label: string, fn: () => Promise<void>) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="space-y-3 border-t border-border pt-4">
    <h3 className="flex items-center gap-1.5 text-sm font-medium"><Paperclip className="size-4" aria-hidden /> Extras for customers</h3>
    <p className="text-xs text-muted-foreground">Up to {MAX_EXTRAS} files. Only customers can download them, even when the PDF download is off.</p>
    {!available ? <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">Extra files are available after the next update.</p>
      : !paid ? <div className="rounded-xl bg-muted p-3 text-xs">
        <p className="flex items-center gap-1.5"><Lock className="size-3.5" aria-hidden /> Extra files are part of Personal and Business.</p>
        <Button size="sm" className="mt-2" onClick={onUpgrade}>See plans</Button>
      </div>
      : <>
        {extras.length > 0 && <ul className="overflow-hidden rounded-2xl border border-border/80">
          {extras.map((x) => <li key={x.id} className="flex items-center justify-between gap-3 border-t border-border/70 px-3 py-2 first:border-t-0">
            <span className="min-w-0"><span className="block truncate">{x.name}</span><span className="text-xs text-muted-foreground">{x.kind.toUpperCase()} · {formatBytes(x.bytes)}</span></span>
            <button type="button" aria-label={`Remove ${x.name}`} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => onChange(extras.filter((e) => e.id !== x.id))}><X className="size-4" /></button>
          </li>)}
        </ul>}
        <input ref={input} hidden type="file" aria-label="Add an extra file" accept={EXTRA_KINDS.map((k) => `.${k}`).concat(".jpeg").join(",")} onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          run("Uploading extra file", async () => {
            const kind = extraKindFor(f.name);
            if (!kind) throw new Error("Use a ZIP, EPUB, PNG, JPG, MP3 or TXT file.");
            if (f.size > limitMb * 1048576) throw new Error(`Each file can be up to ${limitMb} MB on your plan.`);
            onChange([...extras, await uploadProductExtra(id, f, kind)]);
          });
        }} />
        <Button size="sm" variant="line" disabled={extras.length >= MAX_EXTRAS} onClick={() => input.current?.click()}>Add file</Button>
        {extras.length > 0 && <p className="text-xs text-muted-foreground">Save to make changes live.</p>}
      </>}
  </div>;
}
