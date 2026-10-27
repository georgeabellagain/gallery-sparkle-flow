BEGIN;
INSERT INTO public.portfolios(code, owner_id, status, data) VALUES ('__pf_premium_test','00000000-0000-0000-0000-000000000216','draft','{"plan":"personal","profile":{},"viewer":{"studioLighting":"4","backgroundPreset":"wood_floor"}}');
UPDATE public.portfolios SET data=jsonb_set(data,'{viewer,backgroundPreset}','"scene:sorbet"') WHERE code='__pf_premium_test';
UPDATE public.portfolios SET data=jsonb_set(data,'{viewer,backgroundPreset}','"scene:aurora"') WHERE code='__pf_premium_test';
DO $$ BEGIN
  BEGIN
    UPDATE public.portfolios SET data=jsonb_set(data,'{viewer,studioLighting}','"15"') WHERE code='__pf_premium_test';
    RAISE EXCEPTION 'Forged client plan saved premium HDRI';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.portfolios SET data=jsonb_set(data,'{viewer,backgrounds}','{"scroll":{"backgroundPreset":"denim_fabric_03"}}') WHERE code='__pf_premium_test';
    RAISE EXCEPTION 'Per-view background bypassed entitlement';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.portfolios SET data=jsonb_set(data,'{viewer,backgroundKey}','"uploaded_bg"') WHERE code='__pf_premium_test';
    RAISE EXCEPTION 'Uploaded background bypassed entitlement';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
INSERT INTO public.subscriptions(user_id,paddle_subscription_id,paddle_customer_id,product_id,price_id,status,environment) VALUES ('00000000-0000-0000-0000-000000000216','__pf_premium_test_sub','test','test','personal_yearly','active','live');
UPDATE public.portfolios SET data=jsonb_set(data,'{viewer,studioLighting}','"15"') WHERE code='__pf_premium_test';
UPDATE public.portfolios SET data=jsonb_set(data,'{viewer,backgroundPreset}','"marble_tiles"') WHERE code='__pf_premium_test';
ROLLBACK;
