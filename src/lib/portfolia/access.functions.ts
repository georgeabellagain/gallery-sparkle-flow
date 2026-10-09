import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { personalActive } from "./store";
const code = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const lookup = z.object({ by: z.enum(["code", "username"]), value: code });

export const portfolioAccessStatus = createServerFn({ method: "GET" }).inputValidator(d => lookup.parse(d)).handler(async ({ data }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { requestAccess } = await import("./access.server");
  const { setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "private, no-store");
  const { data: row, error } = await supabaseAdmin.from("portfolios").select("code,data").eq("status", "published").eq(data.by === "code" ? "code" : "username", data.value.toLowerCase()).maybeSingle();
  if (error) throw new Error("Couldn’t check this portfolio.");
  if (!row || (data.by === "username" && !personalActive(row.data as any))) return { state: "missing" as const, code: null };
  const { state } = await requestAccess(row.code);
  return { state, code: row.code };
});

export const unlockPortfolio = createServerFn({ method: "POST" }).inputValidator(d => z.object({ code, password: z.string().min(1).max(256) }).parse(d)).handler(async ({ data }) => {
  const { getRequest, setCookie, setResponseHeader } = await import("@tanstack/react-start/server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { readAccessPolicy, accessState } = await import("./access.server");
  const { verifyPassword, grantToken, accessCookie } = await import("./access-crypto.server");
  const { createHash } = await import("node:crypto");
  setResponseHeader("Cache-Control", "private, no-store");
  const request = getRequest();
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new Error("Please open the portfolio and try again.");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const bucket = createHash("sha256").update(`${data.code}:${ip}`).digest("hex");
  const { data: globalAllowed, error: globalError } = await (supabaseAdmin as any).rpc("portfolio_unlock_attempt", { bucket_key: `global:${data.code}` });
  if (globalError || !globalAllowed) return { ok: false, message: "Too many attempts. Please wait five minutes before trying again." };
  const { data: allowed, error: rateError } = await (supabaseAdmin as any).rpc("portfolio_unlock_attempt", { bucket_key: bucket });
  if (rateError || !allowed) return { ok: false, message: "Too many attempts. Please wait five minutes before trying again." };
  const { data: row } = await supabaseAdmin.from("portfolios").select("code").eq("code", data.code).eq("status", "published").maybeSingle();
  const policy = row ? await readAccessPolicy(row.code) : null;
  if (!row || !policy?.password_hash || accessState(policy) === "expired" || !(await verifyPassword(data.password, policy.password_hash))) return { ok: false, message: "This password didn’t unlock the portfolio, or the link is no longer available." };
  const until = Math.min(Date.now() + 12 * 3600000, policy.expires_at ? Date.parse(policy.expires_at) : Infinity);
  setCookie(accessCookie(data.code), grantToken(data.code, policy.secret, until), { httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: Math.max(1, Math.floor((until - Date.now()) / 1000)) });
  return { ok: true, message: "" };
});

export const ownerAccessSettings = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator(d => z.object({ code }).parse(d)).handler(async ({ data, context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { readAccessPolicy } = await import("./access.server");
  const { setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "private, no-store");
  const { data: row } = await context.supabase.from("portfolios").select("code").eq("code", data.code).eq("owner_id", context.userId).maybeSingle();
  if (!row) throw new Error("Save this portfolio to your account first.");
  const policy = await readAccessPolicy(data.code);
  const { data: sub } = await supabaseAdmin.from("subscriptions").select("status,current_period_end").eq("user_id", context.userId).eq("environment", "live").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const personal = Boolean(sub && (["active", "trialing"].includes(sub.status) || (sub.status === "canceled" && sub.current_period_end && Date.parse(sub.current_period_end) > Date.now())));
  return { password: Boolean(policy?.password_hash), expiresAt: policy?.expires_at ?? null, personal };
});

export const saveAccessSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(d => z.object({ code, password: z.string().min(8).max(256).optional(), removePassword: z.boolean(), expiresAt: z.string().datetime().nullable() }).parse(d)).handler(async ({ data, context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { readAccessPolicy } = await import("./access.server");
  const { hashPassword } = await import("./access-crypto.server");
  const { randomBytes } = await import("node:crypto");
  const { getRequest, setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "private, no-store");
  const req = getRequest();
  if (req.headers.get("origin") !== new URL(req.url).origin) throw new Error("Please reload and try again.");
  const { data: row } = await context.supabase.from("portfolios").select("code").eq("code", data.code).eq("owner_id", context.userId).maybeSingle();
  if (!row) throw new Error("Save this portfolio to your account first.");
  const current = await readAccessPolicy(data.code);
  const passwordHash = data.removePassword ? null : data.password ? await hashPassword(data.password) : current?.password_hash ?? null;
  if (passwordHash || data.expiresAt) {
    const { data: sub } = await supabaseAdmin.from("subscriptions").select("status,current_period_end").eq("user_id", context.userId).eq("environment", "live").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!sub || !(["active", "trialing"].includes(sub.status) || (sub.status === "canceled" && sub.current_period_end && Date.parse(sub.current_period_end) > Date.now()))) throw new Error("An active Personal plan is required for passwords and expiry.");
  }
  if (data.expiresAt && Date.parse(data.expiresAt) <= Date.now()) throw new Error("Choose a future expiry date.");
  const { error } = await (supabaseAdmin as any).from("portfolio_access").upsert({ code: data.code, password_hash: passwordHash, expires_at: data.expiresAt, secret: randomBytes(32).toString("hex") });
  if (error) throw new Error("Couldn’t save access settings. Nothing changed.");
  return { ok: true };
});
