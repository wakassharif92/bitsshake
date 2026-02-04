-- Create chat_messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_ip TEXT,
  sender_location TEXT,
  message TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on document_id for faster queries
CREATE INDEX idx_chat_messages_document_id ON chat_messages(document_id);

-- Create index on created_at for sorting
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow recipients to read chat messages for their documents
CREATE POLICY "recipients_can_read_chat_messages" ON chat_messages
  FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents 
      WHERE admin_id = auth.uid()
    )
    OR
    document_id IN (
      SELECT document_id FROM recipients 
      WHERE email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policy: Allow recipients to insert chat messages
CREATE POLICY "recipients_can_insert_chat_messages" ON chat_messages
  FOR INSERT
  WITH CHECK (
    document_id IN (
      SELECT id FROM documents 
      WHERE admin_id = auth.uid()
    )
    OR
    document_id IN (
      SELECT document_id FROM recipients 
      WHERE email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policy: Admin can delete messages
CREATE POLICY "admin_can_delete_chat_messages" ON chat_messages
  FOR DELETE
  USING (
    document_id IN (
      SELECT id FROM documents 
      WHERE admin_id = auth.uid()
    )
  );
