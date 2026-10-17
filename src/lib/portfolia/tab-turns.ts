/** The most sheets a page tab turns one by one; a longer jump first slips silently to that many sheets away. */
export const MAX_TAB_TURNS = 6;
/**
 * How a page tab travels from position `from` to `to` (spread indices, or leaves on a phone): optionally place
 * the book at `skip` without animation, then turn `turns` sheets in sequence at `speed` (1 is a normal turn;
 * smaller is quicker), so readers see the pages go by without waiting through a long book.
 */
export function tabTurnPlan(from: number, to: number, max = MAX_TAB_TURNS, reduceMotion = false) {
  const distance = Math.abs(to - from), dir = to >= from ? 1 : -1;
  if (!distance) return { skip: null, turns: 0, dir, speed: 1 };
  if (reduceMotion) return { skip: to, turns: 0, dir, speed: 1 };
  const turns = Math.min(distance, Math.max(1, max));
  return { skip: distance > turns ? to - dir * turns : null, turns, dir, speed: Math.max(.3, .6 - .06 * (turns - 1)) };
}
