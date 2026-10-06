-- Run in an isolated SQL session. All fixtures are rolled back.
BEGIN;
INSERT INTO public.portfolios(code,owner_id,status,data) VALUES ('__pf_access_test_20261006','00000000-0000-0000-0000-000000000001','published','{"plan":"free","profile":{"name":"Access test"}}'::jsonb);
SELECT 1 / CASE WHEN public.portfolio_is_open('__pf_access_test_20261006') THEN 1 ELSE 0 END;
INSERT INTO public.portfolio_access VALUES ('__pf_access_test_20261006','salt:hash',NULL,'test-secret');
SELECT 1 / CASE WHEN NOT public.portfolio_is_open('__pf_access_test_20261006') THEN 1 ELSE 0 END;
UPDATE public.portfolio_access SET password_hash=NULL, expires_at=now()-interval '1 second' WHERE code='__pf_access_test_20261006';
SELECT 1 / CASE WHEN NOT public.portfolio_is_open('__pf_access_test_20261006') THEN 1 ELSE 0 END;
UPDATE public.portfolio_access SET expires_at=now()+interval '1 hour' WHERE code='__pf_access_test_20261006';
SELECT 1 / CASE WHEN public.portfolio_is_open('__pf_access_test_20261006') THEN 1 ELSE 0 END;
ROLLBACK;
BEGIN;
INSERT INTO public.portfolios(code,owner_id,status,data) VALUES ('__pf_access_test_20261006','00000000-0000-0000-0000-000000000001','published','{"plan":"free","profile":{"name":"Access test"}}'::jsonb);
INSERT INTO public.portfolio_access VALUES ('__pf_access_test_20261006','salt:hash',NULL,'test-secret');
SET LOCAL ROLE anon;
SELECT 1 / CASE WHEN NOT EXISTS(SELECT 1 FROM public.portfolios WHERE code='__pf_access_test_20261006') THEN 1 ELSE 0 END AS protected_row_hidden;
RESET ROLE;
ROLLBACK;
