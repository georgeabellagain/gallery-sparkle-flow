import type { Portfolio, ViewerSettings } from "./store";
import { backgroundKeys } from "./background-settings";
export const MAX_SAVED_LOOKS = 20;
export interface SavedLook { id: string; name: string; viewer: Partial<ViewerSettings> }
/** Explicit visual-only allowlist: copying a look must never copy reader content, access or identity. */
export const LOOK_FIELDS = ["bookStyle", "pageStack", "finish", "look", "looks", "turnStyle", "turnCurve", "turnSpeed", "tabStyle", "studioLighting", "studioBrightness", "studioLightingStrength", "studioTopLight", "studioImperfections", "simpleShadow", "simpleShadowOpacity", "simpleShading", "background", "backgroundColor", "backgroundKey", "backgroundPreset", "backgroundFit", "backgrounds", "backgroundLighting", "background3D"] as const satisfies readonly (keyof ViewerSettings)[];
export function captureLook(viewer: Partial<ViewerSettings>): Partial<ViewerSettings> {
  return structuredClone(Object.fromEntries(LOOK_FIELDS.map(key => [key, viewer[key]])));
}
export function applyLook(look: SavedLook, current: ViewerSettings): Partial<ViewerSettings> {
  const visual = captureLook(look.viewer);
  // Keep both old and reused uploads available to undo and to the image picker.
  return { ...visual, backgroundUploads: [...new Set([...backgroundKeys({ ...current, brandLogoKey: undefined }), ...backgroundKeys(visual)])] };
}
export function portfolioAppearanceKeys(portfolio: Portfolio): string[] {
  return [...new Set([...backgroundKeys(portfolio.viewer), ...(portfolio.savedLooks ?? []).flatMap(look => backgroundKeys(look.viewer))])];
}

/** Public portfolio rows must never contain the reusable library, even for published portfolios. */
export function splitSavedLooks(p: Portfolio) {
  const { savedLooks, ...portfolio } = p;
  return { portfolio, savedLooks: savedLooks ?? [] };
}
export function readSavedLooks(value: unknown): SavedLook[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SavedLook => Boolean(item && typeof item.id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(item.id)
    && typeof item.name === "string" && item.name.trim() && item.viewer && typeof item.viewer === "object" && !Array.isArray(item.viewer)))
    .slice(0, MAX_SAVED_LOOKS).map(item => ({ id: item.id, name: item.name.trim().slice(0, 60), viewer: captureLook(item.viewer) }));
}
