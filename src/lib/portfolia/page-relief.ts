const fract = (x: number) => x - Math.floor(x);

/**
 * Height of a page above the table at distance `d` from the spine (0..1) and
 * height `v` (0 bottom .. 1 top). Pages rise from the gutter in a soft arch
 * and settle toward the outer edge, with a slight bow top to bottom. A little
 * waviness and a slightly lifted corner differ for every page, so no two pages
 * look machine-made.
 */
export function pageRelief(d: number, v: number, seed: number) {
  const dd = Math.min(1, Math.max(0, d));
  const spine = 0.014 * Math.pow(1 - dd, 6);
  // The arch: zero at the gutter and the outer edge, highest about two fifths of the way out.
  const arch = 0.034 * Math.sin(Math.PI * Math.pow(dd, 0.75)) * (1 - 0.3 * Math.pow(2 * v - 1, 2));
  // Imperfections fade out at the gutter so both pages meet cleanly there.
  const s = seed * 12.9898;
  const fade = Math.min(1, dd / 0.18);
  const ripple =
    (Math.sin(dd * 5.4 + s) * Math.sin(v * 4.3 + s * 1.7) * 0.0018 +
      Math.sin(dd * 12.1 + v * 3.3 + s * 2.3) * 0.0006) *
    fade;
  const k = 0.35 + 0.65 * fract(Math.sin(seed * 78.233) * 43758.5453);
  const cu = Math.min(1, Math.max(0, (dd - 0.55) / 0.45));
  const cv = Math.min(1, Math.max(0, (0.4 - v) / 0.4));
  const corner = 0.005 * k * cu * cu * cv * cv;
  return spine + arch + ripple + corner;
}
