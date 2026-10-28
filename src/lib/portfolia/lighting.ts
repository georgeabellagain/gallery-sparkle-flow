/** Lighting choices retain stable IDs so saved portfolios keep their original lighting. */
export type HdriId = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12" | "13" | "14" | "15";

/**
 * Real photographic lighting (see public/studio/hdri). Each is a 512 x 256 or 1024 x 512 Radiance picture,
 * prepared so that every one lights a page equally brightly and its main light comes from
 * the same direction as the studio's own light. `preview` is a CSS background for the thumbnail.
 *
 * Kept apart from the 3D scene so the editor can list them without loading the 3D library.
 */
export const HDRI_PRESETS: readonly { id: HdriId; label: string; file: string; preview: string; dapple?: "pine" | "leaves" | "blinds" | "window" }[] = [
  { id: "1", label: "Side light", file: "/studio/hdri/lighting-1.hdr", preview: "url(/studio/hdri/lighting-1.jpg) center / cover" },
  { id: "2", label: "Warm studio", file: "/studio/hdri/lighting-2.hdr", preview: "url(/studio/hdri/lighting-2.jpg) center / cover" },
  { id: "3", label: "Soft daylight", file: "/studio/hdri/lighting-3.hdr", preview: "url(/studio/hdri/lighting-3.jpg) center / cover" },
  { id: "4", label: "Even studio", file: "/studio/hdri/lighting-4.hdr", preview: "url(/studio/hdri/lighting-4.jpg) center / cover" },
  { id: "5", label: "Pine canopy", file: "/studio/hdri/lighting-5.hdr", preview: "url(/studio/hdri/lighting-5.jpg) center / cover", dapple: "pine" },
  { id: "6", label: "Leaf shade", file: "/studio/hdri/lighting-6.hdr", preview: "url(/studio/hdri/lighting-6.jpg) center / cover", dapple: "leaves" },
  { id: "7", label: "Window blinds", file: "/studio/hdri/lighting-7.hdr", preview: "url(/studio/hdri/lighting-7.jpg) center / cover", dapple: "blinds" },
  { id: "8", label: "Open window", file: "/studio/hdri/lighting-8.hdr", preview: "url(/studio/hdri/lighting-8.jpg) center / cover", dapple: "window" },
  { id: "9", label: "Window glow", file: "/studio/hdri/lighting-9.hdr", preview: "url(/studio/hdri/lighting-9.jpg) center / cover", dapple: "window" },
  { id: "10", label: "Slatted light", file: "/studio/hdri/lighting-10.hdr", preview: "url(/studio/hdri/lighting-10.jpg) center / cover", dapple: "blinds" },
  { id: "11", label: "High window", file: "/studio/hdri/lighting-11.hdr", preview: "url(/studio/hdri/lighting-11.jpg) center / cover", dapple: "window" },
  { id: "12", label: "Window crosslight", file: "/studio/hdri/lighting-12.hdr", preview: "url(/studio/hdri/lighting-12.jpg) center / cover", dapple: "window" },
  { id: "13", label: "Soft blinds", file: "/studio/hdri/lighting-13.hdr", preview: "url(/studio/hdri/lighting-13.jpg) center / cover", dapple: "blinds" },
  { id: "14", label: "Garden shade", file: "/studio/hdri/lighting-14.hdr", preview: "url(/studio/hdri/lighting-14.jpg) center / cover", dapple: "leaves" },
  { id: "15", label: "Forest light", file: "/studio/hdri/lighting-15.hdr", preview: "url(/studio/hdri/lighting-15.jpg) center / cover", dapple: "pine" },
];

/** The shadow the Simple look starts with: light, so it is there without being heavy. */
export const DEFAULT_SIMPLE_SHADOW_OPACITY = 0.2;
export const MAX_STUDIO_BRIGHTNESS = 2;
export function studioExposure(value = .5) {
  const brightness = Math.max(0, Math.min(MAX_STUDIO_BRIGHTNESS, Number.isFinite(value) ? value : .5));
  return .55 + brightness * 1.6;
}

/** Strength retains HDRI detail; the other endpoint is its solid average radiance. */
export function studioLightMix(value = .75) {
  const hdri = Math.max(0, Math.min(1, Number.isFinite(value) ? value : .75));
  return { hdri, top: 0, ambient: 0 };
}

/** The directional pattern belongs to the selected preset, alongside its environment. */
export function presetDirectLight(id: HdriId, strength = .75) {
  const pattern = HDRI_PRESETS.find(preset => preset.id === id)?.dapple;
  return (pattern === "window" || pattern === "blinds" ? 1.4 : pattern ? 1.8 : 0) * studioLightMix(strength).hdri;
}

/** Optional neutral fill, independent of HDRI detail and exposure. */
export function studioTopLight(value = 0) { return Math.PI * Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); }

/** Deliberate art-directed shadows; HDRI pixels alone cannot cast local shadows. */
const SHADOWS = [
  [-3.2, 1.2, 5.2, 3, -.35, .92],
  [2.8, 2.1, 5.6, 7, .2, 1.15],
  [-.7, -3.3, 5.8, 5, -.12, 1.05],
  [1.4, 3.5, 6, 6, .08, 1.2],
  [-3.8, 2.4, 5.1, 2, -.28, .9],
  [3.1, -.9, 5.4, 4, .42, 1.1],
  [-2.9, .8, 5.5, 1.5, -.5, .95],
  [1.1, 3.1, 5.6, 2, .18, 1.05],
  [-3.5, -1.2, 5.2, 2.5, -.4, .88],
  [3.7, 1.3, 5, 1.8, .6, 1.12],
  [-1.2, 3.7, 5.8, 3.5, -.2, .8],
  [2.3, -3.2, 5.3, 2, .8, 1.2],
  [-3.1, -2.4, 6, 5, -.75, 1.08],
  [3.8, 2.8, 4.8, 4, .35, .85],
  [-2.1, 3.9, 5, 1.5, -.6, 1.18],
] as const;
export function presetShadow(id: HdriId) {
  const index = Number(id)-1;
  const [x,y,z,radius,rotation,scale] = SHADOWS[index] ?? SHADOWS[3]!;
  return { position:[x,y,z] as const, radius, rotation, scale,
    offset:[((index%3)-1)*18,(Math.floor(index/3)%3-1)*14] as const,
    seed: index*977+419, penumbra: .08+radius*.035,
  };
}
