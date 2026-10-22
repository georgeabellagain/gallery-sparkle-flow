import * as THREE from "three";

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

/**
 * How dark the page under a turning sheet is, for the Simple look (Studio has real shadows). As a sheet lifts it
 * shades the page it leaves, widely at first and fading as it rises; as it comes down on the other side it darkens
 * that page, spreading out from the spine until it lands. `source` is the side the sheet leaves. Pure numbers.
 */
export function turnShadeAt(progress: number) {
  const p = Math.min(1, Math.max(0, progress));
  return {
    source: { strength: 0.2 * smooth(p / 0.05) * (1 - smooth(p / 0.5)), reach: 1.05 - 0.75 * smooth(p / 0.5) },
    landing: { strength: 0.32 * smooth((p - 0.45) / 0.5), reach: 0.3 + 0.8 * smooth((p - 0.45) / 0.55) },
  };
}

/**
 * Darkens a resting page from the spine outward (in book space, so it follows the page wherever it lies). Applied
 * only to the two resting pages, never to the turning sheet. Simple draws artwork through the emissive channel,
 * so the shade darkens that as well as the paper.
 */
export function createTurnShade() {
  const left = { value: new THREE.Vector2(0, 1) }, right = { value: new THREE.Vector2(0, 1) };
  let enabled = false;
  const set = (side: { value: THREE.Vector2 }, strength: number, reach: number) => side.value.set(enabled ? strength : 0, Math.max(0.05, reach));
  return {
    apply(material: THREE.Material) {
      if (material.userData["turnShade"]) return;
      material.userData["turnShade"] = true;
      const previous = material.onBeforeCompile, key = material.customProgramCacheKey.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.uniforms["turnShadeLeft"] = left;
        shader.uniforms["turnShadeRight"] = right;
        shader.vertexShader = "varying float turnShadeX;\n" + shader.vertexShader.replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nturnShadeX = (modelMatrix * vec4(transformed, 1.0)).x;",
        );
        shader.fragmentShader = "uniform vec2 turnShadeLeft;\nuniform vec2 turnShadeRight;\nvarying float turnShadeX;\n" + shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          vec2 turnShadeSide = turnShadeX < 0.0 ? turnShadeLeft : turnShadeRight;
          float turnShadeFall = 1.0 - smoothstep(0.0, turnShadeSide.y, abs(turnShadeX));
          float turnShadeK = 1.0 - turnShadeSide.x * turnShadeFall;
          diffuseColor.rgb *= turnShadeK;`,
        ).replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= turnShadeK;");
      };
      material.customProgramCacheKey = () => key() + "_turnshade";
      material.needsUpdate = true;
    },
    /** On for the Simple look only. */
    enable(on: boolean) { enabled = on; if (!on) { set(left, 0, 1); set(right, 0, 1); } },
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
