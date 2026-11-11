import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * A slim bar that keeps the upload one tap away once the hero has scrolled out of view, and steps aside near the
 * closing call to action (anything marked data-landing-closing). On phones it is one full-width button at the bottom,
 * above the cookie banner when that is showing.
 */
export function LandingUploadBar({ name }: { name: string }) {
  const [heroGone, setHeroGone] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("landing-hero");
    if (!hero || typeof IntersectionObserver === "undefined") return;
    // Gone means scrolled past the top, not merely below the fold.
    const observer = new IntersectionObserver(([entry]) => setHeroGone(Boolean(entry && !entry.isIntersecting && entry.boundingClientRect.bottom < 0)));
    observer.observe(hero);
    const ends = [...document.querySelectorAll("[data-landing-closing], footer")];
    const closingObserver = new IntersectionObserver(entries => setClosing(entries.some(e => e.isIntersecting)), { rootMargin: "0px 0px 120px 0px" });
    ends.forEach(el => closingObserver.observe(el));
    return () => { observer.disconnect(); closingObserver.disconnect(); };
  }, []);
  if (!heroGone || closing) return null;
  const upload = () => {
    const box = document.getElementById("upload");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    box?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    box?.querySelector<HTMLInputElement>('input[type="file"]')?.click();
  };
  return <div role="region" aria-label="Upload a PDF" className="fixed inset-x-3 bottom-[calc(0.75rem+var(--pf-cookie-h,0px))] z-40 sm:inset-x-0 sm:bottom-auto sm:top-0 sm:border-b sm:border-border sm:bg-background/95 sm:backdrop-blur">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 sm:px-8 sm:py-2.5">
      <p className="hidden min-w-0 truncate text-sm font-medium sm:block">{name}</p>
      <Button onClick={upload} className="w-full shadow-lift sm:w-auto sm:shadow-none">Upload a PDF</Button>
    </div>
  </div>;
}
