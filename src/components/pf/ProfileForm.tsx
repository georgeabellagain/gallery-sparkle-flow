import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { deleteBlob, putBlob, uid } from "@/lib/portfolia/assets";
import { CV_LIMIT_MB, patchProfile, type Portfolio } from "@/lib/portfolia/store";
import { formatBytes } from "@/lib/portfolia/assets";
import { CvIcon } from "./CvIcon";

export function ProfileForm({ p, onSaveError }: { p: Portfolio; onSaveError: (msg: string | null) => void }) {
  const pr = p.profile;
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cvErr, setCvErr] = useState<string | null>(null);
  const cvInput = useRef<HTMLInputElement>(null);
  const paid = p.plan === "personal";

  const onCv = async (f?: File) => {
    setCvErr(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return setCvErr("Upload your CV as a PDF.");
    if (f.size > CV_LIMIT_MB * 1048576) return setCvErr(`CVs can be up to ${CV_LIMIT_MB} MB.`);
    const key = uid("cv");
    try {
      await putBlob(key, f);
    } catch {
      return setCvErr("Browser storage is full, so the CV wasn’t saved.");
    }
    const old = pr.cv?.blobKey;
    set({ cv: { blobKey: key, name: f.name, bytes: f.size } });
    if (old) void deleteBlob(old);
  };
  const set = (patch: Parameters<typeof patchProfile>[0]) =>
    onSaveError(patchProfile(patch) ? null : "Couldn’t save — this browser’s storage is full or blocked. Your last change wasn’t kept.");

  const onPhoto = (f?: File) => {
    setPhotoErr(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setPhotoErr("Choose a JPG, PNG or WebP image.");
    if (f.size > 5 * 1048576) return setPhotoErr("Profile photos can be up to 5 MB.");
    setCropFile(f);
  };

  const savePhoto = async (blob: Blob) => {
    const key = uid("photo");
    try {
      await putBlob(key, blob);
    } catch {
      setPhotoErr("Browser storage is full, so the photo wasn’t saved.");
      return;
    }
    const old = pr.photoKey;
    set({ photoKey: key });
    setCropFile(null);
    if (old) void deleteBlob(old);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="f-name" className="text-xs">Name <span className="text-muted-foreground">(required)</span></Label>
        <Input id="f-name" className="mt-1.5" value={pr.name} onChange={(e) => set({ name: e.target.value })} required aria-required />
      </div>
      <div>
        <Label htmlFor="f-title" className="text-xs">Discipline or title</Label>
        <Input id="f-title" className="mt-1.5" value={pr.title} placeholder="Architect, Photographer…" onChange={(e) => set({ title: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="f-intro" className="text-xs">Short introduction</Label>
        <Textarea id="f-intro" className="mt-1.5" rows={3} maxLength={400} value={pr.intro} onChange={(e) => set({ intro: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="f-photo" className="text-xs">Profile photo</Label>
        <div className="mt-1.5 flex items-center gap-3">
          <input id="f-photo" type="file" accept="image/*" className="text-xs file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs" onChange={(e) => { onPhoto(e.target.files?.[0]); e.currentTarget.value = ""; }} />
          {pr.photoKey && (
            <Button size="xs" variant="quiet" onClick={() => { const k = pr.photoKey; if (!k) return; set({ photoKey: undefined }); void deleteBlob(k); }}>Remove</Button>
          )}
        </div>
        {photoErr && <p role="alert" className="mt-1 text-xs text-destructive">{photoErr}</p>}
      </div>
      <div>
        <p className="flex items-center gap-2 text-xs font-medium">
          <CvIcon className="size-4 text-leaf" /> CV
          {!paid && <span className="rounded-full bg-leaf-soft px-2 py-0.5 text-xxs text-leaf">Personal plan</span>}
        </p>
        {paid ? (
          <div className="mt-1.5">
            <input ref={cvInput} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { void onCv(e.target.files?.[0]); e.currentTarget.value = ""; }} />
            {pr.cv ? (
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs">
                <CvIcon className="text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{pr.cv.name} · {formatBytes(pr.cv.bytes)}</span>
                <Button size="xs" variant="line" onClick={() => cvInput.current?.click()}>Replace</Button>
                <Button size="xs" variant="quiet" onClick={() => { const k = pr.cv?.blobKey; set({ cv: undefined }); if (k) void deleteBlob(k); }}>Remove</Button>
              </div>
            ) : (
              <Button size="xs" variant="line" onClick={() => cvInput.current?.click()}><CvIcon className="size-3.5" /> Upload CV (PDF)</Button>
            )}
            <p className="mt-1 text-xxs text-muted-foreground">Visitors see a small CV link next to your contact details.</p>
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Add a downloadable CV with the Personal plan.</p>
        )}
        {cvErr && <p role="alert" className="mt-1 text-xs text-destructive">{cvErr}</p>}
      </div>
      <div>
        <Label htmlFor="f-email" className="text-xs">Contact email</Label>
        <Input id="f-email" type="email" className="mt-1.5" value={pr.email} onChange={(e) => set({ email: e.target.value })} />
      </div>
      <div>
        <p className="text-xs font-medium">Links</p>
        {pr.links.map((l, i) => (
          <div key={i} className="mt-1.5 flex gap-2">
            <Input aria-label={`Link ${i + 1} label`} placeholder="Label" className="w-28" value={l.label} onChange={(e) => set({ links: pr.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <Input aria-label={`Link ${i + 1} address`} placeholder="instagram.com/you" value={l.url} onChange={(e) => set({ links: pr.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
            <Button size="icon-sm" variant="quiet" aria-label="Remove link" onClick={() => set({ links: pr.links.filter((_, j) => j !== i) })}><X /></Button>
          </div>
        ))}
        {pr.links.length < 5 && (
          <Button size="xs" variant="line" className="mt-2" onClick={() => set({ links: [...pr.links, { label: "", url: "" }] })}><Plus /> Add link</Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Empty fields are hidden on your page.</p>
      {cropFile && <PhotoCropper file={cropFile} onCancel={() => setCropFile(null)} onSave={savePhoto} />}
    </div>
  );
}

const CROP_SIZE = 288;

function PhotoCropper({ file, onCancel, onSave }: { file: File; onCancel: () => void; onSave: (blob: Blob) => Promise<void> }) {
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

  const base = Math.max(CROP_SIZE / size.w, CROP_SIZE / size.h);
  const display = { w: size.w * base * zoom, h: size.h * base * zoom };
  const clamp = (next: { x: number; y: number }) => ({
    x: Math.max((CROP_SIZE - display.w) / 2, Math.min((display.w - CROP_SIZE) / 2, next.x)),
    y: Math.max((CROP_SIZE - display.h) / 2, Math.min((display.h - CROP_SIZE) / 2, next.y)),
  });
  const reset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  const commit = async () => {
    setSaving(true);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const output = 800;
      const canvas = document.createElement("canvas");
      canvas.width = output;
      canvas.height = output;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const drawScale = Math.max(output / img.naturalWidth, output / img.naturalHeight) * zoom;
      const dw = img.naturalWidth * drawScale;
      const dh = img.naturalHeight * drawScale;
      ctx.drawImage(img, (output - dw) / 2 + offset.x * output / CROP_SIZE, (output - dh) / 2 + offset.y * output / CROP_SIZE, dw, dh);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (blob) await onSave(blob);
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog open aria-modal="true" aria-labelledby="crop-title" className="fixed inset-0 z-50 m-auto w-[min(92vw,25rem)] rounded-3xl border border-border bg-card p-0 text-foreground shadow-lift backdrop:bg-foreground/40">
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div><h2 id="crop-title" className="font-medium">Crop profile photo</h2><p className="mt-0.5 text-xs text-muted-foreground">Drag to position, then zoom as needed.</p></div>
          <Button variant="quiet" size="icon-sm" aria-label="Cancel crop" onClick={onCancel}><X /></Button>
        </div>
        <div
          className="relative mx-auto mt-5 size-72 max-w-full touch-none cursor-grab overflow-hidden rounded-full bg-muted active:cursor-grabbing"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }; }}
          onPointerMove={(e) => { const d = drag.current; if (!d) return; setOffset(clamp({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y })); }}
          onPointerUp={() => { drag.current = null; }}
        >
          {url && <img src={url} alt="Crop preview" draggable={false} onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none" style={{ width: display.w, height: display.h, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }} />}
          <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-background/70" />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Minus className="size-4 text-muted-foreground" aria-hidden />
          <input aria-label="Photo zoom" type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => { setZoom(Number(e.target.value)); setOffset({ x: 0, y: 0 }); }} className="min-w-0 flex-1 accent-foreground" />
          <Plus className="size-4 text-muted-foreground" aria-hidden />
          <Button variant="quiet" size="icon-sm" aria-label="Reset crop" title="Reset crop" onClick={reset}><RotateCcw /></Button>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="quiet" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => void commit()} disabled={saving}>{saving ? "Saving…" : "Use photo"}</Button>
        </div>
      </div>
    </dialog>
  );
}
