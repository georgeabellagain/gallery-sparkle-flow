import { useEffect, useRef, useState } from "react";
import { Minus, Palette, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteBlob, putBlob, uid } from "@/lib/portfolia/assets";
import { DEFAULT_STYLE, DEFAULT_VIEWER, FONT_OPTIONS, patchPortfolio, type PageStyle, type Portfolio, type ViewerSettings } from "@/lib/portfolia/store";

/** Paid-plan page styling: heading font, colours and an optional banner. */
export function StyleForm({ p, onSaveError }: { p: Portfolio; onSaveError: (msg: string | null) => void }) {
  const style = p.style ?? DEFAULT_STYLE;
  const paid = p.plan === "personal";
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const set = (patch: Partial<PageStyle>) =>
    onSaveError(patchPortfolio({ style: { ...style, ...patch } }) ? null : "Couldn’t save that style change.");
  const viewer = { ...DEFAULT_VIEWER, ...p.viewer };
  const setViewer = (patch: Partial<ViewerSettings>) =>
    onSaveError(patchPortfolio({ viewer: { ...viewer, ...patch } }) ? null : "Couldn’t save that viewer change.");

  const onBanner = (f?: File) => {
    setErr(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErr("Choose a JPG, PNG or WebP image.");
    if (f.size > 8 * 1048576) return setErr("Banners can be up to 8 MB.");
    setCropFile(f);
  };

  const saveBanner = async (blob: Blob) => {
    const key = uid("banner");
    try { await putBlob(key, blob); } catch { return setErr("Browser storage is full, so the banner wasn’t saved."); }
    const old = style.bannerKey;
    set({ bannerKey: key });
    setCropFile(null);
    if (old) void deleteBlob(old);
  };

  return (
    <div className="rule-t pt-4">
      <p className="flex items-center gap-2 text-xs font-medium">
        <Palette className="size-4 text-leaf" aria-hidden /> Portfolio appearance
        {!paid && <span className="rounded-full bg-leaf-soft px-2 py-0.5 text-xxs text-leaf">Personal plan</span>}
      </p>
      {!paid ? (
        <p className="mt-1 text-xs text-muted-foreground">Personal adds custom colours, typography and a cover image.</p>
      ) : (
        <div className="mt-3 space-y-3 text-xs">
          <label className="flex items-center justify-between gap-3">
            <span>Name font</span>
            <select value={style.font} onChange={(e) => set({ font: e.target.value })} className="rounded-full border border-input bg-background px-3 py-1.5" style={{ fontFamily: style.font }}>
              {FONT_OPTIONS.map((f) => <option key={f.label} value={f.css}>{f.label}</option>)}
            </select>
          </label>
          {([["text", "Details text"], ["background", "Page background"], ["backdrop", "Behind the PDF"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center justify-between gap-3">
              <span>{l}</span>
              <input type="color" value={style[k]} onChange={(e) => set({ [k]: e.target.value })} className="h-8 w-12 cursor-pointer rounded-full border border-border bg-transparent" />
            </label>
          ))}
          <div className="flex items-center justify-between gap-3">
            <span><span className="block">Cover image</span><span className="block text-xxs text-muted-foreground">Shown above your profile</span></span>
            <span className="flex gap-2">
               <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { onBanner(e.target.files?.[0]); e.currentTarget.value = ""; }} />
               <Button size="xs" variant="line" onClick={() => input.current?.click()}>{style.bannerKey ? "Replace" : "Upload image"}</Button>
              {style.bannerKey && <Button size="xs" variant="quiet" onClick={() => { const k = style.bannerKey; set({ bannerKey: undefined }); if (k) void deleteBlob(k); }}>Remove</Button>}
            </span>
          </div>
          {err && <p role="alert" className="text-destructive">{err}</p>}
          <Button size="xs" variant="quiet" onClick={() => set({ ...DEFAULT_STYLE, bannerKey: style.bannerKey })}>Reset colours and font</Button>
        </div>
      )}
      {cropFile && <BannerCropper file={cropFile} onCancel={() => setCropFile(null)} onSave={saveBanner} />}
      <div className="mt-5 rule-t pt-4">
        <p className="text-xs font-medium">Portfolio experience</p>
        <div className="mt-3 space-y-3 text-xs">
          <SettingSelect label="Default reading mode" value={viewer.mode} onChange={(value) => setViewer({ mode: value as ViewerSettings["mode"] })} options={[["scroll", "Scroll"], ["paged", "Page by page"], ["book", "Flipbook"]]} />
          <SettingSelect label="My PDF contains" value={viewer.spreads} onChange={(value) => setViewer({ spreads: value as ViewerSettings["spreads"] })} options={[["single", "Single pages"], ["ready", "Ready-made spreads"]]} />
          <SettingSelect label="Viewer background" value={viewer.background === "oak" || viewer.background === "walnut" ? "midnight" : viewer.background} onChange={(value) => setViewer({ background: value as ViewerSettings["background"], look: "clean" })} options={[["midnight", "Midnight blue"], ["black", "Black"], ["paper", "White"], ["soft", "Soft grey"]]} />
          <label className="flex items-center justify-between gap-3"><span>Show profile header</span><input type="checkbox" checked={viewer.showHeader} onChange={(e) => setViewer({ showHeader: e.target.checked })} /></label>
        </div>
      </div>
    </div>
  );
}

function SettingSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[] }) {
  return <label className="flex items-center justify-between gap-3"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-44 rounded-full border border-input bg-background px-3 py-1.5">{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>;
}

const CROP_WIDTH = 320;
const CROP_HEIGHT = 112;

function BannerCropper({ file, onCancel, onSave }: { file: File; onCancel: () => void; onSave: (blob: Blob) => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const base = Math.max(CROP_WIDTH / size.w, CROP_HEIGHT / size.h);
  const display = { w: size.w * base * zoom, h: size.h * base * zoom };
  const clamp = (next: { x: number; y: number }, nextZoom = zoom) => {
    const nextDisplay = { w: size.w * base * nextZoom, h: size.h * base * nextZoom };
    return {
      x: Math.max((CROP_WIDTH - nextDisplay.w) / 2, Math.min((nextDisplay.w - CROP_WIDTH) / 2, next.x)),
      y: Math.max((CROP_HEIGHT - nextDisplay.h) / 2, Math.min((nextDisplay.h - CROP_HEIGHT) / 2, next.y)),
    };
  };
  const reset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  const commit = async () => {
    setSaving(true);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const outputWidth = 1600;
      const outputHeight = 560;
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const drawScale = Math.max(outputWidth / img.naturalWidth, outputHeight / img.naturalHeight) * zoom;
      const dw = img.naturalWidth * drawScale;
      const dh = img.naturalHeight * drawScale;
      ctx.drawImage(img, (outputWidth - dw) / 2 + offset.x * outputWidth / CROP_WIDTH, (outputHeight - dh) / 2 + offset.y * outputHeight / CROP_HEIGHT, dw, dh);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (blob) await onSave(blob);
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog open aria-modal="true" aria-labelledby="banner-crop-title" className="fixed inset-0 z-50 m-auto w-[min(94vw,38rem)] rounded-3xl border border-border bg-card p-0 text-foreground shadow-lift backdrop:bg-foreground/40">
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div><h2 id="banner-crop-title" className="font-medium">Crop banner</h2><p className="mt-0.5 text-xs text-muted-foreground">Drag to position, then zoom as needed.</p></div>
          <Button variant="quiet" size="icon-sm" aria-label="Cancel banner crop" onClick={onCancel}><X /></Button>
        </div>
        <div
          className="relative mx-auto mt-5 aspect-[20/7] w-full max-w-[32rem] touch-none cursor-grab overflow-hidden rounded-2xl bg-muted active:cursor-grabbing"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }; }}
          onPointerMove={(e) => { const d = drag.current; if (!d) return; setOffset(clamp({ x: d.ox + (e.clientX - d.x) * CROP_WIDTH / e.currentTarget.clientWidth, y: d.oy + (e.clientY - d.y) * CROP_HEIGHT / e.currentTarget.clientHeight })); }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
        >
          {url && <img src={url} alt="Banner crop preview" draggable={false} onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none" style={{ width: `${display.w / CROP_WIDTH * 100}%`, height: `${display.h / CROP_HEIGHT * 100}%`, transform: `translate(calc(-50% + ${offset.x / CROP_WIDTH * 100}%), calc(-50% + ${offset.y / CROP_HEIGHT * 100}%))` }} />}
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-background/70" />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Minus className="size-4 text-muted-foreground" aria-hidden />
          <input aria-label="Banner zoom" type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => { const next = Number(e.target.value); setZoom(next); setOffset((current) => clamp(current, next)); }} className="min-w-0 flex-1 accent-foreground" />
          <Plus className="size-4 text-muted-foreground" aria-hidden />
          <Button variant="quiet" size="icon-sm" aria-label="Reset banner crop" title="Reset banner crop" onClick={reset}><RotateCcw /></Button>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="quiet" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => void commit()} disabled={saving}>{saving ? "Saving…" : "Use banner"}</Button>
        </div>
      </div>
    </dialog>
  );
}
