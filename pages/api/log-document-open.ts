import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; error?: string }>,
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const {
      documentId,
      actorEmail,
      ip,
      userAgent,
      location,
      source,
      clientTime,
      timeZone,
    } = req.body || {};

    if (!documentId || typeof documentId !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Missing documentId" });
    }

    if (!actorEmail || typeof actorEmail !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Missing actorEmail" });
    }

    const normalizedEmail = actorEmail.trim().toLowerCase();

    const { data: document, error: documentError } = await supabaseAdmin
      .from("documents")
      .select("id,admin_id")
      .eq("id", documentId)
      .single();

    if (documentError || !document) {
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    }

    const { data: recipient } = await supabaseAdmin
      .from("recipients")
      .select("id,email")
      .eq("document_id", documentId)
      .ilike("email", normalizedEmail)
      .single();

    let isAdminEmail = false;
    const { data: adminUser } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", document.admin_id)
      .single();

    if (adminUser?.email) {
      isAdminEmail = adminUser.email.toLowerCase() === normalizedEmail;
    }

    if (!recipient && !isAdminEmail) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    const { error: insertError } = await supabaseAdmin
      .from("audit_logs")
      .insert([
        {
          document_id: documentId,
          action: "DOCUMENT_OPENED",
          actor_email: actorEmail,
          ip_address: ip,
          user_agent: userAgent,
          details: {
            location: location || "Unknown",
            source: source || "unknown",
            client_time: clientTime || null,
            time_zone: timeZone || null,
          },
        },
      ]);

    if (insertError) {
      return res
        .status(500)
        .json({ success: false, error: insertError.message });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res
      .status(500)
      .json({ success: false, error: err.message || "Server error" });
  }
}
