import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAccount } from "@/lib/require-account";

const code = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
/** The reads table is not in the generated database types, so it is reached loosely. */
type LooseQuery = PromiseLike<{ data: unknown; error: unknown }> & {
  insert(rows: unknown): PromiseLike<{ error: unknown }>;
  select(columns: string): LooseQuery; eq(column: string, value: unknown): LooseQuery; gte(column: string, value: unknown): LooseQuery;
  order(column: string, options: { ascending: boolean }): LooseQuery; limit(n: number): LooseQuery;
};
const loose = (client: unknown) => client as { from(table: string): LooseQuery };

const event = z.object({
  kind: z.enum(["page", "time", "click", "play"]),
  page: z.number().int().min(1).max(10000).optional(),
  target: z.string().max(120).optional(),
  seconds: z.number().int().min(0).max(600).optional(),
});
export type ReadingEvent = z.infer<typeof event>;

/** A phone, tablet or desktop, from the browser's own description of itself. */
export function deviceOf(userAgent: string): "phone" | "tablet" | "desktop" {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(userAgent)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|BlackBerry|Opera Mini|IEMobile/i.test(userAgent)) return "phone";
  return "desktop";
}
/** Just the site a reader came from ("instagram.com"), never the full address or anything personal in it. */
export function sourceOf(referrer: string | undefined, ownHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\.|^m\.|^l\./, "").toLowerCase();
    return host && host !== ownHost.replace(/^www\./, "") ? host.slice(0, 120) : null;
  } catch { return null; }
}

/**
 * Stores a small batch of what a reader did in a published portfolio (sent every few seconds and when they leave).
 * The portfolio must be published; the device, country and referring site are worked out here, and the visitor is
 * the same random, anonymous id the visit count uses.
 */
export const recordReading = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code, visitor: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).optional(), referrer: z.string().max(500).optional(), events: z.array(event).min(1).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { getRequest, setResponseHeader } = await import("@tanstack/react-start/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    setResponseHeader("Cache-Control", "private, no-store");
    const request = getRequest();
    const own = new URL(request.url);
    if (request.headers.get("origin") !== own.origin) return { ok: false };
    const { data: row } = await supabaseAdmin.from("portfolios").select("code").eq("code", data.code).eq("status", "published").maybeSingle();
    if (!row) return { ok: false };
    const shared = {
      portfolio_code: row.code,
      visitor: data.visitor ?? null,
      device: deviceOf(request.headers.get("user-agent") ?? ""),
      country: request.headers.get("cf-ipcountry")?.slice(0, 2).toUpperCase() || null,
      source: sourceOf(data.referrer, own.hostname),
    };
    const rows = data.events.map((e) => ({ ...shared, kind: e.kind, page: e.page ?? null, target: e.target?.trim() || null, seconds: e.seconds ?? null }));
    const { error } = await loose(supabaseAdmin).from("portfolio_reads").insert(rows);
    return { ok: !error };
  });

export type ReadingRow = { kind: "page" | "time" | "click" | "play"; page: number | null; target: string | null; seconds: number | null; device: string | null; country: string | null; source: string | null; visitor: string | null; created_at: string };

/** What readers did in one of the signed-in owner's portfolios over the last `days` days (up to 20,000 events). */
export const readingInsights = createServerFn({ method: "GET" })
  .middleware([requireAccount])
  .inputValidator((d) => z.object({ code, days: z.number().int().min(1).max(730) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("Cache-Control", "private, no-store");
    const { data: owned } = await context.supabase.from("portfolios").select("code").eq("code", data.code).eq("owner_id", context.userId).maybeSingle();
    if (!owned) throw new Error("Save this portfolio to your account first.");
    // Reader insights are part of Personal (the visit count stays free for everyone).
    const { ownerHasPersonal } = await import("./entitlements.server");
    if (!(await ownerHasPersonal(context.userId, supabaseAdmin))) throw new Error("Reader insights are part of Personal.");
    const since = new Date(Date.now() - data.days * 864e5).toISOString();
    const { data: rows, error } = await loose(supabaseAdmin).from("portfolio_reads").select("kind, page, target, seconds, device, country, source, visitor, created_at")
      .eq("portfolio_code", data.code).gte("created_at", since).order("created_at", { ascending: false }).limit(20000);
    if (error) throw new Error("Couldn't load reader insights.");
    return { rows: (rows ?? []) as ReadingRow[] };
  });
