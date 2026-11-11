BEGIN;
-- Feature D (plan 1): the buyer name or order number printed on a customer's download.
ALTER TABLE public.product_access_links ADD COLUMN IF NOT EXISTS stamp text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_access_links_stamp_length') THEN
    ALTER TABLE public.product_access_links ADD CONSTRAINT product_access_links_stamp_length
      CHECK (stamp IS NULL OR length(stamp) BETWEEN 1 AND 80);
  END IF;
END $$;
COMMIT;
