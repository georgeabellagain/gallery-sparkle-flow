BEGIN;
CREATE OR REPLACE FUNCTION public.validate_portfolio_premium_appearance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE choice jsonb; view_data jsonb;
BEGIN
  -- Existing choices may still be read; newly saved settings require entitlement.
  IF TG_OP = 'UPDATE' AND NEW.data->'viewer' IS NOT DISTINCT FROM OLD.data->'viewer' THEN RETURN NEW; END IF;
  IF public.portfolio_owner_has_personal(NEW.owner_id) THEN RETURN NEW; END IF;
  view_data := NEW.data->'viewer';
  IF view_data->>'studioLighting' IS NOT NULL AND view_data->>'studioLighting' NOT IN ('1','2','3','4') THEN
    RAISE EXCEPTION 'Personal is required to save this HDRI. Choose lighting 1–4 or upgrade.' USING ERRCODE='42501';
  END IF;
  FOR choice IN SELECT value FROM jsonb_each(COALESCE(NULLIF(view_data->'backgrounds','null'::jsonb),'{}'::jsonb)) UNION ALL SELECT view_data LOOP
    IF NULLIF(choice->>'backgroundKey','') IS NOT NULL OR
      (choice->>'backgroundPreset' IS NOT NULL AND choice->>'backgroundPreset' NOT IN ('wood_floor','concrete_floor_02')) THEN
      RAISE EXCEPTION 'Personal is required to save this background. Choose Warm wood, Soft concrete or a colour.' USING ERRCODE='42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_portfolio_premium_appearance() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS portfolio_premium_appearance_guard ON public.portfolios;
CREATE TRIGGER portfolio_premium_appearance_guard BEFORE INSERT OR UPDATE OF data, owner_id ON public.portfolios
FOR EACH ROW EXECUTE FUNCTION public.validate_portfolio_premium_appearance();
COMMIT;
