/**
 * The marketing pictures and clips that exist in public/marketing/ (plan 2, S2). A section shows its visual only when its
 * name is listed here, so a missing file never leaves a broken image. Add an entry in the same change as the files.
 *
 * Pictures: <name>-1600.webp and <name>-800.webp. Clips: <name>.mp4 and <name>-poster.webp.
 */
export type MarketingAsset = { name: string; kind: "image" | "clip"; alt: string; width: number; height: number };

export const MARKETING_ASSETS: MarketingAsset[] = [];

/** Every asset name the plan expects, so code can refer to a visual before its file is made. */
export const KNOWN_ASSET_NAMES = [
  "book-three-quarter", "book-flatlay", "book-phone",
  "feature-hotspots", "feature-video-page", "feature-insights", "feature-lead-form", "feature-share",
  "product-preview", "product-links", "product-delivery",
  "step-upload", "step-style", "step-share",
  "example-architecture", "example-graphic-design", "example-photography", "example-fashion", "example-field-notes", "example-pink",
  "og-home", "og-products",
] as const;

export const marketingAsset = (name: string) => MARKETING_ASSETS.find(a => a.name === name);

/** Social picture (plan 2, S12): the 1200 x 630 og-home or og-products once it exists, else the page's current one. */
export const ogImageUrl = (name: "og-home" | "og-products", fallback: string) => marketingAsset(name) ? `https://portfolia.site/marketing/${name}-1600.webp` : fallback;
