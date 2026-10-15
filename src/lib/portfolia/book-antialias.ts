import * as THREE from "three";

/** Explicit 2x MSAA, instead of the browser's usually 4x/8x default framebuffer. No FXAA text filtering. */
export function createBookAntialias(renderer: THREE.WebGLRenderer, capture = false) {
  const target = Object.assign(new THREE.WebGLRenderTarget(1, 1, { samples: Math.min(capture ? 4 : 2, renderer.capabilities.maxSamples), depthBuffer: true }), {isXRRenderTarget: true});
  // This is a direct display target: retain per-material tone mapping (including
  // unlit backdrops), rather than tone mapping the entire composited picture.
  target.texture.colorSpace = renderer.outputColorSpace;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([-1,-1,0, 3,-1,0, -1,3,0],3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0,0, 2,0, 0,2],2));
  const material = new THREE.RawShaderMaterial({
    uniforms: {image:{value:target.texture}},
    vertexShader: "precision highp float; attribute vec3 position; attribute vec2 uv; varying vec2 coord; void main(){coord=uv;gl_Position=vec4(position,1.0);}",
    // Direct display targets store already encoded output in RGBA8. Copy it verbatim,
    // including premultiplied alpha, without a second gamma/tone-mapping conversion.
    fragmentShader: "precision highp float; uniform sampler2D image; varying vec2 coord; void main(){gl_FragColor=texture2D(image,coord);}",
    depthTest:false, depthWrite:false, toneMapped:false, blending:THREE.NoBlending});
  const scene = new THREE.Scene(); scene.add(new THREE.Mesh(geometry, material));
  const camera = new THREE.Camera(), size = new THREE.Vector2();
  return {
    render(world: THREE.Scene, view: THREE.Camera) {
      renderer.getDrawingBufferSize(size);
      if(target.width!==size.x || target.height!==size.y) target.setSize(size.x,size.y);
      renderer.setRenderTarget(target); renderer.render(world,view);
      renderer.setRenderTarget(null); renderer.render(scene,camera);
    },
    dispose() {target.dispose();geometry.dispose();material.dispose();},
  };
}
