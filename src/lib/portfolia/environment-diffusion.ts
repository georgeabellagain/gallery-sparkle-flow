import * as THREE from "three";

/** Average radiance over a sphere, retaining the selected environment's colour and energy. */
export function averageEnvironment(rgb: Float32Array, width: number, height: number): [number, number, number] {
  const sums = [0, 0, 0]; let total = 0;
  for (let y = 0; y < height; y++) {
    const weight = Math.sin(Math.PI * (y + .5) / height);
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      for (let c = 0; c < 3; c++) sums[c]! += Math.min(60000, Math.max(0, rgb[offset + c]!)) * weight;
      total += weight;
    }
  }
  return sums.map(value => value / Math.max(1e-9, total)) as [number, number, number];
}

/** Blend prefiltered HDRI radiance towards its solid average colour on the GPU. */
export function createEnvironmentDiffuser(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: { source: { value: null }, strength: { value: 1 }, colour: { value: new THREE.Vector3(.285, .285, .285) } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: 'uniform sampler2D source;uniform float strength;uniform vec3 colour;varying vec2 vUv;void main(){gl_FragColor=vec4(mix(colour,texture2D(source,vUv).rgb,strength),1.);}',
    depthTest: false, depthWrite: false, toneMapped: false,
  });
  const geometry = new THREE.PlaneGeometry(2, 2); scene.add(new THREE.Mesh(geometry, material));
  let output: THREE.WebGLRenderTarget | null = null;
  let lastBlend = "";
  return {
    apply(source: THREE.WebGLRenderTarget, strength: number, colour: readonly number[] = [.285, .285, .285]) {
      const amount = Math.max(0, Math.min(1, strength));
      if (amount === 1) return source.texture;
      const key = `${source.texture.uuid}|${source.width}|${source.height}|${amount}|${colour.join(",")}`;
      if (output && lastBlend === key) return output.texture;
      if (!output || output.width !== source.width || output.height !== source.height) {
        output?.dispose();
        output = new THREE.WebGLRenderTarget(source.width, source.height, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false });
        output.texture.mapping = THREE.CubeUVReflectionMapping;
        output.texture.colorSpace = source.texture.colorSpace;
      }
      material.uniforms["source"]!.value = source.texture; material.uniforms["strength"]!.value = amount;
      material.uniforms["colour"]!.value.set(colour[0], colour[1], colour[2]);
      const previous = renderer.getRenderTarget();
      try { renderer.setRenderTarget(output); renderer.render(scene, camera); }
      finally { renderer.setRenderTarget(previous); }
      lastBlend = key;
      return output.texture;
    },
    reset() { output?.dispose(); output = null; lastBlend = ""; },
    dispose() { output?.dispose(); output = null; lastBlend = ""; material.dispose(); geometry.dispose(); },
  };
}
