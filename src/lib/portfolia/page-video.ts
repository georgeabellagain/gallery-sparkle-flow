import * as THREE from "three";

/** The video shown in a page face: its element, and its box in the face's texture coordinates [left, bottom, right, top]. */
export type PageVideoSource = { video: HTMLVideoElement; rect: readonly [number, number, number, number] };

/** A page box (fractions from the top-left) in texture coordinates, which run from the bottom-left. */
export function videoUvRect(box: { x: number; y: number; width: number; height: number }): [number, number, number, number] {
  return [box.x, 1 - (box.y + box.height), box.x + box.width, 1 - box.y];
}

/** Shader text added to a page material: replaces the printed still with the playing video inside its box. */
export const PAGE_VIDEO_FRAGMENT = {
  uniforms: "uniform sampler2D pageVideoMap;\nuniform vec4 pageVideoRect;\nuniform float pageVideoOn;\nuniform sampler2D pageLayerMap;\nuniform float pageLayerOn;\n",
  // After the page picture is sampled: the video is part of the paper's colour, so lighting, the gutter shade and
  // the paper finish all apply to it exactly as to the print around it.
  afterMap: `
  vec3 pageVideoColour = vec3(0.0);
  float pageVideoIn = 0.0;
  #ifdef USE_MAP
  if (pageVideoOn > 0.5) {
    vec2 pageVideoQ = (vMapUv - pageVideoRect.xy) / max(pageVideoRect.zw - pageVideoRect.xy, vec2(1e-5));
    if (pageVideoQ.x >= 0.0 && pageVideoQ.x <= 1.0 && pageVideoQ.y >= 0.0 && pageVideoQ.y <= 1.0) {
      pageVideoColour = texture2D(pageVideoMap, pageVideoQ).rgb;
      pageVideoIn = 1.0;
      diffuseColor.rgb = diffuse * pageVideoColour;
    }
  }
  #endif
  // Stickers drawn over the page while the flat overlay is away (turning, tilted), so they move with the paper.
  vec4 pageLayer = vec4(0.0);
  #ifdef USE_MAP
  if (pageLayerOn > 0.5) {
    pageLayer = texture2D(pageLayerMap, vMapUv);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * pageLayer.rgb, pageLayer.a);
  }
  #endif`,
  // Simple mode shows the page through the emissive channel, so the video replaces it there too.
  afterEmissive: "\nif (pageVideoIn > 0.5) totalEmissiveRadiance = emissive * pageVideoColour;\nif (pageLayer.a > 0.0) totalEmissiveRadiance = mix(totalEmissiveRadiance, emissive * pageLayer.rgb, pageLayer.a);",
};

/**
 * Plays page videos on the book's page materials. BookView supplies which video belongs to a page picture;
 * a face shows its video only once a frame is ready, so until then (and where motion is off) the printed still shows.
 */
export function createPageVideo() {
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  const clear = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  clear.needsUpdate = true;
  const textures = new WeakMap<HTMLVideoElement, THREE.VideoTexture>();
  type State = { map: { value: THREE.Texture }; rect: { value: THREE.Vector4 }; on: { value: number }; canvas: HTMLCanvasElement | null; source: PageVideoSource | null; layerMap: { value: THREE.Texture }; layerOn: { value: number }; layer: HTMLCanvasElement | null };
  const states = new Map<THREE.Material, State>();
  let lookup: (canvas: HTMLCanvasElement) => PageVideoSource | null = () => null;
  let layerLookup: (canvas: HTMLCanvasElement) => HTMLCanvasElement | null = () => null;
  let layerShown = false;
  // One texture per sticker layer in use; a layer no face shows any more frees its texture.
  const layerTextures = new Map<HTMLCanvasElement, THREE.CanvasTexture>();
  const layerTexture = (layer: HTMLCanvasElement) => {
    let t = layerTextures.get(layer);
    if (!t) {
      t = new THREE.CanvasTexture(layer);
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      layerTextures.set(layer, t);
    }
    return t;
  };
  const refreshLayer = (s: State) => {
    s.layerOn.value = s.layer && layerShown ? 1 : 0;
    s.layerMap.value = s.layer ? layerTexture(s.layer) : clear;
  };
  const pruneLayers = () => {
    const used = new Set([...states.values()].map((s) => s.layer));
    for (const [layer, t] of layerTextures) if (!used.has(layer)) { t.dispose(); layerTextures.delete(layer); }
  };
  let still = false;
  const textureOf = (video: HTMLVideoElement) => {
    let t = textures.get(video);
    if (!t) {
      t = new THREE.VideoTexture(video);
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      textures.set(video, t);
    }
    return t;
  };
  const refresh = (s: State) => {
    const ready = Boolean(s.source && !still && s.source.video.readyState >= 2 && s.source.video.videoWidth > 0);
    s.on.value = ready ? 1 : 0;
    s.map.value = ready ? textureOf(s.source!.video) : blank;
    if (s.source) s.rect.value.set(...s.source.rect);
  };
  return {
    apply(material: THREE.Material) {
      if (material.userData["pageVideo"]) return;
      material.userData["pageVideo"] = true;
      const state: State = { map: { value: blank }, rect: { value: new THREE.Vector4(0, 0, 0, 0) }, on: { value: 0 }, canvas: null, source: null, layerMap: { value: clear }, layerOn: { value: 0 }, layer: null };
      states.set(material, state);
      const previous = material.onBeforeCompile, key = material.customProgramCacheKey.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.uniforms["pageVideoMap"] = state.map;
        shader.uniforms["pageVideoRect"] = state.rect;
        shader.uniforms["pageVideoOn"] = state.on;
        shader.uniforms["pageLayerMap"] = state.layerMap;
        shader.uniforms["pageLayerOn"] = state.layerOn;
        shader.fragmentShader = PAGE_VIDEO_FRAGMENT.uniforms + shader.fragmentShader
          .replace("#include <map_fragment>", "#include <map_fragment>" + PAGE_VIDEO_FRAGMENT.afterMap)
          .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>" + PAGE_VIDEO_FRAGMENT.afterEmissive);
      };
      material.customProgramCacheKey = () => key() + "_pagevideo";
      material.needsUpdate = true;
    },
    /** Called whenever a page picture is put on a material. */
    assign(material: THREE.Material, canvas: HTMLCanvasElement | null) {
      const s = states.get(material);
      if (!s) return;
      s.canvas = canvas;
      s.source = canvas ? lookup(canvas) : null;
      refresh(s);
      s.layer = canvas ? layerLookup(canvas) : null;
      refreshLayer(s);
      pruneLayers();
    },
    /** Which video belongs to a page picture; re-reads every face. */
    setLookup(next: (canvas: HTMLCanvasElement) => PageVideoSource | null) {
      lookup = next;
      for (const s of states.values()) { s.source = s.canvas ? lookup(s.canvas) : null; refresh(s); }
    },
    /** Which sticker layer (a transparent picture the size of the face) belongs to a page picture; re-reads every face. */
    setLayerLookup(next: (canvas: HTMLCanvasElement) => HTMLCanvasElement | null) {
      layerLookup = next;
      for (const s of states.values()) { s.layer = s.canvas ? layerLookup(s.canvas) : null; refreshLayer(s); }
      pruneLayers();
    },
    /** Sticker layers show only while the flat overlay of moving stickers is away (turning, tilted, preparing). */
    setLayerShown(value: boolean) { layerShown = value; for (const s of states.values()) refreshLayer(s); },
    /** Reduced motion and exports show only the printed stills. */
    setStill(value: boolean) { still = value; for (const s of states.values()) refresh(s); },
    /** Before each frame: faces whose video has become ready start showing it. */
    update() { for (const s of states.values()) if (s.source) refresh(s); },
    dispose() { blank.dispose(); clear.dispose(); for (const t of layerTextures.values()) t.dispose(); layerTextures.clear(); states.clear(); },
  };
}
