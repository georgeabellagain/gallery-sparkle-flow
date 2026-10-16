# Studio flipbook optimisation review

Reviewed page rasterisation/composition, CPU/GPU artwork caches, turn deformation,
material preparation, HDRI conversion/diffusion, lighting/shadows, backgrounds,
notes/tabs, fullscreen framing, capture and resource disposal.

## Existing work retained

- PDF faces use a device/memory-budgeted LRU; adjacent spreads upload ahead of use.
- GPU page textures are renderer-owned, capped by count and device byte budget.
- Turn poses use a bounded cache, with forward/backward preparation before use.
- Settled Crumbled geometry/normals remain weakly attached to the page canvas.
- Decoded HDRI/half-float preparation is shared through a four-entry LRU.
- GPU environment targets and diffusion results remain renderer-owned and reused.
- Decoded backdrops have a bounded image cache; fitted colour/normal/roughness
  surfaces only rebuild when source, fit or viewport changes.
- One scene serves both stationary pages and the turning sheet; the reverse face
  shares positions/normals and uses mirrored UVs instead of another PDF upload.
- Input redraws are coalesced, idle scenes do not continuously render, fullscreen
  surface budgets/adaptation remain independent of HD PDF texture resolution.
- Note resources cover the current/destination spread rather than every page.
  Caching every note mesh or every PDF raster would risk excessive GPU memory.

## Changes

1. PDF.js continuation chunks and note/link composition from speculative work now
   pause while the book moves. Explicitly requested pages receive counted priority
   holds, so awaiting a destination cannot deadlock behind the animation pause.
   Disposal cancels render tasks and releases queued composition waits.
2. The six bundled paper source textures share decoding across Studio viewers.
   Each renderer retains its own texture objects/disposal. Failed sources are
   evicted for retry; pending material loads are cleared after completion.
3. Each renderer reuses one PMREM generator across HDRIs instead of reallocating
   its conversion resources on every selection. Context restoration resets the
   book generator; scene disposal releases all generator resources.
4. Paper normal/roughness shader variants warm after maps arrive; initial scene
   preparation waits for pending stock maps as well as the HDRI.
5. Shadow maps invalidate when sheet/note geometry or lighting changes. Camera-only
   pan phases reuse world-space shadow maps rather than rendering them every frame.
6. Sticky-note bilinear surface sampling no longer allocates four nested sample
   arrays for every sticky vertex on every displayed frame.

No texture-resolution, normal-frame, lighting or page-turn duration reduction was
introduced. Fullscreen/capture use the same viewer-owned book information bubble.

## Validation

29 targeted tests pass: cooperative scheduling/priority/disposal, paper cache
sharing and independent disposal, note geometry, turn poses, settled normals,
render budgets, shadows, backdrop resizing, HDRI preparation and capture timing.
TypeScript and production build pass. These are regression checks, not a measured
FPS claim; hardware/browser/GPU performance still determines the frame rate.
