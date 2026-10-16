import { backdropCoverage } from "./backdrop-coverage";
import { backgroundSurfaceMaps } from "./background-presets";
import { backdropNormals } from "./backdrop-normals";
import * as THREE from "three";
import { DEFAULT_FIT, type BackgroundFit } from "./background";

// Share decoded images across Studio modes. Failed loads can be retried; the LRU
// is bounded so visiting many portfolios does not retain every uploaded picture.
const decoded = new Map<string, Promise<HTMLImageElement>>();
function loadImage(url: string) {
  const hit = decoded.get(url);
  if (hit) { decoded.delete(url); decoded.set(url, hit); return hit; }
  const image = new Image(); image.crossOrigin = "anonymous"; image.src = url;
  const pending = image.decode().then(() => image).catch(error => { if (decoded.get(url) === pending) decoded.delete(url); throw error; });
  decoded.set(url, pending);
  while (decoded.size > 6) decoded.delete(decoded.keys().next().value!);
  return pending;
}

/** A matte photograph on the table, shaded by the same environment as the pages. */
export function createLitBackdrop(scene: THREE.Scene, repaint: () => void, shadows = false) {
  const material = new THREE.MeshStandardMaterial({ roughness: .82, metalness: 0 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  plane.position.z = -0.072;
  plane.receiveShadow = true;
  plane.visible = false;
  scene.add(plane);
  const catcher = shadows ? new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({opacity:.3, depthWrite:false})) : null;
  if (catcher) { catcher.position.z = -.071; catcher.receiveShadow = true; catcher.visible = false; scene.add(catcher); }
  let source: HTMLImageElement | null = null;
  let surfaceNormal: HTMLImageElement | null = null, surfaceRoughness: HTMLImageElement | null = null;
  let surfaceEnabled = false, loadKey = "";
  let readyPromise: Promise<void> = Promise.resolve();
  let currentUrl: string | undefined;
  let fit = DEFAULT_FIT;
  let enabled = false, disposed = false, revision = 0;
  let dimensions = "";
  let coverage = 1, coverageViewport = "";
  const canvas = document.createElement("canvas");
  let texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  material.map = texture;
  const normalCanvas = document.createElement("canvas");
  let normals = new THREE.CanvasTexture(normalCanvas); normals.colorSpace = THREE.NoColorSpace;
  material.normalScale.set(.65, .65);
  const roughCanvas = document.createElement("canvas");
  let roughness = new THREE.CanvasTexture(roughCanvas); roughness.colorSpace = THREE.NoColorSpace;
  return {
    set(url: string | undefined, nextFit: Partial<BackgroundFit> | undefined, active: boolean, colour = "#191d3a", lit = true, surface = false) {
      const useSurface = lit && surface && Boolean(url);
      const shaderChanged = Boolean(material.normalMap) !== useSurface || Boolean(material.emissiveMap) !== (!lit && Boolean(url)) || Boolean(material.map) !== Boolean(url);
      material.toneMapped = lit;
      material.color.set(lit ? (url ? "#ffffff" : colour) : "#000000");
      material.emissive.set(lit ? "#000000" : (url ? "#ffffff" : colour));
      material.emissiveMap = !lit && url ? texture : null;
      material.map = url ? texture : null;
      material.normalMap = useSurface ? normals : null;
      material.roughnessMap = useSurface && surfaceRoughness ? roughness : null;
      material.roughness = useSurface && surfaceRoughness ? 1 : .82;
      if (shaderChanged) material.needsUpdate = true;
      enabled = active; fit = { ...DEFAULT_FIT, ...nextFit };
      surfaceEnabled = useSurface;
      const key = `${url ?? ""}|${useSurface}`;
      if (key === loadKey) { repaint(); return; }
      loadKey = key; currentUrl = url; source = null; dimensions = ""; coverage = 1;
      plane.visible = false;
      const request = ++revision;
      if (!url) { source = null; readyPromise = Promise.resolve(); plane.visible = enabled; repaint(); return; }
      const maps = useSurface ? backgroundSurfaceMaps(url) : undefined;
      // Rebuild only the changed material/maps. HDRI prefiltering stays in the
      // renderer's existing environment cache; it does not depend on this surface.
      readyPromise = Promise.all([loadImage(url), maps ? loadImage(maps.normal).catch(() => null) : null, maps ? loadImage(maps.roughness).catch(() => null) : null]).then(([image, normal, rough]) => {
        if (disposed || revision !== request) return;
        source = image; surfaceNormal = normal; surfaceRoughness = rough;
        material.normalScale.set(normal ? .65 : .35, normal ? .65 : .35);
        material.roughnessMap = useSurface && rough ? roughness : null;
        material.roughness = useSurface && rough ? 1 : .82;
        material.needsUpdate = true;
        plane.visible = enabled; dimensions = ""; repaint();
      }).catch(() => { if (revision === request) source = null; /* DOM image remains the fallback. */ });
    },
    async ready() { await readyPromise; if (enabled && currentUrl && !source) throw new Error("The background image could not be prepared."); },
    frame(camera: THREE.PerspectiveCamera, width: number, height: number, anchoredHeight?: number) {
      if ((!source && currentUrl) || !enabled) { plane.visible = false; if (catcher) catcher.visible=false; return; }
      const stamp = `${currentUrl}|${surfaceEnabled}|${width}|${height}|${fit.scale}|${fit.x}|${fit.y}|${fit.tile}`;
      if (source && stamp !== dimensions) {
        dimensions = stamp;
        const previousWidth = canvas.width, previousHeight = canvas.height;
        // Retain source detail when starting in a small editor/preview. Zooming
        // the camera must not magnify a preview-sized copy of the photograph.
        const longest = Math.max(width, height);
        const detail = Math.max(longest * Math.min(globalThis.devicePixelRatio || 1, 2), Math.max(source.naturalWidth, source.naturalHeight));
        const cap = Math.min(4096, detail) / longest;
        canvas.width = Math.max(1, Math.round(width * cap)); canvas.height = Math.max(1, Math.round(height * cap));
        const scale = Math.max(fit.tile ? .25 : 1, Math.min(3, fit.scale));
        const cover = Math.max(canvas.width / source.naturalWidth, canvas.height / source.naturalHeight);
        const w = source.naturalWidth * cover * scale, h = source.naturalHeight * cover * scale;
        const x = (canvas.width - w) / 2 + Math.max(-1, Math.min(1, fit.x)) * canvas.width * (scale - 1) / 2;
        const y = (canvas.height - h) / 2 + Math.max(-1, Math.min(1, fit.y)) * canvas.height * (scale - 1) / 2;
        const paint = canvas.getContext("2d")!;
        paint.clearRect(0,0,canvas.width,canvas.height);
        if(fit.tile && scale<1){
          const tile=document.createElement("canvas");tile.width=Math.max(1,Math.round(w));tile.height=Math.max(1,Math.round(h));
          tile.getContext("2d")!.drawImage(source,0,0,tile.width,tile.height);
          const pattern=paint.createPattern(tile,"repeat");
          if(pattern){paint.save();paint.translate(x,y);paint.fillStyle=pattern;paint.fillRect(-x,-y,canvas.width,canvas.height);paint.restore();}
        }else paint.drawImage(source, x, y, w, h);
        // Uploaded textures have fixed GPU storage. A fullscreen resize must
        // allocate fresh storage rather than update the old preview-sized image.
        if (canvas.width !== previousWidth || canvas.height !== previousHeight) {
          texture.dispose();
          texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          material.map = texture;
          if (material.emissiveMap) material.emissiveMap = texture;
        }
        texture.needsUpdate = true;
        if (surfaceEnabled) {
          // Resample surface data only when picture/fit/viewport changes, never
          // for page turns or camera movement. Identical UV fitting keeps every
          // grain/crease aligned with the colour image, including repeated tiles.
          const paintMap = (target: HTMLCanvasElement, image: HTMLImageElement | HTMLCanvasElement, fill: string) => {
            const mapCap = Math.min(1, 512 / Math.max(canvas.width, canvas.height));
            target.width = Math.max(1, Math.round(canvas.width * mapCap)); target.height = Math.max(1, Math.round(canvas.height * mapCap));
            const ctx = target.getContext("2d")!; ctx.fillStyle = fill; ctx.fillRect(0, 0, target.width, target.height);
            if (image === canvas) { ctx.drawImage(canvas, 0, 0, target.width, target.height); return ctx; }
            const sx = target.width / canvas.width, sy = target.height / canvas.height;
            if (fit.tile && scale < 1) {
              const tile = document.createElement("canvas"); tile.width = Math.max(1, Math.round(w * sx)); tile.height = Math.max(1, Math.round(h * sy));
              tile.getContext("2d")!.drawImage(image, 0, 0, tile.width, tile.height);
              const pattern = ctx.createPattern(tile, "repeat");
              if (pattern) { ctx.save(); ctx.translate(x * sx, y * sy); ctx.fillStyle = pattern; ctx.fillRect(-x * sx, -y * sy, target.width, target.height); ctx.restore(); }
            } else ctx.drawImage(image, x * sx, y * sy, w * sx, h * sy);
            return ctx;
          };
          const ctx = paintMap(normalCanvas, surfaceNormal ?? canvas, "rgb(128,128,255)");

          if (!surfaceNormal) {
            const image = ctx.getImageData(0, 0, normalCanvas.width, normalCanvas.height);
            image.data.set(backdropNormals(image.data, normalCanvas.width, normalCanvas.height)); ctx.putImageData(image, 0, 0);
          }
          normals.dispose(); normals = new THREE.CanvasTexture(normalCanvas); normals.colorSpace = THREE.NoColorSpace;
          material.normalMap = normals;
          if (surfaceRoughness) {
            paintMap(roughCanvas, surfaceRoughness, "white");
            roughness.dispose(); roughness = new THREE.CanvasTexture(roughCanvas); roughness.colorSpace = THREE.NoColorSpace;
            material.roughnessMap = roughness;
          }
        }

      }
      const worldHeight = 2 * (camera.position.z - plane.position.z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const anchored = anchoredHeight !== undefined;
      const viewport = `${width}|${height}`;
      if (coverageViewport !== viewport) { coverage = 1; coverageViewport = viewport; }
      if (anchored) coverage = Math.max(coverage, backdropCoverage(anchoredHeight, camera.aspect, worldHeight, camera.position.x, camera.position.y));
      // Keep the complete photograph, enlarging it instead of stretching edge
      // pixels when zooming out or panning approaches its boundary.
      plane.position.x = anchored ? 0 : camera.position.x; plane.position.y = anchored ? 0 : camera.position.y;
      const heightInWorld = (anchoredHeight ?? worldHeight) * (anchored ? coverage : 1);
      plane.scale.set(heightInWorld * camera.aspect, heightInWorld, 1); plane.visible = true;
      if (catcher) { catcher.position.x=plane.position.x;catcher.position.y=plane.position.y;catcher.scale.copy(plane.scale);catcher.visible=true; }
    },
    dispose() { disposed = true; revision++; source = null; scene.remove(plane); texture.dispose(); normals.dispose(); roughness.dispose(); plane.geometry.dispose(); material.dispose(); if (catcher) {scene.remove(catcher);catcher.geometry.dispose();catcher.material.dispose();} },
  };
}
