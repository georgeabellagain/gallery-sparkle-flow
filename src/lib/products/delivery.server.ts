import { createHmac, timingSafeEqual } from "node:crypto";
import { newProductLink, tokenHash } from "./access.server";
import { stripControl } from "./model";
import { autoDelivery, deliveriesPerDay, DELIVERIES_PER_MINUTE, type ProductPlan } from "./plan";

/**
 * Feature F: automatic delivery. Each order gets its own customer link, emailed to the buyer once. Shops retry their
 * webhooks, so an order seen twice is never sent twice. The link's token exists only in memory and in that email: it is
 * never stored or logged. Gumroad, Shopify and a generic JSON endpoint are supported; Etsy has no simple webhook.
 */
export type DeliverySource = "gumroad" | "shopify" | "generic" | "manual";
export const SOURCE_NAMES: Record<DeliverySource, string> = { gumroad: "Gumroad", shopify: "Shopify", generic: "Webhook", manual: "By hand" };
export type DeliverySettings = { gumroadProduct?: string; shopifyProduct?: string; secret?: string };
export type Delivery = { source?: DeliverySource; key_hash?: string; settings?: DeliverySettings } | null | undefined;

export type DeliveryMail = { to: string; productTitle: string; link: string; idempotencyKey: string };
export type DeliveryDeps = {
  plan: (ownerId: string) => Promise<ProductPlan>;
  send: (mail: DeliveryMail) => Promise<void>;
  now?: () => Date;
};
export class DeliveryRefused extends Error {
  constructor(public reason: "unavailable" | "rate" | "invalid") { super(reason); }
}

const EMAIL = /^[^\s@<>()",;:]{1,64}@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
export function cleanEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}
const cleanText = (value: unknown, max: number) => stripControl(String(value ?? ""), " ").trim().slice(0, max);

/** Constant-time check of a presented delivery key against the stored SHA-256. */
export function deliveryKeyValid(keyHash: string | undefined, presented: string | null | undefined) {
  if (!keyHash || !presented || !/^[A-Za-z0-9_-]{43}$/.test(presented)) return false;
  const a = Buffer.from(tokenHash(presented), "hex"), b = Buffer.from(keyHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
/** Shopify signs the raw body: base64(HMAC-SHA256(body, secret)). A re-serialised body fails. */
export function shopifyHmacValid(raw: Uint8Array, header: string | null, secret: string | undefined) {
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  let given: Buffer;
  try { given = Buffer.from(header, "base64"); } catch { return false; }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const productLink = (id: string, token: string) => `https://portfolia.site/product/${id}#access=${token}`;
const startOfDay = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

/** The product must be online and its owner's plan must include automatic delivery, checked on every call. */
async function deliverable(db: any, productId: string, deps: DeliveryDeps) {
  const { data: product } = await db.from("digital_products").select("id,owner_id,title,status,delivery").eq("id", productId).maybeSingle();
  if (!product || product.status !== "published" || !autoDelivery(await deps.plan(product.owner_id))) throw new DeliveryRefused("unavailable");
  return product as { id: string; owner_id: string; title: string; status: string; delivery: Delivery };
}

async function mailLink(db: any, product: { id: string; title: string }, order: { id: string; buyer_email: string }, token: string, key: string, deps: DeliveryDeps) {
  await deps.send({ to: order.buyer_email, productTitle: product.title, link: productLink(product.id, token), idempotencyKey: key });
  await db.from("product_orders").update({ emailed_at: (deps.now?.() ?? new Date()).toISOString(), note: null }).eq("id", order.id);
}

export async function issueOrderLink(db: any, productId: string, input: { source: DeliverySource; orderRef: string; email: string; name?: string | null }, deps: DeliveryDeps) {
  const product = await deliverable(db, productId, deps);
  const email = cleanEmail(input.email), orderRef = cleanText(input.orderRef, 120), name = cleanText(input.name, 80) || null;
  if (!email || !orderRef) throw new DeliveryRefused("invalid");
  const { data: allowed, error: rateError } = await db.rpc("product_delivery_attempt", { bucket_key: `delivery:${productId}`, max_hits: DELIVERIES_PER_MINUTE, window_seconds: 60 });
  if (rateError || !allowed) throw new DeliveryRefused("rate");
  const { data: order, error } = await db
    .from("product_orders")
    .insert({ product_id: productId, source: input.source, order_ref: orderRef, buyer_email: email, buyer_name: name })
    .select("id,buyer_email")
    .single();
  // Shops retry: the same order again changes nothing and sends nothing.
  if (error?.code === "23505") return { status: "duplicate" as const };
  if (error || !order) throw new Error("Could not record the order.");
  const now = deps.now?.() ?? new Date();
  const { count } = await db.from("product_orders").select("id", { count: "exact", head: true }).eq("product_id", productId).gte("emailed_at", startOfDay(now));
  if ((count ?? 0) >= deliveriesPerDay(await deps.plan(product.owner_id))) {
    await db.from("product_orders").update({ note: "Not sent: daily limit" }).eq("id", order.id);
    return { status: "limit" as const, orderId: order.id as string };
  }
  const link = await newProductLink(db, productId, { label: `Order ${orderRef} · ${SOURCE_NAMES[input.source]}`, stamp: name ?? email });
  await db.from("product_orders").update({ link_id: link.id }).eq("id", order.id);
  await mailLink(db, product, order, link.token, `delivery:${productId}:${input.source}:${orderRef}`, deps);
  return { status: "sent" as const, orderId: order.id as string };
}

/** A refund (or the seller) switches the order's link off at once. */
export async function revokeOrder(db: any, productId: string, match: { source: DeliverySource; orderRef: string } | { orderId: string }, deps?: { now?: () => Date }) {
  let q = db.from("product_orders").select("id,link_id").eq("product_id", productId);
  q = "orderId" in match ? q.eq("id", match.orderId) : q.eq("source", match.source).eq("order_ref", cleanText(match.orderRef, 120));
  const { data: order } = await q.maybeSingle();
  if (!order) return false;
  if (order.link_id) await db.from("product_access_links").update({ revoked: true }).eq("id", order.link_id).eq("product_id", productId);
  await db.from("product_orders").update({ refunded_at: (deps?.now?.() ?? new Date()).toISOString() }).eq("id", order.id);
  return true;
}

/** A new link for an order, the old one switched off, and a new email. */
export async function resendOrder(db: any, productId: string, orderId: string, deps: DeliveryDeps) {
  const product = await deliverable(db, productId, deps);
  const { data: order } = await db.from("product_orders").select("id,source,order_ref,buyer_email,buyer_name,link_id").eq("id", orderId).eq("product_id", productId).maybeSingle();
  if (!order) throw new Error("Order not found.");
  if (order.link_id) await db.from("product_access_links").update({ revoked: true }).eq("id", order.link_id).eq("product_id", productId);
  const link = await newProductLink(db, productId, { label: `Order ${order.order_ref} · ${SOURCE_NAMES[order.source as DeliverySource]}`, stamp: order.buyer_name ?? order.buyer_email });
  await db.from("product_orders").update({ link_id: link.id, refunded_at: null }).eq("id", order.id);
  await mailLink(db, product, order, link.token, `delivery:${productId}:${order.source}:${order.order_ref}:${link.id}`, deps);
}

/* ---------- The incoming endpoint (F2) ---------- */

export const MAX_DELIVERY_BODY = 256 * 1024;
const answer = (status: number, body: unknown = status === 200 ? { ok: true } : { ok: false }) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** Reads at most MAX_DELIVERY_BODY bytes, before any parsing. Null when the body is larger. */
async function rawBody(request: Request): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_DELIVERY_BODY) return null;
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_DELIVERY_BODY) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out;
}

/**
 * POST /api/public/product-delivery/<id>/<source>. 200 for accepted orders and duplicates, 401 for a bad key or
 * signature, 404 for an unknown product, a draft or a plan without the feature (never saying which), 413 for a body
 * over 256 KB, 429 over the rate limit. Nothing from the request is echoed back.
 */
export async function handleDeliveryRequest(db: any, id: string, source: string, request: Request, deps: DeliveryDeps): Promise<Response> {
  if (request.method !== "POST") return answer(405);
  if (!/^[a-f0-9-]{36}$/.test(id) || !["gumroad", "shopify", "generic"].includes(source)) return answer(404);
  const raw = await rawBody(request);
  if (!raw) return answer(413);
  let product: Awaited<ReturnType<typeof deliverable>>;
  try { product = await deliverable(db, id, deps); } catch { return answer(404); }
  const delivery = product.delivery ?? {};
  if (delivery.source !== source) return answer(404);
  const text = new TextDecoder().decode(raw);
  try {
    if (source === "generic") {
      const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
      if (!deliveryKeyValid(delivery.key_hash, bearer)) return answer(401);
      const body = JSON.parse(text) as { order_id?: unknown; email?: unknown; name?: unknown; refunded?: unknown };
      const orderRef = cleanText(body.order_id, 120);
      if (!orderRef) return answer(400);
      if (body.refunded === true) { await revokeOrder(db, id, { source: "generic", orderRef }); return answer(200); }
      await issueOrderLink(db, id, { source: "generic", orderRef, email: String(body.email ?? ""), name: body.name ? String(body.name) : null }, deps);
      return answer(200);
    }
    if (source === "gumroad") {
      // Gumroad cannot send headers, so its key travels in the address the seller pastes.
      if (!deliveryKeyValid(delivery.key_hash, new URL(request.url).searchParams.get("key"))) return answer(401);
      const form = new URLSearchParams(text);
      const expected = delivery.settings?.gumroadProduct?.trim().toLowerCase();
      const ids = [form.get("product_id"), form.get("product_permalink"), form.get("permalink"), form.get("short_product_id")].map((v) => (v ?? "").trim().toLowerCase());
      if (!expected || !ids.includes(expected)) return answer(200, { ok: true });
      if (form.get("test") === "true") return answer(200);
      const orderRef = cleanText(form.get("sale_id") ?? form.get("order_number"), 120);
      if (!orderRef) return answer(400);
      if (form.get("refunded") === "true") { await revokeOrder(db, id, { source: "gumroad", orderRef }); return answer(200); }
      await issueOrderLink(db, id, { source: "gumroad", orderRef, email: form.get("email") ?? "", name: form.get("full_name") }, deps);
      return answer(200);
    }
    // Shopify: the HMAC is checked on the raw bytes, before the body is parsed.
    if (!shopifyHmacValid(raw, request.headers.get("x-shopify-hmac-sha256"), delivery.settings?.secret)) return answer(401);
    const topic = request.headers.get("x-shopify-topic");
    const body = JSON.parse(text) as any;
    if (topic === "refunds/create") {
      const orderRef = cleanText(body.order_id, 120);
      if (orderRef) await revokeOrder(db, id, { source: "shopify", orderRef });
      return answer(200);
    }
    if (topic !== "orders/paid") return answer(200);
    const wanted = delivery.settings?.shopifyProduct?.trim().toLowerCase();
    const items: any[] = Array.isArray(body.line_items) ? body.line_items : [];
    if (!wanted || !items.some((li) => [li?.product_id, li?.sku].map((v) => String(v ?? "").trim().toLowerCase()).includes(wanted))) return answer(200);
    const name = [body.customer?.first_name, body.customer?.last_name].filter(Boolean).join(" ") || null;
    await issueOrderLink(db, id, { source: "shopify", orderRef: cleanText(body.id, 120), email: String(body.email ?? body.contact_email ?? ""), name }, deps);
    return answer(200);
  } catch (e) {
    if (e instanceof DeliveryRefused) return answer(e.reason === "rate" ? 429 : e.reason === "invalid" ? 400 : 404);
    if (e instanceof SyntaxError) return answer(400);
    return answer(503);
  }
}

/** The sender used in production (same service as the lead emails). From: "<title> via Portfolia". */
export async function sendDeliveryEmail(mail: DeliveryMail) {
  const React = await import("react");
  const { sendLovableEmail } = await import("@lovable.dev/email-js");
  const { ProductDeliveryEmail } = await import("@/lib/email-templates/product-delivery");
  const { render } = await import("@react-email/render");
  const element = React.createElement(ProductDeliveryEmail, { productTitle: mail.productTitle, link: mail.link });
  const html = await render(element), text = await render(element, { plainText: true });
  await sendLovableEmail({
    to: mail.to,
    from: { name: `${mail.productTitle.slice(0, 60)} via Portfolia`, address: "noreply@portfolia.site" },
    sender_domain: "notify.portfolia.site",
    subject: `Your copy of ${mail.productTitle}`,
    html,
    text,
    purpose: "transactional",
    label: "product-delivery",
    idempotency_key: mail.idempotencyKey,
  }, { apiKey: process.env["LOVABLE_API_KEY"]!, sendUrl: process.env["LOVABLE_SEND_URL"] });
}
