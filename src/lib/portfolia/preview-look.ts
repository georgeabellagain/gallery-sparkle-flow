/**
 * What the editor's preview should show while a creator is editing one look's settings: the Simple options
 * show the Simple look, the Studio options the Studio look. Nothing is saved: it only steers the preview, and
 * is cleared when the creator moves on, so the preview goes back to how the portfolio opens.
 */
export type PreviewLook = "clean" | "studio";

let current: PreviewLook | null = null;
/** A look the creator chose with the editor's Simple / Studio switch: it holds until they pick the other. */
let pinned: PreviewLook | null = null;
const listeners = new Set<(look: PreviewLook | null) => void>();

const effective = () => current ?? pinned;
export function setPreviewLook(look: PreviewLook | null) {
  const before = effective();
  current = look;
  if (effective() !== before) listeners.forEach((listener) => listener(effective()));
}
export function pinPreviewLook(look: PreviewLook | null) {
  const before = effective();
  pinned = look;
  current = null;
  if (effective() !== before) listeners.forEach((listener) => listener(effective()));
}
export function getPinnedLook() {
  return pinned;
}

export function getPreviewLook() {
  return effective();
}

export function subscribePreviewLook(listener: (look: PreviewLook | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
