import { backdropCoverage } from "./backdrop-coverage";
import { backdropNormals } from "./backdrop-normals";
import * as THREE from "three";
import { DEFAULT_FIT, type BackgroundFit } from "./background";

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
  material.normalMap = normals; material.normalScale.set(.35, .35);
  return {
    set(url: string | undefined, nextFit: Partial<BackgroundFit> | undefined, active: boolean, colour = "#191d3a", lit = true) {
      material.toneMapped = lit;
      material.color.set(lit ? (url ? "#ffffff" : colour) : "#000000");
      material.emissive.set(lit ? "#000000" : (url ? "#ffffff" : colour));
      material.emissiveMap = !lit && url ? texture : null;
      material.map = url ? texture : null; material.normalMap = url ? normals : null; material.needsUpdate = true;
      coverage = 1; enabled = active; fit = { ...DEFAULT_FIT, ...nextFit }; dimensions = "";
      plane.visible = enabled && (!url || (!!source && url === currentUrl));
      if (url === currentUrl) { repaint(); return; }
      currentUrl = url; source = null; plane.visible = false;
      const request = ++revision;
      if (!url) { repaint(); return; }
      const image = new Image(); image.crossOrigin = "anonymous"; image.src = url;
      void image.decode().then(() => {
        if (disposed || revision !== request) return;
        source = image; plane.visible = enabled; dimensions = ""; repaint();
      }).catch(() => { /* The unlit DOM image remains available when decoding fails. */ });
    },
    frame(camera: THREE.PerspectiveCamera, width: number, height: number, anchoredHeight?: number) {
      if ((!source && currentUrl) || !enabled) { plane.visible = false; if (catcher) catcher.visible=false; return; }
      const stamp = `${width}|${height}|${fit.scale}|${fit.x}|${fit.y}`;
      if (source && stamp !== dimensions) {
        dimensions = stamp;
        const previousWidth = canvas.width, previousHeight = canvas.height;
        const cap = Math.min(Math.min(devicePixelRatio || 1, 2), 4096 / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * cap)); canvas.height = Math.max(1, Math.round(height * cap));
        const scale = Math.max(1, Math.min(3, fit.scale));
        const cover = Math.max(canvas.width / source.naturalWidth, canvas.height / source.naturalHeight);
        const w = source.naturalWidth * cover * scale, h = source.naturalHeight * cover * scale;
        const x = (canvas.width - w) / 2 + Math.max(-1, Math.min(1, fit.x)) * canvas.width * (scale - 1) / 2;
        const y = (canvas.height - h) / 2 + Math.max(-1, Math.min(1, fit.y)) * canvas.height * (scale - 1) / 2;
        canvas.getContext("2d")!.drawImage(source, x, y, w, h);
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
        const normalCap = Math.min(1, 512 / Math.max(canvas.width, canvas.height));
        const previousNormalWidth = normalCanvas.width, previousNormalHeight = normalCanvas.height;
        normalCanvas.width = Math.max(1, Math.round(canvas.width * normalCap)); normalCanvas.height = Math.max(1, Math.round(canvas.height * normalCap));
        const context = normalCanvas.getContext("2d")!; context.drawImage(canvas, 0, 0, normalCanvas.width, normalCanvas.height);
        const image = context.getImageData(0, 0, normalCanvas.width, normalCanvas.height);
        image.data.set(backdropNormals(image.data, normalCanvas.width, normalCanvas.height)); context.putImageData(image, 0, 0);
        if (normalCanvas.width !== previousNormalWidth || normalCanvas.height !== previousNormalHeight) {
          normals.dispose();
          normals = new THREE.CanvasTexture(normalCanvas);
          normals.colorSpace = THREE.NoColorSpace;
          material.normalMap = normals;
        }
        normals.needsUpdate = true;
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
    dispose() { disposed = true; revision++; source = null; scene.remove(plane); texture.dispose(); normals.dispose(); plane.geometry.dispose(); material.dispose(); if (catcher) {scene.remove(catcher);catcher.geometry.dispose();catcher.material.dispose();} },
  };
}
