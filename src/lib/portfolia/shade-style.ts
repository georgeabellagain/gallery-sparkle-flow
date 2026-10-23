/**
 * How the Simple look draws shade (the spine gutter and the shadow of a turning page): as smooth tone, or in an
 * illustrator's hand with stippled dots or hatched lines. The pattern is laid out in book space, so it stays
 * printed on the paper while a page moves. Studio always uses smooth, real light.
 */
export const SHADE_STYLES = [
  { id: "standard", label: "Standard", description: "Smooth shade, like light on paper." },
  { id: "blend", label: "Blend", description: "A softer, airbrushed falloff." },
  { id: "stipple", label: "Stipple", description: "Ink dots that gather where it's darker." },
  { id: "hatch", label: "Hatch", description: "Fine diagonal lines that thicken in shade." },
  { id: "crosshatch", label: "Cross-hatch", description: "Hatching, with a second set of lines in deeper shade." },
] as const;
export type ShadeStyle = (typeof SHADE_STYLES)[number]["id"];
export const readableShadeStyle = (value: unknown): ShadeStyle => (SHADE_STYLES.some((s) => s.id === value) ? (value as ShadeStyle) : "standard");
export const shadeStyleIndex = (style: ShadeStyle) => SHADE_STYLES.findIndex((s) => s.id === style);

/** Shared by every page shader; one uniform object, so a change of style reaches them all at once. */
export const shadeStyleUniform = { value: 0 };

/**
 * GLSL: the brightness multiplier for a shade amount `s` (0 none, 1 full) at book-space point `p`. Guarded so two
 * shading effects can include it in one shader. Line and dot spacing is about a hundredth of a page.
 */
export const SHADE_STYLE_GLSL = `
#ifndef SHADE_STYLE_FN
#define SHADE_STYLE_FN
uniform int shadeStyle;
float shadeHash(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float styledShade(float s, vec2 p) {
  s = clamp(s, 0.0, 1.0);
  if (shadeStyle == 1) return 1.0 - 0.9 * smoothstep(0.0, 1.0, s) * (0.7 + 0.3 * s);
  if (shadeStyle == 2) {
    vec2 cell = floor(p * 140.0), f = fract(p * 140.0) - 0.5;
    float jitter = shadeHash(cell);
    float dotSize = 0.5 * sqrt(clamp(s * 1.35 - jitter * 0.35, 0.0, 1.0));
    float ink = 1.0 - smoothstep(dotSize - 0.08, dotSize + 0.08, length(f));
    return 1.0 - 0.72 * ink * step(0.02, s);
  }
  if (shadeStyle == 3 || shadeStyle == 4) {
    float a = fract((p.x + p.y) * 95.0);
    float width = clamp(s * 0.85, 0.0, 0.85);
    float ink = smoothstep(width + 0.06, width - 0.06, abs(a - 0.5) * 2.0);
    if (shadeStyle == 4) {
      float b = fract((p.x - p.y) * 95.0);
      float width2 = clamp((s - 0.35) * 1.1, 0.0, 0.8);
      ink = max(ink, smoothstep(width2 + 0.06, width2 - 0.06, abs(b - 0.5) * 2.0) * step(0.001, width2));
    }
    return 1.0 - 0.7 * ink * step(0.02, s);
  }
  return 1.0 - s;
}
#endif
`;
