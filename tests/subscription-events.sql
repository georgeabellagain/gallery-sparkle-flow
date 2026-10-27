-- Run after migrations against a disposable staging database. All changes roll back.
BEGIN;
DO $$
DECLARE snapshot jsonb := '{"user_id":"00000000-0000-0000-0000-000000000316","paddle_subscription_id":"__pf_atomic_test","paddle_customer_id":"test","product_id":"test","price_id":"personal_monthly","environment":"live","status":"canceled","cancel_at_period_end":false,"updated_at":"2026-10-27T12:00:00Z","current_period_end":"2026-10-27T12:00:00Z"}';
BEGIN
  PERFORM public.apply_subscription_event(snapshot);
  IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE paddle_subscription_id='__pf_atomic_test' AND status='canceled') THEN
    RAISE EXCEPTION 'Cancellation-first was lost';
  END IF;
  PERFORM public.apply_subscription_event(snapshot);
  PERFORM public.apply_subscription_event(snapshot || '{"status":"active","updated_at":"2026-10-26T12:00:00Z"}'::jsonb);
  PERFORM public.apply_subscription_event(snapshot || '{"status":"active"}'::jsonb);
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE paddle_subscription_id='__pf_atomic_test' AND status <> 'canceled') THEN
    RAISE EXCEPTION 'Old or tied event revived cancellation';
  END IF;
  PERFORM public.apply_subscription_event(snapshot || '{"status":"active","updated_at":"2026-10-28T12:00:00Z"}'::jsonb);
  IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE paddle_subscription_id='__pf_atomic_test' AND status='active') THEN
    RAISE EXCEPTION 'Newer state was ignored';
  END IF;
  BEGIN
    PERFORM public.apply_subscription_event(snapshot || '{"environment":"sandbox"}'::jsonb);
    RAISE EXCEPTION 'Environment mismatch accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Subscription identity mismatch' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;
