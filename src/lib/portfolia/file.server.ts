import { publicAssetKeys } from "./public-assets";
import { ownerHasPersonal } from "./entitlements.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requestAccess } from "./access.server";
import type { Portfolio } from "./store";
/**
 * Stored files keep the type their uploader declared, so only document and raster image types are served as
 * themselves; anything else (HTML, SVG, scripts) downloads as bytes and can never run on portfolia.site.
 */
export function servedFileType(type: string) {
  const clean = type.split(";")[0]!.trim().toLowerCase();
  return /^(application\/pdf|image\/(png|jpeg|webp|gif|avif))$/.test(clean) ? clean : "application/octet-stream";
}
export async function servePortfolioFile(code: string, url: string, db: any = supabaseAdmin, check = requestAccess): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff" };
  const missing = () => new Response(null, { status: 404, headers });
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(code)) return missing();
  const { data: row, error } = await db.from("portfolios").select("owner_id,data").eq("code", code).eq("status", "published").maybeSingle();
  if (error) return new Response(null, { status: 503, headers });
  if (!row || (await check(code)).state !== "open") return missing();
  const p = row.data as Portfolio;
  const key = new URL(url).searchParams.get("asset");
  const paidAsset = key && [p.profile?.cv?.blobKey, p.style?.bannerKey].includes(key);
  let personal = false;
  if (paidAsset) {
    try { personal = await ownerHasPersonal(row.owner_id, db); }
    catch { return new Response(null, { status: 503, headers }); }
  }
  const allowed = publicAssetKeys(p, personal);
  if (!key || !/^[a-zA-Z0-9_.-]+$/.test(key) || !allowed.includes(key)) return missing();
  const { data: blob, error: storageError } = await db.storage.from("portfolio-files").download(`${row.owner_id}/${key}`);
  if (storageError || !blob) return missing();
  const type = servedFileType(blob.type);
  return new Response(blob, { headers: { ...headers, "Content-Type": type, "Content-Length": String(blob.size), ...(type === "application/octet-stream" ? { "Content-Disposition": "attachment" } : {}) } });
}
