import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { accessCookie, validGrant } from "./access-crypto.server";
export interface AccessPolicy { code: string; password_hash: string | null; expires_at: string | null; secret: string }
export async function readAccessPolicy(code: string, db: any = supabaseAdmin): Promise<AccessPolicy | null> {
  const { data, error } = await db.from("portfolio_access").select("code,password_hash,expires_at,secret").eq("code", code).maybeSingle();
  if (error) throw new Error("Couldn’t check portfolio access. Please try again.");
  return data;
}
export function accessState(policy: AccessPolicy | null, token?: string, now = Date.now()): "open" | "locked" | "expired" {
  if (!policy) return "open";
  if (policy.expires_at && (!Number.isFinite(Date.parse(policy.expires_at)) || Date.parse(policy.expires_at) <= now)) return "expired";
  return policy.password_hash && !validGrant(policy.code, policy.secret, token, now) ? "locked" : "open";
}
export async function requestAccess(code: string) {
  const { getCookie } = await import("@tanstack/react-start/server");
  const policy = await readAccessPolicy(code);
  return { policy, state: accessState(policy, getCookie(accessCookie(code))) };
}
export function fileLinkSeconds(policy: AccessPolicy | null, now = Date.now()) {
  return Math.max(1, Math.min(300, policy?.expires_at ? Math.floor((Date.parse(policy.expires_at) - now) / 1000) : 300));
}
