/**
 * Feature C: product statistics are counts per day only. No IP addresses, cookies, visitor ids or referrers are
 * stored. Every call is best effort: before the migration (or on any error) nothing is counted and nothing fails.
 */
export const PRODUCT_EVENT_KINDS = ["preview_view", "buy_click", "customer_open", "download"] as const;
export type ProductEventKind = (typeof PRODUCT_EVENT_KINDS)[number];

export async function countProductEvent(db: any, product: string, kind: ProductEventKind) {
  try {
    await db.rpc("product_event", { product, event_kind: kind });
  } catch {
    /* not counted */
  }
}

export type DayCounts = { day: string } & Record<ProductEventKind, number>;
const zero = () => Object.fromEntries(PRODUCT_EVENT_KINDS.map((k) => [k, 0])) as Record<ProductEventKind, number>;

/** The last `days` UTC days ending today, oldest first, with zeros where nothing happened. */
export function zeroFilledDays(rows: { day: string; kind: string; count: number }[], now = new Date(), days = 30): DayCounts[] {
  const out: DayCounts[] = [];
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (let i = days - 1; i >= 0; i--) out.push({ day: new Date(end - i * 86400000).toISOString().slice(0, 10), ...zero() });
  const index = new Map(out.map((d, i) => [d.day, i]));
  for (const r of rows) {
    const i = index.get(String(r.day).slice(0, 10));
    if (i !== undefined && (PRODUCT_EVENT_KINDS as readonly string[]).includes(r.kind)) out[i]![r.kind as ProductEventKind] += Number(r.count) || 0;
  }
  return out;
}

export function totals(rows: { kind: string; count: number }[]) {
  const t = zero();
  for (const r of rows) if ((PRODUCT_EVENT_KINDS as readonly string[]).includes(r.kind)) t[r.kind as ProductEventKind] += Number(r.count) || 0;
  return t;
}
