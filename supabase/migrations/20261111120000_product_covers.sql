BEGIN;
-- Feature A (plan 1): a small WebP cover of preview page 1 for each product. Page 1 is always public, so the cover never
-- shows anything private. Self-contained and idempotent; the code works before this runs (covers are skipped).

ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS cover_file jsonb;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY(SELECT DISTINCT unnest(coalesce(allowed_mime_types, ARRAY[]::text[]) || ARRAY['application/pdf','image/webp']))
WHERE id = 'product-files';

-- Same conditions as 20261110130000, plus .webp covers capped at 307200 bytes (300 KB) whatever the plan.
CREATE OR REPLACE FUNCTION public.product_upload_allowed(object_name text, object_metadata jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.product_mfa_satisfied()
 AND split_part(object_name,'/',1)=auth.uid()::text
 AND object_name ~ '^[a-f0-9-]+/[a-f0-9-]+/[a-f0-9-]+\.(pdf|webp)$'
 AND EXISTS(SELECT 1 FROM public.digital_products p WHERE p.id::text=split_part(object_name,'/',2) AND p.owner_id=auth.uid())
 AND CASE WHEN object_metadata->>'size' IS NULL THEN true
 WHEN object_metadata->>'size' ~ '^[0-9]+$' THEN (object_metadata->>'size')::numeric <=
   CASE WHEN object_name ~ '\.webp$' THEN 307200 ELSE public.product_upload_bytes(auth.uid()) END
 ELSE false END;
$$;
REVOKE ALL ON FUNCTION public.product_upload_allowed(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.product_upload_allowed(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.product_file_size_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_uuid uuid; cap bigint;
BEGIN
 IF NEW.bucket_id<>'product-files' THEN RETURN NEW; END IF;
 owner_uuid:=split_part(NEW.name,'/',1)::uuid;
 cap:=CASE WHEN NEW.name ~ '\.webp$' THEN 307200 ELSE public.product_upload_bytes(owner_uuid) END;
 IF NEW.metadata->>'size' IS NOT NULL AND (NEW.metadata->>'size')::numeric > cap THEN
 RAISE EXCEPTION 'Product file exceeds upload allowance'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.product_file_size_guard() FROM PUBLIC,anon,authenticated;
COMMIT;
