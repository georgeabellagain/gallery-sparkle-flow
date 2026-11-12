import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAccount } from "@/lib/require-account";
import {
  ANIMATION_FILE_MIME,
  animationMaxBytes,
  productAnimationPath,
  EXTRA_MIME,
  OPTIONAL_PRODUCT_COLUMNS,
  PRODUCT_BUCKET,
  PRODUCT_COVER_MAX_BYTES,
  isMissingColumn,
  productCoverPath,
  productExtraPath,
  productId,
  stampText,
  productFilePath,
  publicProduct,
  saveProductSchema,
  type Product,
} from "./model";
import { PUBLISH_NEEDS_PLAN, extrasTotalBytes, productAllowance, type ProductPlan } from "./plan";
const idInput = z.object({ id: productId });
async function planOf(db: any, uid: string): Promise<ProductPlan> {
  const { ownerPlan } = await import("../portfolia/entitlements.server");
  return ownerPlan(uid, db);
}
async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
}
async function privateResponse(mutation = false) {
  const { getRequest, setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "private, no-store");
  setResponseHeader("Referrer-Policy", "no-referrer");
  if (mutation) {
    const req = getRequest();
    if (req.headers.get("origin") !== new URL(req.url).origin)
      throw new Error("Please reload and try again.");
  }
}
async function owned(db: any, id: string, uid: string): Promise<Product & { owner_id: string }> {
  const { data, error } = await db
    .from("digital_products")
    .select("*")
    .eq("id", id)
    .eq("owner_id", uid)
    .maybeSingle();
  if (error || !data) throw new Error("Product unavailable. Sign in to its owner account.");
  return data;
}
/** Size and type of a stored object, read from storage, never from what the browser said. */
async function storedObject(db: any, path: string) {
  const folder = path.slice(0, path.lastIndexOf("/")),
    name = path.split("/").pop();
  const { data: files, error } = await db.storage.from(PRODUCT_BUCKET).list(folder, { search: name, limit: 100 });
  const found = files?.find((f: any) => f.name === name);
  return error || !found ? null : { size: Number(found.metadata?.size), mimetype: String(found.metadata?.mimetype ?? "") };
}
export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireAccount])
  .handler(async ({ context }) => {
    await privateResponse();
    const db = await admin();
    const read = (columns: string) =>
      db.from("digital_products").select(columns).eq("owner_id", context.userId).order("updated_at", { ascending: false });
    // Cover and address columns arrive with plan 1's migrations; the list still loads without them.
    let { data, error } = await read("id,title,status,updated_at,full_file,preview_file,cover_file,slug");
    if (error && isMissingColumn(error)) ({ data, error } = await read("id,title,status,updated_at,full_file,preview_file"));
    if (error) throw new Error("Products are unavailable. Please try again shortly.");
    const plan = await planOf(db, context.userId);
    const rows = data as any[];
    // One signing call for every cover, valid ten minutes. Owner-only response.
    const coverPaths = rows.map((r) => r.cover_file?.path).filter((p): p is string => typeof p === "string" && productCoverPath(context.userId, p.split("/")[1] ?? "", p));
    const covers = new Map<string, string>();
    if (coverPaths.length) {
      const { data: signed } = await db.storage.from(PRODUCT_BUCKET).createSignedUrls(coverPaths, 600).catch(() => ({ data: null }));
      for (const s of (signed as any[] | null) ?? []) if (s?.path && s.signedUrl) covers.set(s.path, s.signedUrl);
    }
    return {
      plan,
      allowance: productAllowance(plan),
      // A summary only: no storage keys or file names leave the server here.
      items: rows.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        status: row.status as "draft" | "published",
        updated_at: row.updated_at as string,
        pages: (row.full_file?.pages as number | undefined) ?? 0,
        hasFile: Boolean(row.full_file),
        hasPreview: Boolean(row.preview_file),
        slug: (row.slug as string | null | undefined) ?? null,
        coverUrl: (row.cover_file?.path && covers.get(row.cover_file.path)) || null,
      })),
    };
  });
export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireAccount])
  .handler(async ({ context }) => {
    await privateResponse(true);
    const db = await admin();
    const plan = await planOf(db, context.userId), cap = productAllowance(plan).products;
    const { count } = await db
      .from("digital_products")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", context.userId);
    if ((count ?? 0) >= cap)
      throw new Error(
        plan === "free"
          ? "Free includes one product to try. Upgrade to Personal for up to 10."
          : plan === "personal"
            ? "Personal includes 10 products. Business includes 50."
            : "Business includes 50 products. Delete one to add another.",
      );
    const { data, error } = await db
      .from("digital_products")
      .insert({ owner_id: context.userId })
      .select("id")
      .single();
    if (error) throw new Error("Could not create a product. Please try again.");
    return data.id as string;
  });
export const ownerProduct = createServerFn({ method: "GET" })
  .middleware([requireAccount])
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ context, data }) => {
    await privateResponse();
    const db = await admin(),
      row = await owned(db, data.id, context.userId);
    const plan = await planOf(db, context.userId), allowance = productAllowance(plan);
    const { data: links, error } = await db
      .from("product_access_links")
      .select("*")
      .eq("product_id", data.id)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error("Could not load customer access links.");
    // The delivery key hash and shop signing secret (Feature F) stay on the server.
    const { delivery: _delivery, ...product } = row as typeof row & { delivery?: unknown };
    return {
      product,
      // Chosen fields only: the token hash and signing secret never leave the server.
      links: (links as any[]).map((l) => ({
        id: l.id as string,
        label: l.label as string,
        revoked: Boolean(l.revoked),
        expires_at: (l.expires_at as string | null) ?? null,
        opens: Number(l.opens ?? 0),
        last_opened_at: (l.last_opened_at as string | null) ?? null,
        stamp: (l.stamp as string | null | undefined) ?? null,
      })),
      plan,
      personal: plan !== "free",
      canPublish: allowance.publish,
      limitMb: allowance.mb,
      // Which plan-1 columns this database has, so the editor can say "Available after the next update".
      columns: Object.fromEntries(OPTIONAL_PRODUCT_COLUMNS.map((c) => [c, c in product])) as Record<(typeof OPTIONAL_PRODUCT_COLUMNS)[number], boolean>,
    };
  });
export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireAccount])
  .inputValidator((d) => saveProductSchema.parse(d))
  .handler(async ({ context, data }) => {
    await privateResponse(true);
    const db = await admin(),
      current = await owned(db, data.id, context.userId);
    const plan = await planOf(db, context.userId), allowance = productAllowance(plan);
    // Publishing is paid. A product already online stays online if the plan ends, but is not changed on Free.
    if (data.status === "published" && !allowance.publish)
      throw new Error(
        current.status === "published"
          ? "Your plan has ended. This product stays online, but changing it needs Personal or Business."
          : PUBLISH_NEEDS_PLAN,
      );
    const { personalHdri, personalBackground } = await import("../portfolia/premium-appearance");
    if (plan === "free" && personalHdri(data.appearance.studioLighting ?? "4"))
      throw new Error("Choose a Free HDRI or upgrade before saving.");
    if (
      plan === "free" &&
      data.appearance.backgroundPreset &&
      personalBackground(data.appearance.backgroundPreset)
    )
      throw new Error("Choose a Free background or upgrade before saving.");
    for (const file of [data.full_file, data.preview_file]) {
      if (!file) continue;
      if (!productFilePath(context.userId, data.id, file.path))
        throw new Error("Invalid product file.");
      // Verify actual storage metadata; never trust browser-reported byte size.
      const found = await storedObject(db, file.path);
      if (
        !found ||
        found.size !== file.bytes ||
        file.bytes > allowance.mb * 1048576 ||
        found.mimetype !== "application/pdf"
      )
        throw new Error("The PDF upload is missing or exceeds your plan allowance.");
      const { data: signed, error: signError } = await db.storage
        .from(PRODUCT_BUCKET)
        .createSignedUrl(file.path, 30);
      if (signError || !signed?.signedUrl) throw new Error("Could not verify the PDF.");
      const response = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-7" } });
      const reader = response.body?.getReader();
      const first = await reader?.read();
      await reader?.cancel();
      if (
        !response.ok ||
        !first?.value ||
        !new TextDecoder().decode(first.value.slice(0, 8)).startsWith("%PDF-")
      )
        throw new Error("Upload a valid PDF file.");
    }
    // Feature A: the cover is a WebP of public page 1, at most 300 KB, checked in storage like the PDFs.
    if (data.cover_file) {
      const found = productCoverPath(context.userId, data.id, data.cover_file.path) ? await storedObject(db, data.cover_file.path) : null;
      if (!found || found.size !== data.cover_file.bytes || found.size > PRODUCT_COVER_MAX_BYTES || found.mimetype !== "image/webp")
        throw new Error("The cover picture is missing. Make the preview again.");
    }
    // Feature B: a readable address goes with publishing.
    if (data.slug && data.slug !== current.slug && !allowance.publish)
      throw new Error("Your own address is part of Personal and Business.");
    // Feature E: extras are for paid plans, checked one by one in storage, and limited in total.
    const extras = data.extra_files ?? [];
    if (extras.length) {
      const before = new Set(((current.extra_files as any[] | undefined) ?? []).map((x) => x.id));
      if (!allowance.publish && extras.some((x) => !before.has(x.id)))
        throw new Error("Extra files are part of Personal and Business.");
      if (new Set(extras.map((x) => x.id)).size !== extras.length) throw new Error("Each extra file can be added once.");
      let total = 0;
      for (const x of extras) {
        if (!productExtraPath(context.userId, data.id, x.path, x.kind)) throw new Error("Invalid extra file.");
        const found = await storedObject(db, x.path);
        if (!found || found.size !== x.bytes || x.bytes > allowance.mb * 1048576 || !EXTRA_MIME[x.kind].includes(found.mimetype))
          throw new Error(`“${x.name}” is missing, too large or not the type it says.`);
        total += x.bytes;
      }
      if (total > extrasTotalBytes(plan)) throw new Error(`Extra files can use up to ${allowance.mb * 2} MB in total on your plan.`);
    }
    // Page animations: each picture is the owner's own file for this product, of an allowed type and size. Ones
    // already saved were checked then; only new ones are looked up in storage.
    const animations = data.appearance.animations ?? [];
    if (animations.length) {
      if (new Set(animations.map((a) => a.id)).size !== animations.length) throw new Error("Each animation can be placed once; duplicate it to use it again.");
      const checked = new Set(((current.appearance as Product["appearance"] | null)?.animations ?? []).map((a) => `${a.file.path}:${a.file.bytes}:${a.file.kind}`));
      const looked = new Map<string, boolean>();
      for (const a of animations) {
        if (!productAnimationPath(context.userId, data.id, a.file.path, a.file.kind)) throw new Error("Invalid animation file.");
        if (data.full_file && a.page > data.full_file.pages) throw new Error("An animation is on a page this PDF doesn’t have. Move or remove it.");
        const key = `${a.file.path}:${a.file.bytes}:${a.file.kind}`;
        if (checked.has(key)) continue;
        if (!looked.has(key)) {
          const found = await storedObject(db, a.file.path);
          looked.set(key, Boolean(found && found.size === a.file.bytes && found.size <= animationMaxBytes(a.file.kind) && ANIMATION_FILE_MIME[a.file.kind].includes(found.mimetype)));
        }
        if (!looked.get(key)) throw new Error("An animation’s picture is missing or not the type it says. Remove it and add it again.");
      }
    }
    if (
      data.preview_file &&
      (!data.full_file ||
        data.preview_file.path === data.full_file.path ||
        !data.preview_pages.length ||
        data.preview_file.pages !== data.preview_pages.length ||
        new Set(data.preview_pages).size !== data.preview_pages.length ||
        data.preview_pages.some((n) => n > data.full_file!.pages))
    )
      throw new Error("Generate a separate preview from the chosen pages.");
    if (data.status === "published" && (!data.full_file || !data.preview_file))
      throw new Error("Upload the full PDF and generate a public preview before publishing.");
    const values: Record<string, unknown> = { ...data, revision: current.revision + 1, updated_at: new Date().toISOString() };
    for (const column of OPTIONAL_PRODUCT_COLUMNS) if (values[column] === undefined) delete values[column];
    const update = (v: Record<string, unknown>) =>
      db
        .from("digital_products")
        .update(v)
        .eq("id", data.id)
        .eq("owner_id", context.userId)
        .eq("revision", data.revision)
        .select("id")
        .maybeSingle();
    let { data: saved, error } = await update(values);
    // Before plan 1's migrations: save everything else and tell the editor which parts waited.
    const unsupported: string[] = [];
    if (error && isMissingColumn(error)) {
      for (const column of OPTIONAL_PRODUCT_COLUMNS) if (column in values) { unsupported.push(column); delete values[column]; }
      ({ data: saved, error } = await update(values));
    }
    if (error?.code === "23505" && /slug/i.test(`${error.message} ${error.details ?? ""}`))
      throw new Error("That address is taken. Try another.");
    if (error || !saved)
      throw new Error("This product changed in another tab. Reload before saving.");
    return { revision: current.revision + 1, unsupported };
  });
export const createProductLink = createServerFn({ method: "POST" })
  .middleware([requireAccount])
  .inputValidator((d) =>
    z
      .object({
        id: productId,
        label: z.string().trim().min(1).max(100),
        expiresAt: z.string().datetime().nullable(),
        stamp: stampText.nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await privateResponse(true);
    const db = await admin(),
      row = await owned(db, data.id, context.userId);
    if (!productAllowance(await planOf(db, context.userId)).publish)
      throw new Error("Customer links are part of Personal and Business.");
    if (row.status !== "published")
      throw new Error("Publish this product before creating customer access.");
    if (data.expiresAt && Date.parse(data.expiresAt) <= Date.now())
      throw new Error("Choose a future expiry.");
    const { newProductLink } = await import("./access.server");
    const link = await newProductLink(db, data.id, { label: data.label, expiresAt: data.expiresAt, stamp: data.stamp || null });
    // Customer links keep the id form so the security path never depends on a changeable address.
    return { id: link.id, token: link.token, url: `https://portfolia.site/product/${data.id}#access=${link.token}` };
  });
export const revokeProductLink = createServerFn({ method: "POST" })
  .middleware([requireAccount])
  .inputValidator((d) => z.object({ id: productId, linkId: productId }).parse(d))
  .handler(async ({ context, data }) => {
    await privateResponse(true);
    const db = await admin();
    await owned(db, data.id, context.userId);
    const { error } = await db
      .from("product_access_links")
      .update({ revoked: true })
      .eq("id", data.linkId)
      .eq("product_id", data.id);
    if (error) throw new Error("Could not revoke access.");
    return { ok: true };
  });
export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireAccount])
  .inputValidator((d) => z.object({ id: productId, confirm: z.literal("DELETE") }).parse(d))
  .handler(async ({ context, data }) => {
    await privateResponse(true);
    const db = await admin();
    await owned(db, data.id, context.userId);
    // Hide first; a partial storage failure can be retried without serving files.
    await db
      .from("digital_products")
      .update({ status: "draft" })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    // The whole folder goes: PDFs, the cover and every extra file live under <owner>/<product>/.
    const folder = `${context.userId}/${data.id}`;
    for (let n = 0; n < 100; n++) {
      const { data: files, error } = await db.storage
        .from(PRODUCT_BUCKET)
        .list(folder, { limit: 1000 });
      if (error) throw new Error("Could not delete files. Please retry.");
      if (!files.length) break;
      const result = await db.storage
        .from(PRODUCT_BUCKET)
        .remove(files.map((f: any) => `${folder}/${f.name}`));
      if (result.error) throw new Error("Could not delete files. Please retry.");
    }
    const { error } = await db
      .from("digital_products")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error("Could not delete product.");
    return { ok: true };
  });
export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z
      .union([
        z.object({ id: productId, previewOnly: z.boolean().optional() }),
        z.object({ ref: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9-]+$/), previewOnly: z.boolean().optional() }),
      ])
      .parse(d),
  )
  .handler(async ({ data }) => {
    await privateResponse();
    const db = await admin();
    const { findPublishedProduct } = await import("./lookup.server");
    const { row, error } = await findPublishedProduct(db, "id" in data ? data.id : data.ref);
    if (error) throw new Error("This product could not be loaded.");
    if (!row) return null;
    const { getCookie } = await import("@tanstack/react-start/server");
    const { customerLink, productCookie } = await import("./access.server");
    const { ownerHasPersonal } = await import("../portfolia/entitlements.server");
    const { freeViewer } = await import("../portfolia/premium-appearance");
    if (!(await ownerHasPersonal(row.owner_id, db))) row.appearance = freeViewer(row.appearance);
    // The website embed always shows the shop preview, even in a browser holding a customer session.
    const link = data.previewOnly ? null : await customerLink(db, row.id, getCookie(productCookie(row.id)));
    return publicProduct(row, Boolean(link), link);
  });
export const redeemProduct = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: productId, token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    await privateResponse(true);
    const db = await admin();
    const { getRequest, setCookie } = await import("@tanstack/react-start/server");
    const { tokenHash, validProductLink, customerSession, productCookie } =
      await import("./access.server");
    const ip = getRequest().headers.get("cf-connecting-ip") ?? "unknown";
    const { data: allowed, error: rateError } = await db.rpc("portfolio_unlock_attempt", {
      bucket_key: `product:${data.id}:${tokenHash(ip)}`,
    });
    if (rateError || !allowed) throw new Error("Too many attempts. Try again in five minutes.");
    const { data: row } = await db
      .from("digital_products")
      .select("id")
      .eq("id", data.id)
      .eq("status", "published")
      .maybeSingle();
    const { data: link, error } = await db
      .from("product_access_links")
      .select("*")
      .eq("product_id", data.id)
      .eq("token_hash", tokenHash(data.token))
      .maybeSingle();
    if (!row || error || !validProductLink(link))
      throw new Error(
        "This customer link is invalid, expired or revoked. Contact the seller for help.",
      );
    // Counted for the seller; a failed count never blocks a customer.
    try {
      await db.rpc("product_link_opened", { link_uuid: link.id });
    } catch {
      /* not counted */
    }
    const { countProductEvent } = await import("./stats.server");
    await countProductEvent(db, data.id, "customer_open");
    setCookie(productCookie(data.id), customerSession(link), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 43200,
    });
    return { ok: true };
  });

export const closeProductEdition = createServerFn({ method: "POST" })
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ data }) => {
    await privateResponse(true);
    const { deleteCookie } = await import("@tanstack/react-start/server");
    const { productCookie } = await import("./access.server");
    deleteCookie(productCookie(data.id), { path: "/" });
    return { ok: true };
  });

