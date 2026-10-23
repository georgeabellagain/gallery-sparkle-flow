import { rigidCoverWriter, COVER_OVERHANG, coverArtZ, type CoverRest } from "./rigid-cover";
import { sampleCoverColour } from "./cover-colour";
import { studioShadowSize, studioShadowRadius } from "./shadow-quality";
import { createBookBinding, sideShare, type BindingSide, type RibbonTurn } from "./book-binding";
import { createGutterShade } from "./gutter-shade";
import { createTurnShade } from "./turn-shade";
import { readableShadeStyle, shadeStyleIndex, shadeStyleUniform, styleShadowMaterial, type ShadeStyle } from "./shade-style";
import { createPageVideo, type PageVideoSource } from "./page-video";
import { bindingTurnCurve, bookStyleProfile, type BookStyle } from "./book-style";
import type { TabStyle } from "./tab-style";
import { clampOrbit, isOrbiting, orbitDirection, orbitTilt, type Orbit } from "./orbit-view";
import { constrainFoldPointer,pointerFoldProgress, type FoldPoint, type TurnCurve } from "./turn-curve";
import { createCachedLightMask } from "./cached-light-mask";
import { createSettledPaperCache } from "./settled-paper";
import { presetShadow } from "./lighting";
import { updatePaperTangents } from "./paper-tangents";
import { createPaperTextures } from "./paper-textures";
import { applyTurnPose, bakeTurnGeometry, createTurnGeometryCache, turnGeometryWriter, restingTurnNormals, writePointerFold, type TurnPose } from "./turn-geometry-cache";
import { createRestingPageShadows } from "./resting-page-shadows";
import { createAirDust, setNaturalImperfections } from "./natural-imperfections";
import { turnEase, captureFrames, turnRestVisible, styledTurnEase, turnDurationScale, readableTurnStyle, type TurnStyle } from "./turn-motion";
import { createEnvironmentDiffuser } from "./environment-diffusion";
import { dappleTexture } from "./dapple-light";
import { bookSurfaceRatio, bookMotionBudget } from "./render-budget";
import { createBookNotes } from "./book-notes";
import { pageRelief } from "./page-relief";
import { createBookTabs } from "./book-tabs";
import type { TabEdge, TabPlan } from "./tab-geometry";
import * as THREE from "three";
import { createLitBackdrop } from "./lit-backdrop";
import { paperFinish, type SurfaceKind } from "./surface";
import { loadPreparedEnvironment } from "./prepared-environment";
import type { PreparedEnvironment } from "./environment-pixels";
import { DEFAULT_SIMPLE_SHADOW_OPACITY, HDRI_PRESETS, studioLightMix, studioTopLight, presetDirectLight, studioExposure, type HdriId } from "./lighting";
import { GPU_BYTES, deviceTier, gpuBytesOf } from "./resolution";

export { HDRI_PRESETS };
export type { HdriId };


export type StudioSettings = {
  studio: boolean;
  turnStyle?: TurnStyle;
  turnSpeed?: number;
  turnCurve?: TurnCurve;
  bookStyle?: BookStyle;
  ribbon?: boolean;
  ribbonColour?: string;
  /** Gutter of the spread the ribbon marks (see ribbonPlacement); omitted is the plain tail. */
  ribbonGutter?: number;
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
  /** Simple look only: how shade is drawn (smooth, stippled, hatched...). */
  shadeStyle?: ShadeStyle;
  tabStyle?: TabStyle;
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
  renderer.shadowMap.type = THREE.PCFShadowMap;
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
  let environmentGenerator: THREE.PMREMGenerator | undefined;
  const toEnvironment = (data: Uint16Array, width: number, height: number) => {
    const hdr = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    hdr.minFilter = hdr.magFilter = THREE.LinearFilter;
    hdr.generateMipmaps = false;
    hdr.needsUpdate = true;
    const pmrem = environmentGenerator ??= new THREE.PMREMGenerator(renderer);
    const target = pmrem.fromEquirectangular(hdr);
    hdr.dispose();
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
  const install = (id: HdriId, { width, height, pixels, colour }: PreparedEnvironment) => {
    environmentColours.set(id, colour);
    const target = toEnvironment(pixels, width, height);
    environments.set(id, target);
    return target;
  };
  /** The full photograph replaces its preview only while no page is turning, so a turn never stalls on it. */
  const upgradeEnvironment = (id: HdriId, prepared: PreparedEnvironment) => {
    if (disposed) return;
    if (turning) { setTimeout(() => upgradeEnvironment(id, prepared), 250); return; }
    const previous = environments.get(id);
    const target = install(id, prepared);
    if (settings.studio && settings.hdri === id) {
      scene.environment = diffuser.apply(target, studioLightMix(settings.strength).hdri, environmentColours.get(id));
      requestPaint(false);
    }
    if (previous && previous !== target) previous.dispose();
  };
  const loadEnvironment = (id: HdriId): Promise<THREE.WebGLRenderTarget | null> => {
    const hit = environments.get(id);
    if (hit) return Promise.resolve(hit);
    let promise = loading.get(id);
    if (!promise) {
      // The small preview (about 130 KB) lights the paper first; the full photograph follows. Whichever is
      // ready first is used, so a full file prepared earlier is never replaced by its preview.
      const full = loadPreparedEnvironment(id, "full");
      promise = Promise.any([
        full.then((prepared) => ({ prepared, final: true })),
        loadPreparedEnvironment(id, "preview").then((prepared) => ({ prepared, final: false })),
      ])
        .then(({ prepared, final }) => {
          if (disposed) return null;
          const target = install(id, prepared);
          if (!final) void full.then((better) => upgradeEnvironment(id, better), () => {});
          return target;
        })
        .catch(() => null)
        .finally(() => loading.delete(id));
      loading.set(id, promise);
    }
    return promise;
  };

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  /** The camera as it would be without the 3D view (straight down); the backdrop is framed for it. */
  const neutralCamera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  const book = new THREE.Group();
  scene.add(book);
  const binding = createBookBinding(book,ratio);
  const ambient = new THREE.HemisphereLight(0xffffff, 0xd5cfbf, 2.2);
  const light = new THREE.DirectionalLight(0xffffff, 2.3);
  light.position.set(-1.8, 2.8, 5.5);
  light.castShadow = true;
  const topLight = new THREE.DirectionalLight(0xffffff, 0);
  topLight.position.set(0, 0, 6); topLight.castShadow = false;
  // The studio's lights, fixed in the room: the 3D view moves the camera round them, like walking round a table.
  const lightRig = new THREE.Group();
  scene.add(lightRig);
  lightRig.add(topLight);
  // A tight frustum keeps shadow detail high.
  const shadowExtent = Math.hypot(1, ratio / 2) + 0.7;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.left = -shadowExtent;
  light.shadow.camera.right = shadowExtent;
  light.shadow.camera.top = shadowExtent;
  light.shadow.camera.bottom = -shadowExtent;
  light.shadow.camera.updateProjectionMatrix();
  light.shadow.normalBias = 0.012;
  light.shadow.bias = -0.0001;
  light.shadow.radius = studioShadowRadius(3,light.shadow.mapSize.x);
  lightRig.add(ambient, light);
  const sunPatch = new THREE.SpotLight(0xfff3dc, 0, 0, Math.PI / 5, .35, 0);
  sunPatch.position.set(-1.8, 2.8, 5.5);
  sunPatch.target.position.set(0, 0, 0);
  sunPatch.shadow.mapSize.set(1024, 1024);
  sunPatch.shadow.normalBias = .012;
  sunPatch.shadow.bias = -.0001;
  sunPatch.shadow.camera.near = .1;
  sunPatch.shadow.camera.far = 12;
  const cachedLightMask = createCachedLightMask();
  const dapples = new Map<string, THREE.CanvasTexture>();
  lightRig.add(sunPatch, sunPatch.target);

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
    // Smooth, stippled or hatched, as the creator chose for Simple (shade-style).
    styleShadowMaterial(mesh.material);
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
  const gutter = createGutterShade();
  const pageVideo = createPageVideo();
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
    cachedLightMask.apply(mat);
    gutter.apply(mat);
    pageVideo.apply(mat);
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

  const settledPaper = createSettledPaperCache();

  /** Shapes a resting page: curved, with its own small imperfections. */
  /** Board thickness of the current style, used to place hardback covers. */
  const boardDepth = () => bookStyleProfile(settings.bookStyle).board;
  const shapePage = (mesh: THREE.Mesh, side: -1 | 1, seed: number, rigid=false, rest: CoverRest="open") => {
    settledPaper.invalidate(mesh);
    const positions = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const coverZ = coverArtZ(rest, boardDepth());
    for (let i = 0; i < positions.count; i++) {
      // Reset the canonical order when a different page replaces a saved back face.
      const u=(i%33)/32, v=1-Math.floor(i/33)/16;
      const x=u-.5;
      positions.setXYZ(i,rigid?x*(1+2*COVER_OVERHANG)+side*COVER_OVERHANG:x,(v-.5)*(ratio+(rigid?2*COVER_OVERHANG:0)),rigid?coverZ:pageRelief(.5+side*x,v,seed));
      (mesh.geometry.getAttribute("uv") as THREE.BufferAttribute).setXY(i,u,v);
    }
    positions.needsUpdate = true;
    (mesh.geometry.getAttribute("uv") as THREE.BufferAttribute).needsUpdate=true;
    const material=mesh.material as THREE.MeshStandardMaterial;
    if(material.side!==THREE.FrontSide){material.side=THREE.FrontSide;material.needsUpdate=true;}
    mesh.geometry.computeVertexNormals();
    updatePaperTangents(mesh.geometry);
    mesh.geometry.computeBoundingSphere();
    mesh.userData["seed"] = seed;
    mesh.userData["rigidCover"] = rigid;
    mesh.userData["coverRest"] = rigid ? rest : undefined;
    mesh.userData["coverZ"] = rigid ? coverZ : 0;
  };
  const left = new THREE.Mesh(new THREE.PlaneGeometry(1, ratio, 32, 16), material());
  const right = new THREE.Mesh(new THREE.PlaneGeometry(1, ratio, 32, 16), material());
  // Simple's shadow on the page under a turning sheet (Studio's comes from the light itself).
  const turnShade = createTurnShade();
  turnShade.apply(left.material as THREE.Material);
  turnShade.apply(right.material as THREE.Material);
  shapePage(left, -1, 0);
  shapePage(right, 1, 0);
  left.position.set(-0.5, 0, 0);
  right.position.set(0.5, 0, 0);
  left.receiveShadow = right.receiveShadow = true;
  book.add(left, right);
  const restingShadows = createRestingPageShadows(book, [left, right]);

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
  updatePaperTangents(geometry);
  updatePaperTangents(reverseGeometry, true);
  const frontMat = material();
  const backMat = material(THREE.BackSide);
  const front = new THREE.Mesh(geometry, frontMat);
  const back = new THREE.Mesh(reverseGeometry, backMat);
  front.castShadow = true;
  // Both faces share geometry and double-sided shadow material; cast this sheet only once.
  back.castShadow = false;
  front.receiveShadow = back.receiveShadow = true;
  front.frustumCulled = back.frustumCulled = false;
  // A hardback cover turns as a real board: these carry its two printed faces (see binding.turnCover).
  const coverFrontMat = material();
  const coverBackMat = material();
  /** Resting positions of the cover in the turn in progress, or null for a paper turn. */
  let rigidTurn: { from: CoverRest; to: CoverRest; board: "front" | "back" } | null = null;
  const coverRestOf = (faces: BookFaces): CoverRest => (faces[0] && faces[1] ? "open" : "closed");
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
  let draggedTurn: { from: BookFaces; to: BookFaces; dir: 1 | -1; destinationFocus: number; originalFocus: number; progress: number; speed: number; style: TurnStyle; rigid:boolean;
    /** A soft turn dragged by the reader follows the pointer: the height grabbed and where the pointer is, in page units. */
    pointer?: { allowed: boolean; grabY: number; at: FoldPoint; seeds: number[]; sheetSeeds: number[]; endNormals: [Float32Array, Float32Array] } } | null = null;
  // Pointer to book-plane conversion for turns that follow the pointer.
  const pointerRay = new THREE.Raycaster(), pointerNdc = new THREE.Vector2(), pointerInverse = new THREE.Matrix4();
  const pointerOrigin = new THREE.Vector3(), pointerDirection = new THREE.Vector3();
  /** Where a screen point falls on the book's page plane, in book units (spine at 0, page edges at ±1). */
  const bookPoint = (clientX: number, clientY: number) => {
    const r = renderer.domElement.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    pointerNdc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    pointerRay.setFromCamera(pointerNdc, camera);
    book.updateMatrixWorld();
    pointerInverse.copy(book.matrixWorld).invert();
    pointerOrigin.copy(pointerRay.ray.origin).applyMatrix4(pointerInverse);
    pointerDirection.copy(pointerRay.ray.direction).transformDirection(pointerInverse);
    if (Math.abs(pointerDirection.z) < 1e-6) return null;
    const t = -pointerOrigin.z / pointerDirection.z;
    return { x: pointerOrigin.x + pointerDirection.x * t, y: pointerOrigin.y + pointerDirection.y * t };
  };

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
    pageVideo.assign(mat, canvas);
  };
  const surfaceSize = new THREE.Vector2();
  let pendingDragShape: (() => void) | null = null;
  const paint = () => {
    if (disposed) return;
    // Held while shaders compile (see warm); the finished compile asks for this frame again.
    if (shadersPending && !turning && !captureClock && !frameSink && !fixedQuality) return;
    // A direct animation draw supersedes an input/contact-shadow draw queued
    // for the same frame. Avoid shading the fullscreen surface twice.
    if (paintQueued) { cancelAnimationFrame(paintQueued); paintQueued = 0; }
    // Fullscreen can change layout before ResizeObserver delivers its callback.
    // Never draw a new camera aspect into a buffer with the previous aspect.
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    // Keep shadow edges detailed even when adaptive animation quality lowers
    // the main canvas resolution. Reallocate only when the output tier changes.
    const shadowSize=studioShadowSize(w,h,window.devicePixelRatio,renderer.capabilities.maxTextureSize,fixedQuality);
    for(const source of [light,sunPatch])if(source.shadow.mapSize.x!==shadowSize){
      const radius=source.shadow.radius*512/source.shadow.mapSize.x;
      source.shadow.map?.dispose();source.shadow.map=null;
      source.shadow.mapSize.set(shadowSize,shadowSize);
      source.shadow.radius=studioShadowRadius(radius,shadowSize);
      source.shadow.needsUpdate=true;shadowsDirty=true;
    }
    const size = renderer.getSize(surfaceSize);
    if (size.x !== w || size.y !== h) {
      renderer.setSize(w, h, false);
      frameCamera();
    }
    const update = pendingDragShape;
    pendingDragShape = null;
    update?.();
    // A picture background is a solid floor: in the 3D view it stays put in the room and simply reaches further,
    // framed as for the straight-down camera so its picture never zooms.
    const orbitingNow = isOrbiting(orbit);
    backdrop.frame(orbitingNow ? neutralCamera : camera, w, h, Math.max(ratio * 1.1 + FRAME_PAD, 2.32 / camera.aspect) * (1 + inset));
    backdrop.extend(orbitingNow);
    // Output-sized filtered maps remain attached to the lights. Moving sheets and notes
    // update once per displayed frame; idle scenes only refresh when dirtied.
    // Keep hidden receiving/covered pages in the shadow pass throughout a turn.
    restingShadows.sync(turnRestPages ?? [left.visible, right.visible]);
    binding.sync(turnRestPages ?? [left.visible,right.visible],[left,right].map((mesh,index):BindingSide=>({
      kind: mesh.userData["rigidCover"] ? (mesh.userData["coverRest"] as CoverRest) : "page",
      share: sideShare(index as 0|1, mesh.userData["leaf"] as number, mesh.userData["leaves"] as number),
      leaf: mesh.userData["leaf"] as number | undefined,
    })) as [BindingSide,BindingSide]);
    // Camera-only movement reuses the same world-space shadow maps.
    renderer.shadowMap.needsUpdate = shadowsDirty;
    pageVideo.update();
    renderer.render(scene, camera);
    frameSink?.(renderer.domElement);
    shadowsDirty = false;
  };
  /** Camera/backdrop changes reuse live shadows; geometry/light changes invalidate them. */
  const requestPaint = (shadowChanged = true) => {
    shadowsDirty ||= shadowChanged;
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
  /** The 3D view's angle over the book (0, 0 looks straight down). */
  let orbit: Orbit = { yaw: 0, pitch: 0 };
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
    if (isOrbiting(orbit)) {
      // The 3D view always circles the middle of the book; panning doesn't apply.
      // Step back as the view leans, so the near edge of the book stays in frame.
      neutralCamera.fov = camera.fov; neutralCamera.aspect = camera.aspect;
      neutralCamera.position.set(focus, 0, distance); neutralCamera.lookAt(focus, 0, 0);
      neutralCamera.updateProjectionMatrix(); neutralCamera.updateMatrixWorld();
      const d = orbitDirection(orbit), away = distance * (1 + 0.45 * Math.sin(orbitTilt(orbit)));
      camera.position.set(focus + d.x * away, d.y * away, d.z * away);
      camera.lookAt(focus, 0, 0);
   } else {
     camera.position.set(focus + panX, panY, distance);
      camera.lookAt(focus + panX, panY, 0);
    }
    camera.updateProjectionMatrix();
  };
  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    // A big window gets a slightly lower pixel density rather than a surface too large for the graphics card.
    // CSS pixels are not a minimum: a 4K fullscreen canvas must still obey
    // the GPU budget. Preserve HD page textures independently of this surface.
    const budget = fixedQuality ? 8_294_400 : bookMotionBudget(compact ? MAX_SURFACE_PIXELS_SMALL : MAX_SURFACE_PIXELS, turning, pixelRatio / readingRatio);
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
    environmentGenerator?.dispose(); environmentGenerator = undefined;
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

  /**
   * Shaders still being compiled. They compile in parallel, off the main thread where the browser supports it
   * (KHR_parallel_shader_compile), so the pictures keep decoding meanwhile; a draw before then would wait for
   * them, so drawing is held (never during a turn or a capture) and resumes once they are ready.
   */
  let compiling: Promise<unknown> = Promise.resolve();
  let shadersPending = false;
  /** Compiles the page shaders now so the first turn does not stall. */
  const warm = () => {
    const before: [boolean, boolean, boolean] = [left.visible, right.visible, sheet.visible];
    const sides: [THREE.Side, THREE.Side] = [frontMat.side, backMat.side];
    left.visible = right.visible = sheet.visible = true;
    const jobs: Promise<unknown>[] = [];
    try {
      // Forward and backward turns use different shader variants for the sheet.
      for (const dir of [1, -1] as const) {
        frontMat.side = dir === 1 ? THREE.FrontSide : THREE.BackSide;
        backMat.side = dir === 1 ? THREE.BackSide : THREE.FrontSide;
        frontMat.needsUpdate = true;
        backMat.needsUpdate = true;
        // Each call requests the programs for the state it sees, so the variants are fixed before the sides change.
        jobs.push(renderer.compileAsync(scene, camera).catch(() => undefined));
      }
    } catch {
      /* shaders will compile on first draw instead */
    }
    if (jobs.length) {
      shadersPending = true;
      const all: Promise<unknown> = (compiling = Promise.all([compiling, ...jobs]).then(() => {
        if (compiling !== all || disposed) return;
        shadersPending = false;
        requestPaint();
      }));
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
  const paperTextures = createPaperTextures(() => {
    // New normal/roughness maps change the shader variant. Warm both turn
    // directions before these maps can cause a first-turn compilation hitch.
    warmedLooks.delete(true);
    if (settings.studio && !disposed) { warm(); warmedLooks.add(true); }
    requestPaint(false);
  });
  let variant = "";
  const backdrop = createLitBackdrop(scene, () => requestPaint(false));
  cachedLightMask.apply(backdrop.material);
  const configure = (next: StudioSettings) => {
    next = {...next, material:paperFinish(next.material)};
    settings = next;
    binding.setDetails({ribbon:next.ribbon,ribbonColour:next.ribbonColour,ribbonGutter:next.ribbonGutter});
    binding.set(next.bookStyle,next.studio);
    const rest: CoverRest = left.visible && right.visible ? "open" : "closed";
    [left,right].forEach((mesh,i)=>{
      const rigid=next.bookStyle==="hardback"&&Boolean(mesh.userData["coverBoard"]);
      const moved=rigid&&(mesh.userData["coverRest"]!==rest||mesh.userData["coverZ"]!==coverArtZ(rest,boardDepth()));
      if(mesh.userData["rigidCover"]!==rigid||moved)shapePage(mesh,i===0?-1:1,mesh.userData["seed"] as number,rigid,rest);
    });
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
    const shadow = presetShadow(next.hdri);
    if (pattern && !dapples.has(next.hdri)) dapples.set(next.hdri, dappleTexture(pattern, shadow));
    sunPatch.map = pattern ? dapples.get(next.hdri)! : null;
    sunPatch.position.set(...shadow.position);
    sunPatch.target.position.set(shadow.offset[0]/40,shadow.offset[1]/40,0);
    sunPatch.intensity = next.studio ? presetDirectLight(next.hdri, next.strength) : 0;
    sunPatch.penumbra = shadow.penumbra;
    cachedLightMask.set(next.hdri, pattern ? dapples.get(next.hdri)! : null, sunPatch.angle, sunPatch.penumbra);
    // The patterned light casts the moving sheet onto the backdrop; a shadow-only
    // directional source covers even environments without adding illumination.
    sunPatch.castShadow = next.studio && Boolean(pattern) && mix.hdri > 0;
    sunPatch.shadow.radius = studioShadowRadius(shadow.radius,sunPatch.shadow.mapSize.x);
    sunPatch.visible = Boolean(pattern);
    scene.environmentIntensity = next.studio ? (pattern ? 1 - .3 * mix.hdri : 1) : 0;
    // Studio illumination comes only from the diffused environment and preset pattern.
    light.position.set(...shadow.position);
    light.color.set(0xffffff);
    light.intensity = next.studio ? mix.top : 0;
    topLight.intensity = next.studio ? studioTopLight(next.topLight) : 0;
    light.shadow.radius = studioShadowRadius(shadow.radius,light.shadow.mapSize.x);
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
    if (variantChanged) variant = nextVariant;
    airDust.setIntensity(next.studio ? next.imperfections ?? 0 : 0);
    // Bound pages darken softly into the spine. Simple gets only a slim, light seam so artwork stays true.
    if (next.studio) gutter.set(next.bookStyle !== "flipbook" ? .32 : .18);
    else gutter.set(.14, .07);
    turnShade.enable(next.studio);
    // Hand-drawn shading belongs to the flat, illustrated Simple look; Studio's light stays smooth.
    shadeStyleUniform.value = next.studio ? 0 : shadeStyleIndex(readableShadeStyle(next.shadeStyle));
    tabs.setStyle(next.tabStyle);
    for (const m of pageMaterials) {
      setNaturalImperfections(m,next.studio ? next.imperfections ?? 0 : 0);
      const stickyMatte = Boolean(m.userData["stickyMatte"]);
      if (!stickyMatte) m.bumpMap = null;
      // Satin is smooth with a visible sheen; textured shows clear paper grain.
      m.bumpScale = next.studio && stickyMatte ? .0015 : 0;
      paperTextures.apply(m, next.studio && !stickyMatte ? next.material : "matte");
      m.roughness = stickyMatte ? .97 : next.studio ? m.roughness : .96;
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
    const rest = coverRestOf(next);
    [left, right].forEach((mesh, i) => {
      mesh.visible = !!next[i];
      setMap(mesh.material, next[i] ?? null);
      const seed = seedFor(next[i]);
      const page=next[i];
      mesh.userData["coverBoard"]=page?.dataset["coverBoard"]==="true";
      // Leaf position decides how much of the page block lies under this side.
      if(page){
        mesh.userData["leaf"]=Number(page.dataset["seed"]);
        const leaves=Number(page.dataset["leafCount"]);
        mesh.userData["leaves"]=leaves;
        if(Number.isFinite(leaves))binding.setLeaves(leaves);
      }
      const rigid=settings.bookStyle==="hardback"&&mesh.userData["coverBoard"]===true;
      if(!rigid && settings.material === "paper_0022" && page && settledPaper.apply(page,mesh)) {
        mesh.userData["settledPaper"]=true;mesh.userData["seed"]=seed;
      } else if(mesh.userData["seed"] !== seed || mesh.userData["settledPaper"] || mesh.userData["rigidCover"]!==rigid || (rigid && mesh.userData["coverRest"]!==rest)) {
        shapePage(mesh,i===0?-1:1,seed,rigid,rest);mesh.userData["settledPaper"]=false;
      }
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
  const animate = (duration: number, update: (t: number) => void, easing = ease): Promise<void> => {
    if(captureClock) return captureFrames(duration,t=>{if(disposed)throw new Error("The renderer closed.");update(easing(t));paint();},captureClock);
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
        update(easing(t));
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
  /** The gutter of a spread (leaves to its left), as ribbonPlacement counts it. */
  const gutterOf = (faces: BookFaces) => faces[1] ? Number(faces[1].dataset["seed"]) : faces[0] ? Number(faces[0].dataset["seed"]) + 1 : NaN;
  /**
   * How a turn moves the ribbon lying on the marked spread: leaving forward it rides away on the turning page;
   * arriving backward it arrives on one; otherwise it stays on the resting right-hand page as a sheet covers or uncovers it.
   */
  const ribbonTurnFor = (from: BookFaces, to: BookFaces, dir: 1 | -1): RibbonTurn | null => {
    const mark = settings.ribbonGutter;
    if (mark === undefined || !settings.ribbon || settings.bookStyle === "flipbook") return null;
    if (gutterOf(from) === mark) return dir === 1 ? { carried: true, sign: 1, revealing: false } : { carried: false, sign: 1, revealing: false };
    if (gutterOf(to) === mark) return dir === 1 ? { carried: false, sign: 1, revealing: true } : { carried: true, sign: -1, revealing: false };
    return null;
  };
  /** A hardback board turns when either face of the moving sheet is a cover. */
  const isRigidTurn = (from: BookFaces, to: BookFaces, dir: 1 | -1) =>
    settings.bookStyle==="hardback"&&[from[dir===1?1:0],to[dir===1?0:1]].some(canvas=>canvas?.dataset["coverBoard"]==="true");
  const posesForTurn = (from: BookFaces, to: BookFaces, dir: 1 | -1) => {
    const seeds = [seedFor(from[dir === 1 ? 1 : 0]), seedFor(to[dir === 1 ? 0 : 1])];
    const restingSeeds = [seedFor(dir === 1 ? from[0] : to[0]), seedFor(dir === 1 ? to[1] : from[1])];
    const rigid=isRigidTurn(from,to,dir);
    const curve = rigid?`rigid:${coverRestOf(from)}:${coverRestOf(to)}:${boardDepth()}`:bindingTurnCurve(settings.bookStyle,settings.turnCurve,from,to);
    const key = `${curve}|${dir}|${seeds.join(":")}|${restingSeeds.join(":")}`;
    return turnGeometryCache.get(key, () => rigid
      ? bakeTurnGeometry(geometry,rigidCoverWriter(geometry,ratio,dir,coverArtZ(coverRestOf(from),boardDepth()),coverArtZ(coverRestOf(to),boardDepth())),128)
      : bakeTurnGeometry(geometry,turnGeometryWriter(geometry,ratio,dir,seeds,restingSeeds,SHEET_CLEARANCE,curve as TurnCurve),128,[restingTurnNormals(geometry,ratio,dir,seeds[0]!,dir),restingTurnNormals(geometry,ratio,-dir as 1|-1,seeds[1]!,-dir)]));
  };
  /** Poses the turning sheet at `progress`: from the baked turn, or with `write` (a soft turn following the pointer). */
  const shape = (progress: number, dir: 1 | -1, write?: () => void) => {
    shadowsDirty = true;
    if (turnRestPages) {
      [left, right].forEach((mesh, i) => {
        const visible = !!turnRestPages![i] && turnRestVisible(progress, i === (dir === 1 ? 1 : 0));
        if (mesh.visible !== visible) { mesh.visible = visible; shadowsDirty = true; }
      });
    }
    if (write) write();
    else if (bakedTurn) applyTurnPose(bakedTurn, progress, geometry);
    else return;
    // A hardback cover is drawn by its own rigid board; the paper sheet only carries notes and tabs.
    front.visible = back.visible = !rigidTurn;
    binding.turnCover(rigidTurn ? progress : null, dir, rigidTurn?.from ?? "open", rigidTurn?.to ?? "open", coverFrontMat, coverBackMat, rigidTurn?.board);
    if (settings.material === "paper_0027" || settings.material === "paper_0022") {
      updatePaperTangents(geometry);
      updatePaperTangents(reverseGeometry, true);
    }
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
    const sheetSample = (u: number, v: number) => {
      const x = Math.min(32, Math.max(0, u * 32)), y = Math.min(16, Math.max(0, (1 - v) * 16));
      const x0 = Math.min(31, Math.floor(x)), y0 = Math.min(15, Math.floor(y));
      const tx = x - x0, ty = y - y0;
      const position = stickyPosition.set(0, 0, 0), normal = stickyNormal.set(0, 0, 0);
      const normals = geometry.getAttribute("normal");
      // Four bilinear samples without allocating nested arrays per sticky vertex.
      for (let corner = 0; corner < 4; corner++) {
        const column = x0 + (corner & 1), row = y0 + (corner >> 1);
        const weight = (corner & 1 ? tx : 1-tx) * (corner & 2 ? ty : 1-ty);
        const index = row * 33 + column;
        position.x += attr.getX(index) * weight; position.y += attr.getY(index) * weight; position.z += attr.getZ(index) * weight;
        normal.x += normals.getX(index) * weight; normal.y += normals.getY(index) * weight; normal.z += normals.getZ(index) * weight;
      }
      normal.normalize().multiplyScalar(dir);
      const resting = position.x < 0 ? left : right;
      // Use the actual resting page's relief, including its saved seed.
      stickySample.floorZ = pageRelief(Math.abs(position.x), position.y / ratio + .5, resting.userData["seed"] as number);
      return stickySample;
    };
    notes.turn(progress, dir, sheetSample);
    // The marked ribbon rides on the turning sheet or tucks under it (see binding.setRibbonTurn).
    binding.turnRibbon(progress, (u, v) => { const s = sheetSample(u, v); return { position: s.position.clone(), normal: s.normal.clone() }; });
    if (tabPlan) tabs.turn(tabPlan, progress, dir, (v) => {
      // The sampler reuses its vectors, so read each sample before taking the next.
      const inner = sheetSample(31 / 32, v).position, ix = inner.x, iy = inner.y, iz = inner.z;
      const outer = sheetSample(1, v).position, x = outer.x, y = outer.y, z = outer.z;
      // Outward along the paper in all three directions: a slanted fold turns the tab within the page too.
      const tx = x - ix, ty = y - iy, tz = z - iz, length = Math.hypot(tx, ty, tz) || 1;
      return { x, y, z, tx: tx / length, ty: ty / length, tz: tz / length };
    });
    driveContact(progress);
    turnShade.drive(progress, dir);
  };
  const notes = createBookNotes(book, ratio, pageMaterials, () => right.material as THREE.MeshStandardMaterial, requestPaint);
  const tabs = createBookTabs(book, ratio, pageMaterials, () => right.material as THREE.MeshStandardMaterial, requestPaint, (x,y)=>pageRelief(Math.abs(x),y/ratio+.5,(x<0?left:right).userData["seed"] as number));
  /** How the tabs move during the turn in progress (set when a turn is prepared). */
  let tabPlan: TabPlan[] | null = null;
  configure(settings);
  resize();
  return {
    /** Which video plays inside a page picture (BookView's player owns the elements). */
    setVideoLookup(lookup: (canvas: HTMLCanvasElement) => PageVideoSource | null) { pageVideo.setLookup(lookup); requestPaint(false); },
    /** Only the printed stills (reduced motion, captures). */
    setVideoStill(still: boolean) { pageVideo.setStill(still); requestPaint(false); },
    /** A new video frame is ready: redraw without recomputing shadows. */
    videoFrame() { requestPaint(false); },
    setCoverColour(canvas:HTMLCanvasElement,board:"front"|"back"="front"){binding.setCoverColour(sampleCoverColour(canvas),board);requestPaint();},
    setCaptureClock(clock?:()=>Promise<void>) {captureClock=clock;},
    async captureReady() { await paperTextures.ready(); await backdrop.ready(); if (!await loadEnvironment(settings.hdri)) throw new Error("Studio lighting could not be prepared."); },
    setFrameSink(sink?: (canvas: HTMLCanvasElement) => void) { frameSink = sink; paint(); },
    renderFrame: paint,
    /** `shown` false leaves the canvas clear behind the book, for a colour-and-motion scene drawn underneath it. */
    setBackdrop(url: string | undefined, fit: Parameters<typeof backdrop.set>[1], lit: boolean, colour: string, surface = false, shown = true) {
      backdrop.set(url, fit, shown, colour, lit, surface);
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
      requestPaint(false);
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
    /** Resolves once the shaders compiling in the background are ready, so the book can be shown already drawn. */
    async shadersReady() {
      for (let current = compiling; ; current = compiling) {
        await current;
        if (current === compiling) break;
      }
      if (!disposed) paint();
    },
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
      return Promise.all([paperTextures.ready(), compiling, ...ids.map(loadEnvironment)]).then(() => {
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
      requestPaint(false);
    },
    dragPan(dx: number, dy: number) {
      const height = cameraHeight(zoom);
      panX -= (dx / Math.max(1, host.clientHeight)) * height;
      panY += (dy / Math.max(1, host.clientHeight)) * height;
      frameCamera();
      requestPaint(false);
    },
    /** Moves the 3D view (held to the dome above the book); returns the angle actually used. */
    orbit(next: Orbit) {
      orbit = clampOrbit(next);
      if (isOrbiting(orbit)) { panX = 0; panY = 0; }
      frameCamera();
      requestPaint(false);
      return orbit;
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
      return [left,right].map((mesh,index) => {
        const rigid=Boolean(mesh.userData["rigidCover"]),width=1+(rigid?2*COVER_OVERHANG:0),height=ratio+(rigid?2*COVER_OVERHANG:0),z=rigid?(mesh.userData["coverZ"] as number):0;
        const x=index===0?-width:0;
        // All four corners, so a tilted 3D view still gets the box around the page.
        const points=[[x,height/2],[x+width,height/2],[x,-height/2],[x+width,-height/2]].map(([px,py])=>new THREE.Vector3(px,py,z).project(camera));
        const xs=points.map(p=>(p.x+1)*50),ys=points.map(p=>(1-p.y)*50);
        return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
      });
    },
    corners() {
      camera.updateMatrixWorld();
      return [left,right].map((mesh,index) => {
        const rigid=Boolean(mesh.userData["rigidCover"]),x=(index===0?-1:1)*(1+(rigid?2*COVER_OVERHANG:0)),y=-(ratio+(rigid?2*COVER_OVERHANG:0))/2;
        const point=new THREE.Vector3(x,y,rigid?(mesh.userData["coverZ"] as number):0).project(camera);
        return {x:(point.x+1)*50,y:(1-point.y)*50};
      });
    },
    pan,
    /** `speed` 1 is the normal pace; smaller is quicker (used when pages are turned in quick succession). */
    async prepareTurn(from: BookFaces, to: BookFaces, dir: 1 | -1, destinationFocus: number, speed = 1, plan: TabPlan[] | null = null, dragging = false) {
      if (disposed) return;
      const style = readableTurnStyle(settings.turnStyle);
      speed *= turnDurationScale(style, settings.turnSpeed);
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
      rigidTurn = isRigidTurn(from, to, dir) ? { from: coverRestOf(from), to: coverRestOf(to), board: Number(from[moving]?.dataset["seed"] ?? to[landing]?.dataset["seed"]) < 2 ? "front" : "back" } : null;
      if (rigidTurn) { setMap(coverFrontMat, from[moving]); setMap(coverBackMat, to[landing]); }
      // Prepare resting textures now, but reveal the page below only after
      // 5% travel. Hide the receiving page over the last 5% as well.
      contactTurn = { from: kindOf(from), to: kindOf(to), landing: (to[0] ? 1 : 0) + (to[1] ? 1 : 0) > (from[0] ? 1 : 0) + (from[1] ? 1 : 0) };
      show(dir === 1 ? [from[0], to[1]] : [to[0], from[1]], false);
      turnRestPages = [left.visible, right.visible];
      binding.setRibbonTurn(ribbonTurnFor(from, to, dir));
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
      const rigid = settings.bookStyle==="hardback"&&[from[dir===1?1:0],to[dir===1?0:1]].some(canvas=>canvas?.dataset["coverBoard"]==="true");
      // Only a dragged soft paper turn follows the pointer; boards and the other curves keep their baked shapes.
      const followsPointer = dragging && !rigid && bindingTurnCurve(settings.bookStyle, settings.turnCurve, from, to) === "soft";
      const restingSeeds = [seedFor(dir === 1 ? from[0] : to[0]), seedFor(dir === 1 ? to[1] : from[1])];
      const sheetSeeds = [seedFor(from[moving]), seedFor(to[landing])];
      draggedTurn = { from, to, dir, destinationFocus, originalFocus, progress: 0, speed, style, rigid,
        pointer: followsPointer ? { allowed: true, grabY: ratio / 2, at: { x: 1, y: ratio / 2 }, seeds: restingSeeds, sheetSeeds,
          endNormals: [restingTurnNormals(geometry, ratio, dir, sheetSeeds[0]!, dir), restingTurnNormals(geometry, ratio, -dir as 1 | -1, sheetSeeds[1]!, -dir)] as [Float32Array, Float32Array] } : undefined };
    },
    /** Starts a pointer-following turn at the point the reader pressed. False when this turn doesn't follow the pointer. */
    beginPointerTurn(clientX: number, clientY: number): boolean {
      const turn = draggedTurn, pointer = turn?.pointer;
      if (!turn || !pointer || disposed) return false;
      const p = bookPoint(clientX, clientY);
      if (!p) return false;
      pointer.grabY = THREE.MathUtils.clamp(p.y + ratio / 2, 0, ratio);
      pointer.at = { x: 1, y: pointer.grabY };
      return true;
    },
    /** Moves a pointer-following turn; returns how far it has got, or null when this turn doesn't follow the pointer. */
    dragTurnPointer(clientX: number, clientY: number): number | null {
      const turn = draggedTurn, pointer = turn?.pointer;
      if (!turn || !pointer || disposed) return null;
      const p = bookPoint(clientX, clientY);
      if (!p) return turn.progress;
      // Book space to the turning side's own page units (x from the spine, y from the foot).
      pointer.at = constrainFoldPointer(pointer.grabY, { x: turn.dir * p.x, y: p.y + ratio / 2 }, ratio);
      turn.progress = pointerFoldProgress(pointer.at);
      const at = pointer.at;
      pendingDragShape = () => shape(turn.progress, turn.dir, () => writePointerFold(geometry, ratio, turn.dir, pointer.grabY, at, pointer.seeds, SHEET_CLEARANCE, pointer.sheetSeeds, pointer.endNormals));
      requestPaint();
      return turn.progress;
    },
    /** How far the turn in progress has got (0 to 1), or null when no page is turning. */
    turnProgress(): number | null {
      return draggedTurn ? draggedTurn.progress : null;
    },
    dragTurn(progress: number) {
      const turn = draggedTurn;
      // A turn following the pointer is shaped by dragTurnPointer alone.
      if (!turn || disposed || turn.pointer) return;
      turn.progress = THREE.MathUtils.clamp(progress, 0, 1);
      // Coalesce geometry and normal updates as well as the actual draw.
      pendingDragShape = () => shape(turn.progress, turn.dir);
      requestPaint();
    },
    async settleTurn(complete: boolean) {
      pendingDragShape = null;
      const turn = draggedTurn;
      if (!turn || disposed) return;
      const { from, to, dir, destinationFocus, originalFocus, speed, style } = turn;
      const start = turn.progress;
      const startFocus = focus;
      const end = complete ? 1 : 0;
      const pointer = turn.pointer;
      if (pointer) {
        // The grabbed point carries on to the far side (or goes home), straightening as it goes, so the release
        // continues the very shape under the reader's hand. Both ends are exactly flat.
        const from0 = pointer.at, goal = { x: complete ? -1 : 1, y: pointer.grabY };
        await animate(Math.max(160 * speed, 760 * speed * Math.abs(end - start)), (t) => {
          const at = { x: THREE.MathUtils.lerp(from0.x, goal.x, t), y: THREE.MathUtils.lerp(from0.y, goal.y, t) };
          turn.progress = pointerFoldProgress(at);
          shape(turn.progress, dir, () => writePointerFold(geometry, ratio, dir, pointer.grabY, at, pointer.seeds, SHEET_CLEARANCE, pointer.sheetSeeds, pointer.endNormals));
          if (narrow && complete) {
            focus = THREE.MathUtils.lerp(startFocus, destinationFocus, turn.progress);
            frameCamera();
          }
        }, (t) => 1 - (1 - t) * (1 - t) * (1 - t));
        turn.progress = end;
      } else
      await animate(Math.max(138 * speed, 805 * speed * Math.abs(end - start)), (t) => {
        const progress = THREE.MathUtils.lerp(start, end, t);
        turn.progress = progress;
        shape(progress, dir);
        if (narrow && complete) {
          focus = THREE.MathUtils.lerp(startFocus, destinationFocus, progress);
          frameCamera();
        }
      }, (t) => styledTurnEase(t,style));
      if (disposed) return;
      // At the end the sheet lies exactly over the covered page, so swapping
      // the textures in the same frame as hiding it is invisible.
      if(settings.material === "paper_0022" && !turn.rigid) {
        const restingSide=complete?(dir===1?0:1):(dir===1?1:0);
        const page=(complete?to:from)[restingSide];
        if(page)settledPaper.remember(page,complete?back:front,(restingSide===0?left:right).position);
      }
      sheet.visible = false;
      front.visible = back.visible = true;
      rigidTurn = null;
      binding.turnCover(null, dir, "open", "open");
      turnRestPages = null;
      binding.setRibbonTurn(null);
      notes.endTurn(complete);
      contactTurn = null;
      turnShade.clear();
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
      restingShadows.dispose();
      binding.dispose();
      notes.clear();
      tabs.clear();
      airDust.dispose();
      backdrop.dispose();
      paperTextures.dispose();
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
      environmentGenerator?.dispose();
      evenLight?.dispose();
      cachedLightMask.dispose();
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
      pageVideo.dispose();
      Object.values(contact).forEach((mesh) => mesh.material.dispose());
      shadowCatcher.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
export type BookScene = ReturnType<typeof createBookScene>;

