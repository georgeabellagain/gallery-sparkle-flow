import type { StudioSettings } from "./book-scene";

/** Motion affects the next turn; exposure/fill never changes world-space shadows or paper shaders. */
export function studioSettingsChange(previous: StudioSettings, next: StudioSettings): "none" | "exposure" | "full" {
  let exposure = false;
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]) as Set<keyof StudioSettings>;
  for (const key of keys) {
    if (Object.is(previous[key], next[key])) continue;
    if (key === "turnStyle" || key === "turnSpeed" || key === "turnCurve") continue;
    if (key === "brightness" || key === "topLight") exposure = true;
    else return "full";
  }
  return exposure ? "exposure" : "none";
}
