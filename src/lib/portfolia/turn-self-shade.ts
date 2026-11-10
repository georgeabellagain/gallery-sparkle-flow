import * as THREE from "three";

/** Approximate fold occlusion on the moving paper, without a shadow-map pass.
 * Smooth interpolated normals keep the band attached to the curl on both faces. */
export function createTurnSelfShade() {
  const amount = { value: 0 };
  return {
    drive(progress: number) { amount.value = .32 * Math.sin(Math.PI * Math.max(0, Math.min(1, progress))); },
    clear() { amount.value = 0; },
    apply(material: THREE.Material) {
      const previous = material.onBeforeCompile, key = material.customProgramCacheKey.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.uniforms["turnSelfShade"] = amount;
        shader.vertexShader = 'varying float foldFacing;\n' + shader.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nfoldFacing = abs(objectNormal.z);');
        shader.fragmentShader = 'uniform float turnSelfShade;\nvarying float foldFacing;\n' + shader.fragmentShader
          .replace('#include <color_fragment>', '#include <color_fragment>\nfloat foldLight = 1.0 - turnSelfShade * (1.0 - smoothstep(0.05, 0.95, foldFacing));\ndiffuseColor.rgb *= foldLight;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= foldLight;');
      };
      material.customProgramCacheKey = () => key() + '_turn_self_shade_v1';
      material.needsUpdate = true;
    },
  };
}
