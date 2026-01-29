import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

interface UpdateStatusRequest {
  documentId: string;
  status: "completed";
}

interface UpdateStatusResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateStatusResponse>,
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { documentId, status } = req.body as UpdateStatusRequest;

    if (!documentId || !status) {
      return res
        .status(400)
        .json({ success: false, error: "Missing documentId or status" });
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res
        .status(500)
        .json({ success: false, error: "Supabase configuration missing" });
    }

    // Use service role key to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
    );

    // Update document status
    const { error } = await supabaseAdmin
      .from("documents")
      .update({
        status: status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (error) {
      console.error("Error updating document status:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to update document status",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Document status updated successfully",
    });
  } catch (error: any) {
    console.error("Error in update-document-status:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}
