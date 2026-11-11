import { createHash, randomBytes } from "node:crypto";
import { grantToken, validGrant } from "../portfolia/access-crypto.server";
import { isMissingColumn } from "./model";
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const newAccessToken = () => randomBytes(32).toString("base64url");
export const productCookie = (id: string) => `pf_product_${id}`;
export function validProductLink(link: any, now = Date.now()) {
  return Boolean(
    link &&
    !link.revoked &&
    (!link.expires_at ||
      (Number.isFinite(Date.parse(link.expires_at)) && Date.parse(link.expires_at) > now)),
  );
}
export function customerSession(link: any, now = Date.now()) {
  const until = Math.min(
    now + 12 * 3600000,
    link.expires_at ? Date.parse(link.expires_at) : Infinity,
  );
  return `${link.id}:${grantToken(link.product_id, link.secret, until)}`;
}
/**
 * The customer link behind a session cookie, when it is still valid for this product: its id and buyer stamp
 * (Feature D). Reads the stamp only where the column exists, so it works before that migration is applied.
 */
export async function customerLink(db: any, product: string, cookie?: string): Promise<{ id: string; stamp: string | null } | null> {
  const [id, token] = (cookie ?? "").split(":");
  if (!id || !token || !/^[a-f0-9-]{36}$/.test(id)) return null;
  const read = (columns: string) => db.from("product_access_links").select(columns).eq("id", id).eq("product_id", product).maybeSingle();
  let { data, error } = await read("id,product_id,secret,revoked,expires_at,stamp");
  if (error && isMissingColumn(error)) ({ data, error } = await read("id,product_id,secret,revoked,expires_at"));
  if (error || !validProductLink(data) || !validGrant(product, data.secret, token)) return null;
  return { id: data.id, stamp: typeof data.stamp === "string" && data.stamp ? data.stamp : null };
}
export async function customerAccess(db: any, product: string, cookie?: string) {
  return (await customerLink(db, product, cookie)) !== null;
}

/**
 * Makes a customer link: the token is returned once and only its hash is stored. Shared by "Create customer link"
 * and automatic delivery (Feature F). A stamp is dropped if the database does not have that column yet.
 */
export async function newProductLink(db: any, productId: string, { label, expiresAt = null, stamp = null }: { label: string; expiresAt?: string | null; stamp?: string | null }) {
  const token = newAccessToken();
  const row: Record<string, unknown> = { product_id: productId, label: label.slice(0, 100), expires_at: expiresAt, token_hash: tokenHash(token), secret: newAccessToken() };
  if (stamp) row["stamp"] = stamp.slice(0, 80);
  const insert = () => db.from("product_access_links").insert(row).select("id").single();
  let { data, error } = await insert();
  if (error && "stamp" in row && isMissingColumn(error)) { delete row["stamp"]; ({ data, error } = await insert()); }
  if (error || !data) throw new Error("Could not create access link.");
  return { id: data.id as string, token };
}
