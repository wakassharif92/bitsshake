-- Create config table
CREATE TABLE config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default config values
INSERT INTO config (key, value, description) VALUES
  ('showlocation', 'true'::jsonb, 'Show IP address and location in discussion and audit logs');

-- Enable RLS
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read access to config (settings are public)
CREATE POLICY "public_can_read_config" ON config
  FOR SELECT
  USING (true);

-- RLS Policy: Only admins can update config
CREATE POLICY "admin_can_update_config" ON config
  FOR UPDATE
  USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM users WHERE role = 'admin'
    )
  );

-- Create index on key for faster lookups
CREATE INDEX idx_config_key ON config(key);
