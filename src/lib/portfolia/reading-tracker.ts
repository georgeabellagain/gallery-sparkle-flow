import type { ReadingEvent } from "./reading.functions";

type Send = (batch: ReadingEvent[]) => void;

/**
 * Notes what a reader does inside a published portfolio: each page they open, how long they stay on it (only while
 * the tab is in view, at most 10 minutes a page), and what they press. Events are sent in small batches, every few
 * seconds and when the reader leaves, never one request per action.
 */
export function createReadingTracker(send: Send, now: () => number = () => Date.now()) {
  let queue: ReadingEvent[] = [];
  let page: number | null = null;
  let since = now();
  let visible = true;
  const settle = () => {
    if (page === null || !visible) return;
    const seconds = Math.min(600, Math.round((now() - since) / 1000));
    if (seconds >= 1) queue.push({ kind: "time", page, seconds });
    since = now();
  };
  const flush = () => {
    if (!queue.length) return;
    const batch = queue.slice(0, 40);
    queue = queue.slice(40);
    send(batch);
  };
  return {
    /** The reader is now on `next` (the page shown, or the left page of a spread). */
    page(next: number) {
      if (next === page) return;
      settle();
      page = next;
      since = now();
      queue.push({ kind: "page", page: next });
    },
    /** Something on the page was pressed: a link, hotspot, contents link or download. */
    click(target: string) { queue.push({ kind: "click", page: page ?? undefined, target: target.slice(0, 120) }); },
    /** A video started playing. */
    play(target: string) { queue.push({ kind: "play", page: page ?? undefined, target: target.slice(0, 120) }); },
    /** The tab was hidden (time stops and everything is sent) or shown again (time starts again). */
    visibility(shown: boolean) {
      if (!shown) { settle(); visible = false; flush(); }
      else { visible = true; since = now(); }
    },
    flush,
    /** What is waiting to be sent (for tests). */
    pending: () => [...queue],
  };
}
export type ReadingTracker = ReturnType<typeof createReadingTracker>;

/** What a press on the page should be counted as: a link's site or a control's name, or nothing for ordinary presses. */
export function clickTarget(element: Element | null): string | null {
  const hit = element?.closest?.("a[href], button[aria-label], [role=button][aria-label]");
  if (!hit) return null;
  // The viewer's own controls (toolbar, arrows, panels) are not what readers came for.
  if (hit.closest("[role=toolbar], [aria-label='Viewer controls'], .pf-book-navigation, [data-reader-chrome]")) return null;
  const href = hit.getAttribute("href");
  if (href && /^https?:/i.test(href)) { try { return new URL(href).hostname.replace(/^www\./, "") + new URL(href).pathname.replace(/\/$/, ""); } catch { /* fall through */ } }
  if (href?.startsWith("mailto:")) return "Email";
  if (href?.startsWith("tel:")) return "Phone";
  return hit.getAttribute("aria-label");
}
