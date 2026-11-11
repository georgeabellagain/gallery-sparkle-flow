import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAccount } from "@/lib/require-account";
import { productId } from "./model";

/* Feature F: the owner's side of automatic delivery. The delivery key and Shopify secret never come back to the browser
   after saving; the key is shown once when it is made. */

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
}
async function noStore(mutation = false) {
  const { getRequest, setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "private, no-store");
  setResponseHeader("Referrer-Policy", "no-referrer");
  if (mutation) {
    const req = getRequest();
    if (req.headers.get("origin") !== new URL(req.url).origin) throw new Error("Please reload and try again.");
  }
}
async function deps() {
  const { ownerPlan } = await import("../portfolia/entitlements.server");
  const { sendDeliveryEmail } = await import("./delivery.server");
  const db = await admin();
  return { db, deps: { plan: (owner: string) => ownerPlan(owner, db), send: sendDeliveryEmail } };
}
async function ownedProduct(db: any, id: string, uid: string) {
  const { data, error } = await db.from("digital_products").select("id,status,delivery").eq("id", id).eq("owner_id", uid).maybeSingle();
  if (error) {
    const { isMissingColumn } = await import("./model");
    if (isMissingColumn(error)) throw new Error("Automatic delivery is available after the next update.");
  }
  if (error || !data) throw new Error("Product unavailable.");
  return data;
}
const refusal = (reason: string) =>
  reason === "rate" ? "Too many orders in a minute. Try again shortly." : reason === "invalid" ? "Check the email address and order number." : "Automatic delivery needs a published product on Business.";

/** The delivery set-up (without secrets) and the order list: no token hashes, secrets or link tokens. */
export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireAccount])
  .inputValidator((d) => z.object({ id: productId }).parse(d))
  .handler(async ({ context, data }) => {
    await noStore();
    const db = await admin();
    let row: any;
    try { row = await ownedProduct(db, data.id, context.userId); } catch (e) { return { available: false, message: (e as Error).message, delivery: null, orders: [] }; }
    const { data: orders, error } = await db
      .from("product_orders")
      .select("id,source,order_ref,buyer_email,buyer_name,emailed_at,refunded_at,note,created_at,link_id")
      .eq("product_id", data.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { available: false, message: "Automatic delivery is available after the next update.", delivery: null, orders: [] };
    const linkIds = (orders as any[]).map((o) => o.link_id).filter(Boolean);
    const opens = new Map<string, number>();
    if (linkIds.length) {
      const { data: links } = await db.from("product_access_links").select("id,opens").in("id", linkIds);
      for (const l of (links as any[]) ?? []) opens.set(l.id, Number(l.opens ?? 0));
    }
    const d = row.delivery ?? {};
    return {
      available: true,
      message: "",
      delivery: { source: (d.source as string | undefined) ?? null, hasKey: Boolean(d.key_hash), gumroadProduct: d.settings?.gumroadProduct ?? "", shopifyProduct: d.settings?.shopifyProduct ?? "", hasSecret: Boolean(d.settings?.secret) },
      orders: (orders as any[]).map((o) => ({
        id: o.id as string, source: o.source as string, orderRef: o.order_ref as string, email: o.buyer_email as string, name: (o.buyer_name as string | null) ?? null,
        sentAt: (o.emailed_at as string | null) ?? null, refundedAt: (o.refunded_at as string | null) ?? null, note: (o.note as string | null) ?? null,
        opens: o.link_id ? (opens.get(o.link_id) ?? 0) : 0, createdAt: o.created_at as string,
      })),
    };
  });

/** Chooses the shop and its fields. A new key is made (and shown once) when asked or when there is none. */
export const saveDeliverySettings = createServerFn({ method: "POST" })
  .middleware([requireAccount])
  .inputValidator((d) =>
    z.object({
      id: productId,
      source: z.enum(["gumroad", "shopify", "generic"]),
      gumroadProduct: z.string().trim().max(120).optional(),
      shopifyProduct: z.string().trim().max(120).optional(),
      secret: z.string().trim().max(200).optional(),
      newKey: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await noStore(true);
    const { db, deps: d } = await deps();
    const row = await ownedProduct(db, data.id, context.userId);
    const { autoDelivery } = await import("./plan");
    if (!autoDelivery(await d.plan(context.userId))) throw new Error("Automatic delivery is part of Business.");
    const { newAccessToken, tokenHash } = await import("./access.server");
    const current = row.delivery ?? {};
    const key = data.newKey || !current.key_hash ? newAccessToken() : null;
    const settings = {
      gumroadProduct: data.gumroadProduct ?? current.settings?.gumroadProduct,
      shopifyProduct: data.shopifyProduct ?? current.settings?.shopifyProduct,
      // An empty field keeps the saved secret; it is never sent back.
      secret: data.secret ? data.secret : current.settings?.secret,
    };
    const { error } = await db.from("digital_products").update({ delivery: { source: data.source, key_hash: key ? tokenHash(key) : current.key_hash, settings } }).eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw new Error("Could not save the delivery settings.");
    return { key };
  });

/** Same flow as a shop order, started by hand (also how a seller sends a test). */
export const addManualOrder = createServerFn({ method: "POST" })
  .middleware([requireAccount])
  .inputValidator((d) => z.object({ id: productId, email: z.string().trim().max(254), name: z.string().trim().max(80).optional(), orderRef: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ context, data }) => {
    await noStore(true);
    const { db, deps: d } = await deps();
    await ownedProduct(db, data.id, context.userId);
    const { issueOrderLink, DeliveryRefused } = await import("./delivery.server");
    try {
      return await issueOrderLink(db, data.id, { source: "manual", orderRef: data.orderRef, email: data.email, name: data.name }, d);
    } catch (e) {
      throw new Error(e instanceof DeliveryRefused ? refusal(e.reason) : "Could not send. Please try again.");
    }
  });

export const resendOrder = createServerFn({ method: "POST" })
  .middleware([requireAccount])
  .inputValidator((d) => z.object({ id: productId, orderId: productId }).parse(d))
  .handler(async ({ context, data }) => {
    await noStore(true);
    const { db, deps: d } = await deps();
    await ownedProduct(db, data.id, context.userId);
    const { resendOrder: resend, DeliveryRefused } = await import("./delivery.server");
    try { await resend(db, data.id, data.orderId, d); } catch (e) { throw new Error(e instanceof DeliveryRefused ? refusal(e.reason) : (e as Error).message); }
    return { ok: true };
  });

export const revokeOrderLink = createServerFn({ method: "POST" })
  .middleware([requireAccount])
  .inputValidator((d) => z.object({ id: productId, orderId: productId }).parse(d))
  .handler(async ({ context, data }) => {
    await noStore(true);
    const db = await admin();
    await ownedProduct(db, data.id, context.userId);
    const { revokeOrder } = await import("./delivery.server");
    await revokeOrder(db, data.id, { orderId: data.orderId });
    return { ok: true };
  });
