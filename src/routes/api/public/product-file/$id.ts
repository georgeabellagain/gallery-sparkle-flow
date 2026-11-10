import { createFileRoute } from "@tanstack/react-router";
import { getCookie } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { serveProductFile } from "@/lib/products/file.server";
import { productCookie } from "@/lib/products/access.server";
const serve = ({ params, request }: { params: { id: string }; request: Request }) =>
  serveProductFile(supabaseAdmin, params.id, request, getCookie(productCookie(params.id)));
export const Route = createFileRoute("/api/public/product-file/$id")({
  staticData: { sitemap: false },
  server: { handlers: { GET: serve, HEAD: serve } },
});
