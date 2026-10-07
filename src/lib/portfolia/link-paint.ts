import { getBlob } from "./assets";
import { linkName, siteIconUrl, hostOf, type PageLink } from "./page-extras";

export type LinkIcons = Map<string, ImageBitmap | null>;
export const iconKeyOf = (l: Pick<PageLink, "url" | "iconKey">) => (l.iconKey ? `own:${l.iconKey}` : `site:${hostOf(l.url)}`);

/** Loads each link's logo (the creator's own picture, or the website's icon). A logo that cannot load becomes a letter tile. */
export async function loadLinkIcons(links: PageLink[], cache: LinkIcons = new Map()): Promise<LinkIcons> {
  await Promise.all(
    links.map(async (l) => {
      const key = iconKeyOf(l);
      if (cache.has(key)) return;
      try {
        // A slow or missing logo must never hold the book up: after a few seconds the link shows a letter tile.
        const load = async () => {
          let blob: Blob | undefined;
          if (l.iconKey) blob = await getBlob(l.iconKey);
          else {
            const r = await fetch(siteIconUrl(l.url), { signal: AbortSignal.timeout(4000) });
            if (r.ok) blob = await r.blob();
          }
          return blob ? await createImageBitmap(blob) : null;
        };
        cache.set(key, await Promise.race([load(), new Promise<null>((resolve) => setTimeout(() => resolve(null), 4500))]));
      } catch {
        cache.set(key, null);
      }
    }),
  );
  return cache;
}

const round = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/**
 * Prints the links onto a page: flat, like ink on the paper, with no shadow. They then curve, turn and take the
 * light with the page itself.
 */
export function paintPageLinks(ctx: CanvasRenderingContext2D, w: number, h: number, links: PageLink[], icons: LinkIcons) {
  for (const l of links) {
    const size = l.size * w;
    const x = l.x * w,
      y = l.y * h;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    round(ctx, x, y, size, size, size * 0.22);
    ctx.fill();
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.strokeStyle = "rgba(0,0,0,0.14)";
    ctx.stroke();
    const icon = icons.get(iconKeyOf(l));
    if (icon) {
      ctx.save();
      round(ctx, x, y, size, size, size * 0.22);
      ctx.clip();
      const inset = l.iconKey ? 0 : size * 0.19;
      const box = size - inset * 2;
      const scale = (l.iconKey ? Math.max : Math.min)(box / icon.width, box / icon.height);
      ctx.drawImage(icon, x + (size - icon.width * scale) / 2, y + (size - icon.height * scale) / 2, icon.width * scale, icon.height * scale);
      ctx.restore();
    } else {
      ctx.fillStyle = "#44413b";
      ctx.font = `600 ${size * 0.5}px Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((linkName(l) || "?").charAt(0).toUpperCase(), x + size / 2, y + size / 2 + size * 0.03);
    }
    const caption = l.label?.trim();
    if (caption) {
      let px = size * 0.24;
      ctx.font = `500 ${px}px Arial, sans-serif`;
      while (px > 6 && ctx.measureText(caption).width > size * 1.9) {
        px *= 0.92;
        ctx.font = `500 ${px}px Arial, sans-serif`;
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#44413b";
      ctx.fillText(caption, x + size / 2, y + size + size * 0.1);
    }
    ctx.restore();
  }
}
