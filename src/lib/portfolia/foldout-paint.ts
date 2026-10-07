import { getBlob } from "./assets";
import { foldoutSurfaces, type Foldout, type FoldoutSurface } from "./foldouts";
export const NOTE_FONTS = {
  serif: "Georgia, serif",
  sans: "Arial, sans-serif",
  mono: "Courier New, monospace",
  hand: "cursive",
};
export type NoteImages = Map<string, ImageBitmap>;
export async function loadNoteImages(keys: string[]): Promise<NoteImages> {
  const images: NoteImages = new Map();
  await Promise.all(
    [...new Set(keys)].map(async (key) => {
      try {
        const blob = await getBlob(key);
        if (blob) images.set(key, await createImageBitmap(blob));
      } catch {
        /* A missing image leaves its colour/text readable. */
      }
    }),
  );
  return images;
}
export function noteInk(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 155
    ? "#292722"
    : "#ffffff";
}
/** Shared canvas artwork: the closed note is literally part of the turning page texture. */
export function paintNoteSurface(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  side: FoldoutSurface,
  images: NoteImages,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  ctx.fillStyle = side.colour;
  ctx.fillRect(0, 0, w, h);
  const img = side.imageKey ? images.get(side.imageKey) : undefined;
  if (img) {
    const scale =
      (side.imageFit === "cover"
        ? Math.max(w / img.width, h / img.height)
        : Math.min(w / img.width, h / img.height)) * (side.imageScale ?? 1);
    ctx.drawImage(
      img,
      (w - img.width * scale) / 2 + (side.imageX ?? 0) * w,
      (h - img.height * scale) / 2 + (side.imageY ?? 0) * h,
      img.width * scale,
      img.height * scale,
    );
  }
  const pad = Math.min(w, h) * 0.09;
  if (side.text.trim()) {
    let size = Math.min(w * 0.115, h * 0.18);
    let lines: string[] = [];
    const wrap = () => {
      const out: string[] = [];
      for (const para of side.text.split("\n")) {
        let line = "";
        for (const word of para.split(/\s+/)) {
          const candidate = line ? `${line} ${word}` : word;
          if (ctx.measureText(candidate).width <= w - pad * 2) {
            line = candidate;
            continue;
          }
          if (line) {
            out.push(line);
            line = "";
          }
          for (const char of word) {
            if (line && ctx.measureText(line + char).width > w - pad * 2) {
              out.push(line);
              line = "";
            }
            line += char;
          }
        }
        out.push(line);
      }
      return out;
    };
    for (let i = 0; i < 40; i++) {
      ctx.font = `${size}px ${NOTE_FONTS[side.font ?? "serif"]}`;
      lines = wrap();
      if (lines.length * size * 1.3 <= h - pad * 2) break;
      size *= 0.88;
    }
    if (img) {
      ctx.fillStyle = side.colour;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(
        pad * 0.5,
        pad * 0.5,
        w - pad,
        Math.min(h - pad, lines.length * size * 1.3 + pad),
      );
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = noteInk(side.colour);
    ctx.textBaseline = "top";
    lines.forEach((line, i) => ctx.fillText(line, pad, pad + i * size * 1.3));
  }
  ctx.restore();
}
export function paintClosedNotes(
  canvas: HTMLCanvasElement,
  items: Foldout[],
  images: NoteImages,
) {
  const ctx = canvas.getContext("2d")!;
  for (const f of items) {
    ctx.save();
    ctx.translate(f.x * canvas.width, f.y * canvas.height);
    paintNoteSurface(
      ctx,
      f.width * canvas.width,
      f.height * canvas.height,
      foldoutSurfaces(f).outside,
      images,
    );
    ctx.restore();
  }
}
