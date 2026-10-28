import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CONSENT_EVENT, STORAGE_KEY, isConsentRequiredRegion, loadGoogleAds, saveChoice, storedChoice, updateConsent,
} from "@/lib/ads-consent";

/** Cookie choice for UK/European visitors; elsewhere it only appears from "Cookie settings". */
export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Embedded portfolios live inside other people's sites: no banner and no ads tag there.
    if (window.location.pathname.startsWith("/embed/")) return;
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
    <div role="dialog" aria-labelledby="cookie-title" aria-describedby="cookie-text" className="fixed inset-x-2 bottom-2 z-[100] mx-auto max-w-lg rounded-2xl border border-border bg-card px-3.5 py-3 text-card-foreground shadow-lg sm:inset-x-3 sm:bottom-3 sm:rounded-3xl sm:p-5">
      <div className="flex items-start gap-3 sm:block">
        <div className="min-w-0 flex-1">
          <h2 id="cookie-title" className="text-xs font-semibold sm:text-sm">Cookies for measuring ads</h2>
          <p id="cookie-text" className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:mt-1.5 sm:text-xs sm:leading-relaxed">
            <span className="sm:hidden">May Google set cookies so we can see if our ads lead to sign-ups? Change this any time in Cookie settings. </span>
            <span className="hidden sm:inline">With your permission, Google sets cookies so we can see whether our Google ads lead to sign-ups and subscriptions. You can change this any time under Cookie settings. </span>
            <a href="/privacy" className="underline underline-offset-2">Privacy</a> · <a href="https://business.safety.google/privacy/" target="_blank" rel="noreferrer" className="underline underline-offset-2">How Google uses data</a>
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:mt-4 sm:flex-row sm:gap-2">
          <Button size="sm" className="h-8 min-w-[4.75rem] rounded-full px-3 sm:h-9" onClick={() => choose("granted")}>Accept</Button>
          <Button size="sm" variant="outline" className="h-8 min-w-[4.75rem] rounded-full px-3 sm:h-9" onClick={() => choose("denied")}>Reject</Button>
        </div>
      </div>
    </div>
  );
}
