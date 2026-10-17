import { AccessSettings } from "./AccessSettings";
import { AddressSettings } from "./AddressSettings";
import { UpgradeModal } from "./UpgradeModal";
import { ShareCover } from "./ShareCover";
import { VideoExportPanel } from "./VideoExportPanel";
import { useState } from "react";
import { Code2, Copy, QrCode, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmbedModal } from "@/components/pf/EmbedModal";
import { PortfolioQrCode } from "@/components/pf/PortfolioQrCode";
import { retrySync, useSyncStatus } from "@/lib/portfolia/cloud";
import { allPortfolios, getSavedDoc, personalActive, useDoc, type Portfolio } from "@/lib/portfolia/store";

/** Share a portfolio by link, QR code or embed. The same three ways the dashboard offers. */
export function ShareActions({ p }: { p: Portfolio }) {
  const signedIn = useDoc().account.signedIn;
  const sync = useSyncStatus();
  const [dialog, setDialog] = useState<null | "qr" | "embed" | "video">(null);
  const [upgrade, setUpgrade] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const personal = p.plan === "personal";
  // Prefer the personalised address once it is saved (not just previewed); /p/<code> always keeps working.
  const saved = allPortfolios(getSavedDoc()).find(x => x.code === p.code);
  const sharePath = saved && personalActive(saved) ? `/${saved.username}` : `/p/${p.code}`;
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
      
      <p className="mt-1 text-xs text-muted-foreground">Share the published version by link, embed or personal QR code.</p>
      <code className="mt-3 block break-all whitespace-normal rounded-xl border border-border bg-muted p-3 text-xs select-all">{origin}{sharePath}</code>
      {msg && <p role="alert" className="mt-2 text-sm text-destructive">{msg}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={!published} onClick={() => void copy()}><Copy /> {copied ? "Copied" : "Copy link"}</Button>
        <Button size="sm" variant="line" disabled={!published} onClick={() => setDialog("qr")}><QrCode /> QR code</Button>
        {published && <Button size="sm" variant="line" onClick={() => setDialog("embed")}><Code2 /> Embed</Button>}
      </div>
      {p.pdf && <div className="mt-4 border-t border-border pt-4">
        <Button size="sm" variant="line" disabled={!signedIn} onClick={() => personal ? setDialog("video") : setUpgrade("HD flipbook video export")}><Video /> Export HD video{!personal && <span className="rounded-full bg-leaf-soft px-1.5 py-0.5 text-xxs text-leaf">Personal</span>}</Button>
        <p className="mt-2 text-xs text-muted-foreground">A 1080p video of your flipbook turning through every page, ready for Instagram, LinkedIn or a showreel.</p>
      </div>}
      {dialog === "video" && <VideoExportPanel p={p} onClose={() => setDialog(null)} />}
      <span role="status" className="sr-only">{copied ? "Portfolio link copied" : ""}</span>
      {!published && <p className="mt-3 text-xs text-muted-foreground">Publish this portfolio before sharing it with visitors.</p>}
      {signedIn && published && <p className="mt-3 text-xs text-muted-foreground" role={sync.status === "error" ? "alert" : "status"}>
        {sync.status === "error" ? <>{sync.message || "Couldn’t save the latest changes to your account."} Visitors may still see the previous published version. <button type="button" className="underline underline-offset-4" onClick={retrySync}>Retry saving</button></> : sync.status === "saving" ? "Saving your latest changes. Wait for account sync before sharing the updated version." : sync.status === "saved" ? "Latest changes saved to your account." : "Account sync has not confirmed your latest changes yet."}
      </p>}
      <details className="mt-5 border-t border-border pt-4">
        <summary className="cursor-pointer text-sm font-medium">Link preview image</summary>
        <ShareCover p={p} />
      </details>
      {signedIn && <details className="mt-4 border-t border-border pt-4"><summary className="cursor-pointer text-sm font-medium">Personalised address {!personal && <span className="ml-1 rounded-full bg-leaf-soft px-1.5 py-0.5 text-xxs font-normal text-leaf">Personal</span>}</summary><AddressSettings p={p} onUpgrade={() => setUpgrade("Your own portfolia.site address")} /></details>}
      {signedIn && <details className="mt-4 border-t border-border pt-4"><summary className="cursor-pointer text-sm font-medium">Password and expiry {!personal && <span className="ml-1 rounded-full bg-leaf-soft px-1.5 py-0.5 text-xxs font-normal text-leaf">Personal</span>}</summary><AccessSettings code={p.code} />{!personal && <Button size="sm" className="mt-3" onClick={() => setUpgrade("Password protection")}>Unlock with Personal</Button>}</details>}
      <UpgradeModal open={upgrade !== null} reason={upgrade ?? undefined} onClose={() => setUpgrade(null)} />
      <PortfolioQrCode open={dialog === "qr"} onClose={() => setDialog(null)} url={origin + sharePath} name={p.profile.name} />
      <EmbedModal open={dialog === "embed"} onClose={() => setDialog(null)} url={`${origin}/embed/${p.code}`} title={p.profile.name || "Portfolio"} />
    </section>
  );
}
