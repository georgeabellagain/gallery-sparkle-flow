import * as THREE from "three";
import { HDRI_PRESETS, type HdriId } from "./lighting";
import { parseRgbe } from "./rgbe";
import { dappleTexture } from "./dapple-light";
import { surfaceCanvas } from "./surface";
import { createRenderQueue } from "./render-queue";
import { bookSurfaceRatio } from "./render-budget";

export type PageStudioSettings = { hdri: HdriId; brightness: number; finish: "satin" | "textured" };

/** One offscreen GPU context per reader, reused sequentially for stationary pages.
 * Only the resulting 2D image stays on each page; scrolling needs no GPU loop. */
export function createPageStudioRenderer() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-.5, .5, .5, -.5, .1, 20);
  camera.position.z = 5;
  const material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, side: THREE.FrontSide });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  scene.add(plane);
  const ambient = new THREE.HemisphereLight(0xffffff, 0xb7bdca, .65);
  const key = new THREE.DirectionalLight(0xffffff, .55);
  key.position.set(-3, 5, 5);
  const sun = new THREE.SpotLight(0xfff3dc, 0, 0, Math.PI / 5, .35, 0);
  sun.position.set(-1.8, 2.8, 5.5);
  scene.add(ambient, key, sun, sun.target);
  const masks = new Map<string, THREE.CanvasTexture>();
  const bumps = new Map<string, THREE.CanvasTexture>();
  const environments = new Map<HdriId, Promise<THREE.WebGLRenderTarget>>();
  let disposed = false;
  const queue = createRenderQueue();
  let activeTexture: THREE.CanvasTexture | null = null;
  let frameRatio = 1;
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
        hdr.minFilter = hdr.magFilter = THREE.LinearFilter;
        hdr.needsUpdate = true;
        const pmrem = new THREE.PMREMGenerator(renderer);
        try { return pmrem.fromEquirectangular(hdr); }
        finally { hdr.dispose(); pmrem.dispose(); }
      })();
      environments.set(id, pending);
      pending.catch(() => { if (environments.get(id) === pending) environments.delete(id); });
    }
    return pending;
  };
  return {
    draw(source: HTMLCanvasElement, settings: PageStudioSettings, current = () => true): Promise<HTMLCanvasElement> {
      const run = async () => {
        if (disposed || !current()) throw new Error("Page changed");
        const target = await environment(settings.hdri);
        if (disposed || !current()) throw new Error("Page changed");
        const ratio = source.height / source.width;
        if (ratio !== frameRatio) {
          plane.geometry.dispose(); plane.geometry = new THREE.PlaneGeometry(1, ratio); frameRatio = ratio;
        }
        camera.top = ratio / 2; camera.bottom = -ratio / 2; camera.updateProjectionMatrix();
        activeTexture?.dispose();
        activeTexture = new THREE.CanvasTexture(source);
        activeTexture.colorSpace = THREE.SRGBColorSpace;
        activeTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        material.map = activeTexture;
        const textured = settings.finish === "textured";
        if (!bumps.has(settings.finish)) {
          const bump = new THREE.CanvasTexture(surfaceCanvas(settings.finish, "soft"));
          bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
          bumps.set(settings.finish, bump);
        }
        const bump = bumps.get(settings.finish)!;
        bump.repeat.set(5, ratio * 5);
        material.bumpMap = bump;
        material.bumpScale = textured ? .006 : .0003;
        material.roughness = textured ? .97 : .42;
        material.clearcoat = textured ? 0 : .4;
        material.clearcoatRoughness = .28;
        material.specularIntensity = textured ? .1 : .7;
        material.needsUpdate = true;
        const pattern = HDRI_PRESETS.find(p => p.id === settings.hdri)?.dapple;
        if (pattern && !masks.has(pattern)) masks.set(pattern, dappleTexture(pattern));
        sun.map = pattern ? masks.get(pattern)! : null;
        sun.visible = Boolean(pattern);
        sun.intensity = pattern === "window" || pattern === "blinds" ? 1.4 : pattern ? 1.8 : 0;
        sun.penumbra = pattern === "window" || pattern === "blinds" ? .12 : .35;
        scene.environment = target.texture;
        scene.environmentIntensity = pattern ? .7 : 1;
        ambient.intensity = pattern ? .4 : .65;
        renderer.toneMappingExposure = .55 + Math.max(0, Math.min(1, settings.brightness)) * 1.6;
        const scale = bookSurfaceRatio(source.width, source.height, 1, 2_600_000);
        const width = Math.max(1, Math.floor(source.width * scale)), height = Math.max(1, Math.floor(source.height * scale));
        renderer.setSize(width, height, false);
        renderer.render(scene, camera);
        if (renderer.getContext().isContextLost()) throw new Error("Graphics unavailable");
        const output = document.createElement("canvas");
        output.width = width; output.height = height;
        output.getContext("2d")!.drawImage(renderer.domElement, 0, 0);
        output.style.width = output.style.height = "100%";
        output.setAttribute("aria-hidden", "true");
        return output;
      };
      return queue.enqueue(run);
    },
    dispose() {
      disposed = true;
      queue.close();
      environments.forEach(p => { void p.then(t => t.dispose(), () => undefined); });
      masks.forEach(t => t.dispose()); bumps.forEach(t => t.dispose());
      activeTexture?.dispose(); plane.geometry.dispose(); material.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}

export type PageStudioRenderer = ReturnType<typeof createPageStudioRenderer>;
