/** The page a shared link points at ("#page=5", or "#p5"), or undefined. */
export function pageFromHash(hash: string): number | undefined {
  const n = Number(/(?:^#?|&)(?:page=|p)(\d{1,5})(?:&|$)/.exec(hash.replace(/^#/, ""))?.[1]);
  return Number.isInteger(n) && n >= 1 ? n : undefined;
}
