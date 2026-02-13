-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email varchar(255) UNIQUE NOT NULL,
  full_name varchar(255),
  company_name varchar(255),
  role varchar(50) DEFAULT 'user',
  trial_start_at timestamp,
  trial_end_at timestamp,
  stripe_customer_id varchar(255),
  stripe_subscription_id varchar(255),
  subscription_status varchar(50),
  current_period_end timestamp,
  plan_interval varchar(20),
  cancel_at_period_end boolean DEFAULT false,
  cancel_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  content text,
  created_at timestamp DEFAULT now()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  content text,
  template_id uuid REFERENCES templates(id),
  status varchar(50) DEFAULT 'draft',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create recipients table
CREATE TABLE IF NOT EXISTS recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  email varchar(255) NOT NULL,
  name varchar(255),
  company_name varchar(255),
  role varchar(50) NOT NULL,
  status varchar(50) DEFAULT 'pending',
  signature_text text,
  signed_at timestamp,
  signed_by_ip varchar(45),
  signed_by_country varchar(100),
  signed_by_city varchar(100),
  signed_by_user_agent text,
  created_at timestamp DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  action varchar(255) NOT NULL,
  actor_email varchar(255),
  timestamp timestamp DEFAULT now(),
  ip_address varchar(45),
  user_agent text,
  details jsonb
);

-- Create indexes for performance
CREATE INDEX idx_templates_admin_id ON templates(admin_id);
CREATE INDEX idx_documents_admin_id ON documents(admin_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_recipients_document_id ON recipients(document_id);
CREATE INDEX idx_recipients_email ON recipients(email);
CREATE INDEX idx_audit_logs_document_id ON audit_logs(document_id);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for users table
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Policies for templates table
CREATE POLICY "Users can view their own templates" ON templates
  FOR SELECT USING (admin_id = auth.uid());

CREATE POLICY "Users can insert templates" ON templates
  FOR INSERT WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Users can update their own templates" ON templates
  FOR UPDATE USING (admin_id = auth.uid());

CREATE POLICY "Users can delete their own templates" ON templates
  FOR DELETE USING (admin_id = auth.uid());

-- Policies for documents table
CREATE POLICY "Users can view their own documents" ON documents
  FOR SELECT USING (admin_id = auth.uid());

CREATE POLICY "Users can insert documents" ON documents
  FOR INSERT WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Users can update their own documents" ON documents
  FOR UPDATE USING (admin_id = auth.uid());

CREATE POLICY "Users can delete their own documents" ON documents
  FOR DELETE USING (admin_id = auth.uid());

-- Policies for recipients table
CREATE POLICY "Admins can view recipients of their documents" ON recipients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = recipients.document_id
      AND documents.admin_id = auth.uid()
    )
  );

CREATE POLICY "Recipients can view documents with their email" ON recipients
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can insert recipients" ON recipients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_id
      AND documents.admin_id = auth.uid()
    )
  );

CREATE POLICY "Recipients can update their signature" ON recipients
  FOR UPDATE USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can delete recipients from their documents" ON recipients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = recipients.document_id
      AND documents.admin_id = auth.uid()
    )
  );

-- Policies for audit_logs table
CREATE POLICY "Users can view audit logs of their documents" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = audit_logs.document_id
      AND documents.admin_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_id
      AND documents.admin_id = auth.uid()
    )
  );
