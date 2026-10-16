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
