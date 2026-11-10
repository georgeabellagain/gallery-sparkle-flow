import { PRODUCT_BUCKET, productFilePath } from "./model";
import { customerAccess } from "./access.server";
export async function serveProductFile(
  db: any,
  id: string,
  request: Request,
  cookie?: string,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Content-Type": "application/pdf",
    "Content-Security-Policy": "sandbox",
  };
  const fail = (status = 404) => new Response(null, { status, headers });
  if (!/^[a-f0-9-]{36}$/.test(id)) return fail();
  const url = new URL(request.url),
    edition = url.searchParams.get("edition"),
    download = url.searchParams.get("download") === "1";
  if (edition !== "customer" && edition !== "preview") return fail();
  const { data: row, error } = await db
    .from("digital_products")
    .select("id,owner_id,status,full_file,preview_file,allow_download")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) return fail(503);
  if (!row) return fail();
  if (edition === "customer" && !(await customerAccess(db, id, cookie))) return fail();
  if (download && (edition !== "customer" || !row.allow_download)) return fail();
  const file = edition === "customer" ? row.full_file : row.preview_file;
  if (!file || !productFilePath(row.owner_id, id, file.path)) return fail();
  const range = request.headers.get("range");
  if (range && !/^bytes=\d+-\d*$/.test(range)) return fail(416);
  const { data: signed, error: signError } = await db.storage
    .from(PRODUCT_BUCKET)
    .createSignedUrl(file.path, 30);
  if (signError || !signed?.signedUrl) return fail(503);
  // Never redirect to storage: every subsequent range/download checks revocation.
  const upstream = await fetcher(signed.signedUrl, {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers: range ? { Range: range } : {},
    signal: request.signal,
  }).catch(() => null);
  if (!upstream) return fail(503);
  if (![200, 206, 416].includes(upstream.status)) {
    await upstream.body?.cancel();
    return fail(upstream.status === 404 ? 404 : 503);
  }
  const pass = Object.fromEntries(
    ["Content-Length", "Content-Range"].flatMap((k) =>
      upstream.headers.has(k) ? [[k, upstream.headers.get(k)!]] : [],
    ),
  );
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: {
      ...headers,
      ...pass,
      ...(download ? { "Content-Disposition": `attachment; filename="digital-product.pdf"` } : {}),
    },
  });
}
