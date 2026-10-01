import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import * as THREE from "three";

export const TURN_DURATION = 488;
// World units: one page is 1 wide; overscan keeps the lifted sheet visible
// beyond the original two-page frame without changing the book's layout.
const SIDE_ROOM = 0.7;
const VERTICAL_ROOM = 0.55;
const SEGMENTS = 40;

export type TurnerHandle = {
  /** False when 3D is unavailable; callers then change page without a turn. */
  ready: () => boolean;
  /** Uploads both faces and shows the sheet at progress 0. */
  begin: (front: HTMLCanvasElement, back: HTMLCanvasElement | null, dir: 1 | -1) => void;
  /** Sets drag progress (0–1) directly; no React updates. */
  drag: (p: number) => void;
  /** Animates to 1 (complete) or 0 (cancel) and hides the sheet. */
  release: (complete: boolean, done: (completed: boolean) => void) => void;
};

/**
 * One long-lived curved sheet per book. The WebGL context and shader are
 * created once when Flipbook opens, so a turn only uploads two textures.
 * It draws only while a turn or drag is in progress.
 */
export const CurvedPage = forwardRef<TurnerHandle, { ratio: number }>(function CurvedPage({ ratio }, handle) {
  const mount = useRef<HTMLDivElement>(null);
  const api = useRef<TurnerHandle | null>(null);
  useImperativeHandle(handle, () => ({
    ready: () => !!api.current?.ready(),
    begin: (...a) => api.current?.begin(...a),
    drag: (p) => api.current?.drag(p),
    release: (c, done) => (api.current ? api.current.release(c, done) : done(c)),
  }), []);

  useLayoutEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      api.current = null;
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;pointer-events:none";
    host.appendChild(renderer.domElement);
    const resize = () => renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const scene = new THREE.Scene();
    const distance = 3;
    const viewHeight = ratio + 2 * VERTICAL_ROOM;
    const camera = new THREE.PerspectiveCamera(
      2 * Math.atan(viewHeight / (2 * distance)) * 180 / Math.PI,
      (2 + 2 * SIDE_ROOM) / viewHeight,
      0.01,
      20,
    );
    camera.position.z = distance;
    const positions = new Float32Array((SEGMENTS + 1) * 2 * 3);
    const uvs = new Float32Array((SEGMENTS + 1) * 2 * 2);
    const fwd: number[] = [];
    const bwd: number[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      for (let row = 0; row < 2; row++) {
        const uv = (i * 2 + row) * 2;
        uvs[uv] = i / SEGMENTS;
        uvs[uv + 1] = row === 0 ? 1 : 0;
      }
      if (i < SEGMENTS) {
        const a = i * 2;
        fwd.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        bwd.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    const positionAttribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", positionAttribute);
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    const fwdIndex = new THREE.Uint16BufferAttribute(fwd, 1);
    const bwdIndex = new THREE.Uint16BufferAttribute(bwd, 1);
    geometry.setIndex(fwdIndex);
    const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    blank.needsUpdate = true;
    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { frontPage: { value: blank }, backPage: { value: blank }, direction: { value: 1 } },
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
    // Warm the shader now so the first turn doesn't compile it.
    renderer.compile(scene, camera);

    let dir: 1 | -1 = 1;
    let textures: THREE.Texture[] = [];
    let frame = 0;
    const show = (on: boolean) => (host.style.visibility = on ? "visible" : "hidden");
    show(false);

    const shape = (p: number) => {
      let x = 0;
      let z = 0;
      for (let i = 0; i <= SEGMENTS; i++) {
        if (i) {
          const u = (i - .5) / SEGMENTS;
          const angle = Math.PI * p - Math.sin(Math.PI * p) * .42 * u;
          x += dir * Math.cos(angle) / SEGMENTS;
          z += 1.6 * Math.sin(angle) / SEGMENTS;
        }
        const o = i * 6;
        positions[o] = x;
        positions[o + 1] = ratio / 2;
        positions[o + 2] = z;
        positions[o + 3] = x;
        positions[o + 4] = -ratio / 2;
        positions[o + 5] = z;
      }
      positionAttribute.needsUpdate = true;
      renderer.render(scene, camera);
    };
    const texture = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter;
      renderer.initTexture(t);
      return t;
    };
    let progress = 0;
    api.current = {
      ready: () => true,
      begin: (front, back, d) => {
        cancelAnimationFrame(frame);
        textures.forEach((t) => t.dispose());
        dir = d;
        const f = texture(front);
        const b = back ? texture(back) : f;
        textures = back ? [f, b] : [f];
        material.uniforms["frontPage"]!.value = f;
        material.uniforms["backPage"]!.value = b;
        material.uniforms["direction"]!.value = d;
        geometry.setIndex(d > 0 ? fwdIndex : bwdIndex);
        progress = 0;
        shape(0);
        show(true);
      },
      drag: (p) => {
        progress = Math.max(0, Math.min(1, p));
        shape(progress);
      },
      release: (complete, done) => {
        cancelAnimationFrame(frame);
        const from = progress;
        const to = complete ? 1 : 0;
        const duration = Math.max(120, TURN_DURATION * Math.abs(to - from));
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // Ease-in-out from a full turn; ease-out when continuing a drag.
          const e = from === 0 ? (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) : 1 - Math.pow(1 - t, 3);
          progress = from + (to - from) * e;
          shape(progress);
          if (t < 1) frame = requestAnimationFrame(step);
          else {
            done(complete);
            // Hide on the next frame, after React has committed the new spread.
            frame = requestAnimationFrame(() => show(false));
          }
        };
        frame = requestAnimationFrame(step);
      },
    };
    return () => {
      api.current = null;
      cancelAnimationFrame(frame);
      ro.disconnect();
      textures.forEach((t) => t.dispose());
      blank.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [ratio]);

  return (
    <div
      ref={mount}
      aria-hidden
      className="pointer-events-none absolute z-[3]"
      style={{
        visibility: "hidden",
        left: `${-SIDE_ROOM * 50}%`,
        width: `${(2 + 2 * SIDE_ROOM) * 50}%`,
        top: `${-VERTICAL_ROOM / ratio * 100}%`,
        height: `${(1 + 2 * VERTICAL_ROOM / ratio) * 100}%`,
      }}
    />
  );
});
