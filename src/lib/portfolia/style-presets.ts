import { DEFAULT_FIT } from "./background";
import { BACKGROUND_PRESETS } from "./background-presets";
import { personalBackground, personalHdri } from "./premium-appearance";
import type { ViewerSettings } from "./store";

/** A whole look in one press: the book, its paper, the light, the background and how pages turn. */
export interface StylePreset {
  id: string;
  label: string;
  description: string;
  viewer: Partial<ViewerSettings>;
}

const texture = (id: string, backgroundColor: string): Partial<ViewerSettings> => ({ backgroundPreset: id, backgroundColor, backgroundFit: { ...DEFAULT_FIT, tile: true } });
const scene = (id: string, backgroundColor: string): Partial<ViewerSettings> => ({ backgroundPreset: id, backgroundColor, backgroundFit: DEFAULT_FIT });
const colour = (backgroundColor: string): Partial<ViewerSettings> => ({ backgroundPreset: undefined, backgroundColor, backgroundFit: DEFAULT_FIT });

export const STYLE_PRESETS: readonly StylePreset[] = [
  { id: "gallery", label: "Gallery", description: "A hardback under soft studio light on pale concrete.",
    viewer: { bookStyle: "hardback", finish: "satin", looks: ["studio", "clean"], look: "studio", studioLighting: "4", turnStyle: "classic", turnCurve: "firm", simpleShading: "standard", simpleShadow: true, simpleShadowOpacity: 0.2, ...texture("concrete_floor_02", "#d9d6d0") } },
  { id: "editorial", label: "Editorial", description: "A soft-cover magazine on a warm, quiet colour.",
    viewer: { bookStyle: "softcover", finish: "matte", looks: ["clean", "studio"], look: "clean", studioLighting: "2", turnStyle: "soft", turnCurve: "soft", simpleShading: "blend", simpleShadow: true, simpleShadowOpacity: 0.16, ...scene("scene:sorbet", "#f7efe7") } },
  { id: "lookbook", label: "Lookbook", description: "Glossy pages on warm wood, turning slow and full.",
    viewer: { bookStyle: "softcover", finish: "satin", looks: ["studio", "clean"], look: "studio", studioLighting: "6", turnStyle: "soft", turnCurve: "deep", simpleShading: "standard", simpleShadow: true, simpleShadowOpacity: 0.22, ...texture("wood_floor", "#8a6446") } },
  { id: "minimal", label: "Minimal", description: "Loose sheets, a whisper of shadow, nothing else.",
    viewer: { bookStyle: "flipbook", finish: "matte", looks: ["clean"], look: "clean", turnStyle: "snappy", turnCurve: "firm", simpleShading: "standard", simpleShadow: true, simpleShadowOpacity: 0.1, ...colour("#f4f2ee") } },
  { id: "night", label: "Night", description: "A dark hardback over a slowly moving aurora.",
    viewer: { bookStyle: "hardback", finish: "matte", looks: ["clean", "studio"], look: "clean", studioLighting: "1", turnStyle: "classic", turnCurve: "classic", simpleShading: "standard", simpleShadow: true, simpleShadowOpacity: 0.38, ...scene("scene:aurora", "#0f1226") } },
  { id: "zine", label: "Zine", description: "Newsprint, stippled shade and a quick, snappy turn.",
    viewer: { bookStyle: "flipbook", finish: "paper_0027", looks: ["clean"], look: "clean", turnStyle: "snappy", turnCurve: "soft", simpleShading: "stipple", simpleShadow: true, simpleShadowOpacity: 0.24, ...colour("#e8e3d8") } },
  { id: "sketchbook", label: "Sketchbook", description: "Toothy paper with hatched shade on soft sage.",
    viewer: { bookStyle: "softcover", finish: "natural", looks: ["clean"], look: "clean", turnStyle: "soft", turnCurve: "corner", simpleShading: "hatch", simpleShadow: true, simpleShadowOpacity: 0.2, ...scene("scene:sage", "#e9efe6") } },
  { id: "daylight", label: "Daylight", description: "Window light falling across a hardback on marble.",
    viewer: { bookStyle: "hardback", finish: "satin", looks: ["studio", "clean"], look: "studio", studioLighting: "8", turnStyle: "classic", turnCurve: "classic", simpleShading: "standard", simpleShadow: true, simpleShadowOpacity: 0.2, ...texture("marble_tiles", "#e6e2dc") } },
];

/** Whether a preset uses lighting or a background that only Personal publishes. */
export const presetIsPersonal = (preset: StylePreset) =>
  Boolean((preset.viewer.studioLighting && personalHdri(preset.viewer.studioLighting)) || (preset.viewer.backgroundPreset && personalBackground(preset.viewer.backgroundPreset)));

/**
 * What applying a preset changes: its look, a background that replaces any picture or per-look override, and the
 * flipbook switched on and opened, since the preset is a book look. Everything else (reading modes, logo,
 * scrapbook) is left as it was.
 */
export function presetPatch(preset: StylePreset, viewer: ViewerSettings): Partial<ViewerSettings> {
  const modes = viewer.modes?.length ? viewer.modes : (["scroll", "paged", "book"] as const);
  return { ...preset.viewer, backgroundKey: undefined, backgrounds: undefined, modes: [...new Set([...modes, "book" as const])], mode: "book" };
}

/** Which preset (if any) the portfolio's look currently matches, so its card can show as chosen. */
export function matchingPreset(viewer: ViewerSettings): string | undefined {
  return STYLE_PRESETS.find((preset) => !viewer.backgroundKey && Object.entries(preset.viewer).every(([key, value]) =>
    JSON.stringify(viewer[key as keyof ViewerSettings]) === JSON.stringify(value)))?.id;
}

/** A small swatch for a preset's card: the texture picture, or its colour. */
export function presetSwatch(preset: StylePreset): string {
  const url = BACKGROUND_PRESETS.find((b) => b.id === preset.viewer.backgroundPreset)?.url;
  return url ? `url(${url}) center / 160% repeat` : preset.viewer.backgroundColor ?? "#ddd";
}
