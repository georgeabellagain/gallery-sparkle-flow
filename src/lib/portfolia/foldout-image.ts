import { FOLDOUT_IMAGE_LIMIT } from "./foldouts";
/** Decode and re-encode raster uploads; no SVG/HTML or external asset URLs. */
export async function prepareFoldoutImage(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG or WebP image.");
  if (file.size > FOLDOUT_IMAGE_LIMIT)
    throw new Error("Choose an image smaller than 8 MB.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("This image could not be opened. Try another file.");
  });
  try {
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("Image preparation is unavailable on this device.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Could not prepare the image.")),
        "image/jpeg",
        0.92,
      ),
    );
  } finally {
    bitmap.close();
  }
}
