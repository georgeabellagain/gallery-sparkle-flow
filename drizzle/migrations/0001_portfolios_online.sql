CREATE TABLE public.portfolios (
  code text PRIMARY KEY,
  owner_id uuid NOT NULL,
  username text UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  search_indexing boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolios_owner_idx ON public.portfolios(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolios TO authenticated;
GRANT SELECT ON public.portfolios TO anon;
GRANT ALL ON public.portfolios TO service_role;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage portfolios" ON public.portfolios FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Anyone reads published portfolios" ON public.portfolios FOR SELECT TO anon, authenticated USING (status = 'published');

CREATE TABLE public.portfolio_domains (
  name text PRIMARY KEY,
  owner_id uuid NOT NULL,
  portfolio_code text NOT NULL REFERENCES public.portfolios(code) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'owned',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_domains TO authenticated;
GRANT ALL ON public.portfolio_domains TO service_role;
ALTER TABLE public.portfolio_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage domains" ON public.portfolio_domains FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.portfolio_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  portfolio_code text NOT NULL REFERENCES public.portfolios(code) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('visit','download')),
  visitor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolio_events_code_idx ON public.portfolio_events(portfolio_code);
GRANT SELECT, INSERT ON public.portfolio_events TO authenticated;
GRANT INSERT ON public.portfolio_events TO anon;
GRANT ALL ON public.portfolio_events TO service_role;
ALTER TABLE public.portfolio_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone records events on published portfolios" ON public.portfolio_events FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.portfolios p WHERE p.code = portfolio_code AND p.status = 'published'));
CREATE POLICY "Owners read their events" ON public.portfolio_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.portfolios p WHERE p.code = portfolio_code AND p.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.name_available(_username text, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.portfolios WHERE username = lower(_username) AND code <> _code);
$$;
CREATE OR REPLACE FUNCTION public.domain_available(_name text, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.portfolio_domains WHERE name = lower(_name) AND portfolio_code <> _code);
$$;
GRANT EXECUTE ON FUNCTION public.name_available(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.domain_available(text, text) TO anon, authenticated;

CREATE POLICY "Owners read own files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'portfolio-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners upload own files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'portfolio-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners update own files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'portfolio-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners delete own files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'portfolio-files' AND (storage.foldername(name))[1] = auth.uid()::text);