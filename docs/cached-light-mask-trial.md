# Cached projected brightness mask trial

Enable with `?lightingMask=1` on a Studio viewer URL. Reload without the parameter
for the original rendering path. This is opt-in pending device visual/performance
comparisons; it is not a blanket replacement of the HDRI or dynamic shadows.

The existing window/foliage patterns are already projected cookies, not shadows
extracted from the HDRI photograph. This experiment precomputes their fixed cone
falloff into a linear half-float brightness texture. In the projected volume,
materials sample that texture instead of calculating spotlight cone smoothstep
for every shaded pixel. Outside the projection volume, Three's original light
calculation remains active. Multiple spotlights also use the original path.

The same projected coordinates follow background, curved paper and turning
sheets. Direction, material normals, diffuse/specular response, exposure and
moving page shadow sampling stay live. Unpatched note materials retain the raw
cookie. The live cookie and cached brightness map are mutually exclusive in
patched materials, avoiding doubled falloff. No screen-space filter is used.

CPU pixels are shared in a four-entry LRU; GPU texture objects and disposal belong
to each renderer. Masks keep the original source orientation, warm colour in
linear space and mipmap filtering. Switching lights changes uniforms instead of
rebuilding the shader. Both the flipbook and page reader include the trial.

## Checks and limits

Tests compare the baked cone with Three's analytic spotlight equation, confirm
linear colour preservation, measure interpolated white-mask error below 0.002,
and check shader chaining, retained physical/shadow equations, trial-off behaviour
and independent GPU disposal. TypeScript and production build are also checked.

The baked texture approximates the product of independently interpolated cookie
and falloff, and the shadow normal bias slightly offsets projected coordinates.
A GPU visual comparison is still required for pattern boundaries, paper relief,
turning sheets, fullscreen, background images and HD video. The available browser
has WebGL disabled, so no GPU rendering or frame-rate result is claimed. This
removes a small amount of fixed lighting arithmetic, not the dynamic shadow pass;
its performance benefit may be small or device-dependent.
