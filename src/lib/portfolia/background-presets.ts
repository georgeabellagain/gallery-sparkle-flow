import type { ViewerSettings } from "./store";

export const BACKGROUND_PRESETS = [
  {
    "id": "wood_floor",
    "label": "Warm wood",
    "url": "/studio/backgrounds/wood_floor.webp",
    "source": "https://polyhaven.com/a/wood_floor"
  },
  {
    "id": "wooden_floor_02",
    "label": "Natural hardwood",
    "url": "/studio/backgrounds/wooden_floor_02.webp",
    "source": "https://polyhaven.com/a/wooden_floor_02"
  },
  {
    "id": "concrete_floor_02",
    "label": "Soft concrete",
    "url": "/studio/backgrounds/concrete_floor_02.webp",
    "source": "https://polyhaven.com/a/concrete_floor_02"
  },
  {
    "id": "concrete_floor_03",
    "label": "Textured concrete",
    "url": "/studio/backgrounds/concrete_floor_03.webp",
    "source": "https://polyhaven.com/a/concrete_floor_03"
  },
  {
    "id": "marble_tiles",
    "label": "Marble tiles",
    "url": "/studio/backgrounds/marble_tiles.webp",
    "source": "https://polyhaven.com/a/marble_tiles"
  },
  {
    "id": "painted_plaster_wall",
    "label": "Painted plaster",
    "url": "/studio/backgrounds/painted_plaster_wall.webp",
    "source": "https://polyhaven.com/a/painted_plaster_wall"
  },
  {
    "id": "fabric_pattern_07",
    "label": "Woven fabric",
    "url": "/studio/backgrounds/fabric_pattern_07.webp",
    "source": "https://polyhaven.com/a/fabric_pattern_07"
  },
  {
    "id": "denim_fabric_03",
    "label": "Denim",
    "url": "/studio/backgrounds/denim_fabric_03.webp",
    "source": "https://polyhaven.com/a/denim_fabric_03"
  },
  {
    "id": "grey_plaster_03",
    "label": "Cloud plaster",
    "url": "/studio/backgrounds/grey_plaster_03.webp",
    "source": "https://polyhaven.com/a/grey_plaster_03"
  },
  {
    "id": "plaster_grey_04",
    "label": "Fine grey plaster",
    "url": "/studio/backgrounds/plaster_grey_04.webp",
    "source": "https://polyhaven.com/a/plaster_grey_04"
  },
  {
    "id": "white_stucco_02",
    "label": "White stucco",
    "url": "/studio/backgrounds/white_stucco_02.webp",
    "source": "https://polyhaven.com/a/white_stucco_02"
  },
  {
    "id": "white_plaster_02",
    "label": "Chalk plaster",
    "url": "/studio/backgrounds/white_plaster_02.webp",
    "source": "https://polyhaven.com/a/white_plaster_02"
  },
  {
    "id": "patterned_clay_plaster",
    "label": "Trowelled clay",
    "url": "/studio/backgrounds/patterned_clay_plaster.webp",
    "source": "https://polyhaven.com/a/patterned_clay_plaster"
  },
  {
    "id": "synthetic_wood",
    "label": "Wood slats",
    "url": "/studio/backgrounds/synthetic_wood.webp",
    "source": "https://polyhaven.com/a/synthetic_wood"
  },
  {
    "id": "wood_table_001",
    "label": "Polished wood",
    "url": "/studio/backgrounds/wood_table_001.webp",
    "source": "https://polyhaven.com/a/wood_table_001"
  },
  {
    "id": "marble_tiles_02",
    "label": "Pale marble",
    "url": "/studio/backgrounds/marble_tiles_02.webp",
    "source": "https://polyhaven.com/a/marble_tiles_02"
  },
  {
    "id": "poly_wool_herringbone",
    "label": "Wool herringbone",
    "url": "/studio/backgrounds/poly_wool_herringbone.webp",
    "source": "https://polyhaven.com/a/poly_wool_herringbone"
  },
  {
    "id": "plaster_brick_pattern",
    "label": "Plastered brick",
    "url": "/studio/backgrounds/plaster_brick_pattern.webp",
    "source": "https://polyhaven.com/a/plaster_brick_pattern"
  }
] as const;

/** Uploaded images take precedence; bundled presets work on every device. */
export function backgroundPicture(view: Pick<ViewerSettings, "backgroundKey" | "backgroundPreset">, uploaded?: string) {
  return view.backgroundKey ? uploaded : BACKGROUND_PRESETS.find(p => p.id === view.backgroundPreset)?.url ?? uploaded;
}

/** Preset surface maps are linear data, aligned with the bundled albedo. */
export function backgroundSurfaceMaps(url?: string) {
  const preset = BACKGROUND_PRESETS.find(p => url?.split("?")[0]?.endsWith(p.url));
  return preset ? { normal: `/studio/backgrounds/${preset.id}-nor_gl.webp`, roughness: `/studio/backgrounds/${preset.id}-rough.webp` } : undefined;
}
