import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { handleDeliveryRequest, sendDeliveryEmail } from "@/lib/products/delivery.server";
import { ownerPlan } from "@/lib/portfolia/entitlements.server";

/** Feature F: where Gumroad, Shopify or the seller's own automation reports an order. POST only. */
const serve = ({ params, request }: { params: { id: string; source: string }; request: Request }) =>
  handleDeliveryRequest(supabaseAdmin, params.id, params.source, request, {
    plan: (owner) => ownerPlan(owner, supabaseAdmin),
    send: sendDeliveryEmail,
  });
const refuse = () => new Response(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
export const Route = createFileRoute("/api/public/product-delivery/$id/$source")({
  staticData: { sitemap: false },
  server: { handlers: { POST: serve, GET: refuse } },
});
