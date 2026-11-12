BEGIN;
-- MP4 page animations share the existing authenticated product-file policies.
UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'video/mp4')
WHERE id = 'product-files' AND NOT ('video/mp4' = ANY(allowed_mime_types));

CREATE OR REPLACE FUNCTION public.product_upload_allowed(object_name text, object_metadata jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.product_mfa_satisfied()
 AND split_part(object_name,'/',1)=auth.uid()::text
 AND object_name ~ '^[a-f0-9-]+/[a-f0-9-]+/[a-f0-9-]+\.(pdf|webp|gif|zip|epub|png|jpg|mp3|mp4|txt)$'
 AND EXISTS(SELECT 1 FROM public.digital_products p WHERE p.id::text=split_part(object_name,'/',2) AND p.owner_id=auth.uid())
 AND CASE WHEN object_metadata->>'size' IS NULL THEN true
 WHEN object_metadata->>'size' ~ '^[0-9]+$' THEN (object_metadata->>'size')::numeric <=
   CASE WHEN object_name ~ '\.(webp|gif)$' THEN 2097152 WHEN object_name ~ '\.(mp4)$' THEN 10485760 ELSE public.product_upload_bytes(auth.uid()) END
 ELSE false END;
$$;
REVOKE ALL ON FUNCTION public.product_upload_allowed(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.product_upload_allowed(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.product_file_size_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_uuid uuid; cap bigint;
BEGIN
 IF NEW.bucket_id<>'product-files' THEN RETURN NEW; END IF;
 IF NEW.name !~ '\.(pdf|webp|gif|zip|epub|png|jpg|mp3|mp4|txt)$' THEN RAISE EXCEPTION 'Product file type not allowed'; END IF;
 owner_uuid:=split_part(NEW.name,'/',1)::uuid;
 cap:=CASE WHEN NEW.name ~ '\.(webp|gif)$' THEN 2097152 WHEN NEW.name ~ '\.(mp4)$' THEN 10485760 ELSE public.product_upload_bytes(owner_uuid) END;
 IF NEW.metadata->>'size' IS NOT NULL AND (NEW.metadata->>'size')::numeric > cap THEN
 RAISE EXCEPTION 'Product file exceeds upload allowance'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.product_file_size_guard() FROM PUBLIC,anon,authenticated;

-- Owners may remove their own animations, extras and covers once they are no longer used.
DROP POLICY IF EXISTS "Owner product file delete" ON storage.objects;
CREATE POLICY "Owner product file delete" ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='product-files' AND split_part(name,'/',1)=auth.uid()::text AND public.product_mfa_satisfied()
  AND name ~ '\.(webp|gif|zip|epub|png|jpg|mp3|mp4|txt)$');
COMMIT;
