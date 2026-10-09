import { readerSlideOffset, READER_SLIDE_MS } from "./reader-slide";
import { createFrameCommits } from "./frame-commits";
import * as THREE from "three";
import { HDRI_PRESETS, type HdriId } from "./lighting";
import { parseRgbe } from "./rgbe";
import { dappleTexture } from "./dapple-light";
import { surfaceCanvas } from "./surface";
import { bookSurfaceRatio } from "./render-budget";
import { pageWorldRect } from "./page-position";

export type PageStudioSettings = { hdri: HdriId; brightness: number; finish: "satin" | "textured" };
type Presentation = { layer: HTMLElement; direction: 1 | -1; animate: boolean };
type Page = { layer?: HTMLElement; slide?: { started: number; direction: 1 | -1 }; element: HTMLElement; source: HTMLCanvasElement; near: boolean; mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial> | null; revealAt: number | null };

/** One visible GPU surface per reader. DOM pages move through fixed lighting;
 * only unlit PDF textures are cached. Idle readers do not run an animation loop. */
export function createPageStudioRenderer(host: HTMLElement, viewport: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.domElement.setAttribute("aria-hidden", "true");
  Object.assign(renderer.domElement.style, { width: "100%", height: "100%", display: "block" });
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 50);
  const ambient = new THREE.HemisphereLight(0xffffff, 0xb7bdca, .65);
  const key = new THREE.DirectionalLight(0xffffff, .55);
  key.position.set(-3, 5, 5);
  const sun = new THREE.SpotLight(0xfff3dc, 0, 0, Math.PI / 5, .35, 0);
  sun.position.set(-1.8, 2.8, 5.5);
  scene.add(ambient, key, sun, sun.target);
  const masks = new Map<string, THREE.CanvasTexture>();
  const bumps = new Map<string, THREE.CanvasTexture>();
  const environments = new Map<HdriId, Promise<THREE.WebGLRenderTarget>>();
  const pages = new Map<HTMLElement, Page>();
  const animations = new Set<Animation>();
  // Artwork commits and GPU swaps happen in the same drawing frame.
  const pending = createFrameCommits<HTMLElement, { source: HTMLCanvasElement; commit: (live: boolean) => Presentation | void; current: () => boolean }>();
  let failed = false;
  let disposed = false, ready = false, moving = false;
  let frame = 0, idle: ReturnType<typeof setTimeout> | null = null, revision = 0;
  let settings: PageStudioSettings = { hdri: "4", brightness: .5, finish: "satin" };
  const restore = (page: Page) => {
    page.source.style.visibility = "";
    if (page.layer) page.layer.style.transform = "";
    page.element.style.background = "";
    page.element.style.zIndex = "";
  };
  const conceal = (page: Page) => {
    page.source.style.visibility = "hidden";
    page.element.style.background = "transparent";
    page.element.style.zIndex = "2";
  };
  const release = (page: Page, showSource = true) => {
    if (showSource) restore(page);
    else conceal(page);
    if (!page.mesh) return;
    scene.remove(page.mesh);
    page.mesh.material.map?.dispose();
    page.mesh.material.dispose(); page.mesh.geometry.dispose(); page.mesh = null;
  };
  const applyMaterial = (material: THREE.MeshPhysicalMaterial) => {
    const textured = settings.finish === "textured";
    if (!bumps.has(settings.finish)) {
      const bump = new THREE.CanvasTexture(surfaceCanvas(settings.finish, "soft"));
      bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(5, 5);
      bumps.set(settings.finish, bump);
    }
    material.bumpMap = bumps.get(settings.finish)!;
    material.bumpScale = textured ? .006 : .0003;
    material.roughness = textured ? .97 : .42;
    material.clearcoat = textured ? 0 : .4;
    material.clearcoatRoughness = .28;
    material.specularIntensity = textured ? .1 : .7;
    material.needsUpdate = true;
  };
  const fallback = () => {
    failed = true;
    ready = false;
    pending.flush((element, job) => { if (element.isConnected) job.commit(false); });
    pending.clear();
    renderer.domElement.style.visibility = "hidden";
    pages.forEach(restore);
  };
  const paint = () => {
    frame = 0;
    if (disposed || !ready) return;
    try {
      pending.flush((element, job) => {
        if (!element.isConnected) return;
        const old = pages.get(element);
        // Avoid a cached-to-HD texture upload/material rebuild halfway through a slide.
        if (old?.slide && performance.now() - old.slide.started < READER_SLIDE_MS) {
          pending.stage(element, job);
          return;
        }
        // Do not reveal the raw canvas while the replacement texture uploads.
        job.source.style.visibility = "hidden";
        if (old) release(old);
        const presentation = job.commit(true);
        const slide = presentation?.animate ? { started: performance.now(), direction: presentation.direction } : old?.slide;
        const page: Page = { layer: presentation?.layer ?? old?.layer, slide, element, source: job.source, near: old?.near ?? false, mesh: null, revealAt: old || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? null : performance.now() };
        pages.set(element, page); observer.observe(element); resize.observe(element);
        for (const animation of element.getAnimations()) animations.add(animation);
      });
      for (const animation of animations) if (animation.playState !== "running") animations.delete(animation);
      const box = host.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const now = performance.now();
      let sliding = false;
      for (const page of pages.values()) {
        if (page.slide && now - page.slide.started >= READER_SLIDE_MS) {
          page.slide = undefined;
          if (page.layer) page.layer.style.transform = "";
        }
        if (page.slide) sliding = true;
      }
      const ratio = bookSurfaceRatio(box.width, box.height, Math.min(devicePixelRatio || 1, 1.25), (moving || sliding || animations.size > 0) ? 1_300_000 : 2_600_000);
      const w = Math.max(1, Math.floor(box.width * ratio)), h = Math.max(1, Math.floor(box.height * ratio));
      if (renderer.domElement.width !== w || renderer.domElement.height !== h) renderer.setSize(w, h, false);
      const worldHeight = 2.3 * box.height / box.width;
      camera.aspect = box.width / box.height;
      camera.position.set(0, 0, worldHeight / (2 * Math.tan(THREE.MathUtils.degToRad(18))));
      camera.updateProjectionMatrix();
      const lit: Page[] = [];
      let revealing = false;
      for (const page of pages.values()) {
        if (!page.element.isConnected) { release(page, false); continue; }
        const rect = page.element.getBoundingClientRect();
        const visible = rect.bottom > box.top && rect.top < box.bottom && rect.right > box.left && rect.left < box.right;
        // Fast scrolling may reach a page before IntersectionObserver reports it.
        if (!page.near && !visible) { release(page, false); continue; }
        if (!rect.width || !rect.height) { release(page, false); continue; }
        if (!page.mesh) {
          const texture = new THREE.CanvasTexture(page.source);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          const material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: texture });
          if (page.layer) material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(1, 0, 0)), new THREE.Plane(new THREE.Vector3(-1, 0, 0)), new THREE.Plane(new THREE.Vector3(0, 1, 0)), new THREE.Plane(new THREE.Vector3(0, -1, 0))];
          applyMaterial(material);
          page.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
          scene.add(page.mesh);
          renderer.initTexture(texture);
        }
        const opacity = page.revealAt === null ? 1 : Math.min(1, (performance.now() - page.revealAt) / 180);
        page.mesh.material.transparent = opacity < 1;
        page.mesh.material.opacity = opacity;
        if (opacity < 1) revealing = true;
        else page.revealAt = null;
        const position = pageWorldRect(rect, box);
        // Clip the lit sheet to the fixed page frame, matching the DOM wrapper.
        const clips = page.mesh.material.clippingPlanes;
        if (clips) {
          clips[0]!.constant = -(position.x - position.width / 2);
          clips[1]!.constant = position.x + position.width / 2;
          clips[2]!.constant = -(position.y - position.height / 2);
          clips[3]!.constant = position.y + position.height / 2;
        }
        const elapsed = page.slide ? now - page.slide.started : READER_SLIDE_MS;
        const direction = page.slide?.direction ?? 1;
        const pixels = readerSlideOffset(elapsed, rect.width, direction);
        if (page.layer) page.layer.style.transform = pixels ? `translateX(${pixels}px)` : "";
        page.mesh.position.set(position.x + readerSlideOffset(elapsed, position.width, direction), position.y, 0);
        page.mesh.scale.set(position.width, position.height, 1);
        page.mesh.visible = visible;
        if (page.mesh.visible) lit.push(page);
        else conceal(page);
      }
      renderer.render(scene, camera);
      if (renderer.getContext().isContextLost()) { fallback(); return; }
      renderer.domElement.style.visibility = "";
      for (const page of lit) conceal(page);
      // Sliding/revealing pages are redrawn through the same fixed scene every frame.
      if (animations.size || revealing || sliding) frame = requestAnimationFrame(paint);
    } catch { fallback(); }
  };
  const requestPaint = (motion = false) => {
    if (disposed) return;
    if (motion) {
      moving = true;
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => { moving = false; idle = null; requestPaint(); }, 150);
    }
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) { const page = pages.get(entry.target as HTMLElement); if (page) page.near = entry.isIntersecting; }
    requestPaint();
  }, { root: viewport, rootMargin: "200px" });
  const resize = new ResizeObserver(() => requestPaint());
  resize.observe(host);
  const scroll = () => requestPaint(true);
  viewport.addEventListener("scroll", scroll, { passive: true });
  const animate = (event: AnimationEvent) => {
    if (!(event.target instanceof Element)) return;
    for (const animation of event.target.getAnimations()) animations.add(animation);
    requestPaint(true);
  };
  viewport.addEventListener("animationstart", animate);
  const lost = (event: Event) => { event.preventDefault(); fallback(); };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  const environment = (id: HdriId) => {
    let pending = environments.get(id);
    if (!pending) {
      pending = (async () => {
        const response = await fetch(HDRI_PRESETS.find(p => p.id === id)!.file);
        if (!response.ok) throw new Error("Lighting could not load");
        const { width, height, rgb } = parseRgbe(await response.arrayBuffer());
        if (disposed) throw new Error("Reader closed");
        const pixels = new Uint16Array(width * height * 4);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const from = ((height - 1 - y) * width + x) * 3, to = (y * width + x) * 4;
          for (let c = 0; c < 3; c++) pixels[to + c] = THREE.DataUtils.toHalfFloat(Math.min(rgb[from + c]!, 60000));
          pixels[to + 3] = THREE.DataUtils.toHalfFloat(1);
        }
        const hdr = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        hdr.minFilter = hdr.magFilter = THREE.LinearFilter; hdr.needsUpdate = true;
        const pmrem = new THREE.PMREMGenerator(renderer);
        try { return pmrem.fromEquirectangular(hdr); }
        finally { hdr.dispose(); pmrem.dispose(); }
      })();
      environments.set(id, pending);
      pending.catch(() => { if (environments.get(id) === pending) environments.delete(id); });
    }
    return pending;
  };
  const configure = async (next: PageStudioSettings) => {
    const version = ++revision;
    try {
      const target = await environment(next.hdri);
      if (disposed || version !== revision) return;
      settings = next;
      const pattern = HDRI_PRESETS.find(p => p.id === next.hdri)?.dapple;
      if (pattern && !masks.has(pattern)) masks.set(pattern, dappleTexture(pattern));
      sun.map = pattern ? masks.get(pattern)! : null; sun.visible = Boolean(pattern);
      sun.intensity = pattern === "window" || pattern === "blinds" ? 1.4 : pattern ? 1.8 : 0;
      sun.penumbra = pattern === "window" || pattern === "blinds" ? .12 : .35;
      scene.environment = target.texture; scene.environmentIntensity = pattern ? .7 : 1;
      ambient.intensity = pattern ? .4 : .65;
      renderer.toneMappingExposure = .55 + Math.max(0, Math.min(1, next.brightness)) * 1.6;
      pages.forEach(page => { if (page.mesh) applyMaterial(page.mesh.material); });
      failed = false; ready = true; requestPaint();
    } catch { if (!disposed && version === revision) fallback(); }
  };
  return {
    configure,
    present(element: HTMLElement, source: HTMLCanvasElement, commit: (live: boolean) => Presentation | void, current = () => true) {
      if (disposed || failed) { if (current()) commit(false); return; }
      pending.stage(element, { source, commit, current });
      requestPaint();
    },
    remove(element: HTMLElement) {
      pending.remove(element);
      const page = pages.get(element);
      if (!page) return;
      observer.unobserve(element); resize.unobserve(element); release(page); pages.delete(element); requestPaint();
    },
    dispose() {
      disposed = true; revision++;
      cancelAnimationFrame(frame); if (idle) clearTimeout(idle);
      observer.disconnect(); resize.disconnect();
      viewport.removeEventListener("scroll", scroll); viewport.removeEventListener("animationstart", animate);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      pending.clear(); pages.forEach(page => release(page)); pages.clear();
      environments.forEach(p => { void p.then(t => t.dispose(), () => undefined); });
      masks.forEach(t => t.dispose()); bumps.forEach(t => t.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
export type PageStudioRenderer = ReturnType<typeof createPageStudioRenderer>;
