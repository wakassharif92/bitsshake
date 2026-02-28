CREATE TABLE IF NOT EXISTS document_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  UNIQUE(document_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_document_invoices_document_id ON document_invoices(document_id);
CREATE INDEX IF NOT EXISTS idx_document_invoices_invoice_id ON document_invoices(invoice_id);

ALTER TABLE document_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view document invoices for their documents" ON document_invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_id
      AND documents.admin_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert document invoices for their documents" ON document_invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_id
      AND documents.admin_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete document invoices for their documents" ON document_invoices
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_id
      AND documents.admin_id = auth.uid()
    )
  );
