# Uploaded paper stocks

Source: user-supplied `paper_0022_4k_BUBdjS.zip` and
`paper_0027_4k_LD60UY.zip`. Paper 0027 is described in its source archive as
“Old Oxidized Newspaper Paper with Subtle Wrinkles”, author TextureCan.

Bundled colour, OpenGL normal and roughness maps are resized to 1024px.
Colour uses WebP quality 85; surface data uses lossless RGB WebP.
DirectX normal maps are omitted in favour of OpenGL's Y orientation.
Height and AO are omitted: normal relief and roughness provide the surface
response without changing page geometry or obscuring PDF text.

These maps load only for the selected stock, remain shared across stationary
and moving pages, and are released with the renderer. The PDF remains the
primary colour texture. Paper colour lightly modulates pale areas only.
Sticky notes keep their own matte finish.

Paper 22 uses 2× larger grain with normal strength 0.16 (previously 0.45).
All three maps use the same centred UV crop. Explicit paper-local tangents keep
normal-map orientation consistent across resting pages and mirrored turn faces.

Both stocks suppress normal, roughness and colour variation over dark ink and
high-contrast PDF edges to protect small text. Colour modulation is reduced to
30%; Paper 27 normal strength is 0.22. The mask reuses the existing PDF sample.

The editor labels these stocks Crumbled (Paper 22) and Newspaper (Paper 27).
Crumbled uses negative XY normal strength (-0.16) for its corrected relief
direction; Newspaper uses slightly stronger relief (0.29). Text protection stays enabled.

## Stable Crumbled relief

Crumbled now uses `paper_0022-baked.webp`: its supplied OpenGL normal XY relief
is shaded once into the original colour map using a fixed broad light, then
compressed as quality-92 WebP. The shader keeps the existing 2× grain scale and
text protection. Crumbled loads only this one bitmap, with constant matte
roughness and no live normal map, so mirrored faces and lighting-normal handoffs
cannot reverse or change its fine grain. The page geometry still catches scene
lighting and shadows normally. Newspaper retains dynamic normal/roughness maps.

## Restored physical surface response

Crumbled once again loads its original colour, OpenGL normal and roughness maps,
shared between stationary and moving pages with the same 2× UV scale and normal
strength. It no longer uses the baked bitmap. Both custom stocks now leave normal
mapping independent of PDF luminance and screen-space text edges. Roughness is
remapped to a matte 0.80–0.98 range; dark ink attenuates white specular reflection
instead of switching normals/roughness at letter and image boundaries. This avoids
bright edge halos while retaining real HDRI surface response and text protection.

## Retain landed face orientation

Crumbled now retains the actual completed (or cancelled) turn face as a CPU-only
snapshot per cached PDF canvas. Resting pages reuse its exact normals, tangents,
UVs, vertex order and material side, including inverted back-face normals, rather
than recomputing a front-facing rest normal frame. Returning to that page reuses
the saved frame. Attribute buffers are updated in place, and snapshots are weakly
held so they leave memory with the PDF canvas cache. Real normal and roughness
maps remain enabled.

Newspaper returns to its original 0.45 normal strength and stronger surface-map
response on pale neutral stock. Photos, colour artwork and dark ink receive less
surface noise through a broad luminance/chroma mask, with no screen-space edge
mask on the normals. Tint is limited to stock areas and dark-ink highlight
protection remains. Crumbled is excluded from this artwork response mask.
