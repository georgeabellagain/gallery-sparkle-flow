/** The four lighting environments, numbered as they are in the lighting settings. */
export type HdriId = "1" | "2" | "3" | "4";

/**
 * Real photographic lighting (see public/studio/hdri). Each is a 1024 x 512 Radiance picture,
 * prepared so that every one lights a page equally brightly and its main light comes from
 * the same direction as the studio's own light. `preview` is a CSS background for the thumbnail.
 *
 * Kept apart from the 3D scene so the editor can list them without loading the 3D library.
 */
export const HDRI_PRESETS: readonly { id: HdriId; label: string; file: string; preview: string }[] = [
  { id: "1", label: "Lighting 1", file: "/studio/hdri/lighting-1.hdr", preview: "url(/studio/hdri/lighting-1.jpg) center / cover" },
  { id: "2", label: "Lighting 2", file: "/studio/hdri/lighting-2.hdr", preview: "url(/studio/hdri/lighting-2.jpg) center / cover" },
  { id: "3", label: "Lighting 3", file: "/studio/hdri/lighting-3.hdr", preview: "url(/studio/hdri/lighting-3.jpg) center / cover" },
  { id: "4", label: "Lighting 4", file: "/studio/hdri/lighting-4.hdr", preview: "url(/studio/hdri/lighting-4.jpg) center / cover" },
];

/** The shadow the Simple look starts with: light, so it is there without being heavy. */
export const DEFAULT_SIMPLE_SHADOW_OPACITY = 0.2;
