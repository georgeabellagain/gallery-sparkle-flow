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
      <details className="mt-4 rounded-xl border border-border p-4 text-sm">
        <summary className="cursor-pointer font-medium">How to add this to your website</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>Copy the complete code below.</li>
          <li>In your website editor, add an HTML or embed-code block and paste the code there, rather than into a normal text block.</li>
          <li>Publish the page, then check it on a phone and a desktop. Some editors only display embeds on the published page.</li>
        </ol>
        <p className="mt-3 text-muted-foreground">Your website provider may restrict iframe embeds by plan. If it removes the code or does not support it, use your public portfolio link instead. Replacing the PDF updates the embed; unpublishing makes it unavailable.</p>
      </details>
      <nav aria-label="Platform embed guides" className="mt-4 flex flex-wrap gap-3 text-xs text-leaf">{["squarespace", "wix", "notion"].map(p => <a key={p} href={`/embed-flipbook-in-${p}`} target="_blank" rel="noopener noreferrer" className="underline">{p === "wix" ? "Wix" : p === "notion" ? "Notion" : "Squarespace"} guide</a>)}</nav>
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
