/** Retain the window aspect ratio, with even codec dimensions and a bounded GPU surface. */
export function studioRenderDimensions(width: number, height: number) {
  const w = Math.max(1, width), h = Math.max(1, height);
  const scale = Math.min(3840 / Math.max(w,h), Math.sqrt(8_294_400 / (w*h)));
  return {width: Math.max(2,Math.floor(w*scale/2)*2), height: Math.max(2,Math.floor(h*scale/2)*2)};
}
