ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trial_start_at timestamp,
  ADD COLUMN IF NOT EXISTS trial_end_at timestamp;
