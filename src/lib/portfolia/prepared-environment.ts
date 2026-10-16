import { DataUtils } from "three";
import { averageEnvironment } from "./environment-diffusion";
import { HDRI_PRESETS, type HdriId } from "./lighting";
import { parseRgbe } from "./rgbe";

/** Share CPU preparation across viewers, while GPU targets remain renderer-owned. */
export function createEnvironmentCache<T>(load: (id: HdriId) => Promise<T>, limit = 4) {
  const entries = new Map<HdriId, Promise<T>>();
  return (id: HdriId): Promise<T> => {
    const hit = entries.get(id);
    if (hit) { entries.delete(id); entries.set(id, hit); return hit; }
    const pending = Promise.resolve().then(() => load(id));
    entries.set(id, pending);
    while (entries.size > limit) entries.delete(entries.keys().next().value!);
    void pending.catch(() => { if (entries.get(id) === pending) entries.delete(id); });
    return pending;
  };
}

export const loadPreparedEnvironment = createEnvironmentCache(async (id) => {
  const preset = HDRI_PRESETS.find(p => p.id === id) ?? HDRI_PRESETS[3]!;
  const response = await fetch(preset.file);
  if (!response.ok) throw new Error(`Lighting file ${response.status}`);
  const { width, height, rgb } = parseRgbe(await response.arrayBuffer());
  const colour = averageEnvironment(rgb, width, height);
  const pixels = new Uint16Array(width * height * 4);
  const one = DataUtils.toHalfFloat(1);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const from = ((height - 1 - y) * width + x) * 3, to = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) pixels[to + c] = DataUtils.toHalfFloat(Math.min(rgb[from + c]!, 60000));
    pixels[to + 3] = one;
  }
  return { width, height, pixels, colour };
});
