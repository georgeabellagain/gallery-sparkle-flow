/** Smooth acceleration/deceleration, with no velocity or acceleration at the endpoints. */
export const turnEase = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
/** Clearance disappears as the sheet becomes its resting page, avoiding a shadow jump. */
export const turnClearance = (t: number, gap: number) => gap * Math.sin(Math.PI * Math.max(0, Math.min(1, t)));
