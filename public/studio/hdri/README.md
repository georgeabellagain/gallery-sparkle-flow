# Studio lighting environments

These four lighting environments are used by the flipbook's Studio look. They are
numbered 1 to 4 in the lighting settings, in the order below.

| # | File | Source |
|---|------|--------|
| 1 | lighting-1.hdr | https://polyhaven.com/a/bamboo_tunnel |
| 2 | lighting-2.hdr | https://polyhaven.com/a/empty_play_room |
| 3 | lighting-3.hdr | https://polyhaven.com/a/wooden_studio_08 |
| 4 | lighting-4.hdr | https://polyhaven.com/a/ferndale_studio_07 |

`lighting-N.jpg` is the small picture shown on each lighting button.

They are by Poly Haven and released under CC0 (public domain), so they can be used
commercially: https://polyhaven.com/license

## How they were prepared

The originals are 4096 x 2048 EXR files of 80-100 MB each. For the web each was:

1. Reduced to 1024 x 512 by area averaging, which keeps the total amount of light.
2. Softened: any spot brighter than a luminance of 40 (the sun, a studio lamp) was
   capped and the light taken from it spread softly around it, so no light is lost
   but glossy paper is never hit by a harsh hot-spot.
3. Turned so the picture's main light sits above, in front of and just left of the
   book. This matches the studio's own light, so the shadow falls the same way
   whichever lighting is chosen.
4. Scaled so every one lights a page equally brightly: switching between them changes
   the mood and colour, not the exposure.
5. Saved as Radiance RGBE (`.hdr`), about 1.5-2 MB each.

A lighting file is only downloaded when it is first used. They are read by
`src/lib/portfolia/rgbe.ts`.



## Dappled sunlight additions

| # | Label | File | CC0 source |
|---|---|---|---|
| 5 | Pine sunlight | lighting-5.hdr | https://polyhaven.com/a/forest_slope |
| 6 | Leaf sunlight | lighting-6.hdr | https://polyhaven.com/a/autumn_forest_04 |

Downloaded from the corresponding Poly Haven 1K Radiance assets on 2026-10-08:
`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/forest_slope_1k.hdr`
and `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/autumn_forest_04_1k.hdr`.
License: https://polyhaven.com/license (CC0; redistribution and commercial use allowed).

These two files use 512 × 256 area-averaged RGBE pixels, with spherical mean
luminance normalised to 0.285 and a channel ceiling of 40. Preview JPGs are derived
from the same HDR pixels, not Poly Haven's example renders. Each HDR is about 517 KiB.

An HDR environment alone does not cast local leaf shadows in this renderer.
The two new presets pair it with a deterministic, code-generated foliage projection
on a shadow-casting spotlight. This supplies patches of direct light on the page,
turning sheet and scrapbook flap. The original four choices retain their appearance.
