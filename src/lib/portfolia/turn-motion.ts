/** Smooth acceleration/deceleration, with no velocity or acceleration at the endpoints. */
export const turnEase = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
/** Clearance disappears as the sheet becomes its resting page, avoiding a shadow jump. */
export const turnClearance = (t: number, gap: number) => gap * Math.sin(Math.PI * Math.max(0, Math.min(1, t)));

/** Keep the moving sheet above the receiving page despite different surface relief. */
export const turnSheetHeight = (height: number, floor: number, gap: number, progress = .5) => {
  // At the endpoints use the exact resting mesh. Ramp collision protection
  // over the first/last 8% so a receiving page cannot push the sheet up on click.
  const edge = Math.max(0, Math.min(1, progress / .08, (1 - progress) / .08));
  const blend = edge * edge * (3 - 2 * edge);
  return height + (Math.max(height, floor + gap) - height) * blend;
};

/** Offline capture is frame-count driven, never dependent on the renderer's speed. */
export async function captureFrames(duration: number, update: (t:number)=>void, encode: ()=>Promise<void>) {
  const steps=Math.max(1,Math.ceil(duration*30/1000));
  for(let i=0;i<=steps;i++){update(i/steps);await encode();}
}

/** Avoid overlapping resting sheets near either end of a turn. */
export const turnRestVisible = (progress: number, revealed: boolean) => revealed ? progress >= .05 : progress < .95;

/** Map pointer-driven sheet progress to the eased video timeline. */
export function turnVideoTime(progress: number) {
  const p = Math.max(0, Math.min(1, progress));
  if (p === 0 || p === 1) return p;
  let low = 0, high = 1;
  for (let i = 0; i < 24; i++) { const mid = (low + high) / 2; if (turnEase(mid) < p) low = mid; else high = mid; }
  return (low + high) / 2;
}
