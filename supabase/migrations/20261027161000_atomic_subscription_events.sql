BEGIN;
-- Only verified server webhooks may apply snapshots. ON CONFLICT locks the row,
-- so timestamp comparison and mutation remain atomic under concurrent delivery.
CREATE OR REPLACE FUNCTION public.apply_subscription_event(snapshot jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE incoming public.subscriptions;
BEGIN
  incoming := jsonb_populate_record(NULL::public.subscriptions, snapshot);
  IF incoming.updated_at IS NULL OR incoming.environment NOT IN ('live','sandbox') THEN
    RAISE EXCEPTION 'Invalid subscription event';
  END IF;
  INSERT INTO public.subscriptions AS existing
    (user_id, paddle_subscription_id, paddle_customer_id, product_id, price_id,
     status, current_period_start, current_period_end, cancel_at_period_end, environment, updated_at)
  VALUES (incoming.user_id, incoming.paddle_subscription_id, incoming.paddle_customer_id,
    incoming.product_id, incoming.price_id, incoming.status, incoming.current_period_start,
    incoming.current_period_end, incoming.cancel_at_period_end, incoming.environment, incoming.updated_at)
  ON CONFLICT (paddle_subscription_id) DO UPDATE SET
    paddle_customer_id = EXCLUDED.paddle_customer_id,
    product_id = EXCLUDED.product_id, price_id = EXCLUDED.price_id,
    status = EXCLUDED.status, current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end, updated_at = EXCLUDED.updated_at
  WHERE existing.environment = EXCLUDED.environment AND existing.user_id = EXCLUDED.user_id
    AND (existing.updated_at IS NULL OR EXCLUDED.updated_at > existing.updated_at
      OR (EXCLUDED.updated_at = existing.updated_at AND EXCLUDED.status = 'canceled' AND existing.status <> 'canceled'));
  IF EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.paddle_subscription_id = incoming.paddle_subscription_id
    AND (s.environment <> incoming.environment OR s.user_id <> incoming.user_id)) THEN
    RAISE EXCEPTION 'Subscription identity mismatch';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_subscription_event(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_event(jsonb) TO service_role;
COMMIT;
