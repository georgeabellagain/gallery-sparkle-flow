import * as THREE from "three";

/** Fold the fixed spotlight cone into its projected brightness texture once.
 * Direction, surface response and moving occlusion remain live, so curved paper
 * receives the same projection as the original light. This is not screen-space. */
export function coneBrightness(u: number, v: number, angle: number, penumbra: number) {
  const tangent = Math.tan(angle);
  const cosine = 1 / Math.sqrt(1 + ((2*u-1)**2 + (2*v-1)**2) * tangent*tangent);
  const outer = Math.cos(angle), inner = Math.cos(angle * (1-penumbra));
  const t = Math.max(0, Math.min(1, (cosine-outer) / Math.max(1e-8, inner-outer)));
  return t*t*(3-2*t);
}

// Immutable CPU pixels only. Each renderer owns/disposes its GPU texture.
const masks = new Map<string, {data: Uint16Array; width: number; height: number}>();
export function bakeBrightnessMask(pixels: Uint8ClampedArray, width: number, height: number, angle: number, penumbra: number) {
  const data = new Uint16Array(width*height*4);
  const colour = new THREE.Color();
  for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
    const offset = (y*width+x)*4;
    const attenuation = coneBrightness((x+.5)/width, 1-(y+.5)/height, angle, penumbra);
    colour.setRGB(pixels[offset]!/255,pixels[offset+1]!/255,pixels[offset+2]!/255,THREE.SRGBColorSpace);
    data[offset] = THREE.DataUtils.toHalfFloat(colour.r*attenuation);
    data[offset+1] = THREE.DataUtils.toHalfFloat(colour.g*attenuation);
    data[offset+2] = THREE.DataUtils.toHalfFloat(colour.b*attenuation);
    data[offset+3] = THREE.DataUtils.toHalfFloat(1);
  }
  return data;
}

export function createCachedLightMask(enabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("lightingMask") === "1") {
  const placeholder = new THREE.DataTexture(new Uint16Array(4),1,1,THREE.RGBAFormat,THREE.HalfFloatType);
  placeholder.needsUpdate = true;
  // Opt-in trial: the production appearance stays available for direct comparison.
  const uniforms = { cachedLightMask: {value: placeholder}, cachedLightMaskEnabled: {value: false} };
  const textures = new Map<string, THREE.DataTexture>();
  const attached = new WeakSet<THREE.Material>();
  return {
    set(key: string, source: THREE.CanvasTexture | null, angle: number, penumbra: number) {
      uniforms.cachedLightMaskEnabled.value = enabled && Boolean(source);
      if (!source || !enabled) return;
      const stamp = `${key}|${angle}|${penumbra}`;
      let texture = textures.get(stamp);
      if (!texture) {
        let hit = masks.get(stamp);
        if (!hit) {
          const canvas = source.image as HTMLCanvasElement;
          const pixels = canvas.getContext("2d")!.getImageData(0,0,canvas.width,canvas.height).data;
          hit = { data: bakeBrightnessMask(pixels,canvas.width,canvas.height,angle,penumbra), width: canvas.width, height: canvas.height };
          masks.set(stamp,hit);
          while (masks.size>4) masks.delete(masks.keys().next().value!);
        } else { masks.delete(stamp); masks.set(stamp,hit); }
        texture = new THREE.DataTexture(hit.data,hit.width,hit.height,THREE.RGBAFormat,THREE.HalfFloatType);
        texture.flipY = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true; texture.needsUpdate = true;
        textures.set(stamp,texture);
      }
      uniforms.cachedLightMask.value = texture;
    },
    apply(material: THREE.MeshStandardMaterial) {
      if (!enabled || attached.has(material)) return;
      attached.add(material);
      const previous = material.onBeforeCompile, key = material.customProgramCacheKey.bind(material);
      material.onBeforeCompile = (shader,renderer) => {
        previous.call(material,shader,renderer);
        Object.assign(shader.uniforms,uniforms);
        const lights = THREE.ShaderChunk.lights_fragment_begin
          .replace("getSpotLightInfo( spotLight, geometryPosition, directLight );", `
            // The fixed cone attenuation is already in our cached mask.
            // This scene has exactly one projected spotlight. Other layouts use
            // Three's original path instead of applying this mask to another light.
            #if NUM_SPOT_LIGHTS == 1
            if (cachedLightMaskEnabled) {
              directLight.direction = normalize(spotLight.position-geometryPosition);
              directLight.color = spotLight.color;
              directLight.visible = true;
            } else
            #endif
            { getSpotLightInfo( spotLight, geometryPosition, directLight ); }
          `)
          .replace("spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );", `
            #if NUM_SPOT_LIGHTS == 1
            if (cachedLightMaskEnabled) {
              spotColor = texture2D(cachedLightMask,spotLightCoord.xy);
              // Three leaves the cookie unapplied outside its projection volume.
              // Restore its exact cone calculation there, including near/far caps.
              if (!inSpotLightMap) getSpotLightInfo(spotLight,geometryPosition,directLight);
            } else
            #endif
            { spotColor = texture2D(spotLightMap[SPOT_LIGHT_MAP_INDEX],spotLightCoord.xy); }
          `);
        shader.fragmentShader = "uniform sampler2D cachedLightMask;\nuniform bool cachedLightMaskEnabled;\n" + shader.fragmentShader.replace("#include <lights_fragment_begin>",lights);
      };
      material.customProgramCacheKey = () => key()+"_cached_light_mask_v1";
      material.needsUpdate = true;
    },
    dispose() { placeholder.dispose(); textures.forEach(texture=>texture.dispose()); textures.clear(); },
  };
}
