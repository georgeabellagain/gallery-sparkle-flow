BEGIN;
-- Subscription rows are webhook/service-role managed; browser portfolio JSON is irrelevant.
CREATE OR REPLACE FUNCTION public.portfolio_owner_has_personal(owner_uuid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT s.price_id IN ('personal_monthly', 'personal_yearly') AND (
      s.status IN ('active', 'trialing', 'past_due') OR
      (s.status = 'canceled' AND s.current_period_end > now())
    )
    FROM public.subscriptions s
    WHERE s.user_id = owner_uuid AND s.environment = 'live'
    ORDER BY s.created_at DESC NULLS LAST, s.id DESC LIMIT 1
  ), false);
$$;
REVOKE ALL ON FUNCTION public.portfolio_owner_has_personal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portfolio_owner_has_personal(uuid) TO service_role;

-- Storage computes metadata.size from the uploaded bytes. user_metadata and
-- client MIME/filename/plan/Content-Length are not used for the allowance.
-- A NULL size is used by Storage's preflight permission probe; the final write
-- always carries the actual size and is checked again by these policies.
CREATE OR REPLACE FUNCTION public.portfolio_upload_allowed(object_name text, object_metadata jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
    AND split_part(object_name, '/', 1) = auth.uid()::text
    AND CASE
      WHEN object_metadata->>'size' IS NULL THEN true
      WHEN object_metadata->>'size' ~ '^[0-9]+$' THEN
        (object_metadata->>'size')::numeric <=
          CASE WHEN public.portfolio_owner_has_personal(auth.uid()) THEN 52428800 ELSE 10485760 END
      ELSE false
    END;
$$;
REVOKE ALL ON FUNCTION public.portfolio_upload_allowed(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portfolio_upload_allowed(text,jsonb) TO authenticated;

-- Restrictive policies AND with existing owner policies, closing direct SDK,
-- REST, replacement/upsert and resumable upload paths without changing reads.
DROP POLICY IF EXISTS "Portfolio upload size insert" ON storage.objects;
CREATE POLICY "Portfolio upload size insert" ON storage.objects AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'portfolio-files' OR public.portfolio_upload_allowed(name, metadata));
DROP POLICY IF EXISTS "Portfolio upload size update" ON storage.objects;
CREATE POLICY "Portfolio upload size update" ON storage.objects AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (bucket_id <> 'portfolio-files' OR public.portfolio_upload_allowed(name, metadata));
-- Some Storage versions finalize metadata using an internal service role.
-- Validate those writes too: triggers still run when RLS is bypassed. The
-- first path segment is fixed by the existing ownership policies.
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
  allowed_bytes := CASE WHEN public.portfolio_owner_has_personal(owner_uuid) THEN 52428800 ELSE 10485760 END;
  IF NEW.metadata->>'size' !~ '^[0-9]+$' OR (NEW.metadata->>'size')::numeric > allowed_bytes THEN
    RAISE EXCEPTION 'File exceeds the account upload allowance (% MB)', allowed_bytes / 1048576 USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.portfolio_validate_upload_size() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS portfolio_upload_size_guard ON storage.objects;
CREATE TRIGGER portfolio_upload_size_guard BEFORE INSERT OR UPDATE OF metadata, name, bucket_id ON storage.objects
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_validate_upload_size();
UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id = 'portfolio-files';
COMMIT;
