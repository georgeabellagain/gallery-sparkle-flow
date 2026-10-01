import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import * as THREE from "three";

export const TURN_DURATION = 488;
// World units: one page is 1 wide; overscan keeps the lifted sheet visible
// beyond the original two-page frame without changing the book's layout.
const SIDE_ROOM = 0.7;
const VERTICAL_ROOM = 0.55;
const SEGMENTS = 40;

/** Studio surface for the moving sheet: neutral-grey relief tile plus sheen. */
export type SheetMaterial = { surface: HTMLCanvasElement; sheen: number; repeat: number };

export type TurnerHandle = {
  /** False when 3D is unavailable; callers then change page without a turn. */
  ready: () => boolean;
  /** Uploads both faces and shows the sheet at progress 0. */
  begin: (front: HTMLCanvasElement, back: HTMLCanvasElement | null, dir: 1 | -1, material?: SheetMaterial) => void;
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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
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
      toneMapped: false,
      uniforms: { frontPage: { value: blank }, backPage: { value: blank }, surface: { value: blank }, surfaceOn: { value: 0 }, surfaceRepeat: { value: 4 }, sheen: { value: 0 }, direction: { value: 1 }, turnProgress: { value: 0 } },
      vertexShader: "varying vec2 vUv; varying float vFold; uniform float turnProgress; void main() { vUv = uv; vFold = sin(3.14159265 * uv.x) * sin(3.14159265 * turnProgress); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform sampler2D frontPage; uniform sampler2D backPage; uniform sampler2D surface; uniform float surfaceOn; uniform float surfaceRepeat; uniform float sheen; uniform float direction;
        varying vec2 vUv; varying float vFold;
        void main() {
          vec2 frontUv = vec2(direction > 0.0 ? vUv.x : 1.0 - vUv.x, vUv.y);
          vec2 backUv = vec2(direction > 0.0 ? 1.0 - vUv.x : vUv.x, vUv.y);
          vec4 page = gl_FrontFacing ? texture2D(frontPage, frontUv) : texture2D(backPage, backUv);
          if (surfaceOn > 0.5) {
            float b = texture2D(surface, fract(vUv * vec2(surfaceRepeat, surfaceRepeat * 1.4))).r;
            page.rgb = mix(page.rgb, (1.0 - 2.0 * b) * page.rgb * page.rgb + 2.0 * b * page.rgb, 0.22);
            // Satin catches a restrained moving highlight along the bend.
            page.rgb += sheen * pow(vFold, 3.0) * 0.12;
          }
          page.rgb *= 1.0 - 0.045 * vFold;
          gl_FragColor = page;
          #include <colorspace_fragment>
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
          const angle = Math.PI * p - Math.sin(Math.PI * p) * .72 * u;
          x += dir * Math.cos(angle) / SEGMENTS;
          z += 1.9 * Math.sin(angle) / SEGMENTS;
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
      material.uniforms["turnProgress"]!.value = p;
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
    const surfaceTextures = new Map<HTMLCanvasElement, THREE.Texture>();
    api.current = {
      ready: () => true,
      begin: (front, back, d, mat) => {
        cancelAnimationFrame(frame);
        textures.forEach((t) => t.dispose());
        dir = d;
        const f = texture(front);
        const b = back ? texture(back) : f;
        textures = back ? [f, b] : [f];
        material.uniforms["frontPage"]!.value = f;
        material.uniforms["backPage"]!.value = b;
        material.uniforms["direction"]!.value = d;
        if (mat) {
          let st = surfaceTextures.get(mat.surface);
          if (!st) {
            st = new THREE.CanvasTexture(mat.surface);
            st.wrapS = st.wrapT = THREE.RepeatWrapping;
            surfaceTextures.set(mat.surface, st);
          }
          material.uniforms["surface"]!.value = st;
          material.uniforms["surfaceRepeat"]!.value = mat.repeat;
          material.uniforms["sheen"]!.value = mat.sheen;
        }
        material.uniforms["surfaceOn"]!.value = mat ? 1 : 0;
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
      surfaceTextures.forEach((t) => t.dispose());
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
