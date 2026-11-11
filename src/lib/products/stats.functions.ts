import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAccount } from "@/lib/require-account";
import { productId } from "./model";

/* Feature C: product statistics. Counts only; see stats.server.ts. */

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
}
async function noStore(sameOrigin = false) {
  const { getRequest, setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "private, no-store");
  const req = getRequest();
  if (sameOrigin && req.headers.get("origin") !== new URL(req.url).origin) throw new Error("Please reload and try again.");
  return req;
}

/** Public, fire-and-forget: a shopper opened the preview or pressed Buy. Always answers ok. */
export const recordProductEvent = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: productId, kind: z.enum(["preview_view", "buy_click"]) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const req = await noStore(true);
      const { isBotAgent } = await import("../portfolia/open-notify");
      if (isBotAgent(req.headers.get("user-agent"))) return { ok: true };
      const { countProductEvent } = await import("./stats.server");
      await countProductEvent(await admin(), data.id, data.kind);
    } catch {
      /* never fails the page */
    }
    return { ok: true };
  });

async function ownedIds(db: any, uid: string, ids: string[]) {
  const { data } = await db.from("digital_products").select("id").eq("owner_id", uid).in("id", ids);
  return ((data as any[]) ?? []).map((r) => r.id as string);
}
async function readEvents(db: any, ids: string[], since?: string) {
  let q = db.from("product_events_daily").select("product_id,day,kind,count").in("product_id", ids);
  if (since) q = q.gte("day", since);
  const { data, error } = await q;
  return { rows: ((data as any[]) ?? []) as { product_id: string; day: string; kind: string; count: number }[], available: !error };
}
const thirtyDaysAgo = () => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

/** Owner only: one product's last 30 days (zero-filled) and its totals. Zeros, not errors, before the migration. */
export const productStats = createServerFn({ method: "GET" })
  .middleware([requireAccount])
  .inputValidator((d) => z.object({ id: productId }).parse(d))
  .handler(async ({ context, data }) => {
    await noStore();
    const db = await admin();
    if (!(await ownedIds(db, context.userId, [data.id])).length) throw new Error("Product unavailable.");
    const { zeroFilledDays, totals } = await import("./stats.server");
    const { rows, available } = await readEvents(db, [data.id]);
    const since = thirtyDaysAgo();
    return { available, days: zeroFilledDays(rows.filter((r) => r.day >= since)), totals: totals(rows) };
  });

/** Owner only: 30-day views and buy clicks for every product on the list, in one call. */
export const productStatsSummary = createServerFn({ method: "POST" })
  .middleware([requireAccount])
  .inputValidator((d) => z.object({ ids: z.array(productId).max(60) }).parse(d))
  .handler(async ({ context, data }) => {
    await noStore(true);
    const db = await admin();
    const ids = data.ids.length ? await ownedIds(db, context.userId, data.ids) : [];
    const out: Record<string, { views: number; buys: number }> = {};
    if (!ids.length) return out;
    const { rows } = await readEvents(db, ids, thirtyDaysAgo());
    for (const id of ids) out[id] = { views: 0, buys: 0 };
    for (const r of rows) {
      if (r.kind === "preview_view") out[r.product_id]!.views += Number(r.count) || 0;
      if (r.kind === "buy_click") out[r.product_id]!.buys += Number(r.count) || 0;
    }
    return out;
  });
