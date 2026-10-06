import { createHmac, randomBytes, scrypt as derive, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(derive);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex || !/^[a-f0-9]{128}$/.test(hex)) return false;
  const key = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(key, Buffer.from(hex, "hex"));
}
export function grantToken(code: string, secret: string, until: number) {
  const body = `${code}.${until}`;
  return `${until}.${createHmac("sha256", secret).update(body).digest("hex")}`;
}
export function validGrant(code: string, secret: string, token: string | undefined, now = Date.now()) {
  if (!token || !/^\d+\.[a-f0-9]{64}$/.test(token)) return false;
  const until = Number(token.split(".")[0]);
  if (until <= now || until > now + 12 * 3600000) return false;
  const expected = grantToken(code, secret, until);
  return token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
export const accessCookie = (code: string) => `pf_access_${code}`;
