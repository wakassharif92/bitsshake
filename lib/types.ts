// Document types
export interface Document {
  id: string;
  admin_id: string;
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
