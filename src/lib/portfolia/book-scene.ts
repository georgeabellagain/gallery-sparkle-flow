import * as THREE from "three";
import { surfaceCanvas, type SurfaceKind } from "./surface";
import { parseRgbe } from "./rgbe";
import { DEFAULT_SIMPLE_SHADOW_OPACITY, HDRI_PRESETS, type HdriId } from "./lighting";

export { HDRI_PRESETS };
export type { HdriId };

/** The studio's own light: above, in front and to the left, so the shadow falls below and a little to the right. */
const KEY_LIGHT: [number, number, number] = [-3, 5, 5];

export type StudioSettings = {
  studio: boolean;
  material: SurfaceKind;
  /** 0..1 overall studio brightness. */
  brightness: number;
  hdri: HdriId;
  /** Simple look only: whether the soft shadow under the book shows. */
  simpleShadow: boolean;
  /** Simple look only: how dark that shadow is, 0..1. */
  simpleShadowOpacity: number;
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
  const BOOK_LIFT = 0.07;
  // The shadow cast by the studio light, caught on an invisible sheet below the book.
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.38 }));
  shadowCatcher.position.z = -BOOK_LIFT;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  // A soft shadow that is always under the book in the Simple look. It is in two halves, one under each
  // page, so a page's shadow can arrive with the page as it lands rather than sliding across. Drawn once, not cast.
  const SHADOW_SPREAD = 0.075; // how far the edge softens, in world units
  const SHADOW_MARGIN = 0.3; // how far the picture reaches beyond the page edge
  const SHADOW_PPU = 190; // picture pixels per world unit
  const CONTACT_X = 0.02;
  const CONTACT_Y = -0.03;
  const contactWidth = 1 + SHADOW_MARGIN;
  const contactHeight = ratio + 2 * SHADOW_MARGIN;
  /**
   * One page's shadow. Only the outer side softens: the side at the spine stays solid, so the two
   * halves meet without a seam and, together, look like one shadow under the whole book.
   */
  const makeShadow = (mirror: boolean) => {
    const w = Math.round(contactWidth * SHADOW_PPU);
    const h = Math.round(contactHeight * SHADOW_PPU);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(w, h);
    const sigma = SHADOW_SPREAD * SHADOW_PPU;
    const pageEdge = SHADOW_PPU;
    const top = SHADOW_MARGIN * SHADOW_PPU;
    const bottom = h - SHADOW_MARGIN * SHADOW_PPU;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const fromSpine = mirror ? w - 1 - x : x;
        const dx = Math.max(fromSpine - pageEdge, 0);
        const dy = Math.max(top - y, 0, y - bottom);
        const d = Math.hypot(dx, dy);
        image.data[(y * w + x) * 4 + 3] = Math.round(255 * Math.exp(-(d * d) / (2 * sigma * sigma)));
      }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(contactWidth, contactHeight),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    );
    mesh.renderOrder = -1;
    scene.add(mesh);
    return { mesh, texture };
  };
  const rightShadow = makeShadow(false);
  const leftShadow = makeShadow(true);
  // Each half lies from the spine outwards, shifted a little down and to the right like a real drop shadow.
  rightShadow.mesh.position.set(CONTACT_X + contactWidth / 2, CONTACT_Y, -BOOK_LIFT + 0.002);
  leftShadow.mesh.position.set(CONTACT_X - contactWidth / 2, CONTACT_Y, -BOOK_LIFT + 0.002);
  const contact = [leftShadow.mesh, rightShadow.mesh];

  let settings: StudioSettings = {
    studio: false,
    material: "satin",
    brightness: 0.65,
    hdri: "1",
    simpleShadow: true,
    simpleShadowOpacity: DEFAULT_SIMPLE_SHADOW_OPACITY,
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
  // Room around the book, the same above and below so it sits exactly in the middle, with enough for its shadow to fade out.
  const FRAME_PAD = 0.12 + 0.08 * ratio;
  const cameraHeight = (scale: number) => {
    const aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
    // Frame a lone cover as a page, but leave room for both pages once open.
    const width = narrow ? 1.08 : THREE.MathUtils.lerp(2.32, 1.32, Math.min(1, Math.abs(focus) * 2));
    return Math.max(ratio * 1.1 + FRAME_PAD, width / aspect) / scale;
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

  // The soft Simple-look shadow lies under whichever pages show. When a page appears or goes the shadow
  // under it fades; it never slides. During a turn the fade follows the turn, so a page's shadow
  // arrives as the page lands. Otherwise (a jump to another page) it eases over about a third of a second.
  const contactNow = { l: 1, r: 1 };
  const contactGoal = { l: 1, r: 1 };
  let contactShown = false;
  let contactFrame = 0;
  let contactLast = 0;
  let contactOn = true;
  let contactOpacity = DEFAULT_SIMPLE_SHADOW_OPACITY;
  let contactTurn: { start: [number, number]; end: [number, number] } | null = null;
  const applyContact = () => {
    contact.forEach((mesh, i) => {
      const side = i === 0 ? contactNow.l : contactNow.r;
      mesh.material.opacity = contactOpacity * side;
      mesh.visible = contactOn && side > 0.004;
    });
  };
  const stepContact = (now: number) => {
    contactFrame = 0;
    if (disposed) return;
    const dt = Math.min(64, Math.max(1, now - contactLast));
    contactLast = now;
    const k = 1 - Math.exp(-dt / 110);
    let moving = false;
    for (const key of ["l", "r"] as const) {
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
    contactGoal.l = faces[0] ? 1 : 0;
    contactGoal.r = faces[1] ? 1 : 0;
    const instant = !contactShown || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (faces[0] || faces[1]) contactShown = true;
    if (instant) {
      Object.assign(contactNow, contactGoal);
      applyContact();
      return;
    }
    if (contactNow.l === contactGoal.l && contactNow.r === contactGoal.r) return;
    if (!contactFrame) {
      contactLast = performance.now();
      contactFrame = requestAnimationFrame(stepContact);
    }
  };
  /** Sets each page's shadow from how far the turn has got. */
  const driveContact = (progress: number) => {
    const turn = contactTurn;
    if (!turn) return;
    const side = (i: 0 | 1) => {
      const from = turn.start[i];
      const to = turn.end[i];
      if (from === to) return from;
      // A page lands: its shadow arrives over the last part of the turn. A page lifts: its shadow goes early.
      return to > from ? smooth((progress - 0.55) / 0.45) : 1 - smooth(progress / 0.45);
    };
    contactNow.l = contactGoal.l = side(0);
    contactNow.r = contactGoal.r = side(1);
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
    // Studio shows only the real shadow cast by the light and the paper; the soft shadow is the Simple look's.
    contactOn = !next.studio && next.simpleShadow;
    contactOpacity = THREE.MathUtils.clamp(next.simpleShadowOpacity, 0, 1);
    applyContact();
    shadowCatcher.material.opacity = 0.45;
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
      if (mesh.userData["seed"] !== seed) shapePage(mesh, i === 0 ? -1 : 1, seed);
    });
    setContact(next);
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
      front.geometry = forwardView as THREE.PlaneGeometry;
      back.geometry = (dir === 1 ? reverseGeometry : geometry) as THREE.PlaneGeometry;
    }
    attr.needsUpdate = true;
    geometry.computeVertexNormals();
    driveContact(progress);
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
      zoom = THREE.MathUtils.clamp(scale, 1, 3);
      focus = target;
      frameCamera();
      paint();
    },
    zoomAt(scale: number, x: number, y: number) {
      const aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
      const delta = cameraHeight(zoom) - cameraHeight(scale);
      panX += (x - 0.5) * delta * aspect;
      panY += (0.5 - y) * delta;
      zoom = THREE.MathUtils.clamp(scale, 1, 3);
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
      contactTurn = { start: [from[0] ? 1 : 0, from[1] ? 1 : 0], end: [to[0] ? 1 : 0, to[1] ? 1 : 0] };
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
      contactTurn = null;
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
      cancelAnimationFrame(contactFrame);
      leftShadow.texture.dispose();
      rightShadow.texture.dispose();
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
      contact.forEach((mesh) => mesh.material.dispose());
      shadowCatcher.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
export type BookScene = ReturnType<typeof createBookScene>;
