import { useRef, useState } from "react";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteBlob, putBlob, uid } from "@/lib/portfolia/assets";
import { DEFAULT_STYLE, FONT_OPTIONS, patchPortfolio, type PageStyle, type Portfolio } from "@/lib/portfolia/store";

/** Paid-plan page styling: heading font, colours and an optional banner. */
export function StyleForm({ p, onSaveError }: { p: Portfolio; onSaveError: (msg: string | null) => void }) {
  const style = p.style ?? DEFAULT_STYLE;
  const paid = p.plan === "personal";
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<PageStyle>) =>
    onSaveError(patchPortfolio({ style: { ...style, ...patch } }) ? null : "Couldn’t save that style change.");

  const onBanner = async (f?: File) => {
    setErr(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErr("Choose a JPG, PNG or WebP image.");
    if (f.size > 8 * 1048576) return setErr("Banners can be up to 8 MB.");
    const key = uid("banner");
    try { await putBlob(key, f); } catch { return setErr("Browser storage is full, so the banner wasn’t saved."); }
    const old = style.bannerKey;
    set({ bannerKey: key });
    if (old) void deleteBlob(old);
  };

  return (
    <div className="rule-t pt-4">
      <p className="flex items-center gap-2 text-xs font-medium">
        <Palette className="size-4 text-leaf" aria-hidden /> Page style
        {!paid && <span className="rounded-full bg-leaf-soft px-2 py-0.5 text-xxs text-leaf">Personal plan</span>}
      </p>
      {!paid ? (
        <p className="mt-1 text-xs text-muted-foreground">Choose your own font, colours and banner with the Personal plan.</p>
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
            <span>Banner</span>
            <span className="flex gap-2">
              <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { void onBanner(e.target.files?.[0]); e.currentTarget.value = ""; }} />
              <Button size="xs" variant="line" onClick={() => input.current?.click()}>{style.bannerKey ? "Replace" : "Upload banner"}</Button>
              {style.bannerKey && <Button size="xs" variant="quiet" onClick={() => { const k = style.bannerKey; set({ bannerKey: undefined }); if (k) void deleteBlob(k); }}>Remove</Button>}
            </span>
          </div>
          {err && <p role="alert" className="text-destructive">{err}</p>}
          <Button size="xs" variant="quiet" onClick={() => set({ ...DEFAULT_STYLE, bannerKey: style.bannerKey })}>Reset colours and font</Button>
        </div>
      )}
    </div>
  );
}
