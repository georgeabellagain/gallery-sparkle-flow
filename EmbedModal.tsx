import { useEffect, useState } from "react";
import { Modal } from "@/components/pf/Chrome";
import { Button } from "@/components/ui/button";

/**
 * Embed code for a published portfolio. There is nothing to choose here: the embed shows the portfolio exactly as
 * it is set up in the editor (the same reading modes, look and background), always the published version.
 */
export function EmbedModal({ open, onClose, url, title }: { open: boolean; onClose: () => void; url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);
  const safeTitle = title.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const code = `<iframe src="${url}" title="${safeTitle} portfolio" loading="lazy" allow="fullscreen" style="width:100%;aspect-ratio:16/10;border:0"></iframe><p><a href="${url.replace("/embed/", "/p/")}">View ${safeTitle} portfolio</a></p>`;
  return (
    <Modal open={open} onClose={onClose} title="Embed portfolio">
      <p className="text-muted-foreground">Paste this code into a website that accepts embeds. It shows your portfolio exactly as you have set it up in the editor (the same reading modes, look and background) and always the published version.</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-muted">
        <iframe src={url} title={`${title} embed preview`} className="aspect-[16/10] w-full border-0" />
      </div>
      <textarea readOnly value={code} aria-label="Portfolio embed code" rows={5} className="mt-4 w-full resize-none rounded-xl border border-border bg-muted p-3 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="line" onClick={onClose}>Close</Button>
        <Button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              /* the code is selected in the box above, ready to copy by hand */
            }
          }}
        >
          {copied ? "Copied" : "Copy embed code"}
        </Button>
      </div>
    </Modal>
  );
}
