CREATE OR REPLACE FUNCTION public.validate_portfolio_plan_limits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  is_personal boolean;
  existing integer;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN RETURN NEW; END IF;
  is_personal := public.portfolio_owner_has_personal(NEW.owner_id);
  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO existing FROM public.portfolios p WHERE p.owner_id = NEW.owner_id;
    IF existing >= (CASE WHEN is_personal THEN 10 ELSE 1 END) THEN
      RAISE EXCEPTION 'Portfolio limit reached for this plan.' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.username IS NOT NULL AND NOT is_personal AND (TG_OP = 'INSERT' OR NEW.username IS DISTINCT FROM OLD.username) THEN
    RAISE EXCEPTION 'Personal is required to claim a personalised address.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS portfolio_plan_limits_guard ON public.portfolios;

CREATE TRIGGER portfolio_plan_limits_guard BEFORE INSERT OR UPDATE ON public.portfolios
FOR EACH ROW EXECUTE FUNCTION public.validate_portfolio_plan_limits();