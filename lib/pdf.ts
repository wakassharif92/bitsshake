import jsPDF from "jspdf";
import { Document, Recipient, AuditLog } from "./types";

export async function generateDocumentPDF(
  document: Document,
  recipients: Recipient[],
  auditLogs: AuditLog[],
) {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  let yPosition = margin;

  // Title
  pdf.setFontSize(24);
  pdf.text(document.title, margin, yPosition);
  yPosition += 15;

  // Status and date
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `Status: ${document.status} | Generated: ${new Date().toLocaleString()}`,
    margin,
    yPosition,
  );
  yPosition += 10;

  // Document content
  pdf.setFontSize(11);
  pdf.setTextColor(0, 0, 0);

  const contentLines = pdf.splitTextToSize(
    document.content || "",
    contentWidth,
  );
  contentLines.forEach((line: string) => {
    if (yPosition + 5 > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
    pdf.text(line, margin, yPosition);
    yPosition += 5;
  });

  yPosition += 10;

  // Signatures section
  if (recipients.filter((r) => r.role === "signer").length > 0) {
    if (yPosition + 40 > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text("Signatures", margin, yPosition);
    yPosition += 10;

    const signers = recipients.filter((r) => r.role === "signer");
    signers.forEach((signer) => {
      if (yPosition + 20 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }

      // Signature line
      pdf.setFontSize(14);
      pdf.text(signer.signature_text || "_________________", margin, yPosition);
      yPosition += 8;

      // Signer info
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Email: ${signer.email}`, margin, yPosition);
      yPosition += 5;

      if (signer.signed_at) {
        pdf.text(
          `Signed: ${new Date(signer.signed_at).toLocaleString()}`,
          margin,
          yPosition,
        );
        yPosition += 5;
      }

      yPosition += 8;
    });
  }

  // Audit Log section
  if (auditLogs.length > 0) {
    if (yPosition + 40 > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text("Activity Log", margin, yPosition);
    yPosition += 10;

    auditLogs.forEach((log) => {
      if (yPosition + 15 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${log.action} - ${log.actor_email}`, margin, yPosition);
      yPosition += 4;

      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(new Date(log.timestamp).toLocaleString(), margin, yPosition);
      yPosition += 4;

      if (log.ip_address) {
        pdf.text(`IP: ${log.ip_address}`, margin, yPosition);
        yPosition += 4;
      }

      yPosition += 3;
    });
  }

  return pdf;
}

export function downloadPDF(pdf: jsPDF, filename: string) {
  pdf.save(filename);
}
