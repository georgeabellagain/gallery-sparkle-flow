import { DEFAULT_VIEWER, type Portfolio } from "./store";
import type { PageBounds } from "./foldouts";
export type RenderHotspot = PageBounds & { id: string; label: string; url?: string; page?: number };
export type RenderedState = {
  pages: number[];
  still: string;
  pageBounds?: PageBounds[];
  notes: Array<RenderHotspot & { open: string; close: string; openStill: string }>;
  links: RenderHotspot[];
  forward?: string;
  backward?: string;
};
export type RenderedStudio = {
  version: 1;
  signature: string;
  createdAt: number;
  width: number;
  height: number;
  states: RenderedState[];
  bytes: number;
};
export type StudioExporter = {
  video(progress: (value: string, fraction?: number) => void, signal: AbortSignal): Promise<Blob>;
  render(
    signature: string,
    save: (blob: Blob) => Promise<string>,
    progress: (value: string, fraction?: number) => void,
    signal: AbortSignal,
  ): Promise<RenderedStudio>;
};
export function renderSignature(p: Portfolio) {
  const { studioPlayback: _playback, ...viewer } = { ...DEFAULT_VIEWER, ...p.viewer };
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([, v]) => v !== undefined)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, canonical(v)]),
          )
        : value;
  return JSON.stringify(
    canonical([
      "studio-capture-8",
      p.pdf?.blobKey,
      viewer,
      p.style?.backdrop,
      p.pdf?.foldouts ?? [],
      p.pdf?.tags ?? [],
      p.pdf?.links ?? [],
    ]),
  );
}
export function currentRender(p: Portfolio) {
  const pack = p.pdf?.renderedStudio;
  const key = (value: unknown) => typeof value === "string" && /^render_[a-zA-Z0-9]+$/.test(value);
  const rect = (value: RenderHotspot) =>
    value &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    [value.x, value.y, value.width, value.height].every(Number.isFinite) &&
    value.width > 0 &&
    value.height > 0;
  if (
    !pack ||
    pack.version !== 1 ||
    pack.signature !== renderSignature(p) ||
    !Number.isInteger(pack.width) || !Number.isInteger(pack.height) ||
    pack.width < 2 || pack.height < 2 || pack.width > 4096 || pack.height > 4096 || pack.width * pack.height > 8_294_400 ||
    !Array.isArray(pack.states) ||
    !pack.states.length ||
    pack.states.length > 600
  )
    return undefined;
  return pack.states.every(
    (s) =>
      s &&
      key(s.still) &&
      (!s.pageBounds || Array.isArray(s.pageBounds) && s.pageBounds.length <= 2 && s.pageBounds.every(b => b && [b.x,b.y,b.width,b.height].every(Number.isFinite) && b.width > 0 && b.height > 0)) &&
      (!s.forward || key(s.forward)) &&
      (!s.backward || key(s.backward)) &&
      Array.isArray(s.pages) &&
      s.pages.every((n) => Number.isInteger(n) && n >= 1 && n <= (p.pdf?.pages ?? 0)) &&
      Array.isArray(s.notes) &&
      s.notes.every((n) => rect(n) && key(n.open) && key(n.close) && key(n.openStill)) &&
      Array.isArray(s.links) &&
      s.links.every(
        (l) =>
          rect(l) && (!l.url || typeof l.url === "string") && (!l.page || Number.isInteger(l.page)),
      ),
  )
    ? pack
    : undefined;
}
export function renderedKeys(pack?: RenderedStudio): string[] {
  if (!pack || !Array.isArray(pack.states)) return [];
  return [
    ...new Set(
      pack.states
        .slice(0, 600)
        .flatMap((s) =>
          s && typeof s === "object"
            ? [
                s.still,
                s.forward,
                s.backward,
                ...(Array.isArray(s.notes)
                  ? s.notes
                      .slice(0, 12)
                      .flatMap((n) =>
                        n && typeof n === "object" ? [n.open, n.close, n.openStill] : [],
                      )
                  : []),
              ]
            : [],
        )
        .filter((k): k is string => typeof k === "string" && /^render_[a-zA-Z0-9]+$/.test(k)),
    ),
  ];
}
export function stateForPage(pack: RenderedStudio, page: number) {
  const index = pack.states.findIndex((s) => s.pages.includes(page));
  return index < 0 ? 0 : index;
}
/** Only requested note sections are played; page turns never open a note. */
export function renderedAction(
  pack: RenderedStudio,
  index: number,
  opened: string | null,
  action: { direction: 1 | -1 } | { note: string },
) {
  const state = pack.states[index];
  if (!state) return null;
  const closing = state.notes.find((n) => n.id === opened);
  if ("direction" in action) {
    const next = index + action.direction,
      key = action.direction === 1 ? state.forward : state.backward;
    if (!key || !pack.states[next]) return null;
    return {
      clips: [...(closing ? [closing.close] : []), key],
      still: pack.states[next]!.still,
      index: next,
      opened: null,
    };
  }
  const note = state.notes.find((n) => n.id === action.note);
  if (!note) return null;
  if (opened === note.id) return { clips: [note.close], still: state.still, index, opened: null };
  return {
    clips: [...(closing ? [closing.close] : []), note.open],
    still: note.openStill,
    index,
    opened: note.id,
  };
}
