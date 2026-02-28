// Document types
export interface Document {
  id: string;
  admin_id: string;
  invoice_id?: string | null;
  title: string;
  content: string;
  template_id?: string;
  status: "draft" | "sent" | "signed" | "completed" | "uploaded" | "revert";
  created_at: string;
  updated_at: string;
  file_name?: string;
  file_url?: string;
  is_uploaded?: boolean;
}

export interface Template {
  id: string;
  admin_id: string;
  name: string;
  content: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  admin_id: string;
  invoice_number: string;
  client_name: string;
  client_email?: string;
  sender_signer_email?: string | null;
  receiver_signer_email?: string | null;
  description?: string;
  invoice_type: "one_time" | "milestone";
  milestones?: Array<{
    item: string;
    amount: number;
    sender_signature_text?: string;
    receiver_signature_text?: string;
    sender_signature_style?: string;
    receiver_signature_style?: string;
    sender_signed_by_ip?: string;
    sender_signed_by_city?: string;
    sender_signed_by_country?: string;
    sender_signed_at?: string;
    receiver_signed_by_ip?: string;
    receiver_signed_by_city?: string;
    receiver_signed_by_country?: string;
    receiver_signed_at?: string;
  }>;
  total_amount?: number;
  amount: number;
  currency: string;
  due_date?: string | null;
  status:
    | "in_progress"
    | "draft"
    | "sent"
    | "received"
    | "completed"
    | "paid"
    | "overdue";
  created_at: string;
  updated_at: string;
}

export interface Recipient {
  id: string;
  document_id: string;
  email: string;
  name?: string;
  company_name?: string;
  position?: string;
  role: "signer" | "viewer";
  status: "pending" | "signed" | "viewed";
  signature_text?: string;
  signed_at?: string;
  signed_by_ip?: string;
  signed_by_country?: string;
  signed_by_city?: string;
  signed_by_user_agent?: string;
}

export interface AuditLog {
  id: string;
  document_id: string;
  action: string;
  actor_email: string;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  document_id: string;
  sender_email: string;
  sender_name: string;
  sender_ip?: string;
  sender_location?: string;
  message: string;
  attachment_url?: string;
  attachment_name?: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  role: "admin" | "user";
  created_at: string;
  trial_start_at?: string | null;
  trial_end_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  current_period_end?: string | null;
  plan_interval?: "monthly" | "annual" | null;
  cancel_at_period_end?: boolean | null;
  cancel_at?: string | null;
}
