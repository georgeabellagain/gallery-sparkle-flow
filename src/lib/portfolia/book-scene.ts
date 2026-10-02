import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { surfaceCanvas, type SurfaceKind } from "./surface";

export type StudioSettings = {
  studio: boolean;
  material: SurfaceKind;
  lighting: "soft" | "bright" | "warm";
  backdrop: string;
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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  // A floating-point, prefiltered room environment supplies broad window and
  // softbox illumination to every physical surface, including the backdrop.
  const room = new RoomEnvironment();
  room.rotation.x = Math.PI / 2;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.08);
  room.dispose();
  pmrem.dispose();
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
    new THREE.MeshStandardMaterial({ color: 0xe8e3da, roughness: 0.88 }),
  );
  ground.position.z = -0.065;
  ground.receiveShadow = true;
  scene.add(ground);

  let settings: StudioSettings = {
    studio: false,
    material: "matte",
    lighting: "soft",
    backdrop: "/studio/warm-wood.jpg",
  };
  const backdropTextures = new Map<string, THREE.Texture>();
  const textureLoader = new THREE.TextureLoader();
  let backdropRequest = 0;
  let focus = 0.5,
    narrow = false,
    zoom = 1,
    panX = 0,
    panY = 0,
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
  let draggedTurn: { from: BookFaces; to: BookFaces; dir: 1 | -1; destinationFocus: number; progress: number; landingUpdated: boolean } | null = null;

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
  const cameraHeight = (scale: number) => {
    const aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
    // Frame a lone cover as a page, but leave room for both pages once open.
    const width = narrow ? 1.08 : THREE.MathUtils.lerp(2.32, 1.32, Math.min(1, Math.abs(focus) * 2));
    return Math.max(ratio * 1.12, width / aspect) / scale;
  };
  const frameCamera = () => {
    const w = Math.max(1, host.clientWidth),
      h = Math.max(1, host.clientHeight);
    camera.aspect = w / h;
    const visibleHeight = cameraHeight(zoom);
    const distance = visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.set(focus + panX, panY, distance);
    camera.lookAt(focus + panX, panY, 0);
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
    renderer.toneMapping = next.studio ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.15;
    const warm = next.lighting === "warm";
    const bright = next.lighting === "bright";
    scene.environment = next.studio ? environment.texture : null;
    scene.environmentIntensity = bright ? 1.3 : warm ? 0.75 : 1;
    scene.environmentRotation.set(0, 0, warm ? -0.65 : bright ? 0.7 : 0);
    light.position.set(warm ? 4 : -3, bright ? -2 : 4, 6);
    light.color.set(warm ? 0xffd5a0 : 0xffffff);
    light.intensity = next.studio ? (bright ? 1.2 : warm ? 0.8 : 0.65) : 0;
    ambient.intensity = next.studio ? 0.18 : Math.PI;
    ambient.color.set(warm ? 0xffe4c2 : 0xffffff);
    ambient.groundColor.set(next.studio ? 0xb7bdca : 0xffffff);
    ground.material.color.set(warm ? 0xffe4c7 : 0xffffff);
    const request = ++backdropRequest;
    const applyBackdrop = (map: THREE.Texture | null) => {
      if (disposed || request !== backdropRequest) return;
      ground.material.map = map;
      ground.material.needsUpdate = true;
      paint();
    };
    if (!next.backdrop) applyBackdrop(null);
    else if (backdropTextures.has(next.backdrop))
      applyBackdrop(backdropTextures.get(next.backdrop)!);
    else
      textureLoader.load(
        next.backdrop,
        (map) => {
          if (disposed) {
            map.dispose();
            return;
          }
          map.colorSpace = THREE.SRGBColorSpace;
          map.wrapS = map.wrapT = THREE.RepeatWrapping;
          map.repeat.set(4, 4);
          map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          backdropTextures.set(next.backdrop, map);
          applyBackdrop(map);
        },
        undefined,
        () => applyBackdrop(null),
      );
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
  const show = (next: BookFaces, render = true) => {
    faces = next;
    [left, right].forEach((mesh, i) => {
      mesh.visible = !!next[i];
      setMap(mesh.material, next[i] ?? null);
      blocks[i]!.visible = settings.studio && !!next[i];
    });
    if (render) paint();
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
      const curl = Math.sin(a) * 0.16 * Math.sin(Math.PI * u);
      const x = dir * (u * Math.cos(a) + curl * Math.sin(a));
      const z = u * Math.sin(a) - curl * Math.cos(a);
      // Match the resting page spine relief, with clearance to prevent intersection.
      const spineRelief = 0.014 * Math.pow(1 - u, 6);
      attr.setXYZ(i, x, (v - 0.5) * ratio, z + spineRelief + 0.006);
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
    zoomAt(scale: number, x: number, y: number) {
      const aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
      const delta = cameraHeight(zoom) - cameraHeight(scale);
      panX += (x - 0.5) * delta * aspect;
      panY += (0.5 - y) * delta;
      zoom = scale;
      frameCamera();
      paint();
    },
    dragPan(dx: number, dy: number) {
      const height = cameraHeight(zoom);
      panX -= (dx / Math.max(1, host.clientHeight)) * height;
      panY += (dy / Math.max(1, host.clientHeight)) * height;
      frameCamera();
      paint();
    },
    async resetZoom() {
      if (zoom === 1 && panX === 0 && panY === 0) return;
      const startZoom = zoom, startX = panX, startY = panY;
      await animate(360, (t) => {
        zoom = THREE.MathUtils.lerp(startZoom, 1, t);
        panX = THREE.MathUtils.lerp(startX, 0, t);
        panY = THREE.MathUtils.lerp(startY, 0, t);
        frameCamera();
      });
    },
    corners() {
      camera.updateMatrixWorld();
      return [-1, 1].map((x) => {
        const point = new THREE.Vector3(x, -ratio / 2, 0).project(camera);
        return { x: (point.x + 1) * 50, y: (1 - point.y) * 50 };
      });
    },
    pan,
    async prepareTurn(from: BookFaces, to: BookFaces, dir: 1 | -1, destinationFocus: number) {
      // A cover first aligns with the open spread. The sheet then turns.
      if (!narrow && focus !== 0) await pan(0);
      if (disposed) return;
      const moving = dir === 1 ? 1 : 0;
      const landing = dir === 1 ? 0 : 1;
      setMap(frontMat, from[moving], dir === -1);
      setMap(backMat, to[landing], dir === 1);
      show(dir === 1 ? [from[0], to[1]] : [to[0], from[1]], false);
      sheet.visible = true;
      shape(0, dir);
      paint();
      draggedTurn = { from, to, dir, destinationFocus, progress: 0, landingUpdated: false };
    },
    dragTurn(progress: number) {
      const turn = draggedTurn;
      if (!turn || disposed) return;
      turn.progress = THREE.MathUtils.clamp(progress, 0, 1);
      const landing = turn.dir === 1 ? 0 : 1;
      if (turn.progress >= 0.5 && !turn.landingUpdated) {
        setMap(landing === 0 ? left.material : right.material, turn.to[landing]);
        turn.landingUpdated = true;
      }
      shape(turn.progress, turn.dir);
      paint();
    },
    async settleTurn(complete: boolean) {
      const turn = draggedTurn;
      if (!turn || disposed) return;
      const { from, to, dir, destinationFocus } = turn;
      const start = turn.progress;
      const startFocus = focus;
      const end = complete ? 1 : 0;
      await animate(Math.max(120, 700 * Math.abs(end - start)), (t) => {
        const progress = THREE.MathUtils.lerp(start, end, t);
        turn.progress = progress;
        const landing = dir === 1 ? 0 : 1;
        if (progress >= 0.5 && !turn.landingUpdated) {
          setMap(landing === 0 ? left.material : right.material, to[landing]);
          turn.landingUpdated = true;
        }
        shape(progress, dir);
        if (narrow && complete) {
          focus = THREE.MathUtils.lerp(startFocus, destinationFocus, progress);
          frameCamera();
        }
      });
      if (disposed) return;
      sheet.visible = false;
      show(complete ? to : from, false);
      draggedTurn = null;
      paint();
      await pan(complete ? destinationFocus : bookFocusForCancel(from), narrow ? 0 : 260);
    },
    async turn(from: BookFaces, to: BookFaces, dir: 1 | -1, destinationFocus: number) {
      await this.prepareTurn(from, to, dir, destinationFocus);
      await this.settleTurn(true);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      finishAnimation?.();
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      textures.forEach((t) => t.dispose());
      bumps.forEach((t) => t.dispose());
      backdropTextures.forEach((t) => t.dispose());
      environment.dispose();
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
