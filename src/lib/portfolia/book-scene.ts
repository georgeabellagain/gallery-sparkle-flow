import * as THREE from "three";
import { surfaceCanvas, type SurfaceKind } from "./surface";

export type HdriId =
  | "window"
  | "softbox"
  | "golden"
  | "overcast"
  | "gallery"
  | "livingroom"
  | "loft"
  | "atrium";
export type HdriGroup = "Daylight" | "Interior";

/** Lighting environments offered in Studio. `preview` is a CSS background used for the thumbnail. */
export const HDRI_PRESETS: readonly { id: HdriId; label: string; group: HdriGroup; preview: string }[] = [
  {
    id: "window",
    label: "Window light",
    group: "Daylight",
    preview:
      "radial-gradient(circle at 28% 40%, #ffffff 0, #dce8ff 16%, transparent 42%), linear-gradient(135deg, #5b6b8c, #2a3350)",
  },
  {
    id: "softbox",
    label: "Softbox",
    group: "Daylight",
    preview:
      "radial-gradient(ellipse at 45% 18%, #ffffff 0, #f4f1ea 30%, transparent 64%), linear-gradient(180deg, #8c93a8, #3a4058)",
  },
  {
    id: "golden",
    label: "Golden hour",
    group: "Daylight",
    preview:
      "radial-gradient(circle at 78% 55%, #ffe2a8 0, #ffb25e 22%, transparent 50%), linear-gradient(135deg, #5a3b4a, #2b2038)",
  },
  {
    id: "overcast",
    label: "Overcast",
    group: "Daylight",
    preview: "linear-gradient(180deg, #eef1f5, #b3bac6 58%, #6d7585)",
  },
  {
    id: "gallery",
    label: "Gallery",
    group: "Interior",
    preview:
      "radial-gradient(circle at 12% 20%, #fff6e4 0, transparent 14%), radial-gradient(circle at 32% 20%, #fff6e4 0, transparent 14%), radial-gradient(circle at 52% 20%, #fff6e4 0, transparent 14%), radial-gradient(circle at 72% 20%, #fff6e4 0, transparent 14%), radial-gradient(circle at 92% 20%, #fff6e4 0, transparent 14%), linear-gradient(180deg, #c9c2b6, #4a463f)",
  },
  {
    id: "livingroom",
    label: "Living room",
    group: "Interior",
    preview:
      "radial-gradient(ellipse at 22% 42%, #e6f0ff 0, #b8cdf0 16%, transparent 38%), radial-gradient(circle at 72% 50%, #ffc27a 0, #ff9a4a 14%, transparent 34%), linear-gradient(135deg, #6b4a3c, #2c1f1b)",
  },
  {
    id: "loft",
    label: "Loft windows",
    group: "Interior",
    preview:
      "linear-gradient(90deg, #2a3140 0, #2a3140 10%, #e4eeff 12%, #e4eeff 22%, #2a3140 24%, #2a3140 34%, #e4eeff 36%, #e4eeff 46%, #2a3140 48%, #2a3140 100%)",
  },
  {
    id: "atrium",
    label: "Atrium",
    group: "Interior",
    preview:
      "radial-gradient(ellipse at 50% 6%, #ffffff 0, #f2f4f8 30%, transparent 66%), linear-gradient(180deg, #9aa3b4, #3b4256)",
  },
];

type HdriSpec = {
  /** Sky radiance everywhere. */
  base: number;
  /** Bright areas of the environment (equirectangular u/v, falloff, power, colour). */
  blobs: { u: number; v: number; su: number; sv: number; power: number; tint: [number, number, number] }[];
  /** Adds the foliage flicker used by the window preset. */
  foliage?: boolean;
  /** Key light position, height and colour. */
  key: { x: number; y: number; z: number; color: number; strength: number };
  /** Projected window/foliage light. 0 switches it off. */
  windowLight: number;
  /** 0 = crisp shadow edge, 1 = very soft. */
  soft: number;
  warm: boolean;
};

const white: [number, number, number] = [1, 1, 1];
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
  // Interiors: several discrete sources instead of one open sky.
  gallery: {
    base: 0.42,
    blobs: [0.1, 0.3, 0.5, 0.7, 0.9].map((u) => ({
      u,
      v: 0.18,
      su: 0.0025,
      sv: 0.006,
      power: 2.4,
      tint: [1, 0.98, 0.94] as [number, number, number],
    })),
    key: { x: 0, y: 3.2, z: 4.2, color: 0xfff4e6, strength: 0.6 },
    windowLight: 0,
    soft: 0.8,
    warm: false,
  },
  livingroom: {
    base: 0.2,
    blobs: [
      { u: 0.22, v: 0.4, su: 0.01, sv: 0.03, power: 2.6, tint: [0.95, 1, 1.1] },
      { u: 0.68, v: 0.46, su: 0.004, sv: 0.006, power: 3, tint: [1, 0.72, 0.42] },
      { u: 0.9, v: 0.5, su: 0.003, sv: 0.005, power: 1.6, tint: [1, 0.78, 0.5] },
    ],
    key: { x: -3.2, y: 2.6, z: 4.2, color: 0xffe2c0, strength: 0.5 },
    windowLight: 0.3,
    soft: 0.6,
    warm: true,
  },
  loft: {
    base: 0.26,
    blobs: [0.14, 0.26, 0.38].map((u) => ({
      u,
      v: 0.42,
      su: 0.0016,
      sv: 0.05,
      power: 3.4,
      tint: [0.92, 0.98, 1.1] as [number, number, number],
    })),
    key: { x: -4, y: 1.8, z: 4, color: 0xe9f1ff, strength: 0.55 },
    windowLight: 0.4,
    soft: 0.5,
    warm: false,
  },
  atrium: {
    base: 0.38,
    blobs: [
      { u: 0.5, v: 0.1, su: 0.12, sv: 0.02, power: 2.8, tint: [1, 1, 0.98] },
      { u: 0.5, v: 0.28, su: 0.3, sv: 0.03, power: 0.8, tint: white },
    ],
    key: { x: 0.6, y: 3.6, z: 5, color: 0xffffff, strength: 0.5 },
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
  /** Image URL behind the book. Only used when `backdropKind` is "photo". */
  backdrop: string;
  /** The backdrop colour, shown exactly as chosen. */
  backdropColor: string;
  /** "color" is a flat colour. "photo" fits one picture behind the book. */
  backdropKind: "color" | "photo";
  /** width / height of the photo. */
  backdropAspect: number;
  /** Photo size, 1 = fills the usual view. */
  backdropScale: number;
  /** Photo position, -1..1 across / up. */
  backdropX: number;
  backdropY: number;
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
 * height `v` (0 bottom .. 1 top). Pages rise from the gutter in a gentle dome
 * and fall away towards the fore-edge. A little waviness and a slightly
 * lifted corner differ for every page, so no two pages look machine-made.
 */
function pageRelief(d: number, v: number, seed: number) {
  const spine = 0.014 * Math.pow(1 - d, 6);
  const dome = 0.016 * Math.sin(Math.PI * Math.min(1, Math.max(0, d)));
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
  return spine + dome + ripple + corner;
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

  // The backdrop is a flat, unlit colour (or picture), so it shows exactly what
  // was chosen whatever the lighting. A separate catcher draws the book's shadow on top.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshBasicMaterial({ color: 0x191d3a, toneMapped: false }),
  );
  ground.position.z = -0.13;
  scene.add(ground);
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.38 }));
  shadowCatcher.position.z = -0.129;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  let settings: StudioSettings = {
    studio: false,
    material: "satin",
    brightness: 0.65,
    hdri: "window",
    backdrop: "",
    backdropColor: "#191d3a",
    backdropKind: "color",
    backdropAspect: 1,
    backdropScale: 1,
    backdropX: 0,
    backdropY: 0,
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
  let photoUrl = "";
  const configure = (next: StudioSettings) => {
    settings = next;
    const spec = HDRI_SPECS[next.hdri] ?? HDRI_SPECS.window;
    const brightness = THREE.MathUtils.clamp(next.brightness, 0, 1);
    renderer.toneMapping = next.studio ? studioTone : THREE.NoToneMapping;
    // The brightness slider drives overall exposure so the change is obvious.
    renderer.toneMappingExposure = next.studio ? 0.55 + brightness * 1.6 : 1;
    scene.environment = next.studio ? environmentFor(next.hdri) : null;
    scene.environmentIntensity = next.studio ? 0.6 : 0;
    light.position.set(spec.key.x, spec.key.y, spec.key.z);
    light.color.set(spec.key.color);
    light.intensity = next.studio ? spec.key.strength : 0;
    light.shadow.radius = 2 + spec.soft * 6;
    if (spec.windowLight > 0 && paintedSoft !== spec.soft) {
      paintWindow(spec.soft);
      paintedSoft = spec.soft;
    }
    windowLight.position.set(spec.key.x * 0.85, spec.key.y * 0.75, 6);
    windowLight.intensity = next.studio ? spec.windowLight : 0;
    windowLight.color.set(spec.warm ? 0xfff0dd : 0xffffff);
    ambient.intensity = next.studio ? 0.65 : Math.PI;
    ambient.color.set(spec.warm ? 0xffe4c2 : 0xffffff);
    ambient.groundColor.set(next.studio ? 0xb7bdca : 0xffffff);
    const request = ++backdropRequest;
    const photo = next.backdropKind === "photo" && !!next.backdrop;
    // A picture is shown as it is; a colour is applied directly.
    ground.material.color.set(photo ? "#ffffff" : next.backdropColor || "#191d3a");
    shadowCatcher.material.opacity = 0.3 + spec.soft * 0.1;
    const applyBackdrop = (map: THREE.Texture | null) => {
      if (disposed || request !== backdropRequest) return;
      if (map) {
        // One picture behind the book. It starts centred and covering the
        // usual view; size and position are then adjusted by the visitor.
        map.wrapS = map.wrapT = THREE.MirroredRepeatWrapping;
        const aspect = Math.max(0.2, next.backdropAspect || 1);
        const scale = THREE.MathUtils.clamp(next.backdropScale || 1, 1, 4);
        const tileW = Math.max(3.4, 2 * aspect) * scale;
        const tileH = tileW / aspect;
        const rx = 20 / tileW,
          ry = 20 / tileH;
        const px = THREE.MathUtils.clamp(next.backdropX || 0, -1, 1) * tileW * 0.5;
        const py = THREE.MathUtils.clamp(next.backdropY || 0, -1, 1) * tileH * 0.5;
        map.repeat.set(rx, ry);
        map.offset.set(0.5 - (px / 20 + 0.5) * rx, 0.5 - (py / 20 + 0.5) * ry);
      }
      if (!!ground.material.map !== !!map) ground.material.needsUpdate = true;
      ground.material.map = map;
      paint();
    };
    if (!photo && photoUrl) {
      backdropTextures.get(photoUrl)?.dispose();
      backdropTextures.delete(photoUrl);
      photoUrl = "";
    }
    if (!photo) applyBackdrop(null);
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
          map.anisotropy = maxAnisotropy;
          if (photoUrl && photoUrl !== next.backdrop) {
            backdropTextures.get(photoUrl)?.dispose();
            backdropTextures.delete(photoUrl);
          }
          photoUrl = next.backdrop;
          backdropTextures.set(next.backdrop, map);
          applyBackdrop(map);
        },
        undefined,
        () => applyBackdrop(null),
      );
    ground.visible = next.studio;
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
      backdropTextures.forEach((t) => t.dispose());
      windowTexture.dispose();
      environments.forEach((target) => target.dispose());
      const geometries = new Set<THREE.BufferGeometry>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) geometries.add(o.geometry);
      });
      geometries.add(geometry);
      geometries.add(reverseGeometry);
      geometries.forEach((g) => g.dispose());
      pageMaterials.forEach((m) => m.dispose());
      ground.material.dispose();
      shadowCatcher.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
export type BookScene = ReturnType<typeof createBookScene>;
