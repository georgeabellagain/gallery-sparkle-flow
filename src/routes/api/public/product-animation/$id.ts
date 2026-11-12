import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { serveProductAnimation } from "@/lib/products/file.server";
const serve = ({ params, request }: { params: { id: string }; request: Request }) =>
  serveProductAnimation(supabaseAdmin, params.id, new URL(request.url).searchParams.get("file"));
export const Route = createFileRoute("/api/public/product-animation/$id")({
  staticData: { sitemap: false },
  server: { handlers: { GET: serve, HEAD: serve } },
});
