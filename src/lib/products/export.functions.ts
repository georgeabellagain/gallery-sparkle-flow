import { createServerFn } from "@tanstack/react-start";
import { requireAccount } from "@/lib/require-account";

/**
 * The account's products for "Download my data": their details, customer links (labels and counts, never tokens or
 * secrets) and orders with the buyer emails kept for the seller (Feature F). Parts a migration has not added yet are
 * simply left out.
 */
export const exportProductData = createServerFn({ method: "GET" })
  .middleware([requireAccount])
  .handler(async ({ context }) => {
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("Cache-Control", "private, no-store");
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const { data: products, error } = await db.from("digital_products").select("*").eq("owner_id", context.userId);
    if (error) throw new Error("Couldn’t read your products.");
    const out = [];
    for (const p of (products as any[]) ?? []) {
      const { data: links } = await db.from("product_access_links").select("label,revoked,expires_at,opens,last_opened_at,created_at").eq("product_id", p.id);
      const { data: orders } = await db.from("product_orders").select("source,order_ref,buyer_email,buyer_name,emailed_at,refunded_at,created_at").eq("product_id", p.id);
      out.push({
        id: p.id, title: p.title, description: p.description, status: p.status, slug: p.slug ?? null, buyUrl: p.buy_url,
        createdAt: p.created_at, updatedAt: p.updated_at,
        files: { full: p.full_file?.name ?? null, preview: Boolean(p.preview_file), extras: ((p.extra_files as any[]) ?? []).map((x) => x.name) },
        customerLinks: links ?? [],
        orders: orders ?? [],
      });
    }
    return out;
  });
