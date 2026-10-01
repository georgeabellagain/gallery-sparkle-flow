import * as THREE from "three";
import { surfaceCanvas, type SurfaceKind } from "./surface";

export type StudioSettings = {
  studio: boolean;
  material: SurfaceKind;
  lighting: "soft" | "bright" | "warm";
  direction: number;
  intensity: number;
};
export type BookFaces = [HTMLCanvasElement | null, HTMLCanvasElement | null];
const ease = (t: number) => t * t * (3 - 2 * t);

/** One persistent, demand-rendered scene. Static and moving pages share lights/materials. */
export function createBookScene(host: HTMLElement, ratio: number, onLost: () => void) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  const book = new THREE.Group();
  scene.add(book);
  const ambient = new THREE.HemisphereLight(0xffffff, 0xd5cfbf, 2.2);
  const light = new THREE.DirectionalLight(0xffffff, 2.3);
  light.position.set(-3, 4, 6);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.left = -4;
  light.shadow.camera.right = 4;
  light.shadow.camera.top = 4;
  light.shadow.camera.bottom = -4;
  light.shadow.normalBias = 0.012;
  light.shadow.bias = -0.0001;
  light.shadow.radius = 3;
  scene.add(ambient, light);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.ShadowMaterial({ opacity: 0.24 }),
  );
  ground.position.z = -0.065;
  ground.receiveShadow = true;
  scene.add(ground);

  let settings: StudioSettings = {
    studio: false,
    material: "matte",
    lighting: "soft",
    direction: -35,
    intensity: 1,
  };
  let focus = 0.5,
    narrow = false,
    zoom = 1,
    disposed = false;
  let frame = 0;
  let finishAnimation: (() => void) | null = null;
  const textures = new Set<THREE.Texture>();
  const bumps = new Map<string, THREE.CanvasTexture>();
  const pageMaterials: THREE.MeshPhysicalMaterial[] = [];
  const material = (side: THREE.Side = THREE.FrontSide) => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      side,
      roughness: 0.95,
      metalness: 0,
    });
    pageMaterials.push(mat);
    return mat;
  };
  const restingPage = (side: -1 | 1) => {
    const page = new THREE.PlaneGeometry(1, ratio, 40, 1);
    const positions = page.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const distanceToSpine = 0.5 + side * positions.getX(i);
      positions.setZ(i, 0.014 * Math.pow(1 - distanceToSpine, 6));
    }
    page.computeVertexNormals();
    return page;
  };
  const left = new THREE.Mesh(restingPage(-1), material());
  const right = new THREE.Mesh(restingPage(1), material());
  left.position.set(-0.5, 0, 0);
  right.position.set(0.5, 0, 0);
  left.receiveShadow = right.receiveShadow = true;
  left.castShadow = right.castShadow = true;
  book.add(left, right);
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x323834, roughness: 0.85 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xe7e2d8, roughness: 1 });
  const blocks = [-0.5, 0.5].map((x) => {
    const group = new THREE.Group();
    const cover = new THREE.Mesh(new THREE.BoxGeometry(1.025, ratio + 0.03, 0.012), coverMat);
    cover.position.z = -0.048;
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.994, ratio - 0.006, 0.035), edgeMat);
    pages.position.z = -0.024;
    cover.castShadow = pages.castShadow = true;
    group.position.x = x;
    group.add(cover, pages);
    book.add(group);
    return group;
  });

  const geometry = new THREE.PlaneGeometry(1, ratio, 48, 8);
  const frontMat = material();
  const backMat = material(THREE.BackSide);
  const front = new THREE.Mesh(geometry, frontMat);
  const back = new THREE.Mesh(geometry, backMat);
  front.castShadow = back.castShadow = true;
  front.receiveShadow = back.receiveShadow = true;
  front.frustumCulled = back.frustumCulled = false;
  const sheet = new THREE.Group();
  sheet.add(front, back);
  sheet.visible = false;
  book.add(sheet);
  let faces: BookFaces = [null, null];

  const texture = (canvas: HTMLCanvasElement, mirrored = false) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    if (mirrored) {
      t.repeat.x = -1;
      t.offset.x = 1;
    }
    textures.add(t);
    return t;
  };
  const setMap = (
    mat: THREE.MeshPhysicalMaterial,
    canvas: HTMLCanvasElement | null,
    mirror = false,
  ) => {
    if (mat.map) {
      textures.delete(mat.map);
      mat.map.dispose();
    }
    mat.map = canvas ? texture(canvas, mirror) : null;
    mat.needsUpdate = true;
  };
  const paint = () => {
    if (!disposed) renderer.render(scene, camera);
  };
  const frameCamera = () => {
    const w = Math.max(1, host.clientWidth),
      h = Math.max(1, host.clientHeight);
    camera.aspect = w / h;
    const visibleWidth = narrow ? 1.12 : 2.55;
    const visibleHeight = Math.max(ratio * 1.22, visibleWidth / camera.aspect) / zoom;
    const distance = visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const tilt = settings.studio ? 0.16 : 0;
    camera.position.set(focus, -distance * tilt, distance);
    camera.lookAt(focus, 0, 0);
    camera.updateProjectionMatrix();
  };
  const resize = () => {
    renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
    frameCamera();
    paint();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const lost = (e: Event) => {
    e.preventDefault();
    onLost();
  };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  const configure = (next: StudioSettings) => {
    settings = next;
    const angle = THREE.MathUtils.degToRad(next.direction);
    light.position.set(5 * Math.sin(angle), 5 * Math.cos(angle), 6);
    light.color.set(next.lighting === "warm" ? 0xffe4bf : 0xffffff);
    light.intensity = next.studio ? (next.lighting === "bright" ? 3 : 2) * next.intensity : 0;
    ambient.intensity = next.studio ? 1.6 : Math.PI;
    ambient.groundColor.set(next.studio ? 0xd5cfbf : 0xffffff);
    ground.visible = next.studio;
    light.castShadow = next.studio;
    let bump: THREE.CanvasTexture | null = null;
    if (next.studio) {
      const key = next.material;
      if (!bumps.has(key)) {
        const t = new THREE.CanvasTexture(surfaceCanvas(next.material, "soft"));
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(5, ratio * 5);
        bumps.set(key, t);
      }
      bump = bumps.get(key)!;
    }
    for (const m of pageMaterials) {
      m.bumpMap = bump;
      m.bumpScale =
        next.material === "textured" ? 0.012 : next.material === "natural" ? 0.006 : 0.0015;
      m.roughness = next.material === "satin" ? 0.35 : 0.96;
      m.clearcoat = next.studio && next.material === "satin" ? 0.22 : 0;
      m.clearcoatRoughness = 0.4;
      m.needsUpdate = true;
    }
    coverMat.color.set(
      next.material === "natural" ? 0x8a7559 : next.material === "textured" ? 0x35443a : 0x303735,
    );
    blocks.forEach((b, i) => {
      b.visible = next.studio && !!faces[i];
    });
    frameCamera();
    paint();
  };
  const show = (next: BookFaces) => {
    faces = next;
    [left, right].forEach((mesh, i) => {
      mesh.visible = !!next[i];
      setMap(mesh.material, next[i] ?? null);
      blocks[i]!.visible = settings.studio && !!next[i];
    });
    paint();
  };
  const animate = (duration: number, update: (t: number) => void) =>
    new Promise<void>((resolve) => {
      if (disposed) {
        resolve();
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !duration) {
        update(1);
        paint();
        resolve();
        return;
      }
      finishAnimation?.();
      const start = performance.now();
      finishAnimation = resolve;
      const tick = (now: number) => {
        if (disposed) {
          resolve();
          return;
        }
        const t = Math.min(1, (now - start) / duration);
        update(ease(t));
        paint();
        if (t < 1) frame = requestAnimationFrame(tick);
        else {
          finishAnimation = null;
          resolve();
        }
      };
      frame = requestAnimationFrame(tick);
    });
  const pan = async (to: number, duration = 420) => {
    const from = focus;
    await animate(duration, (t) => {
      focus = THREE.MathUtils.lerp(from, to, t);
      frameCamera();
    });
  };
  const shape = (progress: number, dir: 1 | -1) => {
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < attr.count; i++) {
      const u = uv.getX(i),
        v = uv.getY(i);
      const a = Math.PI * progress;
      const curl = Math.sin(a) * 0.26 * Math.sin(Math.PI * u);
      const x = dir * (u * Math.cos(a) + curl * Math.sin(a));
      const z = u * Math.sin(a) - curl * Math.cos(a);
      attr.setXYZ(i, x, (v - 0.5) * ratio, z + 0.004);
    }
    // Reversing travel reverses winding; preserve the physical front face.
    frontMat.side = dir === 1 ? THREE.FrontSide : THREE.BackSide;
    backMat.side = dir === 1 ? THREE.BackSide : THREE.FrontSide;
    attr.needsUpdate = true;
    geometry.computeVertexNormals();
  };
  configure(settings);
  resize();
  return {
    configure,
    show,
    viewport(isNarrow: boolean, scale: number, target: number) {
      narrow = isNarrow;
      zoom = scale;
      focus = target;
      frameCamera();
      paint();
    },
    corners() {
      camera.updateMatrixWorld();
      return [-1, 1].map((x) => {
        const point = new THREE.Vector3(x, -ratio / 2, 0).project(camera);
        return { x: (point.x + 1) * 50, y: (1 - point.y) * 50 };
      });
    },
    pan,
    async turn(from: BookFaces, to: BookFaces, dir: 1 | -1, destinationFocus: number) {
      // A cover first aligns with the open spread. The sheet then turns.
      if (!narrow && focus !== 0) await pan(0);
      if (disposed) return;
      const moving = dir === 1 ? 1 : 0;
      const landing = dir === 1 ? 0 : 1;
      setMap(frontMat, from[moving], dir === -1);
      setMap(backMat, to[landing], dir === 1);
      show(dir === 1 ? [from[0], to[1]] : [to[0], from[1]]);
      sheet.visible = true;
      shape(0, dir);
      const startFocus = focus;
      await animate(1050, (t) => {
        shape(t, dir);
        if (narrow) {
          focus = THREE.MathUtils.lerp(startFocus, destinationFocus, t);
          frameCamera();
        }
      });
      if (disposed) return;
      sheet.visible = false;
      show(to);
      await pan(destinationFocus, narrow ? 0 : 360);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      finishAnimation?.();
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      textures.forEach((t) => t.dispose());
      bumps.forEach((t) => t.dispose());
      const geometries = new Set<THREE.BufferGeometry>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) geometries.add(o.geometry);
      });
      geometries.forEach((g) => g.dispose());
      pageMaterials.forEach((m) => m.dispose());
      coverMat.dispose();
      edgeMat.dispose();
      ground.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
export type BookScene = ReturnType<typeof createBookScene>;
