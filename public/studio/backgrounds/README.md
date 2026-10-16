# Bundled background textures

All eight diffuse/albedo textures are Poly Haven CC0 assets, downloaded 14 October 2026. Licence: https://polyhaven.com/license. Commercial reuse and redistribution permitted; attribution appreciated but not required. Website example renders were not used.

Converted from original 4K JPG colour maps to 2048px WebP, quality 65; separate 256px thumbnails.

- `wood_floor.webp`: Warm wood, https://polyhaven.com/a/wood_floor
- `wooden_floor_02.webp`: Natural hardwood, https://polyhaven.com/a/wooden_floor_02
- `concrete_floor_02.webp`: Soft concrete, https://polyhaven.com/a/concrete_floor_02
- `concrete_floor_03.webp`: Textured concrete, https://polyhaven.com/a/concrete_floor_03
- `marble_tiles.webp`: Marble tiles, https://polyhaven.com/a/marble_tiles
- `painted_plaster_wall.webp`: Painted plaster, https://polyhaven.com/a/painted_plaster_wall
- `fabric_pattern_07.webp`: Woven fabric, https://polyhaven.com/a/fabric_pattern_07
- `denim_fabric_03.webp`: Denim, https://polyhaven.com/a/denim_fabric_03

Fabric Pattern 07 uses its `col_1` colour map; the others use `diff`.

## Optional 3D surface lighting

Each preset also includes the matching Poly Haven 1K OpenGL normal (`*-nor_gl.webp`)
and roughness (`*-rough.webp`) map, downloaded 16 October 2026 from the same
CC0 asset. Surface maps are resized to 512px to bound download and GPU memory costs. Converted from PNG to
lossless RGB WebP, with 16-bit grayscale roughness scaled to 8-bit; these are linear data maps,
not colour images. Source pattern:
`https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/{id}/{id}_{nor_gl|rough}_1k.png`.

Maps load only when 3D background is enabled. Decoded images are shared in a
bounded cache; fitted GPU textures regenerate only for changed picture, surface
mode, fit or viewport. Page turns and camera movement reuse them. Existing HDRI
prefiltering and cached shadows remain reusable because the surface does not
change the environment. No displacement geometry or extra shadow pass is added.
Uploaded backgrounds use estimated normal relief, with constant matte roughness.
