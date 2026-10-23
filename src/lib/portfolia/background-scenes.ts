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
    { colour: "#21c7a8", size: 0.9, x: 0.25, y: 0.3, drift: [0.18, 0.1], period: 26 },
    { colour: "#7357ff", size: 1, x: 0.75, y: 0.65, drift: [-0.16, -0.12], period: 31 },
    { colour: "#ff5fa8", size: 0.6, x: 0.55, y: 0.15, drift: [-0.1, 0.16], period: 23 } ] },
  { id: "scene:dawn", label: "Dawn", base: "#fbf1e9", animated: true, blobs: [
    { colour: "#ffc4a8", size: 0.95, x: 0.2, y: 0.25, drift: [0.15, 0.08], period: 28 },
    { colour: "#ffa0a0", size: 0.6, x: 0.8, y: 0.3, drift: [-0.12, 0.12], period: 24 },
    { colour: "#d9ccff", size: 0.9, x: 0.65, y: 0.85, drift: [-0.1, -0.12], period: 33 } ] },
  { id: "scene:mint", label: "Mint", base: "#eef7f3", animated: true, blobs: [
    { colour: "#bfead7", size: 1, x: 0.25, y: 0.7, drift: [0.16, -0.1], period: 30 },
    { colour: "#c9e4ff", size: 0.85, x: 0.8, y: 0.25, drift: [-0.14, 0.12], period: 27 } ] },
  { id: "scene:lagoon", label: "Lagoon", base: "#062f39", animated: true, blobs: [
    { colour: "#0fa3b1", size: 1, x: 0.3, y: 0.35, drift: [0.14, 0.12], period: 29 },
    { colour: "#2f6bff", size: 0.8, x: 0.8, y: 0.8, drift: [-0.16, -0.08], period: 25 } ] },
  { id: "scene:studio-light", label: "Studio light", base: "#ecebe8", animated: true, blobs: [
    { colour: "#ffffff", size: 1.1, x: 0.3, y: 0.2, drift: [0.12, 0.05], period: 34 } ],
    sweep: "rgba(255,255,255,0.55)" },
];

export const backgroundScene = (id: string | undefined): BackgroundScene | null => BACKGROUND_SCENES.find((s) => s.id === id) ?? null;
export const isBackgroundScene = (id: string | undefined) => Boolean(backgroundScene(id));
