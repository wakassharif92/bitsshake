import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

interface RevertDocumentRequest {
  documentId: string;
  actorEmail: string;
  actorName?: string;
  reason: string;
}

interface RevertDocumentResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RevertDocumentResponse>,
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { documentId, actorEmail, actorName, reason } =
      req.body as RevertDocumentRequest;

    if (!documentId || !actorEmail || !reason?.trim()) {
      return res.status(400).json({
        success: false,
        error: "Missing documentId, actorEmail, or reason",
      });
    }

    const normalizedActorEmail = actorEmail.trim().toLowerCase();
    const normalizedReason = reason.trim();

    const { data: document, error: documentError } = await supabaseAdmin
      .from("documents")
      .select("id,admin_id,status")
      .eq("id", documentId)
      .single();

    if (documentError || !document) {
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    }

    if (document.status !== "sent") {
      return res.status(400).json({
        success: false,
        error: "Only sent documents can be reverted",
      });
    }

    const adminResult = await supabaseAdmin.auth.admin.getUserById(
      document.admin_id as string,
    );
    const adminEmail = adminResult.data.user?.email?.trim().toLowerCase() || "";
    const isAdmin = !!adminEmail && adminEmail === normalizedActorEmail;

    const { data: signerRecipient } = await supabaseAdmin
      .from("recipients")
      .select("id")
      .eq("document_id", documentId)
      .ilike("email", normalizedActorEmail)
      .eq("role", "signer")
      .single();

    const isSigner = !!signerRecipient;

    if (!isAdmin && !isSigner) {
      return res.status(403).json({
        success: false,
        error: "Only admin or signer can revert this document",
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("documents")
      .update({
        status: "revert",
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: updateError.message || "Failed to revert document",
      });
    }

    await supabaseAdmin.from("audit_logs").insert([
      {
        document_id: documentId,
        action: "DOCUMENT_REVERTED",
        actor_email: normalizedActorEmail,
        details: {
          reason: normalizedReason,
          reverted_by_role: isAdmin ? "admin" : "signer",
        },
      },
    ]);

    await supabaseAdmin.from("chat_messages").insert([
      {
        document_id: documentId,
        sender_email: normalizedActorEmail,
        sender_name:
          actorName?.trim() || (isAdmin ? "Admin" : "Signer"),
        sender_ip: "Unknown",
        sender_location: "Unknown",
        message: `[REVERT] ${normalizedReason}`,
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Document reverted successfully",
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
}
