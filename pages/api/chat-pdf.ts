import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import * as pdfUtils from "@/lib/pdf";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { documentId } = req.body;

    if (!documentId || typeof documentId !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Missing documentId" });
    }

    const { data: document, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id,title")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    }

    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("chat_messages")
      .select("sender_name,sender_email,message,created_at")
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch chat messages" });
    }

    const generateChatPDF =
      pdfUtils.generateChatPDF || (pdfUtils as any).default?.generateChatPDF;

    if (!generateChatPDF) {
      return res.status(500).json({
        success: false,
        error: "Chat PDF generator unavailable",
      });
    }

    const pdf = await generateChatPDF(document.title, messages || []);
    const pdfBytes = pdf.output("arraybuffer");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${document.title.replace(/\s+/g, "_")}_conversation.pdf"`,
    );

    res.status(200).send(Buffer.from(pdfBytes));
  } catch (error: any) {
    console.error("Error generating chat PDF:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}
