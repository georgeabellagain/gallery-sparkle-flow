import type * as THREE from "three";

/**
 * How the Simple look draws the shadow behind the book: as smooth tone, or in an illustrator's hand with fine
 * stippled dots or hatched lines. The pattern is laid out in world space under the book, so it stays still while
 * the shadow shifts. The pages themselves always shade smoothly; Studio uses real light.
 */
export const HALFTONE_STYLES = [
  { id: "dots", label: "Halftone", description: "Medium round dots, merging into a dark centre.", frequency: 95, radius: .72, power: .65 },
  { id: "bold-dots", label: "Bold dots", description: "Large, clearly separated round dots.", frequency: 52, radius: .5, power: .6 },
  { id: "fine-dots", label: "Fine dots", description: "Small dots with a compact dark centre and a gentle fade.", frequency: 145, radius: .62, power: 1 },
  { id: "micro-dots", label: "Micro dots", description: "A very fine, airy halftone with a broad soft fade.", frequency: 220, radius: .46, power: .7 },
] as const;
export const SHADE_STYLES = [
  ...HALFTONE_STYLES,
  { id: "standard", label: "Classic", description: "A smooth, soft shadow." },
  { id: "sketch", label: "Sketch", description: "Fine diagonal pencil lines with cross-hatching in deeper shade." },
] as const;
export type ShadeStyle = (typeof SHADE_STYLES)[number]["id"];
export const readableShadeStyle = (value: unknown): ShadeStyle => {
  if (value === "blend" || value === "classic") return "standard";
  if (value === "stipple") return "fine-dots";
  if (value === "hatch" || value === "crosshatch") return "sketch";
  return SHADE_STYLES.some(s => s.id === value) ? value as ShadeStyle : "standard";
};
// Classic must stay zero: Studio explicitly selects the smooth shadow.
export const shadeStyleIndex = (style: ShadeStyle) => {
  const current = readableShadeStyle(style);
  return current === "standard" ? 0 : current === "sketch" ? 5 : HALFTONE_STYLES.findIndex(s => s.id === current) + 1;
};

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
  if (shadeStyle >= 1 && shadeStyle <= 4) {
    float frequency = 95.0, maxRadius = 0.72, power = 0.65;
    ${HALFTONE_STYLES.map((style, i) => `if (shadeStyle == ${i + 1}) { frequency = ${style.frequency.toFixed(1)}; maxRadius = ${style.radius.toFixed(2)}; power = ${style.power.toFixed(2)}; }`).join("\n    ")}
    vec2 q = p * frequency;
    float d = length(fract(q) - 0.5);
    float radius = maxRadius * pow(s, power);
    float aa = max(fwidth(d), 0.002);
    float ink = 1.0 - smoothstep(radius - aa, radius + aa, d);
    // Fade below pixel resolution instead of shimmering while zooming or exporting.
    float pixelSpan = max(length(dFdx(q)), length(dFdy(q)));
    float unresolved = smoothstep(0.45, 1.0, pixelSpan);
    float meanInk = min(1.0, 3.141593 * radius * radius);
    return mix(ink, meanInk, unresolved) * opacity * smoothstep(0.0, 0.04, s);
  }
  float fade = smoothstep(0.0, 0.55, s);
  float mark = min(1.0, opacity * 2.6) * fade;
  float cover = s * opacity / max(min(1.0, opacity * 2.6), 1e-4);
  float q1 = (p.x + p.y) * 115.0, d1 = abs(fract(q1) - 0.5) * 2.0, aa1 = fwidth(q1) * 2.0 + 1e-4;
  float ink = 1.0 - smoothstep(cover - aa1, cover + aa1, d1);
  if (shadeStyle == 5) {
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
  material.customProgramCacheKey = () => "styled-shadow-halftone-v2";
  material.needsUpdate = true;
}
