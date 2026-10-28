import { useEffect, useRef, useState } from "react";
import { putBlob, uid } from "@/lib/portfolia/assets";
import { deleteUnusedPortfolioAsset } from "@/lib/portfolia/store";
import type { PageLink } from "@/lib/portfolia/page-extras";
import { linkAppearance } from "@/lib/portfolia/link-appearance";
import { LinkLogo } from "./PageLinks";
import { Button } from "@/components/ui/button";

export function LinkIconFields({ link, save }: { link: PageLink; save: (next: PageLink) => boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const latest = useRef(link); latest.current = link;
  const look = linkAppearance(link);
  const set = (patch: Partial<PageLink>) => save({ ...link, ...patch });
  const upload = async (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1048576) {
      setProblem("Choose a JPEG, PNG or WebP up to 8 MB."); return;
    }
    setBusy(true); setProblem("");
    let key: string | undefined;
    try {
      const bitmap = await createImageBitmap(file);
      let blob: Blob;
      try {
        const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error()), "image/png"));
      } finally { bitmap.close(); }
      key = uid("linklogo"); await putBlob(key, blob);
      if (!alive.current || !save({ ...latest.current, iconKey: key })) {
        await deleteUnusedPortfolioAsset(key); return;
      }
      if (latest.current.iconKey) void deleteUnusedPortfolioAsset(latest.current.iconKey);
    } catch {
      if (key) void deleteUnusedPortfolioAsset(key);
      if (alive.current) setProblem("The logo couldn't be added. Please try another image.");
    } finally {
      if (alive.current) setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return <div className="space-y-3">
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0"><LinkLogo link={link} /></span>
      <div className="space-y-1">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => void upload(e.target.files?.[0])} />
        <Button size="xs" variant="line" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Adding…" : "Upload custom logo"}</Button>
        {link.iconKey && <button type="button" disabled={busy} className="block text-xs underline" onClick={() => { const old = link.iconKey; if (set({ iconKey: undefined }) && old) void deleteUnusedPortfolioAsset(old); }}>Use website icon</button>}
      </div>
    </div>
    {problem && <p role="alert" className="text-xs text-destructive">{problem}</p>}
    <label className="block text-xs">Logo shape
      <select aria-label="Logo shape" className="mt-1 w-full rounded-lg border border-border bg-background p-2" value={link.iconShape ?? "rounded"} onChange={e => set({iconShape:e.target.value as PageLink["iconShape"]})}>
        <option value="rounded">Rounded square</option><option value="square">Square</option><option value="circle">Circle</option>
      </select>
    </label>
    <label className="block text-xs">Image fit
      <select aria-label="Logo image fit" className="mt-1 w-full rounded-lg border border-border bg-background p-2" value={look.fit} onChange={e => set({iconFit:e.target.value as PageLink["iconFit"]})}>
        <option value="contain">Show entire image</option><option value="cover">Fill and crop</option>
      </select>
    </label>
    <label className="block text-xs">Logo padding · {Math.round(look.padding * 100)}%
      <input aria-label="Logo padding" type="range" min="0" max="40" step="1" value={Math.round(look.padding * 100)} className="block w-full" onChange={e => set({iconPadding:Number(e.target.value)})} />
    </label>
    <label className="flex items-center justify-between text-xs">Logo background
      <input aria-label="Logo background" type="color" value={look.background} onChange={e => set({iconBackground:e.target.value})} />
    </label>
    <button type="button" className="text-xs underline" onClick={() => set({iconShape:undefined,iconFit:undefined,iconPadding:undefined,iconBackground:undefined})}>Reset logo appearance</button>
    <p className="text-xs text-muted-foreground">Resize or position the logo on the page using the selection controls. Custom logos are saved with your portfolio.</p>
  </div>;
}
