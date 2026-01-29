import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase";
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
    const { data: document, error: docError } = await supabase
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
    const { data: recipients, error: recipientsError } = await supabase
      .from("recipients")
      .select("*")
      .eq("document_id", documentId);

    if (recipientsError || !recipients) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch recipients" });
    }

    // Fetch audit logs
    const { data: auditLogs, error: logsError } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("document_id", documentId)
      .order("timestamp", { ascending: false });

    if (logsError || !auditLogs) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to fetch audit logs" });
    }

    // Generate PDF
    const pdf = await generateDocumentPDF(document, recipients, auditLogs);
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
    return res
      .status(500)
      .json({
        success: false,
        error: error.message || "Internal server error",
      });
  }
}
