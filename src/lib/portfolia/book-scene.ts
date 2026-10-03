import * as THREE from "three";
import { surfaceCanvas, type SurfaceKind } from "./surface";
import { parseRgbe } from "./rgbe";

/** The four lighting environments, numbered as they are in the lighting settings. */
export type HdriId = "1" | "2" | "3" | "4";

/**
 * Real photographic lighting (see public/studio/hdri). Each is a 1024 x 512 Radiance picture,
 * prepared so that every one lights a page equally brightly and its main light comes from
 * the same direction as the studio's own light. `preview` is a CSS background for the thumbnail.
 */
export const HDRI_PRESETS: readonly { id: HdriId; label: string; file: string; preview: string }[] = [
  { id: "1", label: "Lighting 1", file: "/studio/hdri/lighting-1.hdr", preview: "url(/studio/hdri/lighting-1.jpg) center / cover" },
  { id: "2", label: "Lighting 2", file: "/studio/hdri/lighting-2.hdr", preview: "url(/studio/hdri/lighting-2.jpg) center / cover" },
  { id: "3", label: "Lighting 3", file: "/studio/hdri/lighting-3.hdr", preview: "url(/studio/hdri/lighting-3.jpg) center / cover" },
  { id: "4", label: "Lighting 4", file: "/studio/hdri/lighting-4.hdr", preview: "url(/studio/hdri/lighting-4.jpg) center / cover" },
];

/** The studio's own light: above, in front and to the left, so the shadow falls below and a little to the right. */
const KEY_LIGHT: [number, number, number] = [-3, 5, 5];

export type StudioSettings = {
  studio: boolean;
  material: SurfaceKind;
  /** 0..1 overall studio brightness. */
  brightness: number;
  hdri: HdriId;
};
export type BookFaces = [HTMLCanvasElement | null, HTMLCanvasElement | null];
const ease = (t: number) => t * t * (3 - 2 * t);
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
const fract = (x: number) => x - Math.floor(x);

/** Page textures kept on the GPU at once (current, next and previous spreads). */
const MAX_TEXTURES = 8;
/** Gap between a turning sheet and the pages beneath it; larger than any page imperfection. */
const SHEET_CLEARANCE = 0.01;

/**
 * Height of a page above the table at distance `d` from the spine (0..1) and
 * height `v` (0 bottom .. 1 top). Pages lie flat apart from the small lift at
 * the gutter. A little waviness and a slightly lifted corner differ for every
 * page, so no two pages look machine-made.
 */
function pageRelief(d: number, v: number, seed: number) {
  const spine = 0.014 * Math.pow(1 - d, 6);
  // Imperfections fade out at the gutter so both pages meet cleanly there.
  const s = seed * 12.9898;
  const fade = Math.min(1, d / 0.18);
  const ripple =
    (Math.sin(d * 5.4 + s) * Math.sin(v * 4.3 + s * 1.7) * 0.0018 +
      Math.sin(d * 12.1 + v * 3.3 + s * 2.3) * 0.0006) *
    fade;
  const k = 0.35 + 0.65 * fract(Math.sin(seed * 78.233) * 43758.5453);
  const cu = Math.min(1, Math.max(0, (d - 0.55) / 0.45));
  const cv = Math.min(1, Math.max(0, (0.4 - v) / 0.4));
  const corner = 0.005 * k * cu * cu * cv * cv;
  return spine + ripple + corner;
}

/** One persistent, demand-rendered scene. Static and moving pages share lights/materials. */
export function createBookScene(host: HTMLElement, ratio: number, onLost: () => void) {
  const compact = window.innerWidth < 720;
  const dpr = window.devicePixelRatio || 1;
  // Render at least twice the CSS resolution on desktop (a sharp, smooth
  // result even on standard screens) and never beyond what a phone can handle.
  const pixelRatio = compact ? Math.min(Math.max(dpr, 1.5), 2) : Math.min(Math.max(dpr, 2), 2.5);
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: pixelRatio < 2,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const maxAnisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  // Neutral tone mapping keeps artwork colours true; ACES is the fallback.
  const studioTone =
    (THREE as unknown as { NeutralToneMapping?: THREE.ToneMapping }).NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();

  // The lighting environments are real photographs, downloaded the first time one is chosen and
  // prefiltered for paper. They are held as half-floats, which every device can filter.
  const environments = new Map<HdriId, THREE.WebGLRenderTarget>();
  const loading = new Map<HdriId, Promise<THREE.WebGLRenderTarget | null>>();
  const toEnvironment = (data: Uint16Array, width: number, height: number) => {
    const hdr = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    hdr.minFilter = hdr.magFilter = THREE.LinearFilter;
    hdr.generateMipmaps = false;
    hdr.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromEquirectangular(hdr);
    hdr.dispose();
    pmrem.dispose();
    return target;
  };
  /** A plain, even light, used while a lighting file downloads and if one cannot be loaded. */
  let evenLight: THREE.WebGLRenderTarget | null = null;
  const even = () => {
    if (!evenLight) {
      const level = THREE.DataUtils.toHalfFloat(0.285);
      const one = THREE.DataUtils.toHalfFloat(1);
      const data = new Uint16Array(4 * 2 * 4);
      for (let i = 0; i < 8; i++) data.set([level, level, level, one], i * 4);
      evenLight = toEnvironment(data, 4, 2);
    }
    return evenLight;
  };
  const loadEnvironment = (id: HdriId): Promise<THREE.WebGLRenderTarget | null> => {
    const hit = environments.get(id);
    if (hit) return Promise.resolve(hit);
    let promise = loading.get(id);
    if (!promise) {
      const preset = HDRI_PRESETS.find((h) => h.id === id)!;
      promise = fetch(preset.file)
        .then((response) => {
          if (!response.ok) throw new Error(`Lighting file ${response.status}`);
          return response.arrayBuffer();
        })
        .then((buffer) => {
          if (disposed) return null;
          const { width, height, rgb } = parseRgbe(buffer);
          const half = new Uint16Array(width * height * 4);
          const one = THREE.DataUtils.toHalfFloat(1);
          // A picture file starts with its top row; a texture starts with its bottom row.
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const from = ((height - 1 - y) * width + x) * 3;
              const to = (y * width + x) * 4;
              half[to] = THREE.DataUtils.toHalfFloat(Math.min(rgb[from]!, 60000));
              half[to + 1] = THREE.DataUtils.toHalfFloat(Math.min(rgb[from + 1]!, 60000));
              half[to + 2] = THREE.DataUtils.toHalfFloat(Math.min(rgb[from + 2]!, 60000));
              half[to + 3] = one;
            }
          }
          const target = toEnvironment(half, width, height);
          environments.set(id, target);
          return target;
        })
        .catch(() => null)
        .finally(() => loading.delete(id));
      loading.set(id, promise);
    }
    return promise;
  };

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  const book = new THREE.Group();
  scene.add(book);
  const ambient = new THREE.HemisphereLight(0xffffff, 0xd5cfbf, 2.2);
  const light = new THREE.DirectionalLight(0xffffff, 2.3);
  light.position.set(...KEY_LIGHT);
  light.castShadow = true;
  // A tight frustum keeps shadow detail high.
  const shadowExtent = Math.hypot(1, ratio / 2) + 0.7;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.left = -shadowExtent;
  light.shadow.camera.right = shadowExtent;
  light.shadow.camera.top = shadowExtent;
  light.shadow.camera.bottom = -shadowExtent;
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.normalBias = 0.012;
  light.shadow.bias = -0.0001;
  light.shadow.radius = 3;
  scene.add(ambient, light);

  // The book floats this far above the background, which is what makes its shadow show.
  const BOOK_LIFT = 0.18;
  // The shadow cast by the studio light, caught on an invisible sheet below the book.
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.38 }));
  shadowCatcher.position.z = -BOOK_LIFT;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  // A soft shadow that is always under the book, whatever the lighting or look, so the
  // book always appears lifted from the background. It is drawn once, not cast.
  const CONTACT_SIZE = 512;
  const CONTACT_CORE = 320; // the solid centre of the picture, exactly the size of the open book
  const contactCanvas = document.createElement("canvas");
  contactCanvas.width = contactCanvas.height = CONTACT_SIZE;
  {
    const ctx = contactCanvas.getContext("2d")!;
    const image = ctx.createImageData(CONTACT_SIZE, CONTACT_SIZE);
    const inset = (CONTACT_SIZE - CONTACT_CORE) / 2;
    const spread = 26; // how far the edge softens, in picture pixels
    for (let y = 0; y < CONTACT_SIZE; y++) {
      for (let x = 0; x < CONTACT_SIZE; x++) {
        // distance outside the solid centre: 0 inside, growing smoothly away from its edges
        const dx = Math.max(inset - x, 0, x - (CONTACT_SIZE - 1 - inset));
        const dy = Math.max(inset - y, 0, y - (CONTACT_SIZE - 1 - inset));
        const d = Math.hypot(dx, dy);
        image.data[(y * CONTACT_SIZE + x) * 4 + 3] = Math.round(255 * Math.exp(-(d * d) / (2 * spread * spread)));
      }
    }
    ctx.putImageData(image, 0, 0);
  }
  const contactTexture = new THREE.CanvasTexture(contactCanvas);
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * (CONTACT_SIZE / CONTACT_CORE), ratio * (CONTACT_SIZE / CONTACT_CORE)),
    new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }),
  );
  contact.position.set(0.03, -0.07, -BOOK_LIFT + 0.002);
  contact.renderOrder = -1;
  scene.add(contact);

  let settings: StudioSettings = {
    studio: false,
    material: "satin",
    brightness: 0.65,
    hdri: "1",
  };
  let focus = 0.5,
    narrow = false,
    zoom = 1,
    panX = 0,
    panY = 0,
    disposed = false;
  let frame = 0;
  let paintQueued = false;
  let finishAnimation: (() => void) | null = null;
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

  // Every page material always has a map, so its shader never has to be
  // rebuilt in the middle of a turn when the first page appears.
  const placeholder = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  placeholder.colorSpace = THREE.SRGBColorSpace;
  placeholder.needsUpdate = true;

  // Page textures are cached per canvas: a page that is shown again, or that
  // was uploaded ahead of time, costs nothing at the moment of a turn.
  const texCache = new Map<HTMLCanvasElement, THREE.CanvasTexture>();

  // Each page has its own seed (from its position in the book) so its
  // imperfections are always the same, and different from its neighbours'.
  const seeds = new WeakMap<HTMLCanvasElement, number>();
  let seedCounter = 0;
  const seedFor = (canvas: HTMLCanvasElement | null | undefined) => {
    if (!canvas) return 0;
    const fromBook = Number(canvas.dataset?.seed);
    if (Number.isFinite(fromBook) && canvas.dataset?.seed !== undefined) return fromBook + 1;
    let seed = seeds.get(canvas);
    if (seed === undefined) {
      seed = ++seedCounter;
      seeds.set(canvas, seed);
    }
    return seed;
  };

  /** Shapes a resting page: curved, with its own small imperfections. */
  const shapePage = (mesh: THREE.Mesh, side: -1 | 1, seed: number) => {
    const positions = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const d = 0.5 + side * positions.getX(i);
      const v = positions.getY(i) / ratio + 0.5;
      positions.setZ(i, pageRelief(d, v, seed));
    }
    positions.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.userData.seed = seed;
  };
  const left = new THREE.Mesh(new THREE.PlaneGeometry(1, ratio, 40, 24), material());
  const right = new THREE.Mesh(new THREE.PlaneGeometry(1, ratio, 40, 24), material());
  shapePage(left, -1, 0);
  shapePage(right, 1, 0);
  left.position.set(-0.5, 0, 0);
  right.position.set(0.5, 0, 0);
  left.receiveShadow = right.receiveShadow = true;
  left.castShadow = right.castShadow = true;
  book.add(left, right);

  // The turning sheet shows its two faces through two views of one geometry.
  // The reverse view has mirrored texture coordinates, so the same texture
  // can be used on either side without a second mirrored GPU upload.
  const geometry = new THREE.PlaneGeometry(1, ratio, 48, 24);
  const reverseGeometry = new THREE.BufferGeometry();
  reverseGeometry.setIndex(geometry.getIndex());
  reverseGeometry.setAttribute("position", geometry.getAttribute("position"));
  reverseGeometry.setAttribute("normal", geometry.getAttribute("normal"));
  reverseGeometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      Array.from(geometry.getAttribute("uv").array as ArrayLike<number>, (value: number, i: number) => (i % 2 === 0 ? 1 - value : value)),
      2,
    ),
  );
  const frontMat = material();
  const backMat = material(THREE.BackSide);
  const front = new THREE.Mesh(geometry, frontMat);
  const back = new THREE.Mesh(reverseGeometry, backMat);
  front.castShadow = back.castShadow = true;
  front.receiveShadow = back.receiveShadow = true;
  front.frustumCulled = back.frustumCulled = false;
  const sheet = new THREE.Group();
  sheet.add(front, back);
  sheet.visible = false;
  book.add(sheet);
  for (const m of pageMaterials) m.map = placeholder;
  let sheetSeeds: [number, number] = [0, 0];
  let draggedTurn: { from: BookFaces; to: BookFaces; dir: 1 | -1; destinationFocus: number; originalFocus: number; progress: number; speed: number } | null = null;

  const trimTextures = () => {
    if (texCache.size <= MAX_TEXTURES) return;
    const used = new Set<THREE.Texture | null>([left.material.map, right.material.map, frontMat.map, backMat.map]);
    for (const [canvas, t] of texCache) {
      if (texCache.size <= MAX_TEXTURES) break;
      if (used.has(t)) continue;
      t.dispose();
      texCache.delete(canvas);
    }
  };
  const textureFor = (canvas: HTMLCanvasElement) => {
    const hit = texCache.get(canvas);
    if (hit) {
      texCache.delete(canvas);
      texCache.set(canvas, hit);
      return hit;
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAnisotropy;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    texCache.set(canvas, t);
    trimTextures();
    return t;
  };
  const setMap = (mat: THREE.MeshPhysicalMaterial, canvas: HTMLCanvasElement | null) => {
    mat.map = canvas ? textureFor(canvas) : placeholder;
    mat.emissiveMap = settings.studio ? null : mat.map;
  };
  const paint = () => {
    if (!disposed) renderer.render(scene, camera);
  };
  /** Coalesces rapid pointer input into at most one render per frame. */
  const requestPaint = () => {
    if (paintQueued || disposed) return;
    paintQueued = true;
    requestAnimationFrame(() => {
      paintQueued = false;
      paint();
    });
  };
  const cameraHeight = (scale: number) => {
    const aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
    // Frame a lone cover as a page, but leave room for both pages once open.
    const width = narrow ? 1.08 : THREE.MathUtils.lerp(2.32, 1.32, Math.min(1, Math.abs(focus) * 2));
    return Math.max(ratio * 1.12, width / aspect) / scale;
  };
  /** Dragging may never move the view outside the initial framing. */
  const clampPan = () => {
    const aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
    const limit = Math.max(0, cameraHeight(1) - cameraHeight(zoom)) / 2;
    panY = THREE.MathUtils.clamp(panY, -limit, limit);
    panX = THREE.MathUtils.clamp(panX, -limit * aspect, limit * aspect);
  };
  const frameCamera = () => {
    const w = Math.max(1, host.clientWidth),
      h = Math.max(1, host.clientHeight);
    camera.aspect = w / h;
    clampPan();
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

  /** Compiles the page shaders now so the first turn does not stall. */
  const warm = () => {
    const before: [boolean, boolean, boolean] = [left.visible, right.visible, sheet.visible];
    const sides: [THREE.Side, THREE.Side] = [frontMat.side, backMat.side];
    left.visible = right.visible = sheet.visible = true;
    try {
      // Forward and backward turns use different shader variants for the sheet.
      for (const dir of [1, -1] as const) {
        frontMat.side = dir === 1 ? THREE.FrontSide : THREE.BackSide;
        backMat.side = dir === 1 ? THREE.BackSide : THREE.FrontSide;
        frontMat.needsUpdate = true;
        backMat.needsUpdate = true;
        renderer.compile(scene, camera);
      }
    } catch {
      /* shaders will compile on first draw instead */
    }
    frontMat.side = sides[0];
    backMat.side = sides[1];
    frontMat.needsUpdate = true;
    backMat.needsUpdate = true;
    left.visible = before[0];
    right.visible = before[1];
    sheet.visible = before[2];
  };
  let warmedFor: boolean | null = null;
  let environmentRequest = 0;
  const configure = (next: StudioSettings) => {
    settings = next;
    const brightness = THREE.MathUtils.clamp(next.brightness, 0, 1);
    renderer.toneMapping = next.studio ? studioTone : THREE.NoToneMapping;
    // The brightness slider drives overall exposure so the change is obvious.
    renderer.toneMappingExposure = next.studio ? 0.55 + brightness * 1.6 : 1;
    // The lighting is a real photograph. While one downloads, the previous lighting (or a plain even light) stays.
    const request = ++environmentRequest;
    if (!next.studio) scene.environment = null;
    else {
      const ready = environments.get(next.hdri);
      if (ready) scene.environment = ready.texture;
      else {
        if (!scene.environment) scene.environment = even().texture;
        void loadEnvironment(next.hdri).then((target) => {
          if (disposed || request !== environmentRequest) return;
          scene.environment = (target ?? even()).texture;
          paint();
        });
      }
    }
    scene.environmentIntensity = next.studio ? 1 : 0;
    // The studio's own light is the same whatever the lighting, so the shadow always falls the same way.
    light.position.set(...KEY_LIGHT);
    light.color.set(0xffffff);
    light.intensity = next.studio ? 0.55 : 0;
    light.shadow.radius = 6;
    ambient.intensity = next.studio ? 0.65 : Math.PI;
    ambient.color.set(0xffffff);
    ambient.groundColor.set(next.studio ? 0xb7bdca : 0xffffff);
    shadowCatcher.material.opacity = 0.36;
    shadowCatcher.visible = next.studio;
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
    if (warmedFor !== next.studio) {
      warmedFor = next.studio;
      warm();
    }
    frameCamera();
    paint();
  };
  const show = (next: BookFaces, render = true) => {
    [left, right].forEach((mesh, i) => {
      mesh.visible = !!next[i];
      setMap(mesh.material, next[i] ?? null);
      const seed = seedFor(next[i]);
      if (mesh.userData.seed !== seed) shapePage(mesh, i === 0 ? -1 : 1, seed);
    });
    // The shadow sits under whichever pages are showing: a lone cover has a shadow half the width.
    const both = !!next[0] && !!next[1];
    contact.visible = !!next[0] || !!next[1];
    contact.scale.x = both ? 1 : 0.5;
    contact.position.x = 0.03 + (both ? 0 : next[1] ? 0.5 : -0.5);
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
    // Nothing to move: finish at once so the next page can be turned immediately.
    if (Math.abs(from - to) < 1e-6) return;
    await animate(duration, (t) => {
      focus = THREE.MathUtils.lerp(from, to, t);
      frameCamera();
    });
  };
  const shape = (progress: number, dir: 1 | -1) => {
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const uv = geometry.getAttribute("uv");
    // Halfway through, the face the viewer sees changes from one page to the
    // other, so the sheet's relief blends from the first page's to the second's.
    const blend = smooth((progress - 0.3) / 0.4);
    for (let i = 0; i < attr.count; i++) {
      const u = uv.getX(i),
        v = uv.getY(i);
      const a = Math.PI * progress;
      const curl = Math.sin(a) * 0.16 * Math.sin(Math.PI * u);
      const x = dir * (u * Math.cos(a) + curl * Math.sin(a));
      const z = u * Math.sin(a) - curl * Math.cos(a);
      // At rest the sheet matches the curved, imperfect page it came from or lands on.
      const relief = pageRelief(u, v, sheetSeeds[0]) * (1 - blend) + pageRelief(u, v, sheetSeeds[1]) * blend;
      attr.setXYZ(i, x, (v - 0.5) * ratio, z + relief + SHEET_CLEARANCE);
    }
    // Reversing travel reverses winding; preserve the physical front face.
    // The side is part of the shader, so refresh it only when it changes.
    const frontSide = dir === 1 ? THREE.FrontSide : THREE.BackSide;
    if (frontMat.side !== frontSide) {
      frontMat.side = frontSide;
      backMat.side = dir === 1 ? THREE.BackSide : THREE.FrontSide;
      frontMat.needsUpdate = true;
      backMat.needsUpdate = true;
    }
    // The face seen from behind uses the mirrored view of the sheet.
    const forwardView = dir === 1 ? geometry : reverseGeometry;
    if (front.geometry !== forwardView) {
      front.geometry = forwardView;
      back.geometry = dir === 1 ? reverseGeometry : geometry;
    }
    attr.needsUpdate = true;
    geometry.computeVertexNormals();
  };
  configure(settings);
  resize();
  return {
    configure,
    show,
    /** Uploads a page to the GPU ahead of time so a later turn does not stall. */
    prefetch(canvas: HTMLCanvasElement | null | undefined) {
      if (!canvas || disposed) return;
      try {
        renderer.initTexture(textureFor(canvas));
      } catch {
        /* the texture uploads on first use instead */
      }
    },
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
      requestPaint();
    },
    dragPan(dx: number, dy: number) {
      const height = cameraHeight(zoom);
      panX -= (dx / Math.max(1, host.clientHeight)) * height;
      panY += (dy / Math.max(1, host.clientHeight)) * height;
      frameCamera();
      requestPaint();
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
    /** `speed` 1 is the normal pace; smaller is quicker (used when pages are turned in quick succession). */
    async prepareTurn(from: BookFaces, to: BookFaces, dir: 1 | -1, destinationFocus: number, speed = 1) {
      const originalFocus = focus;
      // A cover first aligns with the open spread. The sheet then turns.
      if (!narrow && focus !== 0) await pan(0, 420 * speed);
      if (disposed) return;
      const moving = dir === 1 ? 1 : 0;
      const landing = dir === 1 ? 0 : 1;
      setMap(frontMat, from[moving]);
      setMap(backMat, to[landing]);
      sheetSeeds = [seedFor(from[moving]), seedFor(to[landing])];
      // The page being revealed sits underneath the turning sheet from the
      // first frame; the page being covered stays unchanged until the end.
      show(dir === 1 ? [from[0], to[1]] : [to[0], from[1]], false);
      sheet.visible = true;
      shape(0, dir);
      paint();
      draggedTurn = { from, to, dir, destinationFocus, originalFocus, progress: 0, speed };
    },
    dragTurn(progress: number) {
      const turn = draggedTurn;
      if (!turn || disposed) return;
      turn.progress = THREE.MathUtils.clamp(progress, 0, 1);
      shape(turn.progress, turn.dir);
      requestPaint();
    },
    async settleTurn(complete: boolean) {
      const turn = draggedTurn;
      if (!turn || disposed) return;
      const { from, to, dir, destinationFocus, originalFocus, speed } = turn;
      const start = turn.progress;
      const startFocus = focus;
      const end = complete ? 1 : 0;
      await animate(Math.max(120 * speed, 700 * speed * Math.abs(end - start)), (t) => {
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
      await pan(complete ? destinationFocus : originalFocus, narrow ? 0 : 260 * speed);
    },
    async turn(from: BookFaces, to: BookFaces, dir: 1 | -1, destinationFocus: number, speed = 1) {
      await this.prepareTurn(from, to, dir, destinationFocus, speed);
      await this.settleTurn(true);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      finishAnimation?.();
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      texCache.forEach((t) => t.dispose());
      texCache.clear();
      placeholder.dispose();
      bumps.forEach((t) => t.dispose());
      contactTexture.dispose();
      environments.forEach((target) => target.dispose());
      evenLight?.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) geometries.add(o.geometry);
      });
      geometries.add(geometry);
      geometries.add(reverseGeometry);
      geometries.forEach((g) => g.dispose());
      pageMaterials.forEach((m) => m.dispose());
      contact.material.dispose();
      shadowCatcher.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
export type BookScene = ReturnType<typeof createBookScene>;
