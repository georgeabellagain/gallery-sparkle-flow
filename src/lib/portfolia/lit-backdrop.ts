import * as THREE from "three";
import { DEFAULT_FIT, type BackgroundFit } from "./background";

/** A matte photograph on the table, shaded by the same environment as the pages. */
export function createLitBackdrop(scene: THREE.Scene, repaint: () => void) {
  const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  plane.position.z = -0.072;
  plane.visible = false;
  scene.add(plane);
  let source: HTMLImageElement | null = null;
  let currentUrl: string | undefined;
  let fit = DEFAULT_FIT;
  let enabled = false, disposed = false, revision = 0;
  let dimensions = "";
  const canvas = document.createElement("canvas");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  material.map = texture;
  return {
    set(url: string | undefined, nextFit: Partial<BackgroundFit> | undefined, active: boolean) {
      enabled = active; fit = { ...DEFAULT_FIT, ...nextFit }; dimensions = "";
      plane.visible = enabled && !!source && url === currentUrl;
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
    frame(camera: THREE.PerspectiveCamera, width: number, height: number) {
      if (!source || !enabled) { plane.visible = false; return; }
      const stamp = `${width}|${height}|${fit.scale}|${fit.x}|${fit.y}`;
      if (stamp !== dimensions) {
        dimensions = stamp;
        const cap = Math.min(1, 2048 / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * cap)); canvas.height = Math.max(1, Math.round(height * cap));
        const scale = Math.max(1, Math.min(3, fit.scale));
        const cover = Math.max(canvas.width / source.naturalWidth, canvas.height / source.naturalHeight);
        const w = source.naturalWidth * cover * scale, h = source.naturalHeight * cover * scale;
        const x = (canvas.width - w) / 2 + Math.max(-1, Math.min(1, fit.x)) * canvas.width * (scale - 1) / 2;
        const y = (canvas.height - h) / 2 + Math.max(-1, Math.min(1, fit.y)) * canvas.height * (scale - 1) / 2;
        canvas.getContext("2d")!.drawImage(source, x, y, w, h); texture.needsUpdate = true;
      }
      const worldHeight = 2 * (camera.position.z - plane.position.z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      plane.position.x = camera.position.x; plane.position.y = camera.position.y;
      plane.scale.set(worldHeight * camera.aspect, worldHeight, 1); plane.visible = true;
    },
    dispose() { disposed = true; revision++; source = null; scene.remove(plane); texture.dispose(); plane.geometry.dispose(); material.dispose(); },
  };
}
