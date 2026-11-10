import { createHash, randomBytes } from "node:crypto";
import { grantToken, validGrant } from "../portfolia/access-crypto.server";
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
export async function customerAccess(db: any, product: string, cookie?: string) {
  const [id, token] = (cookie ?? "").split(":");
  if (!id || !token || !/^[a-f0-9-]{36}$/.test(id)) return false;
  const { data, error } = await db
    .from("product_access_links")
    .select("id,product_id,secret,revoked,expires_at")
    .eq("id", id)
    .eq("product_id", product)
    .maybeSingle();
  return !error && validProductLink(data) && validGrant(product, data.secret, token);
}
