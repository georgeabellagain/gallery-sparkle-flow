BEGIN;
-- Feature C (plan 1): counts per product per day. No IP addresses, cookies, visitor ids or referrers.
CREATE TABLE IF NOT EXISTS public.product_events_daily (
  product_id uuid NOT NULL REFERENCES public.digital_products(id) ON DELETE CASCADE,
  day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('preview_view','buy_click','customer_open','download')),
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, day, kind)
);
ALTER TABLE public.product_events_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_events_daily FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.product_events_daily TO service_role;

-- Adds one to today's (UTC) count. Does nothing for drafts or unknown kinds.
CREATE OR REPLACE FUNCTION public.product_event(product uuid, event_kind text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF event_kind NOT IN ('preview_view','buy_click','customer_open','download') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.digital_products WHERE id = product AND status = 'published') THEN RETURN; END IF;
  INSERT INTO public.product_events_daily (product_id, day, kind, count)
  VALUES (product, (now() AT TIME ZONE 'utc')::date, event_kind, 1)
  ON CONFLICT (product_id, day, kind) DO UPDATE SET count = public.product_events_daily.count + 1;
END; $$;
REVOKE ALL ON FUNCTION public.product_event(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_event(uuid, text) TO service_role;
COMMIT;
