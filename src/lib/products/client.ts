import { supabase } from "@/integrations/supabase/client";
import { EXTRA_MIME, PRODUCT_BUCKET, type ExtraKind, type ProductCover, type ProductFile } from "./model";
export async function productAuth() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in to manage products.");
  return { Authorization: `Bearer ${data.session.access_token}` };
}
export async function uploadProductPdf(
  id: string,
  blob: Blob,
  name: string,
  pages: number,
): Promise<ProductFile> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in before uploading.");
  const path = `${data.session.user.id}/${id}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .upload(path, blob, { contentType: "application/pdf", upsert: false });
  if (error)
    throw new Error("Upload failed. Check your plan allowance and connection, then retry.");
  return { path, name, bytes: blob.size, pages };
}
/** Feature A: the cover picture. Fails (and the caller skips it) until the covers migration is applied. */
export async function uploadProductCover(id: string, cover: { blob: Blob; width: number; height: number }): Promise<ProductCover> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in before uploading.");
  const path = `${data.session.user.id}/${id}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .upload(path, cover.blob, { contentType: "image/webp", upsert: false });
  if (error) throw new Error("Cover upload failed.");
  return { path, width: cover.width, height: cover.height, bytes: cover.blob.size };
}
/** Feature E: an extra file for customers, stored under a random name with its own extension. */
export async function uploadProductExtra(id: string, file: File, kind: ExtraKind) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in before uploading.");
  const fileId = crypto.randomUUID();
  const path = `${data.session.user.id}/${id}/${fileId}.${kind}`;
  const { error } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .upload(path, file, { contentType: EXTRA_MIME[kind][0], upsert: false });
  if (error) throw new Error("Upload failed. Check the file type, your plan allowance and connection.");
  return { id: fileId, path, name: file.name.slice(0, 160), bytes: file.size, kind };
}
/** Best effort: removes files the owner no longer uses, after a successful save. */
export async function removeProductFiles(paths: string[]) {
  if (!paths.length) return;
  await supabase.storage.from(PRODUCT_BUCKET).remove(paths).catch(() => {});
}
export async function readProductPdf(file: ProductFile) {
  const { data, error } = await supabase.storage.from(PRODUCT_BUCKET).download(file.path);
  if (error || !data) throw new Error("Could not load this PDF.");
  return data;
}
