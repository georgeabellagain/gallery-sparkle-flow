import { applyTurnPose, bakeTurnGeometry, createTurnGeometryCache, turnGeometryWriter, type TurnPose } from "./turn-geometry-cache";
import { createTurnShadowCache, turnShadowKey } from "./turn-shadow-cache";
import { createAirDust, setNaturalImperfections } from "./natural-imperfections";
import { turnEase, captureFrames, turnRestVisible } from "./turn-motion";
import { averageEnvironment, createEnvironmentDiffuser } from "./environment-diffusion";
import { dappleTexture } from "./dapple-light";
import { bookSurfaceRatio, bookMotionBudget } from "./render-budget";
import { createBookNotes } from "./book-notes";
import { pageRelief } from "./page-relief";
import { createBookTabs } from "./book-tabs";
import type { TabEdge, TabPlan } from "./tab-geometry";
import * as THREE from "three";
import { createLitBackdrop } from "./lit-backdrop";
import { paperFinish, type SurfaceKind } from "./surface";
import { parseRgbe } from "./rgbe";
import { DEFAULT_SIMPLE_SHADOW_OPACITY, HDRI_PRESETS, studioLightMix, studioTopLight, presetDirectLight, studioExposure, type HdriId } from "./lighting";
import { GPU_BYTES, deviceTier, gpuBytesOf } from "./resolution";

export { HDRI_PRESETS };
export type { HdriId };


export type StudioSettings = {
  studio: boolean;
  material: SurfaceKind;
  /** 0..1 overall studio brightness. */
  brightness: number;
  topLight?: number;
  imperfections?: boolean | number;
  strength?: number;
  textureStrength?: number;
  hdri: HdriId;
  /** Simple look only: whether the soft shadow under the book shows. */
  simpleShadow: boolean;
  /** Simple look only: how dark that shadow is, 0..1. */
  simpleShadowOpacity: number;
};
export type BookFaces = [HTMLCanvasElement | null, HTMLCanvasElement | null];
const ease = turnEase;
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** Page textures kept on the GPU at once (current, next and previous spreads). */
const MAX_TEXTURES = 8;
/** The drawing surface, in pixels. With edge smoothing it costs several times its size in graphics memory. */
const MAX_SURFACE_PIXELS = 5_200_000;
const MAX_SURFACE_PIXELS_SMALL = 2_500_000;
/** Gap between a turning sheet and the pages beneath it; larger than any page imperfection. */
const SHEET_CLEARANCE = 0.01;

/** One persistent, demand-rendered scene. Static and moving pages share lights/materials. */
export function createBookScene(host: HTMLElement, ratio: number, onLost: () => void, onRestored?: () => void, initialSettings?: StudioSettings, fixedQuality = false) {
  const compact = window.innerWidth < 720;
  const dpr = window.devicePixelRatio || 1;
  // Edges are smoothed by explicit multisampling, so the picture does not need to be drawn at more than
  // twice the screen's own detail. Drawing fewer pixels is what keeps Studio's paper shading quick.
  let pixelRatio = fixedQuality ? 2 : Math.min(Math.max(dpr, 1), compact ? 1.5 : 2);
  let appliedRatio = pixelRatio;
  const readingRatio = pixelRatio;
  let turning = false;
  let captureClock: (()=>Promise<void>) | undefined;
  let frameSink: ((canvas: HTMLCanvasElement) => void) | undefined;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  let shadowsDirty = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  // CSS owns the display size; the renderer owns only the drawing buffer.
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  host.appendChild(renderer.domElement);
  // Preserve oblique page detail using the filtering supported by this GPU.
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  // Neutral tone mapping keeps artwork colours true; ACES is the fallback.
  const studioTone =
    (THREE as unknown as { NeutralToneMapping?: THREE.ToneMapping }).NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const airDust=createAirDust(scene);

  // The lighting environments are real photographs, downloaded the first time one is chosen and
  // prefiltered for paper. They are held as half-floats, which every device can filter.
  const environments = new Map<HdriId, THREE.WebGLRenderTarget>();
  const environmentColours = new Map<HdriId, [number, number, number]>();
  const diffuser = createEnvironmentDiffuser(renderer);
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
      const preset = HDRI_PRESETS.find((h) => h.id === id) ?? HDRI_PRESETS[3]!;
      promise = fetch(preset.file)
        .then((response) => {
          if (!response.ok) throw new Error(`Lighting file ${response.status}`);
          return response.arrayBuffer();
        })
        .then((buffer) => {
          if (disposed) return null;
          const { width, height, rgb } = parseRgbe(buffer);
          environmentColours.set(id, averageEnvironment(rgb, width, height));
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
  light.position.set(-1.8, 2.8, 5.5);
  light.castShadow = true;
  const topLight = new THREE.DirectionalLight(0xffffff, 0);
  topLight.position.set(0, 0, 6); topLight.castShadow = false; scene.add(topLight);
  // A tight frustum keeps shadow detail high.
  const shadowExtent = Math.hypot(1, ratio / 2) + 0.7;
  light.shadow.mapSize.set(512, 512);
  light.shadow.camera.left = -shadowExtent;
  light.shadow.camera.right = shadowExtent;
  light.shadow.camera.top = shadowExtent;
  light.shadow.camera.bottom = -shadowExtent;
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.normalBias = 0.012;
  light.shadow.bias = -0.0001;
  light.shadow.radius = 3;
  scene.add(ambient, light);
  const sunPatch = new THREE.SpotLight(0xfff3dc, 0, 0, Math.PI / 5, .35, 0);
  sunPatch.position.set(-1.8, 2.8, 5.5);
  sunPatch.target.position.set(0, 0, 0);
  sunPatch.shadow.mapSize.set(512, 512);
  sunPatch.shadow.normalBias = .012;
  sunPatch.shadow.bias = -.0001;
  sunPatch.shadow.camera.near = .1;
  sunPatch.shadow.camera.far = 12;
  const dapples = new Map<string, THREE.CanvasTexture>();
  scene.add(sunPatch, sunPatch.target);
  const shadowCache = createTurnShadowCache([light, sunPatch], compact ? 64 : 128);
  let shadowProgress = 0, shadowDirection = 1;

  // The book floats this far above the background, which is what makes its shadow show.
  const BOOK_LIFT = 0.07;
  // The shadow cast by the studio light, caught on an invisible sheet below the book.
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.38 }));
  shadowCatcher.position.z = -BOOK_LIFT;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  // A soft shadow that is always under the book in the Simple look. There is one for the open book and one
  // for a single page (the cover, or the back page), each solid under what it sits beneath and softening
  // evenly on every side. Moving between one page and two cross-fades them, timed with the page landing,
  // so a shadow never slides and a lone page never has a hard edge. Drawn once, not cast.
  const SHADOW_SPREAD = 0.075; // how far the edge softens, in world units
  const SHADOW_MARGIN = 0.3; // how far the picture reaches beyond the page edge
  const SHADOW_PPU = 190; // picture pixels per world unit
  const CONTACT_X = 0.02;
  const CONTACT_Y = -0.03;
  const makeShadow = (coreWidth: number) => {
    const width = coreWidth + 2 * SHADOW_MARGIN;
    const height = ratio + 2 * SHADOW_MARGIN;
    const w = Math.round(width * SHADOW_PPU);
    const h = Math.round(height * SHADOW_PPU);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(w, h);
    const sigma = SHADOW_SPREAD * SHADOW_PPU;
    const halfWidth = (coreWidth * SHADOW_PPU) / 2;
    const halfHeight = (ratio * SHADOW_PPU) / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = Math.max(Math.abs(x + 0.5 - w / 2) - halfWidth, 0);
        const dy = Math.max(Math.abs(y + 0.5 - h / 2) - halfHeight, 0);
        const d = Math.hypot(dx, dy);
        image.data[(y * w + x) * 4 + 3] = Math.round(255 * Math.exp(-(d * d) / (2 * sigma * sigma)));
      }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return { texture, width, height };
  };
  const spreadArt = makeShadow(2);
  const pageArt = makeShadow(1);
  const shadowMesh = (art: ReturnType<typeof makeShadow>, x: number) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(art.width, art.height),
      new THREE.MeshBasicMaterial({ map: art.texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    );
    mesh.renderOrder = -1;
    // A little down and to the right, like a real drop shadow.
    mesh.position.set(CONTACT_X + x, CONTACT_Y, -BOOK_LIFT + 0.002);
    scene.add(mesh);
    return mesh;
  };
  const contact = { left: shadowMesh(pageArt, -0.5), spread: shadowMesh(spreadArt, 0), right: shadowMesh(pageArt, 0.5) };

  let settings: StudioSettings = {
    studio: false,
    material: "satin",
    brightness: 0.5,
    hdri: "4",
    simpleShadow: true,
    simpleShadowOpacity: DEFAULT_SIMPLE_SHADOW_OPACITY,
    ...initialSettings,
  };
  let focus = 0.5,
    narrow = false,
    zoom = 1,
    panX = 0,
    panY = 0,
    disposed = false;
  let frame = 0;
  let paintQueued = 0;
  let finishAnimation: (() => void) | null = null;
  const pageMaterials: THREE.MeshStandardMaterial[] = [];
  const material = (side: THREE.Side = THREE.FrontSide) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      side,
      roughness: 0.95,
      metalness: 0,
    });
    // A single sheet of paper must cast its shadow whichever way it faces the light. By default a
    // one-sided sheet that faces the light casts none, so the real shadow would come and go.
    mat.shadowSide = THREE.DoubleSide;
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
    const fromBook = Number(canvas.dataset?.["seed"]);
    if (Number.isFinite(fromBook) && canvas.dataset?.["seed"] !== undefined) return fromBook + 1;
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
    mesh.userData["seed"] = seed;
  };
  const left = new THREE.Mesh(new THREE.PlaneGeometry(1, ratio, 32, 16), material());
  const right = new THREE.Mesh(new THREE.PlaneGeometry(1, ratio, 32, 16), material());
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
  const geometry = new THREE.PlaneGeometry(1, ratio, 32, 16);
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
  front.castShadow = true;
  // Both faces share geometry and double-sided shadow material; cast this sheet only once.
  back.castShadow = false;
  front.receiveShadow = back.receiveShadow = true;
  front.frustumCulled = back.frustumCulled = false;
  const sheet = new THREE.Group();
  sheet.add(front, back);
  sheet.visible = false;
  book.add(sheet);
  for (const m of pageMaterials) m.map = placeholder;
  (geometry.getAttribute("position") as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  (geometry.getAttribute("normal") as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  const turnGeometryCache = createTurnGeometryCache(compact ? 4 : 8);
  let bakedTurn: TurnPose[] | null = null;
  let turnRestPages: [boolean, boolean] | null = null;
  let draggedTurn: { from: BookFaces; to: BookFaces; dir: 1 | -1; destinationFocus: number; originalFocus: number; progress: number; speed: number } | null = null;

  // Pages kept on the graphics card are limited by count and by memory, so the browser never has a reason to take the context away.
  // The most graphics memory page pictures may hold at once depends on the device (see resolution.ts); beyond it the
  // browser may take the graphics context away.
  const textureBudget = GPU_BYTES[deviceTier()];
  const textureBytes = () => {
    let total = 0;
    for (const [canvas] of texCache) total += gpuBytesOf(canvas.width || 0, canvas.height || 0);
    return total;
  };
  const trimTextures = () => {
    const budget = textureBudget;
    if (texCache.size <= MAX_TEXTURES && textureBytes() <= budget) return;
    const used = new Set<THREE.Texture | null>([left.material.map, right.material.map, frontMat.map, backMat.map]);
    for (const [canvas, t] of texCache) {
      if (texCache.size <= MAX_TEXTURES && textureBytes() <= budget) break;
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
  const setMap = (mat: THREE.MeshStandardMaterial, canvas: HTMLCanvasElement | null) => {
    mat.map = canvas ? textureFor(canvas) : placeholder;
    mat.emissiveMap = settings.studio ? null : mat.map;
  };
  const surfaceSize = new THREE.Vector2();
  let pendingDragShape: (() => void) | null = null;
  const paint = () => {
    if (disposed) return;
    // A direct animation draw supersedes an input/contact-shadow draw queued
    // for the same frame. Avoid shading the fullscreen surface twice.
    if (paintQueued) { cancelAnimationFrame(paintQueued); paintQueued = 0; }
    // Fullscreen can change layout before ResizeObserver delivers its callback.
    // Never draw a new camera aspect into a buffer with the previous aspect.
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    const size = renderer.getSize(surfaceSize);
    if (size.x !== w || size.y !== h) {
      renderer.setSize(w, h, false);
      frameCamera();
    }
    const update = pendingDragShape;
    pendingDragShape = null;
    update?.();
    backdrop.frame(camera, w, h, Math.max(ratio * 1.1 + FRAME_PAD, 2.32 / camera.aspect) * (1 + inset));
    // Decorations have their own moving geometry and must never borrow a bare-page shadow.
    let decorated = false;
    book.traverse(o => { if (o instanceof THREE.Mesh && o.castShadow && o !== left && o !== right && o !== front) decorated = true; });
    const key = settings.studio && sheet.visible && !decorated && !fixedQuality
      ? turnShadowKey(shadowProgress, shadowDirection, left.visible, right.visible) : null;
    // A soft moving shadow needs less resolution than the stationary reading view.
    // Keeping turn targets at 256 also bounds the 128-frame desktop cache to ~64 MiB.
    for (const source of [light, sunPatch]) source.shadow.mapSize.set(key ? 256 : 512, key ? 256 : 512);
    const cached = key !== null && shadowCache.restore(key);
    if (!key) shadowCache.detach();
    renderer.shadowMap.needsUpdate = !cached && (turning || shadowsDirty);
    renderer.render(scene, camera);
    if (key && !cached) shadowCache.save(key);
    frameSink?.(renderer.domElement);
    shadowsDirty = false;
  };
  /** Coalesces rapid pointer input into at most one render per frame. */
  const requestPaint = () => {
    shadowsDirty = true;
    if (paintQueued || disposed) return;
    paintQueued = requestAnimationFrame(() => {
      paintQueued = 0;
      paint();
    });
  };
  // Room around the book, the same above and below so it sits exactly in the middle, with enough for its shadow to fade out.
  const FRAME_PAD = 0.12 + 0.08 * ratio;
  /** Extra room around the book (the editor uses it to keep the book clear of its tools). */
  let inset = 0;
  const cameraHeight = (scale: number, atFocus = focus) => {
    const aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
    // Frame a lone cover as a page, but leave room for both pages once open.
    const width = narrow ? 1.08 : THREE.MathUtils.lerp(2.32, 1.32, Math.min(1, Math.abs(atFocus) * 2));
    return (Math.max(ratio * 1.1 + FRAME_PAD, width / aspect) / scale) * (1 + inset);
  };
  /** Dragging may never move the view outside the initial framing. */
  const clampPan = () => {
    const aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
    const baseline = cameraHeight(1), height = cameraHeight(zoom);
    const bounds = notes.bounds();
    const margin = .12;
    // Include opened paper in the drag envelope without changing the zoom.
    const top = Math.max(baseline / 2, bounds ? bounds.max.y + margin : baseline / 2);
    const bottom = Math.min(-baseline / 2, bounds ? bounds.min.y - margin : -baseline / 2);
    const leftEdge = Math.min(focus - baseline * aspect / 2, bounds ? bounds.min.x - margin : focus - baseline * aspect / 2);
    const rightEdge = Math.max(focus + baseline * aspect / 2, bounds ? bounds.max.x + margin : focus + baseline * aspect / 2);
    panY = THREE.MathUtils.clamp(panY, Math.min(0, bottom + height / 2), Math.max(0, top - height / 2));
    panX = THREE.MathUtils.clamp(panX, Math.min(0, leftEdge + height * aspect / 2 - focus), Math.max(0, rightEdge - height * aspect / 2 - focus));
  };
  const frameCamera = (height?: number) => {
    const w = Math.max(1, host.clientWidth),
      h = Math.max(1, host.clientHeight);
    camera.aspect = w / h;
    clampPan();
    const visibleHeight = height ?? cameraHeight(zoom);
    const distance = visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.set(focus + panX, panY, distance);
    camera.lookAt(focus + panX, panY, 0);
    camera.updateProjectionMatrix();
  };
  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    // A big window gets a slightly lower pixel density rather than a surface too large for the graphics card.
    // CSS pixels are not a minimum: a 4K fullscreen canvas must still obey
    // the GPU budget. Preserve HD page textures independently of this surface.
    const budget = fixedQuality ? 8_294_400 : bookMotionBudget(compact ? MAX_SURFACE_PIXELS_SMALL : MAX_SURFACE_PIXELS, turning);
    const next = bookSurfaceRatio(w, h, turning ? pixelRatio : readingRatio, budget);
    if (Math.abs(next - appliedRatio) > 1e-6) {
      appliedRatio = next;
      renderer.setPixelRatio(next);
    }
    const currentSize = renderer.getSize(surfaceSize);
    if (currentSize.x !== w || currentSize.y !== h) renderer.setSize(w, h, false);
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
  // If the browser gives the context back, three.js sets itself up again, but the lighting (drawn into the old
  // context) is gone, so it is rebuilt from the current settings. Page pictures re-upload themselves.
  const restored = () => {
    if (disposed) return;
    environments.clear();
    diffuser.reset();
    evenLight = null;
    scene.environment = null;
    warmedLooks.clear(); // the shaders were lost with the old context
    configure(settings);
    paint();
    onRestored?.();
  };
  renderer.domElement.addEventListener("webglcontextrestored", restored);

  // Which of the three shadows is showing. A page that appears or goes fades; nothing slides. During a turn
  // the cross-fade follows the turn, so the shadow arrives as the page lands. Otherwise (a jump to
  // another page) it eases over about a third of a second.
  type ShadowKind = "none" | "left" | "spread" | "right";
  const kindOf = (faces: BookFaces): ShadowKind => (faces[0] && faces[1] ? "spread" : faces[1] ? "right" : faces[0] ? "left" : "none");
  const weightsOf = (kind: ShadowKind) => ({ l: kind === "left" ? 1 : 0, s: kind === "spread" ? 1 : 0, r: kind === "right" ? 1 : 0 });
  const keyOf = { none: null, left: "l", spread: "s", right: "r" } as const;
  const contactNow = weightsOf("spread");
  const contactGoal = weightsOf("spread");
  let contactShown = false;
  let contactFrame = 0;
  let contactLast = 0;
  let contactOn = true;
  let contactOpacity = DEFAULT_SIMPLE_SHADOW_OPACITY;
  let contactTurn: { from: ShadowKind; to: ShadowKind; landing: boolean } | null = null;
  const applyContact = () => {
    const parts = [
      [contact.left, contactNow.l],
      [contact.spread, contactNow.s],
      [contact.right, contactNow.r],
    ] as const;
    for (const [mesh, weight] of parts) {
      mesh.material.opacity = contactOpacity * weight;
      mesh.visible = contactOn && weight > 0.004;
    }
  };
  const stepContact = (now: number) => {
    contactFrame = 0;
    if (disposed) return;
    const dt = Math.min(64, Math.max(1, now - contactLast));
    contactLast = now;
    const k = 1 - Math.exp(-dt / 110);
    let moving = false;
    for (const key of ["l", "s", "r"] as const) {
      const d = contactGoal[key] - contactNow[key];
      if (Math.abs(d) < 0.002) contactNow[key] = contactGoal[key];
      else {
        contactNow[key] += d * k;
        moving = true;
      }
    }
    applyContact();
    requestPaint();
    if (moving) contactFrame = requestAnimationFrame(stepContact);
  };
  const setContact = (faces: BookFaces) => {
    // While a page is turning, the turn itself decides the shadow.
    if (contactTurn) return;
    const kind = kindOf(faces);
    Object.assign(contactGoal, weightsOf(kind));
    const instant = !contactShown || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (kind !== "none") contactShown = true;
    if (instant) {
      Object.assign(contactNow, contactGoal);
      applyContact();
      return;
    }
    const settled = (["l", "s", "r"] as const).every((key) => Math.abs(contactNow[key] - contactGoal[key]) < 1e-6);
    if (settled) return;
    if (!contactFrame) {
      contactLast = performance.now();
      contactFrame = requestAnimationFrame(stepContact);
    }
  };
  /**
   * How much of the outgoing shadow remains when the incoming one is at `t`, chosen so that where the two
   * overlap (under a page that stays put) the shadow keeps exactly the same strength all the way through.
   */
  const outgoing = (t: number) => {
    if (t <= 0) return 1;
    if (t >= 1) return 0;
    const op = contactOpacity;
    if (op < 1e-6) return 1 - t;
    const d = 1 - t * op;
    return d <= 1e-9 ? 0 : Math.min(1, Math.max(0, (1 - (1 - op) / d) / op));
  };
  /** Sets the shadow from how far the turn has got. */
  const driveContact = (progress: number) => {
    const turn = contactTurn;
    if (!turn) return;
    const next = weightsOf("none");
    if (turn.from === turn.to) Object.assign(next, weightsOf(turn.from));
    else {
      // A page lands: the new shadow arrives over the last part of the turn. A page lifts: it changes early.
      const t = turn.landing ? smooth((progress - 0.55) / 0.45) : smooth(progress / 0.45);
      const incoming = keyOf[turn.to];
      const leaving = keyOf[turn.from];
      if (incoming) next[incoming] = t;
      if (leaving) next[leaving] = incoming ? outgoing(t) : 1 - t;
    }
    Object.assign(contactNow, next);
    Object.assign(contactGoal, next);
    applyContact();
  };

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
  // Each look's shaders are compiled once; switching between looks that have been prepared costs nothing.
  const warmedLooks = new Set<boolean>();
  let environmentRequest = 0;
  // The paper's look depends on the look (Simple/Studio) and the paper, not on brightness or the shadow settings,
  // so dragging a slider only changes the exposure or the shadow and never rebuilds the materials.
  let variant = "";
  const backdrop = createLitBackdrop(scene, requestPaint);
  const configure = (next: StudioSettings) => {
    next = {...next, material:paperFinish(next.material)};
    shadowCache.clear();
    settings = next;
    shadowsDirty = true;
    const mix = studioLightMix(next.strength);
    const nextVariant = `${next.studio ? 1 : 0}|${next.material}`;
    const variantChanged = nextVariant !== variant;
    const tone = next.studio ? studioTone : THREE.NoToneMapping;
    if (renderer.toneMapping !== tone) renderer.toneMapping = tone;
    // The brightness slider drives overall exposure so the change is obvious.
    renderer.toneMappingExposure = next.studio ? studioExposure(next.brightness) : 1;
    // The lighting is a real photograph. While one downloads, the previous lighting (or a plain even light) stays.
    const request = ++environmentRequest;
    if (!next.studio) scene.environment = null;
    else {
      const ready = environments.get(next.hdri);
      if (ready) scene.environment = diffuser.apply(ready, mix.hdri, environmentColours.get(next.hdri));
      else {
        if (!scene.environment) scene.environment = even().texture;
        void loadEnvironment(next.hdri).then((target) => {
          if (disposed || request !== environmentRequest) return;
          scene.environment = diffuser.apply(target ?? even(), mix.hdri, environmentColours.get(next.hdri));
          paint();
        });
      }
    }
    const pattern = next.studio ? HDRI_PRESETS.find(p => p.id === next.hdri)?.dapple : undefined;
    if (pattern && !dapples.has(pattern)) dapples.set(pattern, dappleTexture(pattern));
    sunPatch.map = pattern ? dapples.get(pattern)! : null;
    sunPatch.intensity = next.studio ? presetDirectLight(next.hdri, next.strength) : 0;
    sunPatch.penumbra = pattern === "window" || pattern === "blinds" ? .12 : .35;
    // The patterned light casts the moving sheet onto the backdrop; a shadow-only
    // directional source covers even environments without adding illumination.
    sunPatch.castShadow = next.studio && Boolean(pattern) && mix.hdri > 0;
    sunPatch.shadow.radius = 6;
    sunPatch.visible = Boolean(pattern);
    scene.environmentIntensity = next.studio ? (pattern ? 1 - .3 * mix.hdri : 1) : 0;
    // Studio illumination comes only from the diffused environment and preset pattern.
    light.position.set(-1.8, 2.8, 5.5);
    light.color.set(0xffffff);
    light.intensity = next.studio ? mix.top : 0;
    topLight.intensity = next.studio ? studioTopLight(next.topLight) : 0;
    light.shadow.radius = 6;
    ambient.intensity = next.studio ? mix.ambient : Math.PI;
    ambient.color.set(0xffffff);
    ambient.groundColor.set(next.studio ? 0xb7bdca : 0xffffff);
    // Studio shows only the real shadow cast by the light and the paper; the soft shadow is the Simple look's.
    contactOn = !next.studio && next.simpleShadow;
    contactOpacity = next.studio ? .2 : THREE.MathUtils.clamp(next.simpleShadowOpacity, 0, 1);
    applyContact();
    shadowCatcher.material.opacity = .3;
    shadowCatcher.visible = next.studio;
    light.castShadow = next.studio && (!pattern || mix.hdri === 0);
    const satin = next.material === "satin";
    if (variantChanged) variant = nextVariant;
    airDust.setIntensity(next.studio ? next.imperfections ?? 0 : 0);
    for (const m of pageMaterials) {
      setNaturalImperfections(m,next.studio ? next.imperfections ?? 0 : 0);
      const stickyMatte = Boolean(m.userData["stickyMatte"]);
      if (!stickyMatte) m.bumpMap = null;
      // Satin is smooth with a visible sheen; textured shows clear paper grain.
      m.bumpScale = next.studio && stickyMatte ? .0015 : 0;
      m.roughness = stickyMatte ? .97 : next.studio ? (satin ? 0.42 : 0.97) : 0.96;
      // Simple mode reproduces the source artwork independently of studio light.
      m.emissive.set(next.studio ? 0x000000 : 0xffffff);
      m.emissiveMap = next.studio ? null : m.map;
      m.color.set(next.studio ? 0xffffff : 0x000000);
      if (variantChanged) m.needsUpdate = true;
    }
    if (!warmedLooks.has(next.studio)) {
      warmedLooks.add(next.studio);
      warm();
    }
    frameCamera();
    if (variantChanged) paint();
    else requestPaint();
  };
  const show = (next: BookFaces, render = true) => {
    shadowsDirty = true;
    [left, right].forEach((mesh, i) => {
      mesh.visible = !!next[i];
      setMap(mesh.material, next[i] ?? null);
      const seed = seedFor(next[i]);
      if (mesh.userData["seed"] !== seed) shapePage(mesh, i === 0 ? -1 : 1, seed);
    });
    setContact(next);
    if (render) paint();
  };
  // On a slower device, step the picture's resolution down while pages turn rather than let the turn stutter.
  // It only ever steps down, a few times at most, so it can never flicker back and forth.
  let qualityDrops = 0;
  let slowFrames = 0;
  const watchSpeed = (frameMs: number) => {
    if (fixedQuality) return;
    slowFrames = frameMs > 18 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (slowFrames < 6 || qualityDrops >= 3 || pixelRatio <= 0.9) return;
    slowFrames = 0;
    // Resizing the drawing surface is itself a hitch, so it waits until the turn is over (see applyPendingQuality).
    qualityPending = true;
  };
  let qualityPending = false;
  const applyPendingQuality = () => {
    if (!qualityPending || qualityDrops >= 3 || pixelRatio <= 0.9) return;
    qualityPending = false;
    qualityDrops += 1;
    pixelRatio = Math.max(0.9, pixelRatio * 0.9);
    resize();
  };
  /** The most a turn advances in one frame, however slow that frame was. */
  const MAX_FRAME_STEP = 1000 / 60;
  const animate = (duration: number, update: (t: number) => void): Promise<void> => {
    if(captureClock) return captureFrames(duration,t=>{if(disposed)throw new Error("The renderer closed.");update(ease(t));paint();},captureClock);
    return new Promise<void>((resolve) => {
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
      finishAnimation = resolve;
      let start = 0;
      let previous = 0;
      let elapsed = 0;
      let lastFrame = 0;
      let frames = 0;
      const tick = (now: number) => {
        if (disposed) {
          resolve();
          return;
        }
        // Time starts from the first frame that is actually drawn: if that frame is slow (a texture reaching the
        // graphics card, say) the turn begins from the start rather than skipping ahead.
        // A slow frame (a hitch of any kind) holds the turn back instead of making it jump ahead: however long a
        // frame takes, the turn advances by at most one 60 Hz frame, limiting visible jumps.
        if (!start) {
          start = now;
          previous = now;
        }
        elapsed += Math.min(now - previous, MAX_FRAME_STEP);
        previous = now;
        const t = Math.min(1, elapsed / duration);
        update(ease(t));
        paint();
        // The first few frames of a turn are not representative (shaders, uploads), so they are not counted.
        if (lastFrame && ++frames > 2) watchSpeed(now - lastFrame);
        lastFrame = now;
        if (t < 1) frame = requestAnimationFrame(tick);
        else {
          finishAnimation = null;
          resolve();
        }
      };
      frame = requestAnimationFrame(tick);
    });
  };
  const pan = async (to: number, duration = 420) => {
    const from = focus;
    // Nothing to move: finish at once so the next page can be turned immediately.
    if (Math.abs(from - to) < 1e-6) return;
    const fromHeight = cameraHeight(zoom, from), toHeight = cameraHeight(zoom, to);
    await animate(duration, (t) => {
      focus = THREE.MathUtils.lerp(from, to, t);
      frameCamera(THREE.MathUtils.lerp(fromHeight, toHeight, t));
    });
  };
  const stickyPosition = new THREE.Vector3(), stickyNormal = new THREE.Vector3();
  const posesForTurn = (from: BookFaces, to: BookFaces, dir: 1 | -1) => {
    const seeds = [seedFor(from[dir === 1 ? 1 : 0]), seedFor(to[dir === 1 ? 0 : 1])];
    const restingSeeds = [seedFor(dir === 1 ? from[0] : to[0]), seedFor(dir === 1 ? to[1] : from[1])];
    const key = `${dir}|${seeds.join(":")}|${restingSeeds.join(":")}`;
    return turnGeometryCache.get(key, () => bakeTurnGeometry(geometry, turnGeometryWriter(geometry, ratio, dir, seeds, restingSeeds, SHEET_CLEARANCE)));
  };
  const shape = (progress: number, dir: 1 | -1) => {
    shadowProgress = progress; shadowDirection = dir;
    if (turnRestPages) {
      [left, right].forEach((mesh, i) => {
        const visible = !!turnRestPages![i] && turnRestVisible(progress, i === (dir === 1 ? 1 : 0));
        if (mesh.visible !== visible) { mesh.visible = visible; shadowsDirty = true; }
      });
    }
    if (bakedTurn) applyTurnPose(bakedTurn, progress, geometry);
    else return;
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
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
      front.geometry = forwardView as THREE.PlaneGeometry;
      back.geometry = (dir === 1 ? reverseGeometry : geometry) as THREE.PlaneGeometry;
    }
    attr.needsUpdate = true;
    const stickySample = { position: stickyPosition, normal: stickyNormal, floorZ: 0 };
    notes.turn(progress, dir, (u, v) => {
      const x = Math.min(32, Math.max(0, u * 32)), y = Math.min(16, Math.max(0, (1 - v) * 16));
      const x0 = Math.min(31, Math.floor(x)), y0 = Math.min(15, Math.floor(y));
      const tx = x - x0, ty = y - y0;
      const position = stickyPosition.set(0, 0, 0), normal = stickyNormal.set(0, 0, 0);
      const normals = geometry.getAttribute("normal");
      for (const [column, row, weight] of [[x0, y0, (1-tx)*(1-ty)], [x0+1, y0, tx*(1-ty)], [x0, y0+1, (1-tx)*ty], [x0+1, y0+1, tx*ty]]) {
        const index = row! * 33 + column!;
        position.x += attr.getX(index) * weight!; position.y += attr.getY(index) * weight!; position.z += attr.getZ(index) * weight!;
        normal.x += normals.getX(index) * weight!; normal.y += normals.getY(index) * weight!; normal.z += normals.getZ(index) * weight!;
      }
      normal.normalize().multiplyScalar(dir);
      const resting = position.x < 0 ? left : right;
      // Use the actual resting page's relief, including its saved seed.
      stickySample.floorZ = pageRelief(Math.abs(position.x), position.y / ratio + .5, resting.userData["seed"] as number);
      return stickySample;
    });
    if (tabPlan) tabs.turn(tabPlan, progress, dir);
    driveContact(progress);
  };
  const notes = createBookNotes(book, ratio, pageMaterials, () => right.material as THREE.MeshStandardMaterial, requestPaint);
  const tabs = createBookTabs(book, ratio, pageMaterials, () => right.material as THREE.MeshStandardMaterial, requestPaint, (x,y)=>pageRelief(Math.abs(x),y/ratio+.5,(x<0?left:right).userData["seed"] as number));
  /** How the tabs move during the turn in progress (set when a turn is prepared). */
  let tabPlan: TabPlan[] | null = null;
  configure(settings);
  resize();
  return {
    setCaptureClock(clock?:()=>Promise<void>) {captureClock=clock;},
    async captureReady() { await backdrop.ready(); if (!await loadEnvironment(settings.hdri)) throw new Error("Studio lighting could not be prepared."); },
    setFrameSink(sink?: (canvas: HTMLCanvasElement) => void) { frameSink = sink; paint(); },
    renderFrame: paint,
    setBackdrop(url: string | undefined, fit: Parameters<typeof backdrop.set>[1], lit: boolean, colour: string) {
      backdrop.set(url, fit, true, colour, lit);
    },
    setNotes: notes.set,
    notesReady: notes.has,
    prepareNotes: notes.prepare,
    clearNotes: notes.clear,
    noteProgress(id: string, progress: number) {
      notes.progress(id, progress);
      frameCamera();
      requestPaint();
    },
    setInset(value: number) {
      inset = Math.max(0, value);
      frameCamera();
      requestPaint();
    },
    setTabs: tabs.set,
    setTabRest(edges: Record<string, TabEdge>) {
      tabs.setRest(edges);
    },
    /** Where the tabs lie now, as % of the view, for the invisible buttons that make them pressable. */
    tabRects() {
      camera.updateMatrixWorld();
      return tabs.rects().map((r) => {
        const a = new THREE.Vector3(r.x0, r.y1, 0.01).project(camera);
        const b = new THREE.Vector3(r.x1, r.y0, 0.01).project(camera);
        return { id: r.id, x: (a.x + 1) * 50, y: (1 - a.y) * 50, width: (b.x - a.x) * 50, height: (a.y - b.y) * 50 };
      });
    },
    configure,
    show,
    prefetchTurn(from: BookFaces, to: BookFaces, dir: 1 | -1) { if (!disposed && !turning) posesForTurn(from, to, dir); },
    /** Uploads a page to the GPU ahead of time so a later turn does not stall. */
    /**
     * Gets everything the first turn and the Simple/Studio switch will need: with `bothLooks` the shaders for
     * both looks are compiled (by briefly applying the other look), and the lighting is downloaded and prepared.
     * Resolves when that is done, so turning can be held back until nothing is left to stall.
     */
    prepare(bothLooks: boolean, lightingCycle: readonly HdriId[] = []): Promise<void> {
      if (disposed) return Promise.resolve();
      if (bothLooks) {
        const current = settings;
        configure({ ...current, studio: !current.studio });
        configure(current);
      }
      const ids = [...new Set([...(bothLooks || settings.studio ? [settings.hdri] : []), ...lightingCycle])];
      return Promise.all(ids.map(loadEnvironment)).then(() => {
        if (disposed || !lightingCycle.length) return;
        // Compile projected window/slat lighting before the demonstration is visible.
        const current = settings;
        try {
          for (const hdri of lightingCycle) {
            configure({ ...current, studio: true, hdri });
            warm();
          }
        } finally { configure(current); }
      });
    },
    /** The largest picture the graphics card can take on a side. */
    maxTextureSize: renderer.capabilities.maxTextureSize as number,
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
      zoom = THREE.MathUtils.clamp(scale, .5, 3);
      focus = target;
      frameCamera();
      paint();
    },
    zoomAt(scale: number, x: number, y: number) {
      const aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
      const delta = cameraHeight(zoom) - cameraHeight(scale);
      panX += (x - 0.5) * delta * aspect;
      panY += (0.5 - y) * delta;
      zoom = THREE.MathUtils.clamp(scale, .5, 3);
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
    noteBounds(id: string) {
      const box = notes.boundsFor(id); if (!box) return null;
      camera.updateMatrixWorld();
      const xs: number[] = [], ys: number[] = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const point = new THREE.Vector3(x,y,z).project(camera); xs.push((point.x+1)*50); ys.push((1-point.y)*50);
      }
      return { x:Math.min(...xs), y:Math.min(...ys), width:Math.max(...xs)-Math.min(...xs), height:Math.max(...ys)-Math.min(...ys) };
    },
    pageBounds() {
      camera.updateMatrixWorld();
      return [-1, 0].map(x => {
        const top = new THREE.Vector3(x, ratio / 2, 0).project(camera);
        const bottom = new THREE.Vector3(x + 1, -ratio / 2, 0).project(camera);
        return { x: (top.x + 1) * 50, y: (1 - top.y) * 50, width: (bottom.x - top.x) * 50, height: (top.y - bottom.y) * 50 };
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
    async prepareTurn(from: BookFaces, to: BookFaces, dir: 1 | -1, destinationFocus: number, speed = 1, plan: TabPlan[] | null = null, dragging = false) {
      if (disposed) return;
      const openingCover = dir === 1 && !from[0] && Boolean(from[1] && to[0] && to[1]);
      if (openingCover && !dragging) speed *= 1.8;
      bakedTurn = posesForTurn(from, to, dir);
      for (const canvas of [...from, ...to]) if (canvas) renderer.initTexture(textureFor(canvas));
      turning = true;
      applyPendingQuality();
      resize();
      notes.beginTurn(dir === 1 ? 1 : 0);
      tabPlan = plan;
      const originalFocus = focus;
      // A cover first aligns with the open spread. The sheet then turns.
      if (!narrow && focus !== 0) await pan(0, (dragging ? 140 : 420) * speed);
      if (disposed) return;
      const moving = dir === 1 ? 1 : 0;
      const landing = dir === 1 ? 0 : 1;
      setMap(frontMat, from[moving]);
      setMap(backMat, to[landing]);
      // Prepare resting textures now, but reveal the page below only after
      // 5% travel. Hide the receiving page over the last 5% as well.
      contactTurn = { from: kindOf(from), to: kindOf(to), landing: (to[0] ? 1 : 0) + (to[1] ? 1 : 0) > (from[0] ? 1 : 0) + (from[1] ? 1 : 0) };
      show(dir === 1 ? [from[0], to[1]] : [to[0], from[1]], false);
      turnRestPages = [left.visible, right.visible];
      sheet.visible = true;
      // Everything this turn needs reaches the graphics card now (the pictures, the sheet in mid-turn), and the card
      // is waited for, so the first frames of the animation have nothing left to stall on.
      shape(0, dir);
      paint();
      try {
        /* no blocking GPU flush: it froze the first frame */
      } catch {
        /* not available: the turn simply starts */
      }
      draggedTurn = { from, to, dir, destinationFocus, originalFocus, progress: 0, speed };
    },
    /** How far the turn in progress has got (0 to 1), or null when no page is turning. */
    turnProgress(): number | null {
      return draggedTurn ? draggedTurn.progress : null;
    },
    dragTurn(progress: number) {
      const turn = draggedTurn;
      if (!turn || disposed) return;
      turn.progress = THREE.MathUtils.clamp(progress, 0, 1);
      // Coalesce geometry and normal updates as well as the actual draw.
      pendingDragShape = () => shape(turn.progress, turn.dir);
      requestPaint();
    },
    async settleTurn(complete: boolean) {
      pendingDragShape = null;
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
      turnRestPages = null;
      notes.endTurn(complete);
      contactTurn = null;
      if (tabPlan) {
        tabs.setRest(Object.fromEntries(tabPlan.map((p) => [p.id, complete ? p.to : p.from])));
        tabPlan = null;
      }
      show(complete ? to : from, false);
      draggedTurn = null;
      bakedTurn = null;
      paint();
      await pan(complete ? destinationFocus : originalFocus, narrow ? 0 : 260 * speed);
      if (!disposed) {
        turning = false;
        // Restore reading detail only after both the sheet and camera settle.
        resize();
      }
    },
    async turn(from: BookFaces, to: BookFaces, dir: 1 | -1, destinationFocus: number, speed = 1, plan: TabPlan[] | null = null) {
      await this.prepareTurn(from, to, dir, destinationFocus, speed, plan);
      // One frame to let everything settle, so the turn's clock starts on a quiet frame.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await this.settleTurn(true);
    },
    dispose() {
      turnGeometryCache.clear();
      bakedTurn = null;
      shadowCache.clear();
      notes.clear();
      tabs.clear();
      airDust.dispose();
      backdrop.dispose();
      diffuser.dispose();
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(paintQueued);
      finishAnimation?.();
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.domElement.removeEventListener("webglcontextrestored", restored);
      texCache.forEach((t) => t.dispose());
      texCache.clear();
      placeholder.dispose();
      cancelAnimationFrame(contactFrame);
      spreadArt.texture.dispose();
      pageArt.texture.dispose();
      environments.forEach((target) => target.dispose());
      evenLight?.dispose();
      dapples.forEach(texture => texture.dispose());
      sunPatch.shadow.map?.dispose();
      light.shadow.map?.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) geometries.add(o.geometry);
      });
      geometries.add(geometry);
      geometries.add(reverseGeometry);
      geometries.forEach((g) => g.dispose());
      pageMaterials.forEach((m) => m.dispose());
      Object.values(contact).forEach((mesh) => mesh.material.dispose());
      shadowCatcher.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
export type BookScene = ReturnType<typeof createBookScene>;

