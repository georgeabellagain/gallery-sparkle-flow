BEGIN;
-- Raise the upload allowances to 30 MB (Free) and 100 MB (Personal), matching
-- FREE_UPLOAD_LIMIT_MB and PERSONAL_UPLOAD_LIMIT_MB in src/lib/portfolia/store.ts.
-- Same rules as 20261016153000_server_plan_enforcement.sql; only the numbers change.
CREATE OR REPLACE FUNCTION public.portfolio_upload_allowed(object_name text, object_metadata jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
    AND split_part(object_name, '/', 1) = auth.uid()::text
    AND CASE
      WHEN object_metadata->>'size' IS NULL THEN true
      WHEN object_metadata->>'size' ~ '^[0-9]+$' THEN
        (object_metadata->>'size')::numeric <=
          CASE WHEN public.portfolio_owner_has_personal(auth.uid()) THEN 104857600 ELSE 31457280 END
      ELSE false
    END;
$$;
REVOKE ALL ON FUNCTION public.portfolio_upload_allowed(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portfolio_upload_allowed(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.portfolio_validate_upload_size()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner_uuid uuid; allowed_bytes bigint;
BEGIN
  IF NEW.bucket_id <> 'portfolio-files' OR NEW.metadata->>'size' IS NULL THEN RETURN NEW; END IF;
  BEGIN
    owner_uuid := split_part(NEW.name, '/', 1)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid portfolio owner folder' USING ERRCODE = '42501';
  END;
  allowed_bytes := CASE WHEN public.portfolio_owner_has_personal(owner_uuid) THEN 104857600 ELSE 31457280 END;
  IF NEW.metadata->>'size' !~ '^[0-9]+$' OR (NEW.metadata->>'size')::numeric > allowed_bytes THEN
    RAISE EXCEPTION 'File exceeds the account upload allowance (% MB)', allowed_bytes / 1048576 USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.portfolio_validate_upload_size() FROM PUBLIC, anon, authenticated;
UPDATE storage.buckets SET file_size_limit = 104857600 WHERE id = 'portfolio-files';
COMMIT;
