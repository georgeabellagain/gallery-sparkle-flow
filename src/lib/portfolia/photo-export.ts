export type PhotoSize = { width: number; height: number };
// Amazon's A+ image sizes: https://kdp.amazon.com/en_US/help/topic/GCKLH8V7ULLD5EXY
export const PHOTO_SIZE_PRESETS = [
  { id: "portrait", label: "Portrait photograph", width: 2048, height: 2560 },
  { id: "website", label: "Website hero · 16:9", width: 1920, height: 1080 },
  { id: "social-card", label: "Website / social link card", width: 1200, height: 630 },
  { id: "square", label: "Square product image", width: 2000, height: 2000 },
  { id: "social-portrait", label: "Social portrait · 4:5", width: 1080, height: 1350 },
  { id: "story", label: "Story · 9:16", width: 1080, height: 1920 },
  { id: "amazon-tile", label: "Amazon A+ image tile", width: 600, height: 600 },
] as const;
/** Everyone can stage and preview; saving the picture is Personal. Client-side only, so not tamper-proof. */
export const PHOTO_EXPORT_REASON = "Photo shoot export";
export const photoExportAction = (plan: "free" | "personal" | undefined) => (plan === "personal" ? "download" : "upgrade") as "download" | "upgrade";
export function photoSizeError(size: PhotoSize, deviceLimit = 8192) {
  const { width, height } = size,
    max = Math.min(8192, deviceLimit);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 64 || height < 64)
    return "Enter whole pixel dimensions of at least 64 × 64.";
  if (width > max || height > max)
    return `This device supports up to ${max} pixels on either edge.`;
  if (width * height > 16777216) return "Choose dimensions up to 16 megapixels in total.";
  return null;
}
