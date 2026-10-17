import * as THREE from "three";

/**
 * Soft ambient occlusion where paper curves into the spine, the strongest cue that pages are bound.
 * Distance is measured from the spine axis in book space, so an upright turning sheet is only shaded
 * along its hinge, never across its whole face. `setSpace` maps world space into book space when the
 * book itself is moved (the photo shoot); the reader's book never moves, so it keeps the identity.
 */
export function createGutterShade() {
  const amount = { value: 0 }, space = { value: new THREE.Matrix4() };
  return {
    apply(material: THREE.Material) {
      if (material.userData["gutterShade"]) return;
      material.userData["gutterShade"] = true;
      const previous = material.onBeforeCompile, key = material.customProgramCacheKey.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.uniforms["gutterAmount"] = amount;
        shader.uniforms["gutterSpace"] = space;
        shader.vertexShader = "uniform mat4 gutterSpace;\nvarying float gutterDistance;\n" + shader.vertexShader.replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvec4 gutterBook = gutterSpace * modelMatrix * vec4(transformed, 1.0);\ngutterDistance = length(gutterBook.xz);",
        );
        shader.fragmentShader = "uniform float gutterAmount;\nvarying float gutterDistance;\n" + shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          if (gutterAmount > 0.0) {
            float gutter = 1.0 - smoothstep(0.0, 0.16, gutterDistance);
            diffuseColor.rgb *= 1.0 - gutterAmount * gutter * gutter;
          }`,
        );
      };
      material.customProgramCacheKey = () => key() + "_gutter";
      material.needsUpdate = true;
    },
    /** 0 switches it off; Studio uses a gentle value, Simple keeps the artwork untouched. */
    set(value: number) { amount.value = Math.max(0, Math.min(1, value)); },
    /** World-to-book transform, for a book that has been moved or tilted. */
    setSpace(worldToBook: THREE.Matrix4) { space.value.copy(worldToBook); },
  };
}
