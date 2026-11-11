BEGIN;
-- Feature B (plan 1): a readable address, portfolia.site/product/<slug>. Customer links keep the id form.
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS digital_products_slug ON public.digital_products (lower(slug)) WHERE slug IS NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'digital_products_slug_format') THEN
    ALTER TABLE public.digital_products ADD CONSTRAINT digital_products_slug_format
      CHECK (slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');
  END IF;
END $$;
COMMIT;
