import * as THREE from "three";
import { SHADE_STYLE_GLSL, shadeStyleUniform } from "./shade-style";

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

/**
 * How dark the page under a turning sheet is, for the Simple look (Studio has real shadows). As a sheet lifts it
 * shades the page it leaves, widely at first and fading as it rises; as it comes down on the other side it darkens
 * that page, spreading out from the spine until it lands. `source` is the side the sheet leaves. Pure numbers.
 */
export function turnShadeAt(progress: number) {
  const p = Math.min(1, Math.max(0, progress));
  return {
    source: { strength: 0.42 * smooth(p / 0.05) * (1 - smooth(p / 0.55)), reach: 1.05 - 0.7 * smooth(p / 0.55) },
    landing: { strength: 0.6 * smooth((p - 0.4) / 0.55), reach: 0.3 + 0.85 * smooth((p - 0.4) / 0.6) },
  };
}
/** Studio already has the light's own shadow, so the drawn shade there is lighter. */
export const STUDIO_TURN_SHADE = 0.6;

/**
 * Darkens a resting page from the spine outward (in book space, so it follows the page wherever it lies). Applied
 * only to the two resting pages, never to the turning sheet. Simple draws artwork through the emissive channel,
 * so the shade darkens that as well as the paper.
 */
export function createTurnShade() {
  const left = { value: new THREE.Vector2(0, 1) }, right = { value: new THREE.Vector2(0, 1) };
  let scale = 0;
  const set = (side: { value: THREE.Vector2 }, strength: number, reach: number) => side.value.set(strength * scale, Math.max(0.05, reach));
  return {
    apply(material: THREE.Material) {
      if (material.userData["turnShade"]) return;
      material.userData["turnShade"] = true;
      const previous = material.onBeforeCompile, key = material.customProgramCacheKey.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.uniforms["turnShadeLeft"] = left;
        shader.uniforms["turnShadeRight"] = right;
        shader.uniforms["shadeStyle"] = shadeStyleUniform;
        shader.vertexShader = "varying float turnShadeX;\nvarying vec2 turnShadePoint;\n" + shader.vertexShader.replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvec4 turnShadeWorld = modelMatrix * vec4(transformed, 1.0);\nturnShadeX = turnShadeWorld.x;\nturnShadePoint = turnShadeWorld.xy;",
        );
        shader.fragmentShader = "uniform vec2 turnShadeLeft;\nuniform vec2 turnShadeRight;\nvarying float turnShadeX;\nvarying vec2 turnShadePoint;\n" + SHADE_STYLE_GLSL + shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          vec2 turnShadeSide = turnShadeX < 0.0 ? turnShadeLeft : turnShadeRight;
          // Deepest under the sheet near the spine, easing out across the page.
          float turnShadeFall = 1.0 - smoothstep(0.0, turnShadeSide.y, abs(turnShadeX));
          turnShadeFall = turnShadeFall * (0.55 + 0.45 * turnShadeFall);
          float turnShadeK = styledShade(turnShadeSide.x * turnShadeFall, turnShadePoint);
          diffuseColor.rgb *= turnShadeK;`,
        ).replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= turnShadeK;");
      };
      material.customProgramCacheKey = () => key() + "_turnshade";
      material.needsUpdate = true;
    },
    /** Full strength in Simple; lighter in Studio, where the light casts its own shadow too. */
    enable(studio: boolean) { scale = studio ? STUDIO_TURN_SHADE : 1; set(left, 0, 1); set(right, 0, 1); },
    /** Shades for a turn at `progress`; `dir` 1 lifts from the right and lands on the left. */
    drive(progress: number, dir: 1 | -1) {
      const s = turnShadeAt(progress);
      const [from, to] = dir === 1 ? [right, left] : [left, right];
      set(from, s.source.strength, s.source.reach);
      set(to, s.landing.strength, s.landing.reach);
    },
    /** No turn: both pages clear. */
    clear() { set(left, 0, 1); set(right, 0, 1); },
  };
}
