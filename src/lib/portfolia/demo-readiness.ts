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