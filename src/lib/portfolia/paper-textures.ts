import * as THREE from "three";
import { paperFinish, type SurfaceKind } from "./surface";

export type PaperMaps = { colour: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture };
export function paperTextureId(kind: SurfaceKind) {
  return kind === "paper_0022" || kind === "paper_0027" ? kind : undefined;
}
const effects = new WeakMap<THREE.MeshStandardMaterial, { enabled: {value:number}; colour: {value:THREE.Texture}; transform: {value:THREE.Matrix3} }>();
/** Keep the PDF as the primary map: paper tint affects pale stock, not dark ink. */
export function applyPaperMaps(material: THREE.MeshStandardMaterial, kind: SurfaceKind, maps?: PaperMaps) {
  const active = Boolean(paperTextureId(kind) && maps);
  const dynamic = active;
  const changed = Boolean(material.normalMap) !== dynamic || Boolean(material.roughnessMap) !== dynamic;
  material.normalMap = dynamic ? maps!.normal : null;
  const strength = kind === "paper_0022" ? -.16 : .29;
  material.normalScale.set(strength, strength);
  material.roughnessMap = dynamic ? maps!.roughness : null;
  material.roughness = dynamic ? 1 : paperFinish(kind) === "satin" ? .42 : .97;
  let effect = effects.get(material);
  if (active && !effect) {
    effect = {enabled:{value:1},colour:{value:maps!.colour},transform:{value:maps!.colour.matrix}};
    effects.set(material,effect);
    const uniforms = effect, previous = material.onBeforeCompile, key = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      shader.uniforms["paperTextureEnabled"] = uniforms.enabled;
      shader.uniforms["paperStockColour"] = uniforms.colour;
      shader.uniforms["paperStockTransform"] = uniforms.transform;
      shader.vertexShader = "uniform mat3 paperStockTransform;\nvarying vec2 paperStockUv;\n" + shader.vertexShader.replace("#include <uv_vertex>","#include <uv_vertex>\npaperStockUv = (paperStockTransform * vec3(uv, 1.0)).xy;");
      shader.fragmentShader = "uniform float paperTextureEnabled;\nuniform sampler2D paperStockColour;\nvarying vec2 paperStockUv;\n" + shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
        float paperInkLuma = dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        // Keep printed colour clear of decorative tint, especially
        // when small text approaches a screen pixel. Reuse the PDF sample.
        float paperStockMask = paperTextureEnabled * smoothstep(.6,.95,paperInkLuma)
          * (1.0-smoothstep(.015,.12,fwidth(paperInkLuma)));
        if (paperTextureEnabled > 0.0) {
          diffuseColor.rgb *= mix(vec3(1.0),texture2D(paperStockColour,paperStockUv).rgb,paperStockMask*.3);
        }`)
        .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
          // Uncoated stock stays rough. Ink edges must not switch surface
          // roughness or create a narrow glossy halo.
          if (paperTextureEnabled > 0.0) roughnessFactor = mix(.8,.98,clamp(roughnessFactor,0.0,1.0));`)
        .replace("#include <lights_physical_fragment>", `#include <lights_physical_fragment>
          // Dark printed ink should not acquire white dielectric highlights.
          // Keep normals independent of PDF pixels and screen-space edges.
          if (paperTextureEnabled > 0.0) {
            float paperInkSpecular = mix(.04,.5,smoothstep(.08,.6,paperInkLuma));
            material.specularColor *= paperInkSpecular;
            material.specularF90 *= paperInkSpecular;
          }`);
    };
    material.customProgramCacheKey = () => key() + "_paper_stock";
    material.needsUpdate = true;
  }
  if (effect) { effect.enabled.value = active ? 1 : 0; if (active) { effect.colour.value = maps!.colour; effect.transform.value = maps!.colour.matrix; } }
  if (changed) material.needsUpdate = true;
}

/** One prepared set per stock per renderer; page turns share these GPU maps. */
export function createPaperTextures(repaint: () => void) {
  const cache = new Map<string, PaperMaps>();
  const pending = new Map<string, Promise<void>>();
  const materials = new Map<THREE.MeshStandardMaterial, SurfaceKind>();
  const loader = new THREE.TextureLoader();
  let disposed = false;
  const apply = (material: THREE.MeshStandardMaterial, kind: SurfaceKind) => {
    if (disposed) return;
    if (!materials.has(material)) material.addEventListener("dispose", () => materials.delete(material));
    materials.set(material, kind);
    const id = paperTextureId(kind);
    applyPaperMaps(material, kind, id ? cache.get(id) : undefined);
    if (!id || cache.has(id) || pending.has(id)) return;
    const textures: THREE.Texture[] = [];
    let failed = false;
    const job = Promise.all(["colour", "normal", "roughness"].map(async name => {
      const t = await loader.loadAsync(`/studio/paper/${id}-${name}.webp`);
      if (disposed || failed) { t.dispose(); throw new Error("Paper texture preparation cancelled"); }
      textures.push(t);
      t.colorSpace = name === "colour" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 4;
      if (id === "paper_0022") { t.repeat.set(.5,.5); t.offset.set(.25,.25); t.updateMatrix(); }
      return t;
    })).then(([colour,normal,roughness]) => {
      if (disposed) { textures.forEach(t=>t.dispose()); return; }
      const maps: PaperMaps = {colour:colour!,normal:normal!,roughness:roughness!}; cache.set(id,maps);
      for (const [m,k] of materials) if (k===id) applyPaperMaps(m,k,maps);
      repaint();
    }).catch(() => { failed = true; textures.forEach(t=>t.dispose()); });
    pending.set(id,job);
  };
  return { apply, release(material: THREE.MeshStandardMaterial) { materials.delete(material); },
    async ready() { await Promise.all(pending.values()); },
    dispose() { disposed=true;materials.clear();cache.forEach(m=>new Set(Object.values(m)).forEach(t=>t.dispose()));cache.clear(); },
  };
}
