import { ShareCover } from "./ShareCover";
import { useState } from "react";
import { Code2, Copy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmbedModal } from "@/components/pf/EmbedModal";
import { PortfolioQrCode } from "@/components/pf/PortfolioQrCode";
import { retrySync, useSyncStatus } from "@/lib/portfolia/cloud";
import { personalActive, useDoc, type Portfolio } from "@/lib/portfolia/store";

/** Share a portfolio by link, QR code or embed. The same three ways the dashboard offers. */
export function ShareActions({ p }: { p: Portfolio }) {
  const signedIn = useDoc().account.signedIn;
  const sync = useSyncStatus();
  const [dialog, setDialog] = useState<null | "qr" | "embed">(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const personalPath = p.username && personalActive(p) ? `/${p.username}` : null;
  const sharePath = personalPath ?? `/p/${p.code}`;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const published = p.status === "published";
  const copy = async () => {
    if (!published) return;
    try {
      await navigator.clipboard.writeText(origin + sharePath);
      setCopied(true);
      setMsg(null);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("Couldn’t copy automatically — select the address and copy it manually.");
    }
  };
  return (
    <section aria-label="Share portfolio">
      <h2 className="text-sm font-medium">Share portfolio</h2>
      <p className="mt-1 text-xs text-muted-foreground">Share the published version by link, embed or personal QR code.</p>
      <code className="mt-3 block overflow-x-auto rounded-xl border border-border bg-muted p-3 text-xs select-all">{origin}{sharePath}</code>
      {msg && <p role="alert" className="mt-2 text-sm text-destructive">{msg}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={!published} onClick={() => void copy()}><Copy /> {copied ? "Copied" : "Copy link"}</Button>
        <Button size="sm" variant="line" disabled={!published} onClick={() => setDialog("qr")}><QrCode /> QR code</Button>
        {published && <Button size="sm" variant="line" onClick={() => setDialog("embed")}><Code2 /> Embed</Button>}
      </div>
      {!published && <p className="mt-3 text-xs text-muted-foreground">Publish this portfolio before sharing it with visitors.</p>}
      {signedIn && published && <p className="mt-3 text-xs text-muted-foreground" role={sync.status === "error" ? "alert" : "status"}>
        {sync.status === "error" ? <>{sync.message || "Couldn’t save the latest changes to your account."} Visitors may still see the previous published version. <button type="button" className="underline underline-offset-4" onClick={retrySync}>Retry saving</button></> : sync.status === "saving" ? "Saving your latest changes. Wait for account sync before sharing the updated version." : sync.status === "saved" ? "Latest changes saved to your account." : "Account sync has not confirmed your latest changes yet."}
      </p>}
      <ShareCover p={p} />
      <PortfolioQrCode open={dialog === "qr"} onClose={() => setDialog(null)} url={origin + sharePath} name={p.profile.name} />
      <EmbedModal open={dialog === "embed"} onClose={() => setDialog(null)} url={`${origin}/embed/${p.code}`} title={p.profile.name || "Portfolio"} />
    </section>
  );
}

