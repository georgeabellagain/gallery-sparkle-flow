import { foldoutKeys } from "./foldouts";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requestAccess } from "./access.server";
import type { Portfolio } from "./store";
export async function servePortfolioFile(code: string, url: string, db: any = supabaseAdmin, check = requestAccess): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff" };
  const missing = () => new Response(null, { status: 404, headers });
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(code)) return missing();
  const { data: row, error } = await db.from("portfolios").select("owner_id,data").eq("code", code).eq("status", "published").maybeSingle();
  if (error) return new Response(null, { status: 503, headers });
  if (!row || (await check(code)).state !== "open") return missing();
  const p = row.data as Portfolio;
  const key = new URL(url).searchParams.get("asset");
  const allowed = [p.pdf?.blobKey, p.profile?.photoKey, p.plan === "personal" ? p.profile?.cv?.blobKey : undefined, p.plan === "personal" ? p.style?.bannerKey : undefined, p.viewer?.backgroundKey, ...foldoutKeys(p.pdf)];
  if (!key || !/^[a-zA-Z0-9_.-]+$/.test(key) || !allowed.includes(key)) return missing();
  const { data: blob, error: storageError } = await db.storage.from("portfolio-files").download(`${row.owner_id}/${key}`);
  if (storageError || !blob) return missing();
  return new Response(blob, { headers: { ...headers, "Content-Type": blob.type || "application/octet-stream", "Content-Length": String(blob.size) } });
}
