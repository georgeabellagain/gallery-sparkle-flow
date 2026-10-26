/**
 * Colour-and-motion backgrounds: minimal fields of colour behind the book, some still and some drifting slowly.
 * They are drawn by the browser from gradients (nothing to download) and stored in `backgroundPreset` as
 * "scene:<name>", so they work wherever a background preset does: per look and per reading style.
 */
export type SceneBlob = {
  colour: string;
  /** Size as a fraction of the larger side of the view. */
  size: number;
  /** Centre, as fractions of the view. */
  x: number;
  y: number;
  /** How far it drifts (fractions of the view) over one period, and how long that takes in seconds. */
  drift?: [number, number];
  period?: number;
};
export type BackgroundScene = {
  id: `scene:${string}`;
  label: string;
  /** The field's own colour: what shows before anything else, and what the viewer's icons read their tone from. */
  base: string;
  animated: boolean;
  blobs: SceneBlob[];
  /** A soft band of light that sweeps slowly across (animated scenes only). */
  sweep?: string;
};

export const BACKGROUND_SCENES: readonly BackgroundScene[] = [
  // Still
  { id: "scene:sorbet", label: "Sorbet", base: "#f7efe7", animated: false, blobs: [
    { colour: "#ffcdb8", size: 0.9, x: 0.18, y: 0.28 }, { colour: "#e2d6ff", size: 0.85, x: 0.86, y: 0.78 }, { colour: "#fff4c9", size: 0.6, x: 0.7, y: 0.12 } ] },
  { id: "scene:sage", label: "Sage", base: "#e9efe6", animated: false, blobs: [
    { colour: "#cde4d3", size: 0.95, x: 0.2, y: 0.75 }, { colour: "#f1e7d2", size: 0.7, x: 0.85, y: 0.2 } ] },
  { id: "scene:cobalt", label: "Cobalt", base: "#2337c6", animated: false, blobs: [
    { colour: "#4e6bff", size: 1.1, x: 0.75, y: 0.25 }, { colour: "#1a258f", size: 0.9, x: 0.1, y: 0.9 } ] },
  { id: "scene:ink", label: "Ink", base: "#111215", animated: false, blobs: [
    { colour: "#1d3a3d", size: 1, x: 0.2, y: 0.2 }, { colour: "#2a2140", size: 0.9, x: 0.9, y: 0.85 } ] },
  { id: "scene:clay", label: "Clay", base: "#d9694f", animated: false, blobs: [
    { colour: "#f0a07f", size: 1, x: 0.8, y: 0.2 }, { colour: "#b44a35", size: 0.9, x: 0.15, y: 0.85 } ] },
  // Moving
  { id: "scene:aurora", label: "Aurora", base: "#0f1226", animated: true, blobs: [
    { colour: "#21c7a8", size: 0.9, x: 0.25, y: 0.3, drift: [0.43, 0.24], period: 6 },
    { colour: "#7357ff", size: 1, x: 0.75, y: 0.65, drift: [-0.38, -0.29], period: 8 },
    { colour: "#ff5fa8", size: 0.6, x: 0.55, y: 0.15, drift: [-0.24, 0.38], period: 6 } ] },
  { id: "scene:dawn", label: "Dawn", base: "#fbf1e9", animated: true, blobs: [
    { colour: "#ffc4a8", size: 0.95, x: 0.2, y: 0.25, drift: [0.35, 0.19], period: 7 },
    { colour: "#ffa0a0", size: 0.6, x: 0.8, y: 0.3, drift: [-0.29, 0.29], period: 6 },
    { colour: "#d9ccff", size: 0.9, x: 0.65, y: 0.85, drift: [-0.24, -0.29], period: 8 } ] },
  { id: "scene:mint", label: "Mint", base: "#eef7f3", animated: true, blobs: [
    { colour: "#bfead7", size: 1, x: 0.25, y: 0.7, drift: [0.38, -0.24], period: 8 },
    { colour: "#c9e4ff", size: 0.85, x: 0.8, y: 0.25, drift: [-0.34, 0.29], period: 7 } ] },
  { id: "scene:lagoon", label: "Lagoon", base: "#062f39", animated: true, blobs: [
    { colour: "#0fa3b1", size: 1, x: 0.3, y: 0.35, drift: [0.34, 0.29], period: 7 },
    { colour: "#2f6bff", size: 0.8, x: 0.8, y: 0.8, drift: [-0.38, -0.19], period: 6 } ] },
  { id: "scene:studio-light", label: "Studio light", base: "#ecebe8", animated: true, blobs: [
    { colour: "#ffffff", size: 1.1, x: 0.3, y: 0.2, drift: [0.29, 0.12], period: 8 } ],
    sweep: "rgba(255,255,255,0.55)" },
];

export const backgroundScene = (id: string | undefined): BackgroundScene | null => BACKGROUND_SCENES.find((s) => s.id === id) ?? null;
export const isBackgroundScene = (id: string | undefined) => Boolean(backgroundScene(id));

const sceneImages = new Map<string, string>();
/** Marks a picture made from a scene, so surfaces stretch it once instead of tiling it. */
export const SCENE_IMAGE_MARK = "#scene";
/**
 * A still picture of a scene, for places that need an image rather than the live layer (the photo shoot's wall and
 * floor). Drawn the way BackgroundSceneLayer draws it, at rest; made once per scene and kept.
 */
export function sceneImageUrl(id: string | undefined, size = 1536): string | undefined {
  const scene = backgroundScene(id);
  if (!scene || typeof document === "undefined") return undefined;
  const cached = sceneImages.get(scene.id);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.fillStyle = scene.base;
  ctx.fillRect(0, 0, size, size);
  for (const b of scene.blobs) {
    // As in the layer: a square 1.4 × size wide, its circular gradient reaching the square's corners.
    const box = b.size * 1.4 * size, radius = (box / 2) * Math.SQRT2, cx = b.x * size, cy = b.y * size;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0, b.colour);
    g.addColorStop(0.22, `${b.colour}cc`);
    g.addColorStop(0.68, `${b.colour}00`);
    ctx.fillStyle = g;
    ctx.fillRect(cx - box / 2, cy - box / 2, box, box);
  }
  const url = canvas.toDataURL("image/jpeg", 0.9) + SCENE_IMAGE_MARK;
  sceneImages.set(scene.id, url);
  return url;
}
