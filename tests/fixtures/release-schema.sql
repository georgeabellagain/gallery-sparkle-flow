-- Minimal isolated schema for migration regression tests; never run against production.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.subscriptions (
  id uuid DEFAULT gen_random_uuid(), created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL, paddle_subscription_id text UNIQUE NOT NULL,
  paddle_customer_id text NOT NULL, product_id text NOT NULL, price_id text NOT NULL,
  status text NOT NULL, current_period_start timestamptz, current_period_end timestamptz,
  cancel_at_period_end boolean, environment text NOT NULL, updated_at timestamptz
);
CREATE TABLE public.portfolios (code text PRIMARY KEY, owner_id uuid, status text, data jsonb);
