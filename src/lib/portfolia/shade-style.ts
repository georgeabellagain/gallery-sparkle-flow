import type * as THREE from "three";

/**
 * How the Simple look draws the shadow behind the book: as smooth tone, or in an illustrator's hand with fine
 * stippled dots or hatched lines. The pattern is laid out in world space under the book, so it stays still while
 * the shadow shifts. The pages themselves always shade smoothly; Studio uses real light.
 */
export const SHADE_STYLES = [
  { id: "standard", label: "Standard", description: "A smooth, soft shadow." },
  { id: "blend", label: "Blend", description: "Softer and more airbrushed, fading sooner." },
  { id: "stipple", label: "Stipple", description: "Fine ink dots that gather where it's darker." },
  { id: "hatch", label: "Hatch", description: "Fine diagonal lines that thicken in shade." },
  { id: "crosshatch", label: "Cross-hatch", description: "Hatching, with a second set of lines in deeper shade." },
] as const;
export type ShadeStyle = (typeof SHADE_STYLES)[number]["id"];
export const readableShadeStyle = (value: unknown): ShadeStyle => (SHADE_STYLES.some((s) => s.id === value) ? (value as ShadeStyle) : "standard");
export const shadeStyleIndex = (style: ShadeStyle) => SHADE_STYLES.findIndex((s) => s.id === style);

/** One uniform object shared by the shadow materials, so a change of style reaches them all at once. */
export const shadeStyleUniform = { value: 0 };

/**
 * GLSL: how much ink a shadow of amount `s` (0 none, 1 full) puts down at world point `p`, given the shadow's
 * overall `opacity`. Patterned styles put down fewer, darker marks so they read as marks, while averaging out to
 * about the same darkness as the smooth shadow. Marks are about 1/200 of a page apart and anti-aliased.
 */
export const SHADE_STYLE_GLSL = `
#ifndef SHADE_STYLE_FN
#define SHADE_STYLE_FN
uniform int shadeStyle;
float shadeHash(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float shadowInk(float s, vec2 p, float opacity) {
  s = clamp(s, 0.0, 1.0);
  if (shadeStyle == 0) return s * opacity;
  if (shadeStyle == 1) return s * s * (3.0 - 2.0 * s) * s * opacity;
  // Marks are darker than the smooth shadow so they read as marks, but they fade out with the shadow itself, so
  // the pattern melts into the background instead of stopping at a line.
  float fade = smoothstep(0.0, 0.55, s);
  float mark = min(1.0, opacity * 2.6) * fade;
  float cover = s * opacity / max(min(1.0, opacity * 2.6), 1e-4);
  if (shadeStyle == 2) {
    vec2 q = p * 210.0, cell = floor(q);
    vec2 f = fract(q) - 0.5 + (vec2(shadeHash(cell), shadeHash(cell + 17.0)) - 0.5) * 0.3;
    float r = 0.56 * sqrt(cover), d = length(f), aa = fwidth(d) + 1e-4;
    return mark * (1.0 - smoothstep(r - aa, r + aa, d));
  }
  float q1 = (p.x + p.y) * 115.0, d1 = abs(fract(q1) - 0.5) * 2.0, aa1 = fwidth(q1) * 2.0 + 1e-4;
  float ink = 1.0 - smoothstep(cover - aa1, cover + aa1, d1);
  if (shadeStyle == 4) {
    float w2 = max(0.0, cover - 0.3) * 1.2;
    float q2 = (p.x - p.y) * 115.0, d2 = abs(fract(q2) - 0.5) * 2.0, aa2 = fwidth(q2) * 2.0 + 1e-4;
    ink = max(ink * (1.0 - 0.35 * step(0.3, cover)), (1.0 - smoothstep(w2 - aa2, w2 + aa2, d2)) * step(0.001, w2));
  }
  return mark * ink;
}
#endif
`;

/** Gives a shadow material (an alpha picture on a basic material) the chosen style. */
export function styleShadowMaterial(material: THREE.Material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms["shadeStyle"] = shadeStyleUniform;
    shader.vertexShader = "varying vec2 shadowPoint;\n" + shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\nshadowPoint = (modelMatrix * vec4(transformed, 1.0)).xy;",
    );
    shader.fragmentShader = "varying vec2 shadowPoint;\n" + SHADE_STYLE_GLSL + shader.fragmentShader.replace(
      "#include <map_fragment>",
      "#include <map_fragment>\ndiffuseColor.a = shadowInk(diffuseColor.a / max(opacity, 1e-4), shadowPoint, opacity);",
    );
  };
  material.customProgramCacheKey = () => "styled-shadow";
  material.needsUpdate = true;
}
