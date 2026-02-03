import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

interface SignerSummary {
  id: string;
  name: string | null;
  email: string;
  signature_text: string | null;
  signed_at: string | null;
  role: string;
  status: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SignerSummary[] | { error: string }>,
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

    const { data: signers, error } = await supabaseAdmin
      .from("recipients")
      .select("id,name,email,signature_text,signed_at,role,status")
      .eq("document_id", documentId)
      .eq("role", "signer")
      .order("created_at", { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(signers || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
