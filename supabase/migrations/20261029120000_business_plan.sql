BEGIN;
-- Business: everything in Personal plus Business extras. Business prices count as paid wherever the database checks
-- for Personal (uploads, premium appearance, launch backgrounds), and get a larger upload allowance: 250 MB, matching
-- BUSINESS_UPLOAD_LIMIT_MB in src/lib/portfolia/store.ts. Same rules as 20261019150000_larger_upload_limits.sql.

CREATE OR REPLACE FUNCTION public.portfolio_owner_plan(owner_uuid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN NOT (s.status IN ('active', 'trialing', 'past_due') OR (s.status = 'canceled' AND s.current_period_end > now())) THEN 'free'
      WHEN s.price_id IN ('business_monthly', 'business_yearly') THEN 'business'
      WHEN s.price_id IN ('personal_monthly', 'personal_yearly') THEN 'personal'
      ELSE 'free'
    END
    FROM public.subscriptions s
    WHERE s.user_id = owner_uuid AND s.environment = 'live'
    ORDER BY s.created_at DESC NULLS LAST, s.id DESC LIMIT 1
  ), 'free');
$$;
REVOKE ALL ON FUNCTION public.portfolio_owner_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portfolio_owner_plan(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.portfolio_owner_has_personal(owner_uuid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.portfolio_owner_plan(owner_uuid) IN ('personal', 'business');
$$;
REVOKE ALL ON FUNCTION public.portfolio_owner_has_personal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portfolio_owner_has_personal(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.portfolio_upload_allowance(owner_uuid uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE public.portfolio_owner_plan(owner_uuid)
    WHEN 'business' THEN 262144000
    WHEN 'personal' THEN 104857600
    ELSE 31457280
  END::bigint;
$$;
REVOKE ALL ON FUNCTION public.portfolio_upload_allowance(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.portfolio_upload_allowed(object_name text, object_metadata jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
    AND split_part(object_name, '/', 1) = auth.uid()::text
    AND CASE
      WHEN object_metadata->>'size' IS NULL THEN true
      WHEN object_metadata->>'size' ~ '^[0-9]+$' THEN
        (object_metadata->>'size')::numeric <= public.portfolio_upload_allowance(auth.uid())
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
  allowed_bytes := public.portfolio_upload_allowance(owner_uuid);
  IF NEW.metadata->>'size' !~ '^[0-9]+$' OR (NEW.metadata->>'size')::numeric > allowed_bytes THEN
    RAISE EXCEPTION 'File exceeds the account upload allowance (% MB)', allowed_bytes / 1048576 USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.portfolio_validate_upload_size() FROM PUBLIC, anon, authenticated;
UPDATE storage.buckets SET file_size_limit = 262144000 WHERE id = 'portfolio-files';
COMMIT;
