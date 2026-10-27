-- Reader insights: what happens inside a published portfolio once it is open. Which pages are read and for how
-- long, which links, hotspots and videos are pressed, and the reader's device type, country and the site they came
-- from. Written only by the server (recordReading), read only by the server for the owner (readingInsights), so
-- the table has row level security on and no policies. No IP address or personal detail is stored.

CREATE TABLE IF NOT EXISTS public.portfolio_reads (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  portfolio_code text NOT NULL REFERENCES public.portfolios(code) ON DELETE CASCADE,
  visitor text CHECK (char_length(visitor) <= 64),
  kind text NOT NULL CHECK (kind IN ('page', 'time', 'click', 'play')),
  page integer CHECK (page BETWEEN 1 AND 10000),
  target text CHECK (char_length(target) <= 120),
  seconds integer CHECK (seconds BETWEEN 0 AND 600),
  device text CHECK (device IN ('phone', 'tablet', 'desktop')),
  country text CHECK (char_length(country) <= 2),
  source text CHECK (char_length(source) <= 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_reads_code_time ON public.portfolio_reads (portfolio_code, created_at DESC);

ALTER TABLE public.portfolio_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portfolio_reads FROM anon, authenticated;
