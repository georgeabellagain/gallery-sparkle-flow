BEGIN;
CREATE TABLE IF NOT EXISTS public.portfolio_access (
 code text PRIMARY KEY REFERENCES public.portfolios(code) ON DELETE CASCADE,
 password_hash text,
 expires_at timestamptz,
 secret text NOT NULL
);
ALTER TABLE public.portfolio_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portfolio_access FROM anon, authenticated;
GRANT ALL ON public.portfolio_access TO service_role;
CREATE OR REPLACE FUNCTION public.portfolio_is_open(portfolio_code text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT NOT EXISTS (SELECT 1 FROM public.portfolio_access a WHERE a.code = portfolio_code
 AND (a.password_hash IS NOT NULL OR (a.expires_at IS NOT NULL AND a.expires_at <= now())));
$$;
REVOKE ALL ON FUNCTION public.portfolio_is_open(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portfolio_is_open(text) TO anon, authenticated, service_role;
DROP POLICY IF EXISTS "Anyone reads published portfolios" ON public.portfolios;
CREATE POLICY "Anyone reads published portfolios" ON public.portfolios FOR SELECT TO anon, authenticated
USING (status = 'published' AND public.portfolio_is_open(code));
CREATE TABLE IF NOT EXISTS public.portfolio_unlock_limits (bucket text PRIMARY KEY, window_start timestamptz NOT NULL, attempts integer NOT NULL);
CREATE INDEX IF NOT EXISTS portfolio_unlock_limits_window ON public.portfolio_unlock_limits(window_start);
ALTER TABLE public.portfolio_unlock_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portfolio_unlock_limits FROM anon, authenticated;
GRANT ALL ON public.portfolio_unlock_limits TO service_role;
CREATE OR REPLACE FUNCTION public.portfolio_unlock_attempt(bucket_key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
 DELETE FROM public.portfolio_unlock_limits WHERE window_start < now() - interval '1 day';
 INSERT INTO public.portfolio_unlock_limits AS t VALUES (bucket_key, now(), 1)
 ON CONFLICT (bucket) DO UPDATE SET
 attempts = CASE WHEN t.window_start < now() - interval '5 minutes' THEN 1 ELSE t.attempts + 1 END,
 window_start = CASE WHEN t.window_start < now() - interval '5 minutes' THEN now() ELSE t.window_start END
 RETURNING attempts INTO n;
 RETURN n <= CASE WHEN bucket_key LIKE 'global:%' THEN 200 ELSE 20 END;
END;
$$;
REVOKE ALL ON FUNCTION public.portfolio_unlock_attempt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portfolio_unlock_attempt(text) TO service_role;
COMMIT;
