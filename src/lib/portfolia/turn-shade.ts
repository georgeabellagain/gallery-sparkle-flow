import * as THREE from "three";

const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

/**
 * How the turning sheet shades the two resting pages, for the Simple look (Studio has real shadows). The shade
 * follows the sheet: everything between the spine and the sheet's free edge (projected onto the page) is under the
 * sheet and darkened, and the shadow then softens away beyond that edge, spreading wider the higher the sheet is.
 * `source` is the page the sheet leaves (shaded from the moment it lifts until it has passed upright); `landing`
 * is the page it is covering up (shaded from about upright until it lands). `edge` and `spread` are in page widths
 * from the spine. Pure numbers.
 */
export function turnShadeAt(progress: number) {
  const p = Math.min(1, Math.max(0, progress));
  const reach = Math.cos(Math.PI * p), height = Math.sin(Math.PI * p);
  const spread = 0.06 + 0.4 * height;
  return {
    source: {
      strength: 0.45 * smooth(p / 0.04) * (1 - smooth((p - 0.5) / 0.4)),
      edge: Math.max(0, reach),
      spread,
    },
    landing: {
      strength: 0.5 * smooth((p - 0.3) / 0.3) * (1 - smooth((p - 0.97) / 0.03)),
      edge: Math.max(0, -reach),
      spread,
    },
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
  // Per side: strength, edge, spread.
  const left = { value: new THREE.Vector3(0, 0, 1) }, right = { value: new THREE.Vector3(0, 0, 1) };
  let scale = 0;
  const set = (side: { value: THREE.Vector3 }, strength: number, edge = 0, spread = 1) => side.value.set(strength * scale, edge, Math.max(0.02, spread));
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
        shader.fragmentShader = "uniform vec3 turnShadeLeft;\nuniform vec3 turnShadeRight;\nvarying float turnShadeX;\n" + shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          vec3 turnShadeSide = turnShadeX < 0.0 ? turnShadeLeft : turnShadeRight;
          // Full under the sheet, softening away beyond its edge.
          float turnShadeFall = 1.0 - smoothstep(turnShadeSide.y, turnShadeSide.y + turnShadeSide.z, abs(turnShadeX));
          float turnShadeK = 1.0 - turnShadeSide.x * turnShadeFall * turnShadeFall * (3.0 - 2.0 * turnShadeFall);
          diffuseColor.rgb *= turnShadeK;`,
        ).replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= turnShadeK;");
      };
      material.customProgramCacheKey = () => key() + "_turnshade2";
      material.needsUpdate = true;
    },
    /** Full strength in Simple; lighter in Studio, where the light casts its own shadow too. */
    enable(studio: boolean) { scale = studio ? STUDIO_TURN_SHADE : 1; set(left, 0); set(right, 0); },
    /** Shades for a turn at `progress`; `dir` 1 lifts from the right and lands on the left. */
    drive(progress: number, dir: 1 | -1) {
      const s = turnShadeAt(progress);
      const [from, to] = dir === 1 ? [right, left] : [left, right];
      set(from, s.source.strength, s.source.edge, s.source.spread);
      set(to, s.landing.strength, s.landing.edge, s.landing.spread);
    },
    /** No turn: both pages clear. */
    clear() { set(left, 0); set(right, 0); },
  };
}
