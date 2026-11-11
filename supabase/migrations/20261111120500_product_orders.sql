BEGIN;
-- Feature F (plan 1): automatic delivery, one private link per order, emailed to the buyer.
-- delivery = { source, key_hash, settings }. key_hash is a SHA-256 of the delivery key; the key itself is never stored.
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS delivery jsonb;

CREATE TABLE IF NOT EXISTS public.product_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.digital_products(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('gumroad','shopify','generic','manual')),
  order_ref text NOT NULL CHECK (length(order_ref) BETWEEN 1 AND 120),
  buyer_email text NOT NULL CHECK (length(buyer_email) BETWEEN 3 AND 254),
  buyer_name text,
  link_id uuid REFERENCES public.product_access_links(id) ON DELETE SET NULL,
  emailed_at timestamptz,
  refunded_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, source, order_ref)
);
CREATE INDEX IF NOT EXISTS product_orders_product ON public.product_orders(product_id, created_at DESC);
ALTER TABLE public.product_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_orders FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.product_orders TO service_role;

-- One link per order: a busy product needs far more than 1000.
CREATE OR REPLACE FUNCTION public.product_link_count_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(NEW.product_id::text));
 IF (SELECT count(*) FROM public.product_access_links WHERE product_id=NEW.product_id)>=20000 THEN
 RAISE EXCEPTION 'Maximum 20000 customer links per product'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.product_link_count_guard() FROM PUBLIC,anon,authenticated;

-- A small counter for delivery requests: at most max_hits per window_seconds for each key.
CREATE TABLE IF NOT EXISTS public.product_delivery_limits (bucket text PRIMARY KEY, window_start timestamptz NOT NULL, hits integer NOT NULL);
ALTER TABLE public.product_delivery_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_delivery_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.product_delivery_limits TO service_role;
CREATE OR REPLACE FUNCTION public.product_delivery_attempt(bucket_key text, max_hits integer, window_seconds integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 DELETE FROM public.product_delivery_limits WHERE window_start < now() - interval '1 day';
 INSERT INTO public.product_delivery_limits AS t VALUES (bucket_key, now(), 1)
 ON CONFLICT (bucket) DO UPDATE SET
  hits = CASE WHEN t.window_start < now() - make_interval(secs => window_seconds) THEN 1 ELSE t.hits + 1 END,
  window_start = CASE WHEN t.window_start < now() - make_interval(secs => window_seconds) THEN now() ELSE t.window_start END
 RETURNING hits INTO n;
 RETURN n <= max_hits;
END; $$;
REVOKE ALL ON FUNCTION public.product_delivery_attempt(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_delivery_attempt(text, integer, integer) TO service_role;
COMMIT;
