BEGIN;
-- Lead capture (Personal): the details readers choose to leave in a portfolio's lead form. Written only by the
-- server after it checks the portfolio is published, its form is switched on and its owner has Personal; read only
-- by the server for that portfolio's owner. The visitor's IP address is never stored.
CREATE TABLE IF NOT EXISTS public.portfolio_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_code text NOT NULL REFERENCES public.portfolios(code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  name text CHECK (char_length(name) <= 120),
  email text NOT NULL CHECK (char_length(email) <= 254),
  phone text CHECK (char_length(phone) <= 40),
  company text CHECK (char_length(company) <= 120),
  message text CHECK (char_length(message) <= 2000),
  page integer,
  country text CHECK (char_length(country) <= 2)
);
CREATE INDEX IF NOT EXISTS portfolio_leads_code_created ON public.portfolio_leads (portfolio_code, created_at DESC);
ALTER TABLE public.portfolio_leads ENABLE ROW LEVEL SECURITY;
-- No policies: only the server (service role) reads or writes it.
REVOKE ALL ON public.portfolio_leads FROM PUBLIC, anon, authenticated;
COMMIT;
