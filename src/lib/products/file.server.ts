import { PRODUCT_BUCKET, isMissingColumn, productCoverPath, productExtraPath, productFilePath, type ProductExtra } from "./model";
import { customerLink } from "./access.server";
import { STAMP_SERVER_LIMIT_BYTES } from "./plan";
import { countProductEvent } from "./stats.server";

const BASE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Accept-Ranges": "bytes",
  "Content-Type": "application/pdf",
  "Content-Security-Policy": "sandbox",
};

/** A download name that is safe in a header: letters, digits, dot, dash and underscore only. */
export function safeFileName(name: string, kind: string) {
  const base = name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+/, "").slice(0, 100);
  return base && base.toLowerCase().endsWith(`.${kind}`) ? base : base ? `${base}.${kind}` : `file.${kind}`;
}

export async function serveProductFile(
  db: any,
  id: string,
  request: Request,
  cookie?: string,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const headers: Record<string, string> = { ...BASE_HEADERS };
  const fail = (status = 404) => new Response(null, { status, headers });
  if (!/^[a-f0-9-]{36}$/.test(id)) return fail();
  const url = new URL(request.url),
    edition = url.searchParams.get("edition"),
    extraId = url.searchParams.get("extra"),
    download = url.searchParams.get("download") === "1";
  if (!extraId && edition !== "customer" && edition !== "preview") return fail();
  const read = (columns: string) => db.from("digital_products").select(columns).eq("id", id).eq("status", "published").maybeSingle();
  let { data: row, error } = await read("id,owner_id,status,full_file,preview_file,allow_download,extra_files");
  if (error && isMissingColumn(error)) ({ data: row, error } = await read("id,owner_id,status,full_file,preview_file,allow_download"));
  if (error) return fail(503);
  if (!row) return fail();
  const range = request.headers.get("range");
  if (range && !/^bytes=\d+-\d*$/.test(range)) return fail(416);

  // Feature E: an extra file, for customers only, always as an attachment and never shown inline.
  if (extraId) {
    if (!/^[a-f0-9-]{36}$/.test(extraId)) return fail();
    if (!(await customerLink(db, id, cookie))) return fail();
    const extra = ((row.extra_files as ProductExtra[] | undefined) ?? []).find((x) => x.id === extraId);
    if (!extra || !productExtraPath(row.owner_id, id, extra.path, extra.kind)) return fail();
    headers["Content-Type"] = "application/octet-stream";
    headers["Content-Disposition"] = `attachment; filename="${safeFileName(extra.name, extra.kind)}"`;
    return proxy(db, extra.path, request, range, headers, fetcher);
  }

  const link = edition === "customer" ? await customerLink(db, id, cookie) : null;
  if (edition === "customer" && !link) return fail();
  if (download && (edition !== "customer" || !row.allow_download)) return fail();
  const file = edition === "customer" ? row.full_file : row.preview_file;
  if (!file || !productFilePath(row.owner_id, id, file.path)) return fail();
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="digital-product.pdf"`;
    // Counted once per download, not once per range request.
    if (!range || /^bytes=0-/.test(range)) await countProductEvent(db, id, "download");
  }

  // Feature D: a stamped customer never receives an unstamped file through download=1.
  if (download && link?.stamp) {
    if (Number(file.bytes) > STAMP_SERVER_LIMIT_BYTES) return fail(); // stamped in the buyer's browser instead
    const { data: signed, error: signError } = await db.storage.from(PRODUCT_BUCKET).createSignedUrl(file.path, 30);
    if (signError || !signed?.signedUrl) return fail(503);
    const upstream = await fetcher(signed.signedUrl, { signal: request.signal }).catch(() => null);
    if (!upstream?.ok) return fail(503);
    try {
      const { stampPdf } = await import("./stamp");
      const out = await stampPdf(new Uint8Array(await upstream.arrayBuffer()), link.stamp);
      headers["Content-Length"] = String(out.byteLength);
      delete headers["Accept-Ranges"];
      return new Response(request.method === "HEAD" ? null : (out as BodyInit), { status: 200, headers });
    } catch {
      return fail(422);
    }
  }
  return proxy(db, file.path, request, range, headers, fetcher);
}

/** Never redirect to storage: every request, range or download checks access again first. */
async function proxy(db: any, path: string, request: Request, range: string | null, headers: Record<string, string>, fetcher: typeof fetch) {
  const fail = (status: number) => new Response(null, { status, headers });
  const { data: signed, error: signError } = await db.storage.from(PRODUCT_BUCKET).createSignedUrl(path, 30);
  if (signError || !signed?.signedUrl) return fail(503);
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
    ["Content-Length", "Content-Range"].flatMap((k) => (upstream.headers.has(k) ? [[k, upstream.headers.get(k)!]] : [])),
  );
  return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers: { ...headers, ...pass } });
}

/** Feature A: the cover of a published product, proxied (no redirect, no storage URL). Drafts get 404. */
export async function serveProductCover(db: any, id: string, fetcher: typeof fetch = fetch): Promise<Response> {
  const headers = {
    "Content-Type": "image/webp",
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
  };
  const fail = (status = 404) => new Response(null, { status, headers: { ...headers, "Cache-Control": "no-store" } });
  if (!/^[a-f0-9-]{36}$/.test(id)) return fail();
  const { data: row, error } = await db.from("digital_products").select("id,owner_id,status,cover_file").eq("id", id).eq("status", "published").maybeSingle();
  if (error) return fail(isMissingColumn(error) ? 404 : 503);
  const cover = row?.cover_file;
  if (!row || !cover?.path || !productCoverPath(row.owner_id, id, cover.path)) return fail();
  const { data: signed, error: signError } = await db.storage.from(PRODUCT_BUCKET).createSignedUrl(cover.path, 30);
  if (signError || !signed?.signedUrl) return fail(503);
  const upstream = await fetcher(signed.signedUrl).catch(() => null);
  if (!upstream?.ok) { await upstream?.body?.cancel(); return fail(upstream?.status === 404 ? 404 : 503); }
  return new Response(upstream.body, { status: 200, headers });
}
