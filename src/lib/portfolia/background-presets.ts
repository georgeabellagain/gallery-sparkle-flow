import type { ViewerSettings } from "./store";

export const BACKGROUND_PRESETS = [{"id": "wood_floor", "label": "Warm wood", "url": "/studio/backgrounds/wood_floor.webp", "source": "https://polyhaven.com/a/wood_floor"}, {"id": "wooden_floor_02", "label": "Natural hardwood", "url": "/studio/backgrounds/wooden_floor_02.webp", "source": "https://polyhaven.com/a/wooden_floor_02"}, {"id": "concrete_floor_02", "label": "Soft concrete", "url": "/studio/backgrounds/concrete_floor_02.webp", "source": "https://polyhaven.com/a/concrete_floor_02"}, {"id": "concrete_floor_03", "label": "Textured concrete", "url": "/studio/backgrounds/concrete_floor_03.webp", "source": "https://polyhaven.com/a/concrete_floor_03"}, {"id": "marble_tiles", "label": "Marble tiles", "url": "/studio/backgrounds/marble_tiles.webp", "source": "https://polyhaven.com/a/marble_tiles"}, {"id": "painted_plaster_wall", "label": "Painted plaster", "url": "/studio/backgrounds/painted_plaster_wall.webp", "source": "https://polyhaven.com/a/painted_plaster_wall"}, {"id": "fabric_pattern_07", "label": "Woven fabric", "url": "/studio/backgrounds/fabric_pattern_07.webp", "source": "https://polyhaven.com/a/fabric_pattern_07"}, {"id": "denim_fabric_03", "label": "Denim", "url": "/studio/backgrounds/denim_fabric_03.webp", "source": "https://polyhaven.com/a/denim_fabric_03"}] as const;

/** Uploaded images take precedence; bundled presets work on every device. */
export function backgroundPicture(view: Pick<ViewerSettings, "backgroundKey" | "backgroundPreset">, uploaded?: string) {
  return view.backgroundKey ? uploaded : BACKGROUND_PRESETS.find(p => p.id === view.backgroundPreset)?.url ?? uploaded;
}

/** Preset surface maps are linear data, aligned with the bundled albedo. */
export function backgroundSurfaceMaps(url?: string) {
  const preset = BACKGROUND_PRESETS.find(p => url?.split("?")[0]?.endsWith(p.url));
  return preset ? { normal: `/studio/backgrounds/${preset.id}-nor_gl.webp`, roughness: `/studio/backgrounds/${preset.id}-rough.webp` } : undefined;
}
