import * as THREE from "three";

/** Viewer-only lighting approximation. Reuses the already convolved HDRI's diffuse
 * mip, with no glossy environment lookup, BRDF LUT or microfacet evaluation.
 * Keep Three's light projection and normal-map plumbing so cookies, paper grain,
 * back faces and camera rotation stay attached to the actual curved surface.
 * Photoshoot materials never opt into this patch. */
export const FAST_STUDIO_LIGHTING = `
#undef RE_Direct
#undef RE_IndirectSpecular
void fastStudioDirect(const in IncidentLight light, const in vec3 position,
  const in vec3 normal, const in vec3 viewDir, const in vec3 clearcoatNormal,
  const in PhysicalMaterial material, inout ReflectedLight reflected) {
  float facing = saturate(dot(normal, light.direction));
  reflected.directDiffuse += light.color * facing * material.diffuseContribution * RECIPROCAL_PI;
  // A modest, broad satin glint. Roughness maps still affect the finish, and
  // paper's existing ink protection still controls its specular colour.
  vec3 halfVector = normalize(light.direction + viewDir + vec3(0.000001));
  float glint = pow(saturate(dot(normal, halfVector)), mix(48.0, 6.0, material.roughness));
  reflected.directSpecular += light.color * facing * material.specularColor
    * glint * (1.0 - material.roughness);
}
#define RE_Direct fastStudioDirect
`;

export function fastStudioFragment(fragment: string) {
  return fragment
    .replace("#include <lights_physical_pars_fragment>",
      "#include <lights_physical_pars_fragment>\n" + FAST_STUDIO_LIGHTING)
    // This block only feeds the physical multi-scattering equations. Removing
    // it also removes the per-pixel DFG lookup, even on recent Three versions.
    .replace("#include <lights_fragment_begin>", THREE.ShaderChunk.lights_fragment_begin.replace(
      /#ifdef STANDARD[\s\S]*?(?=IncidentLight directLight;)/, ""))
    .replace("#include <lights_fragment_end>", `
      reflectedLight.indirectDiffuse += (irradiance + iblIrradiance)
        * material.diffuseContribution * RECIPROCAL_PI;
      // Cheap ambient sheen using the same diffuse lookup; no second environment
      // sample. Deliberately subdued so satin does not bleach printed content.
      float fastRim = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 3.0);
      reflectedLight.indirectSpecular += iblIrradiance * RECIPROCAL_PI
        * material.specularColor * (1.0 - material.roughness) * (0.25 + fastRim);
    `);
}

const attached = new WeakSet<THREE.MeshStandardMaterial>();
export function applyFastStudio(material: THREE.MeshStandardMaterial) {
  if (attached.has(material)) return;
  attached.add(material);
  const previous = material.onBeforeCompile, key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.fragmentShader = fastStudioFragment(shader.fragmentShader);
  };
  material.customProgramCacheKey = () => key() + "_fast_studio_v1";
  material.needsUpdate = true;
}
