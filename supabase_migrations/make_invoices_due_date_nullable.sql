-- Ensure invoices.due_date is nullable
ALTER TABLE IF EXISTS invoices
  ALTER COLUMN due_date DROP NOT NULL;

-- Optional sanity check (run manually if needed):
-- SELECT is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'invoices' AND column_name = 'due_date';
