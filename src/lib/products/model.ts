import { BACKGROUND_PRESETS } from "../portfolia/background-presets";
import { z } from "zod";
import { readableTurnCurve } from "../portfolia/turn-curve";
import { readableTurnStyle } from "../portfolia/turn-motion";
import { paperFinish } from "../portfolia/surface";
import type { ViewerSettings } from "../portfolia/store";
export const PRODUCT_BUCKET = "product-files";
export const productId = z.string().uuid();
export const productFile = z.object({
  path: z.string().max(240),
  name: z.string().min(1).max(160),
  bytes: z.number().int().positive().max(262144000),
  pages: z.number().int().min(1).max(2000),
});
export type ProductFile = z.infer<typeof productFile>;
const hex = z.string().regex(/^#[a-fA-F0-9]{6}$/);
const fit = z.object({ scale: z.number().min(0.05).max(10), x: z.number().min(-5).max(5), y: z.number().min(-5).max(5), tile: z.boolean().optional() });
// Deliberate allowlist: no hidden pages, asset keys, tracking, scripts or external
// media in the public product reader. Preview and customer files stay separate.
export const productAppearance = z.object({
  mode: z.literal("book").default("book"),
  look: z.enum(["clean", "studio"]).default("clean"),
  bookStyle: z.enum(["flipbook", "hardback", "softcover"]).optional(),
  turnStyle: z.string().max(30).transform(readableTurnStyle).optional(),
  turnCurve: z.string().max(30).transform(readableTurnCurve).optional(),
  turnSpeed: z.number().min(0.25).max(3).optional(),
  pageStack: z.boolean().optional(),
  studioLighting: z
    .enum(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"])
    .optional(),
  studioBrightness: z.number().min(0).max(2).optional(),
  studioLightingStrength: z.number().min(0).max(1).optional(),
  studioTopLight: z.number().min(0).max(1).optional(),
  finish: z
    .string()
    .max(30)
    .transform((v) => paperFinish(v as import("../portfolia/surface").SurfaceKind))
    .optional(),
  backgroundColor: hex.optional(),
  backgroundPreset: z
    .string()
    .refine((v) => BACKGROUND_PRESETS.some((p) => p.id === v), "Choose a listed background")
    .optional(),
  spreads: z.enum(["single", "ready"]).optional(),
  simpleShadow: z.boolean().optional(),
  simpleShadowOpacity: z.number().min(0).max(1).optional(),
  // Same choices as the portfolio editor (no uploaded picture keys).
  backgroundFit: fit.optional(),
  backgrounds: z
    .record(
      z.enum(["studio", "clean", "scroll", "paged"]),
      z.object({ backgroundColor: hex.optional(), backgroundPreset: z.string().max(60).optional(), backgroundFit: fit.optional() }),
    )
    .optional(),
  idleOrbit: z.enum(["start", "always", "off"]).optional(),
  paper: z.string().max(30).optional(),
  light: z.string().max(30).optional(),
  thickness: z.string().max(30).optional(),
  simpleShading: z.string().max(30).optional(),
  ribbon: z.boolean().optional(),
  ribbonColour: hex.optional(),
  previewWatermark: z.boolean().optional(),
});
export function shopUrl(value: string) {
  if (!value.trim()) return "";
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    !u.hostname.includes(".") ||
    /^(localhost|127\.|0\.|\[)/i.test(u.hostname)
  )
    throw new Error("Use a public HTTPS shop or listing URL.");
  return u.href;
}
export function previewPages(value: string, total: number): number[] {
  const result = new Set<number>();
  if (!value.trim()) return total >= 1 ? [1] : [];
  for (const bit of value.split(",")) {
    const match = bit.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Use page numbers or ranges, for example 1, 3–5 (with a hyphen).");
    const first = Number(match[1]),
      last = Number(match[2] ?? match[1]);
    if (first < 1 || last < first || last > total || last - first > 39)
      throw new Error(`Choose pages between 1 and ${total}, up to 40 preview pages.`);
    for (let n = first; n <= last; n++) result.add(n);
  }
  // The cover always opens the preview.
  if (total >= 1) result.add(1);
  if (result.size > 40) throw new Error("Choose at most 40 preview pages.");
  return [...result].sort((a, b) => a - b);
}
export const saveProductSchema = z.object({
  id: productId,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(3000),
  buy_url: z.string().max(2000).transform(shopUrl),
  allow_download: z.boolean(),
  status: z.enum(["draft", "published"]),
  full_file: productFile.nullable(),
  preview_file: productFile.nullable(),
  preview_pages: z.array(z.number().int().positive()).max(40),
  appearance: productAppearance,
  revision: z.number().int().nonnegative(),
});
export type Product = Omit<z.infer<typeof saveProductSchema>, "appearance"> & {
  appearance: Partial<ViewerSettings>;
  updated_at: string;
};
export function productFilePath(owner: string, id: string, path: string) {
  return (
    path.startsWith(`${owner}/${id}/`) && /^[a-f0-9-]+\/[a-f0-9-]+\/[a-f0-9-]+\.pdf$/.test(path)
  );
}
export function publicProduct(row: Product, customer: boolean) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    buyUrl: row.buy_url,
    appearance: row.appearance,
    customer,
    allowDownload: customer && row.allow_download,
    pages: (customer ? row.full_file : row.preview_file)?.pages ?? 0,
    hasPreview: Boolean(row.preview_file),
    hasCustomerEdition: Boolean(row.full_file),
    // No storage keys, original filename, full page count, access hashes or token.
    fileUrl: (customer ? row.full_file : row.preview_file)
      ? `/api/public/product-file/${row.id}?edition=${customer ? "customer" : "preview"}&v=${row.revision}`
      : null,
  };
}

/** Reading spreads after the cover: pages 2-3, 4-5, ... (the last may be a single page). */
export function previewSpreads(total: number): [number, number][] {
  const out: [number, number][] = [];
  for (let n = 2; n <= total; n += 2) out.push([n, Math.min(n + 1, total)]);
  return out;
}
