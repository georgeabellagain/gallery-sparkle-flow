import { isMissingColumn, productId } from "./model";

/** A published product by id or by its readable address (Feature B). Drafts are never found. */
export async function findPublishedProduct(db: any, ref: string) {
  const byId = productId.safeParse(ref).success;
  const query = db.from("digital_products").select("*").eq("status", "published");
  const { data, error } = await (byId ? query.eq("id", ref) : query.eq("slug", ref.toLowerCase())).maybeSingle();
  // An address lookup before the slug migration is simply "not found".
  if (error && !byId && isMissingColumn(error)) return { row: null, error: null };
  return { row: (data as any) ?? null, error };
}
