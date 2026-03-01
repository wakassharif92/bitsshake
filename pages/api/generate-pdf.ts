import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { generateDocumentPDF } from "@/lib/pdf";

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

    // Fetch document
    const { data: document, error: docError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    }

    // Fetch recipients
    const { data: recipients, error: recipientsError } = await supabaseAdmin
      .from("recipients")
      .select("*")
      .eq("document_id", documentId);

    if (recipientsError || !recipients) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch recipients" });
    }

    // Fetch audit logs
    const { data: auditLogs, error: logsError } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("document_id", documentId)
      .order("timestamp", { ascending: false });

    if (logsError || !auditLogs) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch audit logs" });
    }

    // Fetch chat signature messages
    const { data: chatMessages, error: chatError } = await supabaseAdmin
      .from("chat_messages")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false });

    if (chatError) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch chat messages" });
    }

    const chatSignatures = (chatMessages || []).filter((m: any) =>
      m.message?.startsWith("[SIGNATURE]"),
    );

    // Fetch attached invoices
    const { data: attachedRows, error: attachedRowsError } = await supabaseAdmin
      .from("document_invoices")
      .select("invoice_id")
      .eq("document_id", documentId);

    if (attachedRowsError) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch attached invoices" });
    }

    const invoiceIds = (attachedRows || [])
      .map((row: any) => row.invoice_id)
      .filter(Boolean);

    let attachedInvoices: any[] = [];
    if (invoiceIds.length > 0) {
      const { data: invoicesData, error: invoicesError } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .in("id", invoiceIds);

      if (invoicesError) {
        return res
          .status(500)
          .json({ success: false, error: "Failed to fetch invoice details" });
      }

      attachedInvoices = invoicesData || [];
    }

    // Generate PDF
    const pdf = await generateDocumentPDF(
      document,
      recipients,
      auditLogs,
      chatSignatures,
      attachedInvoices,
    );
    const pdfBytes = pdf.output("arraybuffer");

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${document.title.replace(/\s+/g, "_")}.pdf"`,
    );

    res.status(200).send(Buffer.from(pdfBytes));
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
}
