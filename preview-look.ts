/**
 * What the editor's preview should show while a creator is editing one look's settings: the Simple options
 * show the Simple look, the Studio options the Studio look. Nothing is saved: it only steers the preview, and
 * is cleared when the creator moves on, so the preview goes back to how the portfolio opens.
 */
export type PreviewLook = "clean" | "studio";

let current: PreviewLook | null = null;
const listeners = new Set<(look: PreviewLook | null) => void>();

export function setPreviewLook(look: PreviewLook | null) {
  if (look === current) return;
  current = look;
  listeners.forEach((listener) => listener(look));
}

export function getPreviewLook() {
  return current;
}

export function subscribePreviewLook(listener: (look: PreviewLook | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
