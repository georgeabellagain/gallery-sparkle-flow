BEGIN;
-- Self-contained: do not assume an earlier optional MFA migration was installed.
CREATE OR REPLACE FUNCTION public.saved_looks_mfa_satisfied()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id = auth.uid() AND status = 'verified');
$$;
REVOKE ALL ON FUNCTION public.saved_looks_mfa_satisfied() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saved_looks_mfa_satisfied() TO authenticated;
-- Reusable looks are creator data, never part of the publicly readable portfolio JSON.
CREATE TABLE IF NOT EXISTS public.portfolio_saved_looks (
  portfolio_code text PRIMARY KEY REFERENCES public.portfolios(code) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  looks jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_looks_array CHECK (jsonb_typeof(looks) = 'array'),
  CONSTRAINT saved_looks_limit CHECK (jsonb_array_length(looks) <= 20)
);
ALTER TABLE public.portfolio_saved_looks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portfolio_saved_looks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_saved_looks TO authenticated;
GRANT ALL ON public.portfolio_saved_looks TO service_role;
DROP POLICY IF EXISTS "Owners manage saved looks" ON public.portfolio_saved_looks;
CREATE POLICY "Owners manage saved looks" ON public.portfolio_saved_looks
FOR ALL TO authenticated
USING (owner_id = auth.uid() AND public.saved_looks_mfa_satisfied())
WITH CHECK (owner_id = auth.uid() AND public.saved_looks_mfa_satisfied() AND EXISTS (
  SELECT 1 FROM public.portfolios p WHERE p.code = portfolio_code AND p.owner_id = auth.uid()
));
NOTIFY pgrst, 'reload schema';
COMMIT;
