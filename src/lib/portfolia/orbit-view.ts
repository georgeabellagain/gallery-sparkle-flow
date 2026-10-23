/**
 * The 3D view: the camera moves over a dome above the book and always looks at its middle.
 * `yaw` swings round to the left or right, `pitch` leans towards the reader (positive) or the
 * top of the book (negative). Both are radians; 0, 0 is straight down, the normal reading view.
 */
export type Orbit = { yaw: number; pitch: number };

const deg = Math.PI / 180;
/** Hard stops: never round to the side or under the book, only a cap of the dome above it. */
export const ORBIT_LIMITS = { yaw: 55 * deg, pitch: 50 * deg, tilt: 56 * deg, back: 25 * deg } as const;
/** Where the 3D view opens: a little from the reader's side and to the left, like a book on a desk. */
export const ORBIT_START: Orbit = { yaw: -0.32, pitch: 0.62 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** How far the camera leans from straight down, whichever way. */
export const orbitTilt = (o: Orbit) => Math.acos(clamp(Math.cos(o.yaw) * Math.cos(o.pitch), -1, 1));

export function clampOrbit(o: Orbit): Orbit {
  const next = { yaw: clamp(o.yaw || 0, -ORBIT_LIMITS.yaw, ORBIT_LIMITS.yaw), pitch: clamp(o.pitch || 0, -ORBIT_LIMITS.back, ORBIT_LIMITS.pitch) };
  if (orbitTilt(next) <= ORBIT_LIMITS.tilt) return next;
  // Corners of the box lean too far: pull back along the same direction to the edge of the cap.
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (orbitTilt({ yaw: next.yaw * mid, pitch: next.pitch * mid }) > ORBIT_LIMITS.tilt) hi = mid;
    else lo = mid;
  }
  return { yaw: next.yaw * lo, pitch: next.pitch * lo };
}

/** Unit direction from the book's middle to the camera (book plane is z = 0, up is +y). */
export function orbitDirection(o: Orbit) {
  return { x: Math.sin(o.yaw) * Math.cos(o.pitch), y: -Math.sin(o.pitch), z: Math.cos(o.yaw) * Math.cos(o.pitch) };
}

/** Dragging across the whole view swings the camera about 150°, which the limits then stop. */
export function orbitDrag(o: Orbit, dx: number, dy: number, size: number): Orbit {
  const k = (2.6 / Math.max(1, size));
  return clampOrbit({ yaw: o.yaw - dx * k, pitch: o.pitch - dy * k });
}

export const isOrbiting = (o: Orbit) => Math.abs(o.yaw) > 1e-4 || Math.abs(o.pitch) > 1e-4;
