import { useSyncExternalStore } from "react";
import type { PageStyle, ViewerSettings } from "./store";

/**
 * Undo and redo for how a portfolio looks (Book & turns, Light & shade, Background, Reading, Branding, presets).
 * A slider dragged in one go is one step. Uploaded pictures are files, not settings: a step never brings back a
 * picture that has since been removed (it may already be deleted), so undoing past an upload keeps today's files.
 */
export type AppearanceSnapshot = { code: string; viewer?: ViewerSettings; style?: PageStyle };

const LIMIT = 60;
/** Changes to the same settings this close together are one step (a slider being dragged). */
const COALESCE_MS = 700;
const past: AppearanceSnapshot[] = [];
const future: AppearanceSnapshot[] = [];
let last = { code: "", fields: "", at: 0 };
const listeners = new Set<() => void>();
let version = 0;
const changed = () => { version++; for (const l of listeners) l(); };

const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

/** Called with how the portfolio looked just before a change to `fields`. */
export function recordAppearance(before: AppearanceSnapshot, fields: string, now = Date.now()) {
  const same = last.code === before.code && last.fields === fields && now - last.at < COALESCE_MS;
  last = { code: before.code, fields, at: now };
  future.length = 0;
  if (!same) {
    past.push(clone(before));
    if (past.length > LIMIT) past.shift();
  }
  changed();
}

/** Keeps the pictures as they are now; a remembered picture is kept only while it is still one of the uploads. */
export function withCurrentFiles(snapshot: AppearanceSnapshot, current: AppearanceSnapshot, uploads: string[]): AppearanceSnapshot {
  const keep = (key?: string) => (key && uploads.includes(key) ? key : undefined);
  const viewer = snapshot.viewer && {
    ...snapshot.viewer,
    backgroundKey: keep(snapshot.viewer.backgroundKey),
    backgroundUploads: current.viewer?.backgroundUploads,
    brandLogoKey: current.viewer?.brandLogoKey,
    backgrounds: snapshot.viewer.backgrounds
      ? Object.fromEntries(Object.entries(snapshot.viewer.backgrounds).map(([context, choice]) => [context, choice && { ...choice, backgroundKey: keep(choice.backgroundKey) }]))
      : undefined,
  };
  const style = snapshot.style && { ...snapshot.style, bannerKey: current.style?.bannerKey };
  return { code: snapshot.code, viewer, style };
}

/** Steps back (or forward): `apply` puts a snapshot on the portfolio and returns how it looked before, or null. */
export function stepAppearance(direction: "undo" | "redo", apply: (snapshot: AppearanceSnapshot) => AppearanceSnapshot | null): boolean {
  const from = direction === "undo" ? past : future, to = direction === "undo" ? future : past;
  const snapshot = from.pop();
  if (!snapshot) return false;
  const before = apply(snapshot);
  if (before) to.push(clone(before));
  last = { code: "", fields: "", at: 0 };
  changed();
  return Boolean(before);
}

export function clearAppearanceHistory() { past.length = 0; future.length = 0; changed(); }

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** Whether there is anything to undo or redo for this portfolio. */
export function useAppearanceHistory(code: string) {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return { canUndo: past[past.length - 1]?.code === code, canRedo: future[future.length - 1]?.code === code };
}
