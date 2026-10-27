import { useEffect, useMemo, useRef } from "react";
import { clickTarget, createReadingTracker, type ReadingTracker } from "@/lib/portfolia/reading-tracker";
import { recordReading } from "@/lib/portfolia/reading.functions";
import { isBot, readerVisitor } from "@/lib/portfolia/store";

/**
 * Reader insights for a published portfolio: hands back what the viewer needs to report (the page) and a click
 * listener for the page area. Does nothing for previews, the owner's own visits and robots.
 */
export function useReading(code: string, active: boolean) {
  const tracker = useRef<ReadingTracker | null>(null);
  useEffect(() => {
    if (!active || typeof window === "undefined" || isBot()) return;
    const visitor = readerVisitor(), referrer = document.referrer || undefined;
    const t = createReadingTracker((events) => { void recordReading({ data: { code, visitor, referrer, events } }).catch(() => {}); });
    tracker.current = t;
    const timer = setInterval(t.flush, 8000);
    const onVisibility = () => t.visibility(document.visibilityState === "visible");
    const onHide = () => t.visibility(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      t.visibility(false);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      tracker.current = null;
    };
  }, [code, active]);
  return useMemo(() => ({
    onPage: (page: number) => tracker.current?.page(page),
    onClickCapture: (e: { target: EventTarget | null }) => {
      const target = clickTarget(e.target as Element | null);
      if (!target || !tracker.current) return;
      // A video player's play button counts as a play; everything else as a press.
      if (target.startsWith("Play ")) tracker.current.play(target.slice(5));
      else tracker.current.click(target);
    },
  }), []);
}
