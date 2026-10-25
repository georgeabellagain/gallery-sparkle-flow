-- Two-step sign-in: an account with a verified authenticator must finish its code step (aal2) before it can
-- read or change its portfolios or files. Accounts without two-step sign-in are unaffected. These restrictive
-- policies sit on top of the existing ones, so they only ever take access away.

CREATE OR REPLACE FUNCTION public.mfa_satisfied()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    OR NOT EXISTS (
      SELECT 1 FROM auth.mfa_factors
      WHERE user_id = auth.uid() AND status = 'verified'
    );
$$;

REVOKE ALL ON FUNCTION public.mfa_satisfied() FROM public;
GRANT EXECUTE ON FUNCTION public.mfa_satisfied() TO authenticated;

DROP POLICY IF EXISTS "Two-step sign-in finished" ON public.portfolios;
CREATE POLICY "Two-step sign-in finished" ON public.portfolios AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (public.mfa_satisfied())
  WITH CHECK (public.mfa_satisfied());

DROP POLICY IF EXISTS "Two-step sign-in finished insert" ON storage.objects;
CREATE POLICY "Two-step sign-in finished insert" ON storage.objects AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'portfolio-files' OR public.mfa_satisfied());

DROP POLICY IF EXISTS "Two-step sign-in finished update" ON storage.objects;
CREATE POLICY "Two-step sign-in finished update" ON storage.objects AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (bucket_id <> 'portfolio-files' OR public.mfa_satisfied())
  WITH CHECK (bucket_id <> 'portfolio-files' OR public.mfa_satisfied());

DROP POLICY IF EXISTS "Two-step sign-in finished delete" ON storage.objects;
CREATE POLICY "Two-step sign-in finished delete" ON storage.objects AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (bucket_id <> 'portfolio-files' OR public.mfa_satisfied());

DROP POLICY IF EXISTS "Two-step sign-in finished select" ON storage.objects;
CREATE POLICY "Two-step sign-in finished select" ON storage.objects AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (bucket_id <> 'portfolio-files' OR public.mfa_satisfied());
