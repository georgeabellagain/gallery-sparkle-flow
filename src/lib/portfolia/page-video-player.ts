import type { PageVideo } from "./page-extras";

export const MAX_PLAYING = 2;

/** The videos allowed to play: those on the pages in view, in reading order, at most MAX_PLAYING. */
export function choosePlaying(inView: readonly string[], max = MAX_PLAYING): string[] {
  return [...new Set(inView)].slice(0, max);
}

/**
 * Owns the page videos' elements. Videos start muted and inline (so phones autoplay them), loop, play only while
 * their page is in view, and only one has sound. Each new frame asks the book to redraw; nothing redraws while
 * nothing plays.
 */
export function createPageVideoPlayer(options: {
  /** A playable address for a stored file (a signed link for visitors, a local copy for the owner). */
  urlFor: (key: string) => Promise<string | undefined>;
  onFrame: () => void;
  /** Sound state changed (for the on-page speaker buttons). */
  onSound?: (id: string | null) => void;
}) {
  const elements = new Map<string, HTMLVideoElement>();
  const holder = typeof document !== "undefined" ? document.createElement("div") : null;
  // iOS plays inline video textures reliably only when the element is in the document.
  if (holder) {
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;";
    document.body.appendChild(holder);
  }
  let playing = new Set<string>();
  let sound: string | null = null;
  let frameLoop = 0;
  let disposed = false;
  const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const loop = () => {
    frameLoop = 0;
    if (disposed || ![...playing].some((id) => !elements.get(id)?.paused)) return;
    options.onFrame();
    frameLoop = requestAnimationFrame(loop);
  };
  const kick = () => { if (!frameLoop && !disposed) frameLoop = requestAnimationFrame(loop); };

  return {
    /** The element for a video, created (and loading) on first use. */
    element(video: PageVideo): HTMLVideoElement {
      let el = elements.get(video.id);
      if (el) return el;
      el = document.createElement("video");
      el.muted = true;
      el.defaultMuted = true;
      el.playsInline = true;
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.loop = true;
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      el.dataset["videoId"] = video.id;
      el.addEventListener("loadeddata", () => options.onFrame());
      el.addEventListener("playing", kick);
      elements.set(video.id, el);
      holder?.appendChild(el);
      void options.urlFor(video.blobKey).then((url) => { if (url && !disposed) { el!.src = url; el!.load(); if (playing.has(video.id)) void el!.play().catch(() => {}); } });
      return el;
    },
    /** Pages in view changed: play theirs (up to the limit), pause the rest. */
    setInView(ids: readonly string[]) {
      playing = new Set(reduced() || document.hidden ? [] : choosePlaying(ids));
      for (const [id, el] of elements) {
        if (playing.has(id)) { if (el.src) void el.play().then(kick).catch(() => {}); }
        else { el.pause(); if (sound === id) { el.muted = true; sound = null; options.onSound?.(null); } }
      }
    },
    /** Tap a video: its sound on (others off), or off again. */
    toggleSound(id: string) {
      const el = elements.get(id);
      if (!el) return;
      const on = sound !== id;
      for (const [other, e] of elements) e.muted = !(on && other === id);
      sound = on ? id : null;
      // A tap is a user gesture, so the browser lets it play with sound (and starts it if it was held back).
      if (on) void el.play().then(kick).catch(() => {});
      options.onSound?.(sound);
    },
    get sound() { return sound; },
    dispose() {
      disposed = true;
      if (frameLoop) cancelAnimationFrame(frameLoop);
      for (const el of elements.values()) { el.pause(); el.removeAttribute("src"); el.load(); }
      elements.clear();
      holder?.remove();
    },
  };
}
export type PageVideoPlayer = ReturnType<typeof createPageVideoPlayer>;
