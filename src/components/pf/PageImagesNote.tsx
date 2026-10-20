import { ensurePageImages, usePageImageProgress } from "@/lib/portfolia/make-page-images";
import { cn } from "@/lib/utils";
import { allPortfolios, getSavedDoc, type Portfolio } from "@/lib/portfolia/store";

/** Progress of a published portfolio's quick-opening page pictures, made on this device; nothing once they exist. */
export function PageImagesNote({ p, className }: { p: Portfolio; className?: string }) {
  const progress = usePageImageProgress(p.code);
  // Pictures belong to the saved PDF, not to a replacement still being previewed in the editor.
  const key = allPortfolios(getSavedDoc()).find((saved) => saved.code === p.code)?.pdf?.blobKey;
  if (!progress || !key) return null;
  const start = () => void ensurePageImages(p.code, key).catch(() => {});
  return <p role="status" className={cn("text-xs text-muted-foreground", className)}>
    {progress.waiting
      ? <>Visitors would see the first pages sooner with quick-opening pages. <button type="button" className="underline" onClick={start}>Make them now</button> (downloads your PDF to this device once).</>
      : progress.error
        ? <>Couldn’t prepare quick-opening pages: {progress.error} <button type="button" className="underline" onClick={start}>Try again</button></>
        : <>Preparing quick-opening pages{progress.total ? ` · ${progress.done} of ${progress.total}.` : "…"} Keep this tab open.</>}
  </p>;
}
