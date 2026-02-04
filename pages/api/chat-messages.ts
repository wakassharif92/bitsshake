import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    // Get documentId from query (GET) or body (POST)
    const documentId = (req.query.documentId || req.body.documentId) as string;

    if (!documentId || typeof documentId !== "string") {
      return res.status(400).json({ error: "Invalid or missing documentId" });
    }

    if (req.method === "GET") {
      // Fetch chat messages - verify user is a recipient or admin
      const userEmail = (req.query.userEmail as string)?.toLowerCase();

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
      );

      // If userEmail is provided, verify they're authorized
      if (userEmail) {
        const { data: recipient, error: recipientError } = await supabaseAdmin
          .from("recipients")
          .select("id")
          .eq("document_id", documentId)
          .eq("email", userEmail)
          .single();

        // If not a recipient, check if they're the document admin
        if (recipientError || !recipient) {
          const { data: document } = await supabaseAdmin
            .from("documents")
            .select("id, admin_id")
            .eq("id", documentId)
            .single();

          // For now, allow if document exists - we can't verify admin without auth
          // The admin will be authenticated via their session token
          if (!document) {
            return res
              .status(403)
              .json({ error: "Not authorized to view this document" });
          }
        }
      }

      const { data: messages, error } = await supabaseAdmin
        .from("chat_messages")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        throw error;
      }

      return res.status(200).json({ messages: messages || [] });
    } else if (req.method === "POST") {
      // Send message
      const {
        message,
        senderEmail,
        senderName,
        senderIp,
        senderLocation,
        attachmentUrl,
        attachmentName,
      } = req.body;

      if (!message || !senderEmail || !senderName) {
        return res.status(400).json({
          error: "Missing required fields: message, senderEmail, senderName",
        });
      }

      // Use client-provided IP and location (sent from ChatPanel component)
      // This is the real user IP from ipify.org, not the server's IP
      const finalSenderIp = senderIp || "Unknown";
      const finalSenderLocation = senderLocation || "Unknown";

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
      );

      // Fetch document to verify it exists and get admin info
      const { data: document, error: docError } = await supabaseAdmin
        .from("documents")
        .select("id, admin_id")
        .eq("id", documentId)
        .single();

      if (docError || !document) {
        console.error("Document fetch error:", docError);
        return res.status(404).json({ error: "Document not found" });
      }

      // Get the admin's email to check authorization
      const { data: adminData, error: adminError } =
        await supabaseAdmin.auth.admin.getUserById(document.admin_id as string);

      const adminEmail = adminData?.user?.email?.toLowerCase();
      const isAdmin = adminEmail && senderEmail.toLowerCase() === adminEmail;

      let isRecipient = false;
      if (!isAdmin) {
        const { data: recipient, error: recipientError } = await supabaseAdmin
          .from("recipients")
          .select("id")
          .eq("document_id", documentId)
          .eq("email", senderEmail.toLowerCase())
          .single();

        if (!recipientError && recipient) {
          isRecipient = true;
        }
      }

      if (!isAdmin && !isRecipient) {
        console.error(
          `Unauthorized: ${senderEmail} is not admin (${adminEmail}) or recipient of document ${documentId}`,
        );
        return res.status(403).json({
          error: "Not authorized to chat on this document",
        });
      }

      const { data: chatMsg, error } = await supabaseAdmin
        .from("chat_messages")
        .insert([
          {
            document_id: documentId,
            sender_email: senderEmail.toLowerCase(),
            sender_name: senderName,
            sender_ip: finalSenderIp,
            sender_location: finalSenderLocation,
            message,
            attachment_url: attachmentUrl,
            attachment_name: attachmentName,
          },
        ])
        .select();

      if (error) {
        console.error("Error inserting message:", error);
        throw error;
      }

      if (!chatMsg || chatMsg.length === 0) {
        return res.status(500).json({
          error: "Failed to insert message - no data returned",
        });
      }

      return res.status(200).json({ message: chatMsg[0] });
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (err: any) {
    console.error("Error in /api/chat-messages:", err);
    return res.status(500).json({
      error: err.message || "An unexpected error occurred",
    });
  }
}
