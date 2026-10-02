import * as THREE from "three";
import { surfaceCanvas, type SurfaceKind } from "./surface";

export type HdriId = "window" | "softbox" | "golden" | "overcast";

/** Lighting environments offered in Studio. `preview` is a CSS background used for the thumbnail. */
export const HDRI_PRESETS: readonly { id: HdriId; label: string; preview: string }[] = [
  {
    id: "window",
    label: "Window light",
    preview:
      "radial-gradient(circle at 28% 40%, #ffffff 0, #dce8ff 16%, transparent 42%), linear-gradient(135deg, #5b6b8c, #2a3350)",
  },
  {
    id: "softbox",
    label: "Softbox",
    preview:
      "radial-gradient(ellipse at 45% 18%, #ffffff 0, #f4f1ea 30%, transparent 64%), linear-gradient(180deg, #8c93a8, #3a4058)",
  },
  {
    id: "golden",
    label: "Golden hour",
    preview:
      "radial-gradient(circle at 78% 55%, #ffe2a8 0, #ffb25e 22%, transparent 50%), linear-gradient(135deg, #5a3b4a, #2b2038)",
  },
  {
    id: "overcast",
    label: "Overcast",
    preview: "linear-gradient(180deg, #eef1f5, #b3bac6 58%, #6d7585)",
  },
];

type HdriSpec = {
  /** Sky radiance everywhere. */
  base: number;
  /** Bright areas of the environment (equirectangular u/v, falloff, power, colour). */
  blobs: { u: number; v: number; su: number; sv: number; power: number; tint: [number, number, number] }[];
  /** Adds the foliage flicker used by the window preset. */
  foliage?: boolean;
  /** Key light direction (before rotation), height and colour. */
  key: { x: number; y: number; z: number; color: number; strength: number };
  /** Projected window/foliage light. 0 switches it off. */
  windowLight: number;
  /** 0 = crisp shadow edge, 1 = very soft. */
  soft: number;
  warm: boolean;
};

const HDRI_SPECS: Record<HdriId, HdriSpec> = {
  window: {
    base: 0.28,
    blobs: [{ u: 0.28, v: 0.42, su: 0.012, sv: 0.035, power: 3.2, tint: [1, 1, 1.02] }],
    foliage: true,
    key: { x: -3, y: 4, z: 4.5, color: 0xffffff, strength: 0.55 },
    windowLight: 0.45,
    soft: 0.65,
    warm: false,
  },
  softbox: {
    base: 0.34,
    blobs: [{ u: 0.45, v: 0.22, su: 0.05, sv: 0.02, power: 2.6, tint: [1, 0.99, 0.97] }],
    key: { x: -1, y: 5, z: 4.5, color: 0xffffff, strength: 0.6 },
    windowLight: 0,
    soft: 0.9,
    warm: false,
  },
  golden: {
    base: 0.22,
    blobs: [{ u: 0.78, v: 0.5, su: 0.02, sv: 0.03, power: 3.6, tint: [1, 0.72, 0.42] }],
    key: { x: 4, y: 2, z: 4.5, color: 0xffc98a, strength: 0.65 },
    windowLight: 0.3,
    soft: 0.35,
    warm: true,
  },
  overcast: {
    base: 0.55,
    blobs: [{ u: 0.5, v: 0.1, su: 0.5, sv: 0.05, power: 0.6, tint: [0.95, 0.97, 1] }],
    key: { x: 0, y: 3, z: 6, color: 0xf2f6ff, strength: 0.3 },
    windowLight: 0,
    soft: 1,
    warm: false,
  },
};

export type StudioSettings = {
  studio: boolean;
  material: SurfaceKind;
  /** 0..1 overall studio brightness. */
  brightness: number;
  hdri: HdriId;
  /** Degrees. Turns the key light (and so the shadow angle) and the reflections. */
  hdriRotation: number;
  /** Image URL behind the book. Empty for a flat colour. */
  backdrop: string;
  /** Flat colour behind the book (white when an image is used). */
  backdropColor: string;
  /** "tile" repeats a texture (wood). "photo" fits one picture behind the book. */
  backdropKind: "tile" | "photo";
  /** width / height of the photo. */
  backdropAspect: number;
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

  // Self-contained floating-point HDR environments, prefiltered for diffuse
  // paper. Radiance above 1 preserves a real high dynamic range, and no
  // third-party request can leave the viewer unlit. Built on first use.
  const environments = new Map<HdriId, THREE.WebGLRenderTarget>();
  const environmentFor = (id: HdriId) => {
    const hit = environments.get(id);
    if (hit) return hit.texture;
    const spec = HDRI_SPECS[id];
    const envWidth = 512,
      envHeight = 256;
    const radiance = new Float32Array(envWidth * envHeight * 4);
    for (let y = 0; y < envHeight; y++) {
      for (let x = 0; x < envWidth; x++) {
        const u = x / envWidth,
          v = y / envHeight;
        const foliage = spec.foliage ? 0.85 + 0.15 * Math.sin(x * 0.12) * Math.cos(y * 0.19) : 1;
        let r = spec.base,
          g = spec.base,
          b = spec.base;
        for (const blob of spec.blobs) {
          const k = blob.power * Math.exp(-((u - blob.u) ** 2 / blob.su + (v - blob.v) ** 2 / blob.sv)) * foliage;
          r += k * blob.tint[0];
          g += k * blob.tint[1];
          b += k * blob.tint[2];
        }
        const i = (y * envWidth + x) * 4;
        radiance[i] = r;
        radiance[i + 1] = g;
        radiance[i + 2] = b;
        radiance[i + 3] = 1;
      }
    }
    const hdr = new THREE.DataTexture(radiance, envWidth, envHeight, THREE.RGBAFormat, THREE.FloatType);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    hdr.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromEquirectangular(hdr);
    hdr.dispose();
    pmrem.dispose();
    environments.set(id, target);
    return target.texture;
  };

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
  let paintedSoft = -1;
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
      ctx.ellipse(x, y, 12 + (i % 19), 8 + (i % 11), i, 0, Math.PI * 2);
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
    material: "satin",
    brightness: 0.65,
    hdri: "window",
    hdriRotation: 0,
    backdrop: "",
    backdropColor: "#191d3a",
    backdropKind: "tile",
    backdropAspect: 1,
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
  let draggedTurn: { from: BookFaces; to: BookFaces; dir: 1 | -1; destinationFocus: number; originalFocus: number; progress: number } | null = null;

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
  let photoUrl = "";
  const configure = (next: StudioSettings) => {
    settings = next;
    const spec = HDRI_SPECS[next.hdri] ?? HDRI_SPECS.window;
    const brightness = THREE.MathUtils.clamp(next.brightness, 0, 1);
    const angle = THREE.MathUtils.degToRad(next.hdriRotation || 0);
    renderer.toneMapping = next.studio ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    // The brightness slider drives overall exposure so the change is obvious.
    renderer.toneMappingExposure = next.studio ? 0.55 + brightness * 1.6 : 1;
    scene.environment = next.studio ? environmentFor(next.hdri) : null;
    scene.environmentIntensity = next.studio ? 0.6 : 0;
    scene.environmentRotation.set(0, 0, angle);
    // Rotating the key light around the book moves the shadow it casts.
    const kx = spec.key.x * Math.cos(angle) - spec.key.y * Math.sin(angle);
    const ky = spec.key.x * Math.sin(angle) + spec.key.y * Math.cos(angle);
    light.position.set(kx, ky, spec.key.z);
    light.color.set(spec.key.color);
    light.intensity = next.studio ? spec.key.strength : 0;
    light.shadow.radius = 2 + spec.soft * 6;
    if (spec.windowLight > 0 && paintedSoft !== spec.soft) {
      paintWindow(spec.soft);
      paintedSoft = spec.soft;
    }
    windowLight.position.set(kx * 0.85, ky * 0.75, 6);
    windowLight.intensity = next.studio ? spec.windowLight : 0;
    windowLight.color.set(spec.warm ? 0xfff0dd : 0xffffff);
    ambient.intensity = next.studio ? 0.65 : Math.PI;
    ambient.color.set(spec.warm ? 0xffe4c2 : 0xffffff);
    ambient.groundColor.set(next.studio ? 0xb7bdca : 0xffffff);
    ground.material.color.set(next.backdropColor || "#ffffff");
    const request = ++backdropRequest;
    const photo = next.backdropKind === "photo";
    const applyBackdrop = (map: THREE.Texture | null) => {
      if (disposed || request !== backdropRequest) return;
      if (map) {
        map.wrapS = map.wrapT = photo ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
        if (photo) {
          // Fit one picture behind the book, centred, covering the usual view.
          const aspect = Math.max(0.2, next.backdropAspect || 1);
          const tileW = Math.max(3.4, 2 * aspect);
          const tileH = tileW / aspect;
          const rx = 20 / tileW,
            ry = 20 / tileH;
          map.repeat.set(rx, ry);
          map.offset.set(0.5 - 0.5 * rx, 0.5 - 0.5 * ry);
        } else {
          map.repeat.set(2, 2);
          map.offset.set(0, 0);
        }
      }
      ground.material.map = map;
      // Use the photographic grain of wood as height relief under the studio lights.
      ground.material.bumpMap = photo ? null : map;
      ground.material.bumpScale = map && !photo ? 0.018 : 0;
      ground.material.roughness = 0.9;
      ground.material.needsUpdate = true;
      paint();
    };
    if (!photo && photoUrl) {
      backdropTextures.get(photoUrl)?.dispose();
      backdropTextures.delete(photoUrl);
      photoUrl = "";
    }
    if (!next.backdrop) applyBackdrop(null);
    else if (backdropTextures.has(next.backdrop)) applyBackdrop(backdropTextures.get(next.backdrop)!);
    else
      textureLoader.load(
        next.backdrop,
        (map) => {
          if (disposed) {
            map.dispose();
            return;
          }
          map.colorSpace = THREE.SRGBColorSpace;
          map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          if (photo) {
            if (photoUrl && photoUrl !== next.backdrop) {
              backdropTextures.get(photoUrl)?.dispose();
              backdropTextures.delete(photoUrl);
            }
            photoUrl = next.backdrop;
          }
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
    const satin = next.material === "satin";
    const textured = next.material === "textured";
    for (const m of pageMaterials) {
      m.bumpMap = bump;
      // Satin is smooth with a visible sheen; textured shows clear paper grain.
      m.bumpScale = next.studio ? (textured ? 0.006 : 0.0003) : 0;
      m.roughness = next.studio ? (satin ? 0.42 : 0.97) : 0.96;
      m.clearcoat = next.studio && satin ? 0.4 : 0;
      m.clearcoatRoughness = 0.28;
      m.specularIntensity = next.studio ? (satin ? 0.7 : 0.1) : 0.12;
      // Simple mode reproduces the source artwork independently of studio light.
      m.emissive.set(next.studio ? 0x000000 : 0xffffff);
      m.emissiveMap = next.studio ? null : m.map;
      m.color.set(next.studio ? 0xffffff : 0x000000);
      m.needsUpdate = true;
    }
    coverMat.color.set(textured ? 0x35443a : 0x303735);
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
  const pan = async (to: number, duration = 300) => {
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
      await animate(240, (t) => {
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
      // The page being revealed sits underneath the turning sheet from the
      // first frame; the page being covered stays unchanged until the end.
      show(dir === 1 ? [from[0], to[1]] : [to[0], from[1]], false);
      sheet.visible = true;
      shape(0, dir);
      paint();
      draggedTurn = { from, to, dir, destinationFocus, originalFocus, progress: 0 };
    },
    dragTurn(progress: number) {
      const turn = draggedTurn;
      if (!turn || disposed) return;
      turn.progress = THREE.MathUtils.clamp(progress, 0, 1);
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
      await animate(Math.max(100, 450 * Math.abs(end - start)), (t) => {
        const progress = THREE.MathUtils.lerp(start, end, t);
        turn.progress = progress;
        shape(progress, dir);
        if (narrow && complete) {
          focus = THREE.MathUtils.lerp(startFocus, destinationFocus, progress);
          frameCamera();
        }
      });
      if (disposed) return;
      // At the end the sheet lies exactly over the covered page, so swapping
      // the textures in the same frame as hiding it is invisible.
      sheet.visible = false;
      show(complete ? to : from, false);
      draggedTurn = null;
      paint();
      await pan(complete ? destinationFocus : originalFocus, narrow ? 0 : 180);
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
      environments.forEach((target) => target.dispose());
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
