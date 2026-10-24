import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { putBlob, uid } from "@/lib/portfolia/assets";
import { normaliseUrl } from "@/lib/portfolia/page-extras";
import { DEFAULT_VIEWER, deleteUnusedPortfolioAsset, isPaid, patchPortfolioAppearance, useDoc, type Portfolio, type ViewerSettings } from "@/lib/portfolia/store";
import { useBlob, useObjectUrl } from "./Chrome";
import { PanelSection, SliderRow } from "./panel-ui";

export const BRAND_HEIGHT = { min: 20, max: 72, default: 36 };

/** Your logo as readers see it in the viewer's top corner, linking to your site when you give one. */
export function BrandMark({ logoKey, height = BRAND_HEIGHT.default, link, tone }: { logoKey: string; height?: number; link?: string; tone: "light" | "dark" }) {
  const url = useObjectUrl(useBlob(logoKey));
  if (!url) return null;
  const img = <img src={url} alt="Logo" draggable={false} className="block w-auto max-w-[40vw] object-contain" style={{ height: Math.min(BRAND_HEIGHT.max, Math.max(BRAND_HEIGHT.min, height)) }} />;
  const frame = `flex items-center rounded-2xl px-2.5 py-1.5 shadow-sm backdrop-blur-md ${tone === "dark" ? "bg-slate-950/40" : "bg-white/70"}`;
  return link
    ? <a href={link} target="_blank" rel="noopener noreferrer" aria-label="Visit our website" className={`${frame} transition-opacity hover:opacity-90`}>{img}</a>
    : <span className={frame}>{img}</span>;
}

/**
 * Branding (Personal): your own logo in the corner of the viewer, sized to taste and linking to your site, as
 * business flipbook makers offer. On Personal the Portfolia credit is already gone from published portfolios.
 */
export function BrandingSettings({ p, onSaveError }: { p: Portfolio; onSaveError: (message: string | null) => void }) {
  const doc = useDoc();
  const viewer = { ...DEFAULT_VIEWER, ...p.viewer };
  const preview = useObjectUrl(useBlob(viewer.brandLogoKey));
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState(viewer.brandLink ?? "");
  useEffect(() => setLink(viewer.brandLink ?? ""), [viewer.brandLink]);
  const save = (patch: Partial<ViewerSettings>) => {
    const ok = patchPortfolioAppearance(p.code, { viewer: patch });
    onSaveError(ok ? null : "Couldn't save your branding.");
    return ok;
  };
  const upload = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 10 * 1048576) return setError("Choose a PNG, JPG or WebP logo up to 10 MB.");
    setError(""); setBusy(true);
    let url = "";
    try {
      // Kept sharp on high-density screens (up to 600 px tall), with its transparency.
      url = URL.createObjectURL(file);
      const img = new Image(); img.src = url; await img.decode();
      const scale = Math.min(1, 600 / img.naturalHeight, 1800 / img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
      if (!blob) throw new Error();
      const key = uid("brand");
      await putBlob(key, blob);
      const old = viewer.brandLogoKey;
      if (!save({ brandLogoKey: key })) throw new Error();
      if (old) void deleteUnusedPortfolioAsset(old);
    } catch {
      setError("Your logo couldn't be added. Please try again.");
    } finally {
      if (url) URL.revokeObjectURL(url);
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const commitLink = () => {
    if (!link.trim()) { setError(""); save({ brandLink: undefined }); return; }
    const next = normaliseUrl(link);
    if (!next) return setError("That website address doesn't look right.");
    setError(""); setLink(next); save({ brandLink: next });
  };
  return (
    <div className="text-sm">
      <PanelSection title="Your logo" hint="Shows in the top corner of your viewer, on every page, in every reading style."
        aside={!isPaid(doc) ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">Personal</span> : undefined}>
        <div className="flex items-center gap-3">
          <span className="flex h-16 min-w-16 max-w-[60%] items-center justify-center rounded-xl bg-[repeating-conic-gradient(#f1f1f1_0_25%,#fff_0_50%)] bg-[length:12px_12px] p-2 ring-1 ring-border">
            {preview ? <img src={preview} alt="Your logo" className="max-h-12 w-auto object-contain" /> : <ImagePlus className="size-5 text-muted-foreground" />}
          </span>
          <div className="flex flex-col gap-1.5">
            <Button size="xs" variant="line" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Adding…" : viewer.brandLogoKey ? "Change logo" : "Upload logo"}</Button>
            {viewer.brandLogoKey && <Button size="xs" variant="quiet" onClick={() => { const old = viewer.brandLogoKey; if (save({ brandLogoKey: undefined }) && old) void deleteUnusedPortfolioAsset(old); }}><Trash2 className="size-3.5" />Remove</Button>}
          </div>
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
        <p className="text-[11px] text-muted-foreground">A PNG with a transparent background looks best on any background.</p>
        {viewer.brandLogoKey && (
          <SliderRow label="Size" value={`${viewer.brandLogoHeight ?? BRAND_HEIGHT.default} px`}>
            <input type="range" className="w-full" min={BRAND_HEIGHT.min} max={BRAND_HEIGHT.max} step={2} value={viewer.brandLogoHeight ?? BRAND_HEIGHT.default} onChange={(e) => save({ brandLogoHeight: Number(e.target.value) })} />
          </SliderRow>
        )}
        <label className="block text-xs">Goes to (optional)
          <input className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm" inputMode="url" placeholder="yourstudio.com" value={link} onChange={(e) => setLink(e.target.value)} onBlur={commitLink} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitLink(); } }} />
        </label>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </PanelSection>
      <PanelSection title="Portfolia credit" hint={isPaid(doc) ? "Your published portfolios don't show “Hosted on Portfolia”." : "Free portfolios show a small “Hosted on Portfolia” credit. Personal removes it and turns on your logo for readers."}>
        <span />
      </PanelSection>
    </div>
  );
}
