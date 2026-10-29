import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ga4Choice, readableGa4Id, rememberGa4Choice, startGa4 } from "@/lib/portfolia/business";
import type { Portfolio } from "@/lib/portfolia/store";
import { useBlob, useObjectUrl } from "./Chrome";

/**
 * Business extras for readers of a published portfolio: the owner's Google Analytics 4, started only after the reader
 * agrees, and the owner's logo as the browser tab icon. `page` forwards page turns to Google Analytics once it runs.
 */
export function useBusinessReader(p: Portfolio, active: boolean) {
  const gaId = active && p.ownerBusiness ? readableGa4Id(p.ga4Id) : undefined;
  const [choice, setChoice] = useState<"yes" | "no" | null>("no");
  const ga = useRef<{ page: (n: number) => void } | null>(null);
  // Read after hydration, so the server render and the first client render agree.
  useEffect(() => setChoice(gaId ? ga4Choice(gaId) : "no"), [gaId]);
  useEffect(() => {
    if (gaId && choice === "yes") ga.current = startGa4(gaId);
  }, [gaId, choice]);
  useBrandFavicon(p.ownerBusiness ? p.viewer?.brandLogoKey : undefined);
  const decide = (c: "yes" | "no") => { if (gaId) rememberGa4Choice(gaId, c); setChoice(c); };
  return {
    page: (n: number) => ga.current?.page(n),
    consent: gaId && choice === null ? <AnalyticsConsent name={p.name || p.profile.name} onChoose={decide} /> : null,
  };
}

function useBrandFavicon(logoKey: string | undefined) {
  const url = useObjectUrl(useBlob(logoKey));
  useEffect(() => {
    if (!url) return;
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
    const before = links.map((l) => l.href);
    const own = links.length ? null : document.head.appendChild(Object.assign(document.createElement("link"), { rel: "icon" }));
    for (const l of own ? [own] : links) l.href = url;
    return () => { own?.remove(); links.forEach((l, i) => { l.href = before[i]!; }); };
  }, [url]);
}

function AnalyticsConsent({ name, onChoose }: { name?: string; onChoose: (c: "yes" | "no") => void }) {
  return (
    <div role="dialog" aria-label="Analytics cookies" className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-md rounded-2xl border border-border bg-background/95 p-4 text-sm shadow-soft backdrop-blur sm:left-auto sm:right-3 sm:mx-0">
      <p>{name ? `${name} uses` : "The owner uses"} Google Analytics to see how this portfolio is read. It sets cookies only if you agree.</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="line" onClick={() => onChoose("no")}>No thanks</Button>
        <Button size="sm" onClick={() => onChoose("yes")}>Allow</Button>
      </div>
    </div>
  );
}
