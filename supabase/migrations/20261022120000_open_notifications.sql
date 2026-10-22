BEGIN;
-- "Someone opened your portfolio" emails (Personal, opt-in). One row per portfolio holds when the last email
-- went out and the opens since then, so the server can keep to one email every few hours and a few a day.
-- No IP address or visitor detail is stored here.
CREATE TABLE IF NOT EXISTS public.portfolio_open_notifications (
  portfolio_code text PRIMARY KEY REFERENCES public.portfolios(code) ON DELETE CASCADE,
  last_sent_at timestamptz,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  sent_today integer NOT NULL DEFAULT 0,
  pending integer NOT NULL DEFAULT 0
);
ALTER TABLE public.portfolio_open_notifications ENABLE ROW LEVEL SECURITY;
-- No policies: only the server (service role) reads or writes it.
REVOKE ALL ON public.portfolio_open_notifications FROM PUBLIC, anon, authenticated;

-- Counts an open and says whether an email may go now. Locked per portfolio, so two opens at once never send two.
-- `opens` is this open plus any counted since the last email.
CREATE OR REPLACE FUNCTION public.claim_open_notification(p_code text, p_gap interval, p_daily integer)
RETURNS TABLE(send boolean, opens integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.portfolio_open_notifications;
  today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  INSERT INTO public.portfolio_open_notifications (portfolio_code) VALUES (p_code) ON CONFLICT DO NOTHING;
  SELECT * INTO r FROM public.portfolio_open_notifications WHERE portfolio_code = p_code FOR UPDATE;
  IF r.day <> today THEN r.day := today; r.sent_today := 0; END IF;
  IF (r.last_sent_at IS NULL OR r.last_sent_at <= now() - p_gap) AND r.sent_today < p_daily THEN
    UPDATE public.portfolio_open_notifications
      SET last_sent_at = now(), day = r.day, sent_today = r.sent_today + 1, pending = 0
      WHERE portfolio_code = p_code;
    RETURN QUERY SELECT true, r.pending + 1;
  ELSE
    UPDATE public.portfolio_open_notifications
      SET day = r.day, sent_today = r.sent_today, pending = r.pending + 1
      WHERE portfolio_code = p_code;
    RETURN QUERY SELECT false, r.pending + 1;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_open_notification(text, interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_open_notification(text, interval, integer) TO service_role;
COMMIT;
