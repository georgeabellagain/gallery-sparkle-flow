import * as THREE from "three";
import { surfaceCanvas, type SurfaceKind } from "./surface";

export type StudioSettings = {
  studio: boolean;
  material: SurfaceKind;
  lighting: "soft" | "bright" | "warm";
  backdrop: string;
  diffusion: number;
};
export type BookFaces = [HTMLCanvasElement | null, HTMLCanvasElement | null];
const ease = (t: number) => t * t * (3 - 2 * t);

/** One persistent, demand-rendered scene. Static and moving pages share lights/materials. */
export function createBookScene(host: HTMLElement, ratio: number, onLost: () => void) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  // Self-contained floating-point HDR window environment, prefiltered for
  // diffuse paper. Radiance above 1 preserves a real high dynamic range;
  // no third-party environment request can leave the viewer unlit.
  const envWidth = 512, envHeight = 256;
  const radiance = new Float32Array(envWidth * envHeight * 4);
  for (let y = 0; y < envHeight; y++) {
    for (let x = 0; x < envWidth; x++) {
      const u = x / envWidth, v = y / envHeight;
      const windowRadiance = Math.exp(-((u - 0.28) ** 2 / 0.012 + (v - 0.42) ** 2 / 0.035));
      const foliage = 0.85 + 0.15 * Math.sin(x * 0.12) * Math.cos(y * 0.19);
      const value = 0.28 + 3.2 * windowRadiance * foliage;
      const i = (y * envWidth + x) * 4;
      radiance[i] = value;
      radiance[i + 1] = value;
      radiance[i + 2] = value * 1.02;
      radiance[i + 3] = 1;
    }
  }
  const hdr = new THREE.DataTexture(radiance, envWidth, envHeight, THREE.RGBAFormat, THREE.FloatType);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  hdr.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(hdr);
  hdr.dispose();
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  const book = new THREE.Group();
  scene.add(book);
  const ambient = new THREE.HemisphereLight(0xffffff, 0xd5cfbf, 2.2);
  const light = new THREE.DirectionalLight(0xffffff, 2.3);
  light.position.set(-3, 4, 6);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.left = -4;
  light.shadow.camera.right = 4;
  light.shadow.camera.top = 4;
  light.shadow.camera.bottom = -4;
  light.shadow.normalBias = 0.012;
  light.shadow.bias = -0.0001;
  light.shadow.radius = 3;
  // A projected window/foliage pattern adds soft daylight variation without
  // baking shadows or colour into the PDF artwork.
  const windowLight = new THREE.SpotLight(0xffffff, 1.5, 30, 0.65, 0.9, 0);
  windowLight.position.set(-2.5, 3, 6);
  windowLight.target.position.set(0, 0, -0.1);
  const windowMap = document.createElement("canvas");
  windowMap.width = windowMap.height = 512;
  const windowTexture = new THREE.CanvasTexture(windowMap);
  windowLight.map = windowTexture;
  const paintWindow = (diffusion: number) => {
    const ctx = windowMap.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 512, 512);
    ctx.save();
    ctx.filter = `blur(${4 + diffusion * 24}px)`;
    ctx.fillStyle = "#aaa";
    ctx.fillRect(244, 0, 24, 512);
    ctx.fillRect(0, 244, 512, 24);
    // Deterministic foliage silhouettes keep slider changes visually stable.
    for (let i = 0; i < 45; i++) {
      const x = (Math.sin(i * 73.1) * 0.5 + 0.5) * 512;
      const y = (Math.cos(i * 37.7) * 0.5 + 0.5) * 512;
      ctx.beginPath();
      ctx.ellipse(x, y, 12 + i % 19, 8 + i % 11, i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    windowTexture.needsUpdate = true;
  };
  scene.add(ambient, light, windowLight, windowLight.target);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0xe8e3da, roughness: 0.88 }),
  );
  ground.position.z = -0.13;
  ground.receiveShadow = true;
  scene.add(ground);

  let settings: StudioSettings = {
    studio: false,
    diffusion: 0.65,
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
      specularIntensity: 0.12,
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
    const cover = new THREE.Mesh(new THREE.BoxGeometry(1.025, ratio + 0.04, 0.018), coverMat);
    cover.position.z = -0.105;
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.994, ratio - 0.006, 0.085), edgeMat);
    pages.position.z = -0.052;
    cover.castShadow = pages.castShadow = true;
    group.position.x = x;
    group.add(cover, pages);
    // Separate sheet edges make the block read as a bound booklet.
    for (let i = 1; i < 15; i++) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.998, ratio - 0.004, 0.0008), coverMat);
      edge.position.z = -0.009 - i * 0.0055;
      group.add(edge);
    }
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
  let draggedTurn: { from: BookFaces; to: BookFaces; dir: 1 | -1; destinationFocus: number; originalFocus: number; progress: number; landingUpdated: boolean } | null = null;

  const texture = (canvas: HTMLCanvasElement, mirrored = false) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
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
    mat.emissiveMap = settings.studio ? null : mat.map;
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
    renderer.toneMappingExposure = 1;
    const warm = next.studio && next.lighting === "warm";
    const bright = next.lighting === "bright";
    scene.environment = next.studio ? environment.texture : null;
    scene.environmentIntensity = next.studio ? (bright ? 0.65 : 0.5) : 0;
    scene.environmentRotation.set(0, 0, warm ? -0.65 : bright ? 0.7 : 0);
    light.position.set(warm ? 4 : -3, bright ? -2 : 4, 6);
    light.color.set(warm ? 0xffd5a0 : 0xffffff);
    const diffusion = THREE.MathUtils.clamp(next.diffusion, 0, 1);
    paintWindow(diffusion);
    windowLight.intensity = next.studio ? (0.65 - diffusion * 0.35) : 0;
    windowLight.color.set(warm ? 0xfff0dd : 0xffffff);
    light.shadow.radius = 2 + diffusion * 6;
    light.intensity = next.studio ? (bright ? 0.65 : 0.45) : 0;
    ambient.intensity = next.studio ? 0.65 : Math.PI;
    ambient.color.set(warm ? 0xffe4c2 : 0xffffff);
    ambient.groundColor.set(next.studio ? 0xb7bdca : 0xffffff);
    ground.material.color.set(warm ? 0xffe4c7 : 0xffffff);
    const request = ++backdropRequest;
    const applyBackdrop = (map: THREE.Texture | null) => {
      if (disposed || request !== backdropRequest) return;
      ground.material.map = map;
      // Use the photographic grain as height relief under the studio lights.
      ground.material.bumpMap = map;
      ground.material.bumpScale = map ? 0.018 : 0;
      ground.material.roughness = 0.9;
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
          map.repeat.set(2, 2);
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
        next.studio ? (next.material === "textured" ? 0.0015 : next.material === "natural" ? 0.0008 : 0.0003) : 0;
      m.roughness = next.studio && next.material === "satin" ? 0.78 : 0.96;
      m.clearcoat = next.studio && next.material === "satin" ? 0.035 : 0;
      m.clearcoatRoughness = 0.4;
      // Simple mode reproduces the source artwork independently of studio light.
      m.emissive.set(next.studio ? 0x000000 : 0xffffff);
      m.emissiveMap = next.studio ? null : m.map;
      m.color.set(next.studio ? 0xffffff : 0x000000);
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
      zoom = THREE.MathUtils.clamp(scale, 0.8, 3);
      focus = target;
      frameCamera();
      paint();
    },
    zoomAt(scale: number, x: number, y: number) {
      const aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
      const delta = cameraHeight(zoom) - cameraHeight(scale);
      panX += (x - 0.5) * delta * aspect;
      panY += (0.5 - y) * delta;
      zoom = THREE.MathUtils.clamp(scale, 0.8, 3);
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
      const originalFocus = focus;
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
      draggedTurn = { from, to, dir, destinationFocus, originalFocus, progress: 0, landingUpdated: false };
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
      const { from, to, dir, destinationFocus, originalFocus } = turn;
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
      await pan(complete ? destinationFocus : originalFocus, narrow ? 0 : 260);
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
      windowTexture.dispose();
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

