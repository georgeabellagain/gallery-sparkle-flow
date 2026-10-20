import * as THREE from "three";

/** Average radiance over a sphere (kept with the lighting preparation, which also runs in a worker). */
export { averageEnvironment } from "./environment-pixels";

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
  const blends = new Map<string, THREE.WebGLRenderTarget>();
  const clear = () => { blends.forEach(target => target.dispose()); blends.clear(); };
  return {
    apply(source: THREE.WebGLRenderTarget, strength: number, colour: readonly number[] = [.285, .285, .285]) {
      const amount = Math.max(0, Math.min(1, strength));
      if (amount === 1) return source.texture;
      const key = `${source.texture.uuid}:${source.texture.version}|${source.width}|${source.height}|${amount}|${colour.join(",")}`;
      const cached = blends.get(key);
      if (cached) { blends.delete(key); blends.set(key, cached); return cached.texture; }
      const output = new THREE.WebGLRenderTarget(source.width, source.height, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false });
      output.texture.mapping = THREE.CubeUVReflectionMapping;
      output.texture.colorSpace = source.texture.colorSpace;
      material.uniforms["source"]!.value = source.texture; material.uniforms["strength"]!.value = amount;
      material.uniforms["colour"]!.value.set(colour[0], colour[1], colour[2]);
      const previous = renderer.getRenderTarget();
      try { renderer.setRenderTarget(output); renderer.render(scene, camera); }
      catch (error) { output.dispose(); throw error; }
      finally { renderer.setRenderTarget(previous); }
      blends.set(key, output);
      while (blends.size > 4) { const oldest = blends.keys().next().value!; blends.get(oldest)!.dispose(); blends.delete(oldest); }
      return output.texture;
    },
    reset: clear,
    dispose() { clear(); material.dispose(); geometry.dispose(); },
  };
}
