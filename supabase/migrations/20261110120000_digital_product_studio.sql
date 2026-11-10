BEGIN;
CREATE OR REPLACE FUNCTION public.product_mfa_satisfied()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(auth.jwt()->>'aal','aal1')='aal2' OR NOT EXISTS (
 SELECT 1 FROM auth.mfa_factors WHERE user_id=auth.uid() AND status='verified');
$$;
REVOKE ALL ON FUNCTION public.product_mfa_satisfied() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.product_mfa_satisfied() TO authenticated;

-- Keep product entitlements self-contained even where older portfolio migrations
-- have not yet added Business prices.
CREATE OR REPLACE FUNCTION public.product_owner_paid(owner_uuid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE((SELECT s.price_id IN ('personal_monthly','personal_yearly','business_monthly','business_yearly')
 AND (s.status IN ('active','trialing','past_due') OR (s.status='canceled' AND s.current_period_end>now()))
 FROM public.subscriptions s WHERE s.user_id=owner_uuid AND s.environment='live'
 ORDER BY s.created_at DESC NULLS LAST,s.id DESC LIMIT 1),false);
$$;
REVOKE ALL ON FUNCTION public.product_owner_paid(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.product_owner_paid(uuid) TO service_role;
CREATE TABLE IF NOT EXISTS public.digital_products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL DEFAULT 'Untitled product' CHECK(length(title) BETWEEN 1 AND 120), description text NOT NULL DEFAULT '',
 buy_url text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 allow_download boolean NOT NULL DEFAULT true, full_file jsonb, preview_file jsonb, preview_pages jsonb NOT NULL DEFAULT '[]',
 appearance jsonb NOT NULL DEFAULT '{"mode":"book","look":"clean"}', revision integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS digital_products_owner ON public.digital_products(owner_id);
CREATE TABLE IF NOT EXISTS public.product_access_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES public.digital_products(id) ON DELETE CASCADE,
 token_hash text UNIQUE NOT NULL, secret text NOT NULL, label text NOT NULL CHECK(length(label) BETWEEN 1 AND 100),
 revoked boolean NOT NULL DEFAULT false, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_access_product ON public.product_access_links(product_id);
ALTER TABLE public.digital_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_access_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.digital_products, public.product_access_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.digital_products, public.product_access_links TO service_role;
-- All access is through owner-authenticated server functions. Even signed-in
-- buyers cannot enumerate products, storage keys, or access grants via REST.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('product-files','product-files',false,262144000,ARRAY['application/pdf'])
ON CONFLICT(id) DO UPDATE SET public=false, file_size_limit=262144000, allowed_mime_types=ARRAY['application/pdf'];
CREATE OR REPLACE FUNCTION public.product_upload_allowed(object_name text, object_metadata jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.product_mfa_satisfied()
 AND split_part(object_name,'/',1)=auth.uid()::text
 AND object_name ~ '^[a-f0-9-]+/[a-f0-9-]+/[a-f0-9-]+\.pdf$'
 AND EXISTS(SELECT 1 FROM public.digital_products p WHERE p.id::text=split_part(object_name,'/',2) AND p.owner_id=auth.uid())
 AND CASE WHEN object_metadata->>'size' IS NULL THEN true
 WHEN object_metadata->>'size' ~ '^[0-9]+$' THEN (object_metadata->>'size')::numeric <=
 CASE WHEN public.product_owner_paid(auth.uid()) THEN 104857600 ELSE 31457280 END ELSE false END;
$$;
REVOKE ALL ON FUNCTION public.product_upload_allowed(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.product_upload_allowed(text,jsonb) TO authenticated;
DROP POLICY IF EXISTS "Product PDF insert" ON storage.objects;
CREATE POLICY "Product PDF insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='product-files' AND public.product_upload_allowed(name,metadata));
-- No update policy: referenced originals/previews are immutable. Replacement
-- uploads use fresh paths and are attached atomically by the owner server API.
DROP POLICY IF EXISTS "Owner product PDF read" ON storage.objects;
CREATE POLICY "Owner product PDF read" ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='product-files' AND split_part(name,'/',1)=auth.uid()::text AND public.product_mfa_satisfied());
CREATE OR REPLACE FUNCTION public.product_file_size_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE limit_bytes bigint; owner_uuid uuid;
BEGIN
 IF NEW.bucket_id<>'product-files' THEN RETURN NEW; END IF;
 owner_uuid:=split_part(NEW.name,'/',1)::uuid;
 limit_bytes:=CASE WHEN public.product_owner_paid(owner_uuid) THEN 104857600 ELSE 31457280 END;
 IF NEW.metadata->>'size' IS NOT NULL AND (NEW.metadata->>'size')::numeric > limit_bytes THEN
 RAISE EXCEPTION 'Product file exceeds upload allowance'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS product_file_size_guard ON storage.objects;
CREATE TRIGGER product_file_size_guard BEFORE INSERT OR UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.product_file_size_guard();
-- Serialize per-owner creation; concurrent requests cannot evade the limit.
CREATE OR REPLACE FUNCTION public.product_count_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cap integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(NEW.owner_id::text));
 cap:=CASE WHEN public.product_owner_paid(NEW.owner_id) THEN 10 ELSE 1 END;
 IF (SELECT count(*) FROM public.digital_products WHERE owner_id=NEW.owner_id)>=cap THEN RAISE EXCEPTION 'Product limit reached (free: 1, paid: 10)'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS product_count_guard ON public.digital_products;
CREATE TRIGGER product_count_guard BEFORE INSERT ON public.digital_products FOR EACH ROW EXECUTE FUNCTION public.product_count_guard();
CREATE OR REPLACE FUNCTION public.product_link_count_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(NEW.product_id::text));
 IF (SELECT count(*) FROM public.product_access_links WHERE product_id=NEW.product_id)>=1000 THEN
 RAISE EXCEPTION 'Maximum 1000 customer links per product'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS product_link_count_guard ON public.product_access_links;
CREATE TRIGGER product_link_count_guard BEFORE INSERT ON public.product_access_links FOR EACH ROW EXECUTE FUNCTION public.product_link_count_guard();
REVOKE ALL ON FUNCTION public.product_count_guard(), public.product_file_size_guard(), public.product_link_count_guard() FROM PUBLIC,anon,authenticated;
COMMIT;
