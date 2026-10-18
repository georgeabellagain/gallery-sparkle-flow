import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CONSENT_EVENT, STORAGE_KEY, isConsentRequiredRegion, loadGoogleAds, saveChoice, storedChoice, updateConsent,
} from "@/lib/ads-consent";

/** Cookie choice for UK/European visitors; elsewhere it only appears from "Cookie settings". */
export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void loadGoogleAds();
    if (storedChoice() === null) void isConsentRequiredRegion().then((req) => { if (req && storedChoice() === null) setOpen(true); });
    const show = () => setOpen(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const c = storedChoice();
      if (c) { updateConsent(c); if (c === "granted") void loadGoogleAds(); setOpen(false); }
    };
    window.addEventListener(CONSENT_EVENT, show);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(CONSENT_EVENT, show); window.removeEventListener("storage", onStorage); };
  }, []);

  if (!open) return null;
  const choose = (d: "granted" | "denied") => { saveChoice(d); setOpen(false); };

  return (
    <div role="dialog" aria-labelledby="cookie-title" aria-describedby="cookie-text" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-lg rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-lg">
      <h2 id="cookie-title" className="text-sm font-semibold">Cookies for measuring ads</h2>
      <p id="cookie-text" className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        With your permission, Google sets cookies so we can see whether our Google ads lead to sign-ups and subscriptions. You can change this any time under Cookie settings. <a href="/privacy" className="underline underline-offset-2">Privacy notice</a> · <a href="https://business.safety.google/privacy/" target="_blank" rel="noreferrer" className="underline underline-offset-2">How Google uses data</a>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" className="rounded-full" onClick={() => choose("granted")}>Accept</Button>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => choose("denied")}>Reject</Button>
      </div>
    </div>
  );
}
