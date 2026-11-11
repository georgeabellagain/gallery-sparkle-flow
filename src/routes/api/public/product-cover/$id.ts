import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { serveProductCover } from "@/lib/products/file.server";
const serve = ({ params }: { params: { id: string } }) => serveProductCover(supabaseAdmin, params.id);
export const Route = createFileRoute("/api/public/product-cover/$id")({
  staticData: { sitemap: false },
  server: { handlers: { GET: serve, HEAD: serve } },
});
