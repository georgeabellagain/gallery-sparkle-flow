/** Lighting choices retain stable IDs so saved portfolios keep their original lighting. */
export type HdriId = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";

/**
 * Real photographic lighting (see public/studio/hdri). Each is a 512 x 256 or 1024 x 512 Radiance picture,
 * prepared so that every one lights a page equally brightly and its main light comes from
 * the same direction as the studio's own light. `preview` is a CSS background for the thumbnail.
 *
 * Kept apart from the 3D scene so the editor can list them without loading the 3D library.
 */
export const HDRI_PRESETS: readonly { id: HdriId; label: string; file: string; preview: string; dapple?: "pine" | "leaves" | "blinds" | "window" }[] = [
  { id: "1", label: "1", file: "/studio/hdri/lighting-1.hdr", preview: "url(/studio/hdri/lighting-1.jpg) center / cover" },
  { id: "2", label: "2", file: "/studio/hdri/lighting-2.hdr", preview: "url(/studio/hdri/lighting-2.jpg) center / cover" },
  { id: "3", label: "3", file: "/studio/hdri/lighting-3.hdr", preview: "url(/studio/hdri/lighting-3.jpg) center / cover" },
  { id: "4", label: "4", file: "/studio/hdri/lighting-4.hdr", preview: "url(/studio/hdri/lighting-4.jpg) center / cover" },
  { id: "5", label: "5", file: "/studio/hdri/lighting-5.hdr", preview: "url(/studio/hdri/lighting-5.jpg) center / cover", dapple: "pine" },
  { id: "6", label: "6", file: "/studio/hdri/lighting-6.hdr", preview: "url(/studio/hdri/lighting-6.jpg) center / cover", dapple: "leaves" },
  { id: "7", label: "7", file: "/studio/hdri/lighting-7.hdr", preview: "url(/studio/hdri/lighting-7.jpg) center / cover", dapple: "blinds" },
  { id: "8", label: "8", file: "/studio/hdri/lighting-8.hdr", preview: "url(/studio/hdri/lighting-8.jpg) center / cover", dapple: "window" },
];

/** The shadow the Simple look starts with: light, so it is there without being heavy. */
export const DEFAULT_SIMPLE_SHADOW_OPACITY = 0.2;

/** HDRI is the only illumination at full strength; the other endpoint is neutral overhead light. */
export function studioLightMix(value = .75) {
  const hdri = Math.max(0, Math.min(1, Number.isFinite(value) ? value : .75));
  return { hdri, top: 2.3 * (1 - hdri), ambient: .65 * (1 - hdri) };
}
