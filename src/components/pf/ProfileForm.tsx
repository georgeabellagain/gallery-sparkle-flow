import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { deleteBlob, putBlob, uid } from "@/lib/portfolia/assets";
import { patchPortfolio, patchProfile, type Portfolio } from "@/lib/portfolia/store";

export function ProfileForm({ p, onSaveError }: { p: Portfolio; onSaveError: (msg: string | null) => void }) {
  const pr = p.profile;
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const set = (patch: Parameters<typeof patchProfile>[0]) =>
    onSaveError(patchProfile(patch) ? null : "Couldn’t save — this browser’s storage is full or blocked. Your last change wasn’t kept.");

  const onPhoto = async (f?: File) => {
    setPhotoErr(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setPhotoErr("Choose a JPG, PNG or WebP image.");
    if (f.size > 5 * 1048576) return setPhotoErr("Profile photos can be up to 5 MB.");
    const key = uid("photo");
    try {
      await putBlob(key, f);
    } catch {
      return setPhotoErr("Browser storage is full, so the photo wasn’t saved.");
    }
    const old = pr.photoKey;
    set({ photoKey: key });
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
          <input id="f-photo" type="file" accept="image/*" className="text-xs file:mr-3 file:border file:border-border file:bg-background file:px-2.5 file:py-1 file:text-xs" onChange={(e) => void onPhoto(e.target.files?.[0])} />
          {pr.photoKey && (
            <Button size="xs" variant="quiet" onClick={() => { const k = pr.photoKey!; set({ photoKey: undefined }); void deleteBlob(k); }}>Remove</Button>
          )}
        </div>
        {photoErr && <p role="alert" className="mt-1 text-xs text-destructive">{photoErr}</p>}
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
      <label className="flex items-center gap-2 pt-2 text-sm">
        <input type="checkbox" checked={p.allowDownload} onChange={(e) => onSaveError(patchPortfolio({ allowDownload: e.target.checked }) ? null : "Couldn’t save that setting.")} />
        Let visitors download the PDF
      </label>
      <p className="text-xs text-muted-foreground">Empty fields are hidden on your page.</p>
    </div>
  );
}
