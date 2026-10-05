import { useState } from "react";
import { Modal } from "@/components/pf/Chrome";
import { Button } from "@/components/ui/button";

/** Embed code for a published portfolio, with a live preview. */
export function EmbedModal({ open, onClose, url, title }: { open: boolean; onClose: () => void; url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<"scroll" | "paged" | "book">("book");
  const [background, setBackground] = useState<"black" | "paper" | "soft">("black");
  const params = new URLSearchParams({ page: String(page), mode, background });
  const embedUrl = `${url}?${params}`;
  const safeTitle = title.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const code = `<iframe src="${embedUrl}" title="${safeTitle} portfolio" loading="lazy" allow="fullscreen" style="width:100%;aspect-ratio:16/10;border:0"></iframe><p><a href="${url.replace("/embed/", "/p/")}">View ${safeTitle} portfolio</a></p>`;
  return (
    <Modal open={open} onClose={onClose} title="Embed portfolio">
      <p className="text-muted-foreground">Paste this code into a website that accepts embeds. It always shows the published version.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs">Starting page<input type="number" min={1} value={page} onChange={(e) => setPage(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded-full border border-input bg-background px-3 py-1.5" /></label>
        <label className="text-xs">Reading mode<select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="mt-1 w-full rounded-full border border-input bg-background px-3 py-1.5"><option value="scroll">Scroll</option><option value="paged">Page by page</option><option value="book">Flipbook</option></select></label>
        <label className="text-xs">Background<select value={background} onChange={(e) => setBackground(e.target.value as typeof background)} className="mt-1 w-full rounded-full border border-input bg-background px-3 py-1.5"><option value="black">Black</option><option value="paper">Paper</option><option value="soft">Soft grey</option></select></label>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-muted">
        <iframe key={embedUrl} src={embedUrl} title={`${title} embed preview`} className="aspect-[16/10] w-full border-0" />
      </div>
      <textarea readOnly value={code} aria-label="Portfolio embed code" rows={5} className="mt-4 w-full resize-none rounded-xl border border-border bg-muted p-3 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <div className="mt-4 flex justify-end gap-2"><Button variant="line" onClick={onClose}>Close</Button><Button onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); }}>{copied ? "Copied" : "Copy embed code"}</Button></div>
    </Modal>
  );
}
