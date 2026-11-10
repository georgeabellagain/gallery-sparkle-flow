import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_BUCKET, type ProductFile } from "./model";
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
export async function readProductPdf(file: ProductFile) {
  const { data, error } = await supabase.storage.from(PRODUCT_BUCKET).download(file.path);
  if (error || !data) throw new Error("Could not load this PDF.");
  return data;
}
