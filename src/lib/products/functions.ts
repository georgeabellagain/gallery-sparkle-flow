import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAccount } from "@/lib/require-account";
import {
  PRODUCT_BUCKET,
  productId,
  productFilePath,
  publicProduct,
  saveProductSchema,
  type Product,
} from "./model";
import { PUBLISH_NEEDS_PLAN, productAllowance, type ProductPlan } from "./plan";
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
export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireAccount])
  .handler(async ({ context }) => {
    await privateResponse();
    const db = await admin();
    const { data, error } = await db
      .from("digital_products")
      .select("id,title,status,updated_at,full_file,preview_file")
      .eq("owner_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Products are unavailable. Please try again shortly.");
    const plan = await planOf(db, context.userId);
    return {
      plan,
      allowance: productAllowance(plan),
      // A summary only: no storage keys or file names leave the server here.
      items: (data as any[]).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        status: row.status as "draft" | "published",
        updated_at: row.updated_at as string,
        pages: (row.full_file?.pages as number | undefined) ?? 0,
        hasFile: Boolean(row.full_file),
        hasPreview: Boolean(row.preview_file),
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
    return {
      product: row,
      // Chosen fields only: the token hash and signing secret never leave the server.
      links: (links as any[]).map((l) => ({
        id: l.id as string,
        label: l.label as string,
        revoked: Boolean(l.revoked),
        expires_at: (l.expires_at as string | null) ?? null,
        opens: Number(l.opens ?? 0),
        last_opened_at: (l.last_opened_at as string | null) ?? null,
      })),
      plan,
      personal: plan !== "free",
      canPublish: allowance.publish,
      limitMb: allowance.mb,
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
      const folder = file.path.slice(0, file.path.lastIndexOf("/")),
        name = file.path.split("/").pop();
      const { data: files, error } = await db.storage
        .from(PRODUCT_BUCKET)
        .list(folder, { search: name, limit: 100 });
      const found = files?.find((f: any) => f.name === name);
      if (
        error ||
        !found ||
        Number(found.metadata?.size) !== file.bytes ||
        file.bytes > allowance.mb * 1048576 ||
        found.metadata?.mimetype !== "application/pdf"
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
    const { data: saved, error } = await db
      .from("digital_products")
      .update({ ...data, revision: current.revision + 1, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .eq("revision", data.revision)
      .select("id")
      .maybeSingle();
    if (error || !saved)
      throw new Error("This product changed in another tab. Reload before saving.");
    return { revision: current.revision + 1 };
  });
export const createProductLink = createServerFn({ method: "POST" })
  .middleware([requireAccount])
  .inputValidator((d) =>
    z
      .object({
        id: productId,
        label: z.string().trim().min(1).max(100),
        expiresAt: z.string().datetime().nullable(),
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
    const { newAccessToken, tokenHash } = await import("./access.server");
    const token = newAccessToken();
    const { data: link, error } = await db
      .from("product_access_links")
      .insert({
        product_id: data.id,
        label: data.label,
        expires_at: data.expiresAt,
        token_hash: tokenHash(token),
        secret: newAccessToken(),
      })
      .select("id")
      .single();
    if (error) throw new Error("Could not create access link.");
    return {
      id: link.id as string,
      token,
      url: `https://portfolia.site/product/${data.id}#access=${token}`,
    };
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
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ data }) => {
    await privateResponse();
    const db = await admin();
    const { data: row, error } = await db
      .from("digital_products")
      .select("*")
      .eq("id", data.id)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error("This product could not be loaded.");
    if (!row) return null;
    const { getCookie } = await import("@tanstack/react-start/server");
    const { customerAccess, productCookie } = await import("./access.server");
    const { ownerHasPersonal } = await import("../portfolia/entitlements.server");
    const { freeViewer } = await import("../portfolia/premium-appearance");
    if (!(await ownerHasPersonal(row.owner_id, db))) row.appearance = freeViewer(row.appearance);
    return publicProduct(row, await customerAccess(db, data.id, getCookie(productCookie(data.id))));
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
