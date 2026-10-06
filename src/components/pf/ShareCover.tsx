import { useEffect, useState } from "react";
import { backfillCover } from "@/lib/portfolia/backfill-cover";
import { useDoc, type Portfolio } from "@/lib/portfolia/store";

export function ShareCover({ p }: { p: Portfolio }) {
  const signedIn = useDoc().account.signedIn;
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = p.pdf?.blobKey;
  const missing = Boolean(key && !p.pdf?.coverKey);
  useEffect(() => {
    if (!signedIn || !missing || !key || p.status !== "published") return;
    let live = true;
    setError(null);
    void backfillCover(p.code, key).catch((e) => { if (live) setError(e instanceof Error ? e.message : "Couldn’t generate the cover."); });
    return () => { live = false; };
  }, [signedIn, missing, key, p.code, p.status, attempt]);
  if (!signedIn || p.status !== "published" || !key) return null;
  return <p className="mt-3 text-xs text-muted-foreground" role="status">
    {!missing ? "Cover ready for link previews after account sync. Social apps may keep an older cached preview." : error ? <>{error} <button type="button" className="underline" onClick={() => setAttempt((n) => n + 1)}>Retry cover</button></> : "Preparing a cover image for shared links…"}
  </p>;
}
