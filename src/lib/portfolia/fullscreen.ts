export type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void; webkitFullscreenEnabled?: boolean };
export type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => void };

/** Use the chosen surface, falling back to an in-page fullscreen when refused. */
export async function toggleFullscreen(element: FullscreenElement | null, doc: FullscreenDocument, fallbackActive: boolean): Promise<"native" | "fallback" | "exited"> {
  if (doc.fullscreenElement || doc.webkitFullscreenElement) {
    try {
      if (doc.exitFullscreen) await doc.exitFullscreen();
      else await doc.webkitExitFullscreen?.();
    } catch { /* May already have exited. */ }
    return "exited";
  }
  if (fallbackActive) return "exited";
  const request: ((this: HTMLElement) => Promise<void> | void) | undefined = element?.requestFullscreen ?? element?.webkitRequestFullscreen;
  if (element && request && (doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? true)) {
    try { await request.call(element); return "native"; }
    catch { /* Fullscreen is not supported or was refused. */ }
  }
  return "fallback";
}
