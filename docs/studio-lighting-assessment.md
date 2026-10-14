# Studio lighting assessment — 14 October 2026

## Finding

A non-HDRI lighting rig can approximate the soft paper shading, window/foliage highlights and moving shadows. It cannot reproduce the same environment-dependent satin reflections exactly. Removing HDR files alone is unlikely to produce a large frame-rate improvement: the existing environment is prefiltered once and cached, while page shading, shadow maps and a large multisampled surface run during each turn.

This is a source-level assessment, not a GPU benchmark. Relative costs and expected benefits below are hypotheses to validate on desktop and mobile hardware.

## Current pipeline

- Eight local RGBE HDR presets. Presets 1–4 are 1024×512 and roughly 1.5–1.9 MB each; 5–8 are 512×256 and roughly 0.36–0.52 MB each. Files load on selection, not on every frame.
- Decode to floating-point radiance, convert to half-float textures, generate a GGX-prefiltered CubeUV environment with Three.js PMREM. Generated environments are cached in each renderer. Book and flat-reader renderers maintain separate caches, so mode transitions can repeat preparation.
- Diffusion blends the prefiltered environment towards its spherical average colour on the GPU. Identical blends are now reused. Brightness is tone-mapping exposure, not a new environment generation.
- Book pages use MeshPhysicalMaterial, with paper bump maps; satin also enables clearcoat. Sticky notes retain matte settings. Flat readers use MeshStandardMaterial without clearcoat.
- Lighting 5–8 adds code-generated foliage/blinds/window masks through a spotlight. These patterned highlights are not contained in the HDRI itself.
- The book uses a directional shadow source for plain lighting or a patterned spotlight shadow source for patterned lighting. Only one of these casts shadows at a time. Shadow maps are 512×512. A separate optional white top light casts no shadows.
- Lit image backgrounds use a standard material and a generated low-resolution normal map. The image texture can reach 4096px; normal maps are bounded at 512px and regenerated on fit/viewport changes, not on every turn.
- Book draws on demand; moving turns render on requestAnimationFrame. The desktop surface budget is 5.2 million pixels, with antialiasing. This was raised to prevent visible blur. Page textures are managed separately and retained in a bounded cache.
- Moving page positions and normals are updated on the CPU. Receiving-page relief is sampled to avoid clipping, and notes/tabs follow the sheet. These costs remain even if HDRIs are removed.

## Main cost groups

| Work | When | Potential reduction |
| --- | --- | --- |
| HDR download, decode, half-float conversion, PMREM | Initial use / renderer creation | Smaller source HDRs or offline prefiltered environments; primarily improves startup and memory |
| Physical material, clearcoat, environment and bump sampling | Every visible shaded pixel | Use simpler materials for matte paper; reserve physical clearcoat for satin |
| Page/scrapbook geometry and normals | Each moving frame | Analytic normals and fewer allocations; preserve collision and note attachment rules |
| Shadow rendering | Moving frames and scene changes | Preserve one active shadow source; cache stationary shadows, including camera-only updates |
| Multisampled full-screen surface | Each draw | Device-specific resolution tuning; avoid reducing detail so far that moving pages blur |
| Backdrop rasterisation/normal generation | Fit/viewport changes | Cache rasterisation at unchanged sizes; use authored normal maps for bundled assets if required |

## Alternatives

| Approach | Appearance | Expected benefit / limits |
| --- | --- | --- |
| Optimised HDRI | Closest to current look, including satin reflections | Best first step: downsample older sources to 512×256, prefilter offline, reuse decoded source data across readers, simplify matte materials |
| Procedural lighting | Ambient/hemisphere fill, one shadow-casting key, existing projected window/foliage masks, optional white fill | Eliminates HDR fetching/PMREM and environment sampling; diffuse look can be close, satin reflections will differ. To materially reduce per-frame cost, pair it with Lambert/Phong or a small custom paper shader |
| Precomputed diffuse light probe plus small specular environment | Retains directional ambient colour and some reflections | Good middle ground; diffuse light can use low-order spherical harmonics, satin retains a small prefiltered environment. Requires a custom/compatible material implementation |
| Matcap / baked lighting | Very cheap stylised shading | Poor fit for current Studio: lighting may stick to the camera, background response differs, and moving notes/shadows need separate handling |
| Flat 2D / baked video | Cheap playback | Rejected for this product: loses interactive curvature/zoom/notes, and the earlier flat-page handoff caused visible jolts |

## Recommendation

Keep current Studio lighting for now. Prototype an optional Efficient Studio path with hemisphere/ambient fill, one shadow source, the existing preset masks and a lightweight paper shader. Keep brightness, diffusion and top-light controls; map diffusion to projected-pattern contrast and fill balance. Compare the two implementations using the same pages, camera, notes and background before selecting a default.

First measure cold-start time, 95th-percentile frame time during forward/backward turns, GPU memory and stationary power use at desktop/mobile resolutions. Cover matte and satin, lit backgrounds, sticky notes near the spine, zoom/pan and fullscreen. Do not promise a percentage improvement before these measurements. Do not repeat the removed 3D-to-2D handoff.

## References

- Three.js physical-material cost: https://threejs.org/docs/pages/MeshPhysicalMaterial.html
- PMREM filtering and roughness sampling: https://threejs.org/docs/pages/PMREMGenerator.html
- Local implementations: book-scene.ts, page-studio.ts, environment-diffusion.ts, lit-backdrop.ts, book-notes.ts, render-budget.ts.
