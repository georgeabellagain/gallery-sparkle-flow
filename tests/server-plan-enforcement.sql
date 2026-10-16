-- Execute after migration, in one session. Every fixture is rolled back.
BEGIN;
INSERT INTO public.subscriptions(user_id,paddle_subscription_id,paddle_customer_id,product_id,price_id,status,environment,current_period_end)
VALUES ('00000000-0000-0000-0000-000000000116','__pf_security_test_sub','test','test','personal_monthly','active','sandbox',now()+interval '1 day');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000116',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000116","role":"authenticated"}',true);
DO $$ BEGIN
  IF public.portfolio_owner_has_personal('00000000-0000-0000-0000-000000000116') THEN RAISE EXCEPTION 'sandbox granted paid access'; END IF;
END $$;
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects(bucket_id,name,metadata) VALUES ('portfolio-files','00000000-0000-0000-0000-000000000116/__pf_security_test','{"size":10485760}');
DO $$ BEGIN
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,metadata) VALUES ('portfolio-files','00000000-0000-0000-0000-000000000116/__pf_security_test_large','{"size":10485761}');
    RAISE EXCEPTION 'free oversized insert succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE storage.objects SET metadata='{"size":10485761}' WHERE name='00000000-0000-0000-0000-000000000116/__pf_security_test';
    RAISE EXCEPTION 'free oversized replacement succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,metadata) VALUES ('portfolio-files','00000000-0000-0000-0000-000000000117/__pf_security_test_wrong_owner','{"size":1}');
    RAISE EXCEPTION 'cross-owner write succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Internal Storage service finalization cannot bypass the trigger.
SET LOCAL ROLE service_role;
DO $$ BEGIN
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,metadata) VALUES ('portfolio-files','00000000-0000-0000-0000-000000000116/__pf_security_test_internal','{"size":10485761}');
    RAISE EXCEPTION 'service finalization bypassed size limit';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.subscriptions SET environment='live' WHERE paddle_subscription_id='__pf_security_test_sub';
SET LOCAL ROLE authenticated;
UPDATE storage.objects SET metadata='{"size":52428800}' WHERE name='00000000-0000-0000-0000-000000000116/__pf_security_test';
DO $$ BEGIN
  BEGIN
    UPDATE storage.objects SET metadata='{"size":52428801}' WHERE name='00000000-0000-0000-0000-000000000116/__pf_security_test';
    RAISE EXCEPTION 'paid oversized replacement succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.subscriptions SET status='canceled',current_period_end=now()-interval '1 day' WHERE paddle_subscription_id='__pf_security_test_sub';
DO $$ BEGIN
  IF public.portfolio_owner_has_personal('00000000-0000-0000-0000-000000000116') THEN RAISE EXCEPTION 'expired subscription granted access'; END IF;
END $$;
UPDATE public.subscriptions SET current_period_end=now()+interval '1 day' WHERE paddle_subscription_id='__pf_security_test_sub';
DO $$ BEGIN
  IF NOT public.portfolio_owner_has_personal('00000000-0000-0000-0000-000000000116') THEN RAISE EXCEPTION 'paid-through cancellation lost access early'; END IF;
END $$;
UPDATE public.subscriptions SET price_id='other_product' WHERE paddle_subscription_id='__pf_security_test_sub';
DO $$ BEGIN
  IF public.portfolio_owner_has_personal('00000000-0000-0000-0000-000000000116') THEN RAISE EXCEPTION 'unrelated product granted access'; END IF;
END $$;
ROLLBACK;
