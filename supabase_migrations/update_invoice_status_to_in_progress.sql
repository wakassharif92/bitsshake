-- Replace invoice status default from draft to in_progress
ALTER TABLE IF EXISTS invoices
  ALTER COLUMN status SET DEFAULT 'in_progress';

-- Migrate existing draft invoices
UPDATE invoices
SET status = 'in_progress'
WHERE status = 'draft';
