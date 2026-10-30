/** Keep the loader until a prepared scene has been drawn and the browser can present it. */
export async function prepareVisiblePreview(draw: () => Promise<void>, nextFrame: () => Promise<void>) {
  await draw();
  await nextFrame();
}

/** Demo reveal waits for resources, final shader variants and a painted frame, never a timer. */
export async function prepareDemoPresentation(
  resources: () => Promise<void>,
  shadersAndPaint: () => Promise<void>,
  nextFrame: () => Promise<void>,
) {
  await resources();
  await shadersAndPaint();
  await nextFrame();
}