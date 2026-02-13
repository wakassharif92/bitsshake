ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id varchar(255),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar(255),
  ADD COLUMN IF NOT EXISTS subscription_status varchar(50),
  ADD COLUMN IF NOT EXISTS current_period_end timestamp,
  ADD COLUMN IF NOT EXISTS plan_interval varchar(20);
