import { setPreviewMode } from "./preview-look";
let request = 0;
const listeners = new Set<() => void>();
/** Survives switching from Scroll to the book, then is consumed once by the editor preview. */
export function requestPreviewTurn() {
  request = Date.now(); setPreviewMode("book"); listeners.forEach(listener => listener());
}
export function cancelPreviewTurn() { request = 0; }
export function takePreviewTurn(now = Date.now()) {
  if (!request) return false;
  const fresh = now - request < 30_000;
  request = 0; return fresh;
}
export function subscribePreviewTurn(listener: () => void) {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
