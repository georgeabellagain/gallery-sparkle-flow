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
export async function servePortfolioFile(code: string, url: string, db: any = supabaseAdmin, check = requestAccess, range: string | null = null, fetcher: typeof fetch = fetch): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes" };
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
  // The viewer reads PDFs a range at a time: storage streams just that part through a link that lasts a minute.
  if (range && /^bytes=\d*-\d*$/.test(range.trim())) {
    const { data: signed, error: signError } = await db.storage.from("portfolio-files").createSignedUrl(`${row.owner_id}/${key}`, 60);
    if (signError || !signed?.signedUrl) return missing();
    const part = await fetcher(signed.signedUrl, { headers: { Range: range.trim() } }).catch(() => null);
    if (!part || (part.status !== 206 && part.status !== 416 && !part.ok)) return part?.status === 404 ? missing() : new Response(null, { status: 503, headers });
    const type = servedFileType(part.headers.get("content-type") ?? "");
    const passed = Object.fromEntries(["Content-Range", "Content-Length"].flatMap((name) => { const value = part.headers.get(name); return value ? [[name, value]] : []; }));
    return new Response(part.body, { status: part.status, headers: { ...headers, ...passed, "Content-Type": type, ...(type === "application/octet-stream" ? { "Content-Disposition": "attachment" } : {}) } });
  }
  const { data: blob, error: storageError } = await db.storage.from("portfolio-files").download(`${row.owner_id}/${key}`);
  if (storageError || !blob) return missing();
  const type = servedFileType(blob.type);
  return new Response(blob, { headers: { ...headers, "Content-Type": type, "Content-Length": String(blob.size), ...(type === "application/octet-stream" ? { "Content-Disposition": "attachment" } : {}) } });
}
