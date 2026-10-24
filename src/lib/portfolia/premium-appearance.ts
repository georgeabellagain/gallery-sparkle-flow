import { DEFAULT_STYLE } from "./store";
import type { Portfolio } from "./store";
import { SPOTLIGHT_LIMITS } from "./page-extras";
export const FREE_HDRIS = ["1", "2", "3", "4"];
export const FREE_BACKGROUNDS = ["wood_floor", "concrete_floor_02", "scene:sorbet", "scene:aurora"];
export const personalHdri = (id: string) => !FREE_HDRIS.includes(id);
export const personalBackground = (id: string) => !FREE_BACKGROUNDS.includes(id);
export function premiumAppearance(p: Portfolio): string[] {
  const features: string[] = [];
  if (p.viewer?.studioLighting && personalHdri(p.viewer.studioLighting)) features.push("Personal HDRI lighting");
  const choices = [p.viewer, ...Object.values(p.viewer?.backgrounds ?? {})];
  if (choices.some(c => c?.backgroundKey || (c?.backgroundPreset && personalBackground(c.backgroundPreset)))) features.push("Personal backgrounds");
  if (p.profile.cv) features.push("Downloadable CV");
  if (p.pdf?.videos?.length) features.push("Videos on pages");
  if (p.leadForm?.enabled) features.push("Lead capture form");
  if (p.viewer?.brandLogoKey) features.push("Your logo in the viewer");
  if ((p.pdf?.spotlights?.length ?? 0) > SPOTLIGHT_LIMITS.free) features.push(`More than ${SPOTLIGHT_LIMITS.free} spotlights`);
  if (p.style && Object.entries(p.style).some(([key, value]) => value !== undefined && value !== DEFAULT_STYLE[key as keyof typeof DEFAULT_STYLE])) features.push("Custom profile styling");
  return features;
}
/** Public links never apply premium preview choices for an unpaid owner. */
export function freeViewer(view: Portfolio["viewer"]): Portfolio["viewer"] {
  if (!view) return view;
  const clean = <T extends { backgroundKey?: string; backgroundPreset?: string }>(c: T): T => ({ ...c, backgroundKey: undefined, backgroundPreset: c.backgroundPreset && !personalBackground(c.backgroundPreset) ? c.backgroundPreset : undefined });
  return { ...clean(view), brandLogoKey: undefined, brandLink: undefined, studioLighting: view.studioLighting && !personalHdri(view.studioLighting) ? view.studioLighting : "4", backgroundUploads: undefined, backgrounds: view.backgrounds ? Object.fromEntries(Object.entries(view.backgrounds).map(([key,c]) => [key, clean(c)])) : undefined };
}
