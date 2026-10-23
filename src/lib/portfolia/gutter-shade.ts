import * as THREE from "three";
import { SHADE_STYLE_GLSL, shadeStyleUniform } from "./shade-style";

/**
 * Soft ambient occlusion where paper curves into the spine, the strongest cue that pages are bound.
 * Distance is measured from the spine axis in book space, so an upright turning sheet is only shaded
 * along its hinge, never across its whole face. `setSpace` maps world space into book space when the
 * book itself is moved (the photo shoot); the reader's book never moves, so it keeps the identity.
 */
export function createGutterShade() {
  const amount = { value: 0 }, width = { value: .16 }, space = { value: new THREE.Matrix4() };
  return {
    apply(material: THREE.Material) {
      if (material.userData["gutterShade"]) return;
      material.userData["gutterShade"] = true;
      const previous = material.onBeforeCompile, key = material.customProgramCacheKey.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.uniforms["gutterAmount"] = amount;
        shader.uniforms["gutterSpace"] = space;
        shader.uniforms["gutterWidth"] = width;
        shader.uniforms["shadeStyle"] = shadeStyleUniform;
        shader.vertexShader = "uniform mat4 gutterSpace;\nvarying float gutterDistance;\nvarying vec2 gutterPoint;\n" + shader.vertexShader.replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvec4 gutterBook = gutterSpace * modelMatrix * vec4(transformed, 1.0);\ngutterDistance = length(gutterBook.xz);\ngutterPoint = gutterBook.xy;",
        );
        // Simple draws the artwork through the emissive channel (unlit), so the shade darkens both. Its style
        // (smooth, stippled, hatched...) comes from shade-style.
        shader.fragmentShader = "uniform float gutterAmount;\nuniform float gutterWidth;\nvarying float gutterDistance;\nvarying vec2 gutterPoint;\n" + SHADE_STYLE_GLSL + shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float gutterShadeK = 1.0;
          if (gutterAmount > 0.0) {
            float gutter = 1.0 - smoothstep(0.0, gutterWidth, gutterDistance);
            gutterShadeK = styledShade(gutterAmount * gutter * gutter, gutterPoint);
            diffuseColor.rgb *= gutterShadeK;
          }`,
        ).replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= gutterShadeK;");
      };
      material.customProgramCacheKey = () => key() + "_gutter";
      material.needsUpdate = true;
    },
    /** 0 switches it off. Width is how far from the spine (book units) the shade fades out. */
    set(value: number, fade = .16) { amount.value = Math.max(0, Math.min(1, value)); width.value = Math.max(.01, fade); },
    /** World-to-book transform, for a book that has been moved or tilted. */
    setSpace(worldToBook: THREE.Matrix4) { space.value.copy(worldToBook); },
  };
}
