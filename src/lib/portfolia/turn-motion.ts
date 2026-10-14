/** Smooth acceleration/deceleration, with no velocity or acceleration at the endpoints. */
export const turnEase = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
/** Clearance disappears as the sheet becomes its resting page, avoiding a shadow jump. */
export const turnClearance = (t: number, gap: number) => gap * Math.sin(Math.PI * Math.max(0, Math.min(1, t)));

/** Keep the moving sheet above the receiving page despite different surface relief. */
export const turnSheetHeight = (height: number, floor: number, gap: number) => Math.max(height, floor + gap);

/** Offline capture is frame-count driven, never dependent on the renderer's speed. */
export async function captureFrames(duration: number, update: (t:number)=>void, encode: ()=>Promise<void>) {
  const steps=Math.max(1,Math.ceil(duration*60/1000));
  for(let i=0;i<=steps;i++){update(i/steps);await encode();}
}
