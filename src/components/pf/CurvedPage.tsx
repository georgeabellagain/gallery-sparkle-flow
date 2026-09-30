import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";

/** One continuous textured surface, curved on the GPU without separate DOM strips. */
export function CurvedPage({ front, back, direction, ratio, onFinish }: {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement | null;
  direction: 1 | -1;
  ratio: number;
  onFinish: () => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const finish = useRef(onFinish);
  finish.current = onFinish;

  useLayoutEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      // Keep navigation usable if WebGL is disabled.
      const fallback = window.setTimeout(() => finish.current(), 390);
      return () => window.clearTimeout(fallback);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;pointer-events:none";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const distance = 3;
    const camera = new THREE.PerspectiveCamera(2 * Math.atan(ratio / (2 * distance)) * 180 / Math.PI, 2 / ratio, 0.01, 20);
    camera.position.z = distance;
    const segments = 40;
    const positions = new Float32Array((segments + 1) * 2 * 3);
    const uvs = new Float32Array((segments + 1) * 2 * 2);
    const indices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      for (let row = 0; row < 2; row++) {
        const uv = (i * 2 + row) * 2;
        uvs[uv] = i / segments;
        uvs[uv + 1] = row === 0 ? 1 : 0;
      }
      if (i < segments) {
        const a = i * 2;
        if (direction > 0) indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        else indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    const frontTexture = new THREE.CanvasTexture(front);
    const backTexture = new THREE.CanvasTexture(back ?? front);
    frontTexture.colorSpace = THREE.SRGBColorSpace;
    backTexture.colorSpace = THREE.SRGBColorSpace;
    frontTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    backTexture.anisotropy = frontTexture.anisotropy;
    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { frontPage: { value: frontTexture }, backPage: { value: backTexture }, direction: { value: direction } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform sampler2D frontPage; uniform sampler2D backPage; uniform float direction;
        varying vec2 vUv;
        void main() {
          vec2 frontUv = vec2(direction > 0.0 ? vUv.x : 1.0 - vUv.x, vUv.y);
          vec2 backUv = vec2(direction > 0.0 ? 1.0 - vUv.x : vUv.x, vUv.y);
          gl_FragColor = gl_FrontFacing ? texture2D(frontPage, frontUv) : texture2D(backPage, backUv);
        }`,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const duration = 390;
    const start = performance.now();
    let frame = 0;
    let stopped = false;
    const draw = (now: number) => {
      if (stopped) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      let x = 0;
      let z = 0;
      for (let i = 0; i <= segments; i++) {
        if (i) {
          const u = (i - .5) / segments;
          const angle = Math.PI * eased - Math.sin(Math.PI * eased) * .42 * u;
          x -= direction * Math.cos(angle) / segments;
          z += Math.sin(angle) / segments;
        }
        const offset = i * 6;
        positions[offset] = x;
        positions[offset + 1] = ratio / 2;
        positions[offset + 2] = z;
        positions[offset + 3] = x;
        positions[offset + 4] = -ratio / 2;
        positions[offset + 5] = z;
      }
      geometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
      if (t < 1) frame = requestAnimationFrame(draw);
      else finish.current();
    };
    frame = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      geometry.dispose();
      material.dispose();
      frontTexture.dispose();
      backTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [front, back, direction, ratio]);

  return <div ref={mount} aria-hidden className="pointer-events-none absolute inset-0 z-[3] overflow-visible" />;
}