import { usePortfolioFont } from "@/lib/portfolia/fonts";
import { useEffect, useRef, useState } from "react";
import { Minus, Palette, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { putBlob, uid } from "@/lib/portfolia/assets";
import { DEFAULT_STYLE, DEFAULT_VIEWER, FONT_OPTIONS, patchPortfolioAppearance, deleteUnusedPortfolioAsset, type PageStyle, type Portfolio, type ViewerSettings } from "@/lib/portfolia/store";
import { backgroundColour, DEFAULT_FIT } from "@/lib/portfolia/background";
import { useBlob, useObjectUrl } from "@/components/pf/Chrome";
import { Segmented } from "@/components/pf/viewer-ui";
import { DEFAULT_SIMPLE_SHADOW_OPACITY, HDRI_PRESETS } from "@/lib/portfolia/lighting";
import { setPreviewLook } from "@/lib/portfolia/preview-look";

/** Shrinks a chosen picture to a size that looks sharp on a large screen but stays light to load. */
async function prepareBackground(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob) throw new Error("Could not prepare the picture");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Paid-plan page styling: heading font, colours and an optional banner. */
export function StyleForm({ p, onSaveError, sidebar = false, part = "all" }: { p: Portfolio; onSaveError: (msg: string | null) => void; sidebar?: boolean; part?: "all" | "appearance" | "experience" | "reading" | "look" | "background" }) {
  const showAppearance = part === "all" || part === "appearance";
  const showReading = part === "all" || part === "experience" || part === "reading";
  const showLook = part === "all" || part === "experience" || part === "look";
  const showBackground = part === "all" || part === "experience" || part === "background";
  const showExperience = showReading || showLook || showBackground;
  const titled = part === "all" || part === "experience";
  const style = p.style ?? DEFAULT_STYLE;
  usePortfolioFont(style.font);
  const paid = p.plan === "personal";
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const set = (patch: Partial<PageStyle>) => {
    const saved = patchPortfolioAppearance(p.code, { style: patch });
    onSaveError(saved ? null : "Couldn’t save that style change.");
    return saved;
  };
  const viewer = { ...DEFAULT_VIEWER, ...p.viewer };
  const setViewer = (patch: Partial<ViewerSettings>) => {
    const saved = patchPortfolioAppearance(p.code, { viewer: patch });
    onSaveError(saved ? null : "Couldn’t save that viewer change.");
    return saved;
  };
  const backgroundInput = useRef<HTMLInputElement>(null);
  // While one look's options are being edited, the preview shows that look. Clicking anywhere else (or leaving) puts
  // the preview back to how the portfolio opens. Nothing here is saved.
  const flipbookBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!flipbookBox.current || !flipbookBox.current.contains(e.target as Node)) setPreviewLook(null);
    };
    document.addEventListener("pointerdown", away);
    return () => {
      document.removeEventListener("pointerdown", away);
      setPreviewLook(null);
    };
  }, []);
  const [backgroundErr, setBackgroundErr] = useState<string | null>(null);
  const backgroundBlob = useBlob(viewer.backgroundKey);
  const backgroundUrl = useObjectUrl(backgroundBlob);
  /** The colour behind the PDF as it shows now, so the colour wheel starts on the right colour. */
  const wheelColour = backgroundColour(viewer, paid ? style.backdrop : undefined);
  const fit = { ...DEFAULT_FIT, ...viewer.backgroundFit };
  const setFit = (patch: Partial<typeof fit>) => setViewer({ backgroundFit: { ...fit, ...patch } });
  // The creator chooses which reading modes and which flipbook appearances visitors get (always at least one of each).
  const enabledModes = viewer.modes?.length ? viewer.modes : (["scroll", "paged", "book"] as const);
  const enabledLooks = viewer.looks?.length ? viewer.looks : ([viewer.look] as const);
  const modeLabel = { scroll: "Scroll", paged: "Page by page", book: "Flipbook" } as const;
  const toggleMode = (mode: ViewerSettings["mode"], checked: boolean) => {
    const modes = checked ? [...new Set([...enabledModes, mode])] : enabledModes.filter((item) => item !== mode);
    if (!modes.length) return;
    setViewer({ modes, mode: modes.includes(viewer.mode) ? viewer.mode : modes[0]! });
  };
  const toggleLook = (look: ViewerSettings["look"], checked: boolean) => {
    const looks = checked ? [...new Set([...enabledLooks, look])] : enabledLooks.filter((item) => item !== look);
    if (!looks.length) return;
    setViewer({ looks, look: looks.includes(viewer.look) ? viewer.look : looks[0]! });
  };
  const shadowOn = viewer.simpleShadow ?? true;
  const shadowOpacity = viewer.simpleShadowOpacity ?? DEFAULT_SIMPLE_SHADOW_OPACITY;
  const studioBrightness = viewer.studioBrightness ?? 0.5;
  const studioLighting = viewer.studioLighting ?? "4";

  const onBackgroundImage = async (f?: File) => {
    setBackgroundErr(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setBackgroundErr("Choose a JPG, PNG or WebP image.");
    if (f.size > 15 * 1048576) return setBackgroundErr("Background pictures can be up to 15 MB.");
    try {
      const blob = await prepareBackground(f);
      const key = uid("bg");
      await putBlob(key, blob);
      const old = viewer.backgroundKey;
      if (!setViewer({ backgroundKey: key, backgroundFit: DEFAULT_FIT })) { void deleteUnusedPortfolioAsset(key); return; }
      void deleteUnusedPortfolioAsset(old);
    } catch {
      setBackgroundErr("That picture couldn’t be saved. Try a JPG or PNG, or check your connection.");
    }
  };
  const removeBackgroundImage = () => {
    const old = viewer.backgroundKey;
    if (setViewer({ backgroundKey: undefined, backgroundFit: undefined })) void deleteUnusedPortfolioAsset(old);
  };

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
    if (!set({ bannerKey: key })) { void deleteUnusedPortfolioAsset(key); return; }
    setCropFile(null);
    void deleteUnusedPortfolioAsset(old);
  };

  return (
    <div className={`grid min-w-0 items-start gap-x-10 gap-y-6 ${sidebar || part !== "all" ? "" : "lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]"}`}>
      {showAppearance && <div>
      <p className="flex items-center gap-2 text-xs font-medium">
        <Palette className="size-4 text-leaf" aria-hidden /> Page style
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
          {([["text", "Details text"], ["background", "Page background"]] as const).map(([k, l]) => (
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
              {style.bannerKey && <Button size="xs" variant="quiet" onClick={() => { const k = style.bannerKey; if (set({ bannerKey: undefined })) void deleteUnusedPortfolioAsset(k); }}>Remove</Button>}
            </span>
          </div>
          {err && <p role="alert" className="text-destructive">{err}</p>}
          <Button size="xs" variant="quiet" onClick={() => set({ ...DEFAULT_STYLE, bannerKey: style.bannerKey })}>Reset colours and font</Button>
        </div>
      )}
      {cropFile && <BannerCropper file={cropFile} onCancel={() => setCropFile(null)} onSave={saveBanner} />}
      </div>}
      {showExperience && <div className={part !== "all" ? "" : `rule-t pt-4 ${sidebar ? "" : "lg:border-t-0 lg:pt-0"}`}>
        {titled && <p className="text-xs font-medium">Portfolio experience</p>}
        <div className={`${titled ? "mt-3" : ""} grid items-start gap-x-10 gap-y-4 text-xs ${sidebar || !titled ? "" : "lg:grid-cols-2"}`}>
          {showReading && <div className="space-y-3">
          <div className="space-y-2">
            <p>Reading modes visitors can use</p>
            <div className="grid gap-2">
              {(["scroll", "paged", "book"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2">
                  <input type="checkbox" checked={enabledModes.includes(mode)} disabled={enabledModes.length === 1 && enabledModes.includes(mode)} onChange={(e) => toggleMode(mode, e.target.checked)} />
                  <span>{modeLabel[mode]}</span>
                  {enabledModes.length > 1 && viewer.mode === mode && <span className="text-xxs text-muted-foreground">Opens first</span>}
                </label>
              ))}
            </div>
            {enabledModes.length > 1 && (
              <div className="space-y-1.5 pt-1">
                <p>Opens with</p>
                <Segmented label="Opens with" value={viewer.mode} options={enabledModes.map((mode) => [mode, modeLabel[mode]] as const)} onChange={(mode) => setViewer({ mode })} />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <p>My PDF contains</p>
            <Segmented label="My PDF contains" value={viewer.spreads} options={[["single", "Single pages"], ["ready", "Two-page spreads"]] as const} onChange={(spreads) => setViewer({ spreads })} />
          </div>
          <label className="flex items-center justify-between gap-3"><span>Show profile icon</span><input type="checkbox" checked={viewer.showHeader} onChange={(e) => setViewer({ showHeader: e.target.checked })} /></label>
          </div>}
          {(showLook || showBackground) && <div className="space-y-3">
          
          {showLook && (
            <div
              ref={flipbookBox}
              className="space-y-3 rounded-xl border border-border p-3"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPreviewLook(null);
              }}
            >
              <p className="font-medium">Page appearance</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2" onPointerDownCapture={() => setPreviewLook(null)}>
                {([["clean", "Simple"], ["studio", "Studio"]] as const).map(([look, label]) => (
                  <label key={look} className="flex items-center gap-2">
                    <input type="checkbox" checked={enabledLooks.includes(look)} disabled={enabledLooks.length === 1 && enabledLooks.includes(look)} onChange={(e) => toggleLook(look, e.target.checked)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {enabledLooks.length > 1 && (
                <div className="space-y-1.5" onPointerDownCapture={() => setPreviewLook(null)}>
                  <p>Opens with</p>
                  <Segmented label="Flipbook opens with" value={viewer.look} options={[["clean", "Simple"], ["studio", "Studio"]] as const} onChange={(look) => setViewer({ look })} />
                  <p className="text-xxs text-muted-foreground">Visitors get a Simple / Studio switch in the corner of the flipbook.</p>
                </div>
              )}
              {enabledLooks.includes("clean") && (
                <div className="space-y-2 border-t border-border pt-3" onPointerDownCapture={() => setPreviewLook("clean")} onFocusCapture={() => setPreviewLook("clean")}>
                  <p className="font-medium">Simple</p>
                  <div className="space-y-1.5">
                    <p>Shadow under the book</p>
                    <Segmented label="Shadow under the book" value={shadowOn ? "on" : "off"} options={[["on", "On"], ["off", "Off"]] as const} onChange={(v) => setViewer({ simpleShadow: v === "on" })} />
                  </div>
                  {shadowOn && (
                    <label className="flex items-center gap-3">
                      <span className="w-20 shrink-0">Opacity</span>
                      <input type="range" aria-label="Shadow opacity" min="0" max="100" step="1" value={Math.round(shadowOpacity * 100)} onChange={(e) => setViewer({ simpleShadowOpacity: Number(e.target.value) / 100 })} className="min-w-0 flex-1 accent-foreground" />
                      <span className="w-9 text-right tabular-nums">{Math.round(shadowOpacity * 100)}%</span>
                    </label>
                  )}
                </div>
              )}
              {enabledLooks.includes("studio") && (
                <div className="space-y-3 border-t border-border pt-3" onPointerDownCapture={() => setPreviewLook("studio")} onFocusCapture={() => setPreviewLook("studio")}>
                  <p className="font-medium">Studio</p>
                  <div className="space-y-1.5">
                    <p>Paper</p>
                    <Segmented label="Studio paper" value={viewer.finish === "textured" ? "textured" : "satin"} options={[["satin", "Satin"], ["textured", "Textured"]] as const} onChange={(finish) => setViewer({ finish })} />
                  </div>
                  <label className="flex items-center gap-3">
                    <span className="w-20 shrink-0">Brightness</span>
                    <input type="range" aria-label="Studio brightness" min="0" max="100" step="1" value={Math.round(studioBrightness * 100)} onChange={(e) => setViewer({ studioBrightness: Number(e.target.value) / 100 })} className="min-w-0 flex-1 accent-foreground" />
                    <span className="w-9 text-right tabular-nums">{Math.round(studioBrightness * 100)}%</span>
                  </label>
                  <div className="space-y-1.5">
                    <p>Lighting</p>
                    <div role="radiogroup" aria-label="Studio lighting" className="grid grid-cols-4 gap-1.5">
                      {HDRI_PRESETS.map((light, index) => (
                        <button
                          key={light.id}
                          type="button"
                          role="radio"
                          aria-checked={studioLighting === light.id}
                          aria-label={light.label}
                          title={light.label}
                          onClick={() => setViewer({ studioLighting: light.id })}
                          className={`relative h-12 overflow-hidden rounded-lg border text-sm font-medium text-white transition-opacity ${studioLighting === light.id ? "border-foreground opacity-100 ring-2 ring-foreground/30" : "border-border opacity-75 hover:opacity-100"}`}
                          style={{ background: light.preview }}
                        >
                          <span className="absolute inset-0 flex items-center justify-center bg-black/25 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">{index < 4 ? index + 1 : light.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {showBackground && <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span>Viewer background</span>
              <span className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Viewer background colour"
                  title={viewer.backgroundKey ? "Remove the picture to use a colour" : "Choose a colour"}
                  value={wheelColour}
                  disabled={!!viewer.backgroundKey}
                  onChange={(e) => setViewer({ backgroundColor: e.target.value })}
                  className="h-8 w-12 cursor-pointer rounded-full border border-border bg-transparent disabled:cursor-default disabled:opacity-40"
                />
                <input ref={backgroundInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { void onBackgroundImage(e.target.files?.[0]); e.currentTarget.value = ""; }} />
                <Button size="xs" variant="line" onClick={() => backgroundInput.current?.click()}>{viewer.backgroundKey ? "Replace picture" : "Upload picture"}</Button>
                {viewer.backgroundKey && <Button size="xs" variant="quiet" onClick={removeBackgroundImage}>Remove</Button>}
              </span>
            </div>
            {viewer.backgroundKey && (
              <div className="space-y-2 rounded-xl border border-border p-3">
                {backgroundUrl && <img src={backgroundUrl} alt="Your background picture" className="h-16 w-full rounded-md object-cover" />}
                <label className="flex items-center gap-3"><span className="w-16 shrink-0">Size</span><input type="range" aria-label="Background picture size" min="100" max="300" step="5" value={Math.round(fit.scale * 100)} onChange={(e) => setFit({ scale: Number(e.target.value) / 100 })} className="min-w-0 flex-1 accent-foreground" /><span className="w-10 text-right tabular-nums">{Math.round(fit.scale * 100)}%</span></label>
                <label className="flex items-center gap-3"><span className="w-16 shrink-0">Left / right</span><input type="range" aria-label="Move background picture left or right" min="-100" max="100" step="2" value={Math.round(fit.x * 100)} disabled={fit.scale <= 1} onChange={(e) => setFit({ x: Number(e.target.value) / 100 })} className="min-w-0 flex-1 accent-foreground disabled:opacity-40" /></label>
                <label className="flex items-center gap-3"><span className="w-16 shrink-0">Up / down</span><input type="range" aria-label="Move background picture up or down" min="-100" max="100" step="2" value={Math.round(fit.y * 100)} disabled={fit.scale <= 1} onChange={(e) => setFit({ y: Number(e.target.value) / 100 })} className="min-w-0 flex-1 accent-foreground disabled:opacity-40" /></label>
                <p className="text-xxs text-muted-foreground">Make the picture larger to move it.</p>
                <Button size="xs" variant="quiet" onClick={() => setFit(DEFAULT_FIT)}>Reset size and position</Button>
              </div>
            )}
            {backgroundErr && <p role="alert" className="text-destructive">{backgroundErr}</p>}
          </div>}
          </div>}
        </div>
      </div>}
    </div>
  );
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

