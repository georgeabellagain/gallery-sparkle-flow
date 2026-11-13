/**
 * Phones read the flipbook sideways: a landscape screen shows the whole spread, as the book was designed. Browsers
 * can't turn a phone round, so the reader asks (a small hint while a phone is upright) and, where the browser
 * allows it (Android, in full screen), holds the screen sideways until full screen ends.
 */

/** The book shows one page at a time only in a tall, narrow space; anything wider than it is tall shows the spread. */
export const showsSinglePage = (width: number, height: number) => width < 720 && width < height;

/** Whether to suggest turning the phone: a touch screen, held upright, small enough that the spread would be cramped. */
export function wantsRotateHint(o: { touch: boolean; width: number; height: number; mode: string }) {
  return o.touch && o.mode === "book" && o.height > o.width && Math.min(o.width, o.height) < 600;
}

type LockableOrientation = ScreenOrientation & { lock?: (orientation: "landscape") => Promise<void> };
/** Holds the screen sideways while in full screen (Android). iPhones don't allow it; nothing happens there. */
export async function lockLandscape() {
  try {
    await (screen.orientation as LockableOrientation | undefined)?.lock?.("landscape");
    return true;
  } catch {
    return false;
  }
}
export function unlockOrientation() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* not locked */
  }
}

const HINT_KEY = "pf-rotate-hint-dismissed";
export function rotateHintDismissed() {
  try { return sessionStorage.getItem(HINT_KEY) === "1"; } catch { return false; }
}
export function dismissRotateHint() {
  try { sessionStorage.setItem(HINT_KEY, "1"); } catch { /* shown again next time */ }
}
