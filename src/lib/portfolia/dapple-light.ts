import * as THREE from "three";

/** A projected light mask, rather than a flat overlay: moving sheets and notes receive the same light. */
export function dappleTexture(kind: "pine" | "leaves") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, 256, 256);
  let seed = kind === "pine" ? 429 : 871;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.filter = kind === "pine" ? "blur(1.5px)" : "blur(3px)";
  for (let i = 0; i < (kind === "pine" ? 85 : 42); i++) {
    ctx.save(); ctx.translate(random() * 256, random() * 256); ctx.rotate(random() * Math.PI);
    ctx.fillStyle = `rgba(255,244,219,${.35 + random() * .65})`;
    ctx.beginPath(); ctx.ellipse(0, 0, 3 + random() * 8, kind === "pine" ? 2 + random() * 3 : 6 + random() * 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
