import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

interface PublicDocumentResponse {
  document: any;
  recipients: any[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublicDocumentResponse | { error: string }>,
) {
  try {
    const { documentId, email } = req.query;

    if (!documentId || typeof documentId !== "string") {
      return res.status(400).json({ error: "Missing documentId" });
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Missing email" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verify requester is a recipient of this document
    const { data: requester, error: requesterError } = await supabaseAdmin
      .from("recipients")
      .select("id")
      .eq("document_id", documentId)
      .ilike("email", normalizedEmail)
      .single();

    if (requesterError || !requester) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { data: document, error: documentError } = await supabaseAdmin
      .from("documents")
      .select("id,title,content,status,admin_id")
      .eq("id", documentId)
      .single();

    if (documentError || !document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const { data: recipients, error: recipientsError } = await supabaseAdmin
      .from("recipients")
      .select(
        "id,email,name,company_name,role,status,signature_text,signed_at,signed_by_city,signed_by_country,signed_by_ip",
      )
      .eq("document_id", documentId)
      .order("created_at", { ascending: false });

    if (recipientsError) {
      return res.status(500).json({ error: recipientsError.message });
    }

    return res.status(200).json({ document, recipients: recipients || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
