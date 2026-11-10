BEGIN;
-- Digital Product Studio inside the subscriptions. Free is a try-out (one draft product, 30 MB); publishing and
-- customer links need Personal (10 products, 100 MB) or Business (50 products, 250 MB). Same numbers as
-- PRODUCT_ALLOWANCE in src/lib/products/plan.ts. Self-contained, like 20261110120000_digital_product_studio.sql.

CREATE OR REPLACE FUNCTION public.product_owner_plan(owner_uuid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE((SELECT CASE
   WHEN NOT (s.status IN ('active','trialing','past_due') OR (s.status='canceled' AND s.current_period_end>now())) THEN 'free'
   WHEN s.price_id IN ('business_monthly','business_yearly') THEN 'business'
   WHEN s.price_id IN ('personal_monthly','personal_yearly') THEN 'personal'
   ELSE 'free' END
 FROM public.subscriptions s WHERE s.user_id=owner_uuid AND s.environment='live'
 ORDER BY s.created_at DESC NULLS LAST,s.id DESC LIMIT 1),'free');
$$;
REVOKE ALL ON FUNCTION public.product_owner_plan(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.product_owner_plan(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.product_upload_bytes(owner_uuid uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE public.product_owner_plan(owner_uuid) WHEN 'business' THEN 262144000 WHEN 'personal' THEN 104857600 ELSE 31457280 END::bigint;
$$;
REVOKE ALL ON FUNCTION public.product_upload_bytes(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.product_upload_bytes(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.product_upload_allowed(object_name text, object_metadata jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.product_mfa_satisfied()
 AND split_part(object_name,'/',1)=auth.uid()::text
 AND object_name ~ '^[a-f0-9-]+/[a-f0-9-]+/[a-f0-9-]+\.pdf$'
 AND EXISTS(SELECT 1 FROM public.digital_products p WHERE p.id::text=split_part(object_name,'/',2) AND p.owner_id=auth.uid())
 AND CASE WHEN object_metadata->>'size' IS NULL THEN true
 WHEN object_metadata->>'size' ~ '^[0-9]+$' THEN (object_metadata->>'size')::numeric <= public.product_upload_bytes(auth.uid())
 ELSE false END;
$$;
REVOKE ALL ON FUNCTION public.product_upload_allowed(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.product_upload_allowed(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.product_file_size_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner_uuid uuid;
BEGIN
 IF NEW.bucket_id<>'product-files' THEN RETURN NEW; END IF;
 owner_uuid:=split_part(NEW.name,'/',1)::uuid;
 IF NEW.metadata->>'size' IS NOT NULL AND (NEW.metadata->>'size')::numeric > public.product_upload_bytes(owner_uuid) THEN
 RAISE EXCEPTION 'Product file exceeds upload allowance'; END IF;
 RETURN NEW;
END; $$;

-- Serialize per-owner creation; concurrent requests cannot evade the limit.
CREATE OR REPLACE FUNCTION public.product_count_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cap integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(NEW.owner_id::text));
 cap:=CASE public.product_owner_plan(NEW.owner_id) WHEN 'business' THEN 50 WHEN 'personal' THEN 10 ELSE 1 END;
 IF (SELECT count(*) FROM public.digital_products WHERE owner_id=NEW.owner_id)>=cap THEN RAISE EXCEPTION 'Product limit reached (free: 1, Personal: 10, Business: 50)'; END IF;
 RETURN NEW;
END; $$;

-- Going public needs a paid plan. A product that is already published stays published if the plan later ends, so
-- buyers keep the edition they paid for; it just cannot be published again once taken down.
CREATE OR REPLACE FUNCTION public.product_publish_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='published' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'published')
   AND public.product_owner_plan(NEW.owner_id)='free' THEN
  RAISE EXCEPTION 'Publishing a product needs Personal or Business';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS product_publish_guard ON public.digital_products;
CREATE TRIGGER product_publish_guard BEFORE INSERT OR UPDATE OF status ON public.digital_products FOR EACH ROW EXECUTE FUNCTION public.product_publish_guard();
REVOKE ALL ON FUNCTION public.product_publish_guard() FROM PUBLIC,anon,authenticated;

-- How often each customer link has been opened, so a seller can spot a link that is being passed around.
ALTER TABLE public.product_access_links ADD COLUMN IF NOT EXISTS opens integer NOT NULL DEFAULT 0;
ALTER TABLE public.product_access_links ADD COLUMN IF NOT EXISTS last_opened_at timestamptz;
CREATE OR REPLACE FUNCTION public.product_link_opened(link_uuid uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.product_access_links SET opens=opens+1, last_opened_at=now() WHERE id=link_uuid;
$$;
REVOKE ALL ON FUNCTION public.product_link_opened(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.product_link_opened(uuid) TO service_role;
COMMIT;
