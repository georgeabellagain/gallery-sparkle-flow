-- Isolated CI stand-ins for Supabase identity/MFA helpers; never run in production.
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE TABLE auth.mfa_factors (user_id uuid, status text);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON public.portfolios TO authenticated;
