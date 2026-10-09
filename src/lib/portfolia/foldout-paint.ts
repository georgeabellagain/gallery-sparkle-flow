import { layoutNoteText } from "./note-text";
import { getBlob } from "./assets";
import { foldoutSurfaces, type Foldout, type FoldoutSurface, type NoteFont } from "./foldouts";
/** Handwriting fonts come from Google Fonts and load the first time a note uses one. */
export const NOTE_FONT_FAMILIES: Record<NoteFont, { css: string; google?: string }> = {
  serif: { css: "Georgia, serif" },
  sans: { css: "Arial, sans-serif" },
  mono: { css: "Courier New, monospace" },
  hand: { css: '"Caveat", cursive', google: "Caveat:wght@400..700" },
  neat: { css: '"Patrick Hand", cursive', google: "Patrick+Hand" },
  script: { css: '"Dancing Script", cursive', google: "Dancing+Script:wght@400..700" },
  marker: { css: '"Permanent Marker", cursive', google: "Permanent+Marker" },
};
export const NOTE_FONTS = Object.fromEntries(
  Object.entries(NOTE_FONT_FAMILIES).map(([k, v]) => [k, v.css]),
) as Record<NoteFont, string>;
/** Makes sure every font the notes use is ready before they are painted, so artwork never flashes the fallback. */
export async function loadNoteFonts(sides: Array<{ font?: NoteFont } | undefined>) {
  if (typeof document === "undefined") return;
  const wanted = [...new Set(sides.map((s) => s?.font).filter((f): f is NoteFont => !!f && !!NOTE_FONT_FAMILIES[f]?.google))];
  await Promise.all(
    wanted.map(async (font) => {
      const { css, google } = NOTE_FONT_FAMILIES[font];
      const family = css.split(",")[0]!.trim();
      const id = `note-font-${font}`;
      let link = document.getElementById(id) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${google}&display=swap`;
        document.head.appendChild(link);
      }
      const timeout = new Promise((r) => setTimeout(r, 5000));
      try {
        // fonts.load resolves instantly (with nothing) until the stylesheet registers the font,
        // which let closed notes bake with the system cursive fallback. Wait for the sheet first.
        if (!link.sheet) {
          const sheet = link;
          await Promise.race([
            new Promise((r) => {
              sheet.addEventListener("load", r, { once: true });
              sheet.addEventListener("error", r, { once: true });
            }),
            timeout,
          ]);
        }
        await Promise.race([document.fonts.load(`32px ${family}`, "Aa"), timeout]);
      } catch {
        /* the fallback script font still reads fine */
      }
    }),
  );
}
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
    const family = NOTE_FONTS[side.font ?? "serif"];
    const measure = (t: string, size: number) => {
      ctx.font = `${size}px ${family}`;
      return ctx.measureText(t).width;
    };
    const { size, lines } = layoutNoteText(side.text, w - pad * 2, h - pad * 2, Math.min(w * 0.115, h * 0.18), measure);
    const lineHeight = size * 1.3;
    const textHeight = lines.length * lineHeight;
    const valign = side.valign ?? "top";
    const top = valign === "middle" ? Math.max(pad, (h - textHeight) / 2) : valign === "bottom" ? Math.max(pad, h - pad - textHeight) : pad;
    if (img) {
      ctx.fillStyle = side.colour;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(pad * 0.5, Math.max(0, top - pad * 0.5), w - pad, Math.min(h - pad, textHeight + pad));
      ctx.globalAlpha = 1;
    }
    ctx.font = `${size}px ${family}`;
    ctx.fillStyle = noteInk(side.colour);
    ctx.textBaseline = "top";
    const align = side.align ?? "left";
    lines.forEach((line, i) => {
      const y = top + i * lineHeight;
      const words = line.text.split(" ");
      if (align === "justify" && !line.last && words.length > 1) {
        // Spread the spare room evenly between the words so both edges are straight.
        const gap = (w - pad * 2 - words.reduce((n, word) => n + ctx.measureText(word).width, 0)) / (words.length - 1);
        let x = pad;
        for (const word of words) {
          ctx.fillText(word, x, y);
          x += ctx.measureText(word).width + gap;
        }
        return;
      }
      const lineWidth = ctx.measureText(line.text).width;
      const x = align === "center" ? (w - lineWidth) / 2 : align === "right" ? w - pad - lineWidth : pad;
      ctx.fillText(line.text, x, y);
    });
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
