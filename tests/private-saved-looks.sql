-- Run only against the disposable fixture database. Changes roll back.
BEGIN;
INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000516'),('00000000-0000-0000-0000-000000000517');
INSERT INTO public.portfolios(code,owner_id,status,data) VALUES
 ('__looks_own','00000000-0000-0000-0000-000000000516','draft','{}'),
 ('__looks_own_second','00000000-0000-0000-0000-000000000516','draft','{}'),
 ('__looks_other','00000000-0000-0000-0000-000000000517','draft','{}');
INSERT INTO auth.mfa_factors(user_id,status) VALUES ('00000000-0000-0000-0000-000000000516','verified');
SELECT set_config('request.jwt.claims','{"aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000516',true);
INSERT INTO public.portfolio_saved_looks(portfolio_code,owner_id,looks) VALUES ('__looks_own','00000000-0000-0000-0000-000000000516','[{"id":"one","name":"Private name","viewer":{"studioLighting":"4"}}]');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.portfolio_saved_looks) <> 1 THEN RAISE EXCEPTION 'Owner cannot read own looks'; END IF;
 BEGIN
  INSERT INTO public.portfolio_saved_looks(portfolio_code,owner_id) VALUES ('__looks_other','00000000-0000-0000-0000-000000000516');
  RAISE EXCEPTION 'Claimed another owner portfolio';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.portfolio_saved_looks SET looks=(SELECT jsonb_agg('{}'::jsonb) FROM generate_series(1,21)) WHERE portfolio_code='__looks_own';
  RAISE EXCEPTION 'Exceeded 20-look allowance';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000517',true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.portfolio_saved_looks) THEN RAISE EXCEPTION 'Other account read private looks'; END IF;
 UPDATE public.portfolio_saved_looks SET looks='[]' WHERE portfolio_code='__looks_own';
 IF FOUND THEN RAISE EXCEPTION 'Other account changed private looks'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000516',true);
SELECT set_config('request.jwt.claims','{"aal":"aal1"}',true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.portfolio_saved_looks) THEN RAISE EXCEPTION 'Incomplete MFA read private looks'; END IF;
 BEGIN
  INSERT INTO public.portfolio_saved_looks(portfolio_code,owner_id) VALUES ('__looks_own_second','00000000-0000-0000-0000-000000000516');
  RAISE EXCEPTION 'Incomplete MFA saved looks';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  PERFORM 1 FROM public.portfolio_saved_looks;
  RAISE EXCEPTION 'Anonymous access to private looks';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DELETE FROM public.portfolios WHERE code='__looks_own';
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.portfolio_saved_looks WHERE portfolio_code='__looks_own') THEN RAISE EXCEPTION 'Deleted portfolio left an orphaned library'; END IF;
END $$;
ROLLBACK;
