import jsPDF from "jspdf";
import { Document, Recipient, AuditLog, ChatMessage } from "./types";

export async function generateDocumentPDF(
  document: Document,
  recipients: Recipient[],
  auditLogs: AuditLog[],
  chatSignatures: ChatMessage[] = [],
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

  // Discussion signatures section
  if (chatSignatures.length > 0) {
    if (yPosition + 40 > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text("Signature Agreement", margin, yPosition);
    yPosition += 10;

    chatSignatures.forEach((sig) => {
      if (yPosition + 30 > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }

      const signatureBody = sig.message
        ? sig.message.replace("[SIGNATURE]", "").trim()
        : "";
      const [sigName, sigReason] = signatureBody
        ? signatureBody.split("||").map((part) => part.trim())
        : ["", ""];
      const title = sigReason ? `${sigReason} Signature` : "Signature";

      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text(title, margin, yPosition);
      yPosition += 6;

      if (sigName) {
        pdf.setFontSize(16);
        pdf.text(sigName, margin, yPosition);
        yPosition += 7;
      }

      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Email: ${sig.sender_email}`, margin, yPosition);
      yPosition += 4;
      if (sig.sender_name) {
        pdf.text(`Name: ${sig.sender_name}`, margin, yPosition);
        yPosition += 4;
      }
      if (sig.sender_location) {
        pdf.text(`Location: ${sig.sender_location}`, margin, yPosition);
        yPosition += 4;
      }
      if (sig.sender_ip) {
        pdf.text(`IP: ${sig.sender_ip}`, margin, yPosition);
        yPosition += 4;
      }
      pdf.text(
        `Signed: ${new Date(sig.created_at).toLocaleString()}`,
        margin,
        yPosition,
      );
      yPosition += 8;
    });
  }

  return pdf;
}

export function downloadPDF(pdf: jsPDF, filename: string) {
  pdf.save(filename);
}

export async function generateChatPDF(
  documentTitle: string,
  messages: {
    sender_name?: string;
    sender_email: string;
    message: string;
    created_at: string;
  }[],
) {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  let yPosition = margin;

  pdf.setFontSize(20);
  pdf.text("Conversation", margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(
    `Document: ${documentTitle} | Generated: ${new Date().toLocaleString()}`,
    margin,
    yPosition,
  );
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setTextColor(0, 0, 0);

  messages.forEach((msg) => {
    const header = `${msg.sender_name || msg.sender_email} (${msg.sender_email})`;
    const time = new Date(msg.created_at).toLocaleString();

    const headerLines = pdf.splitTextToSize(header, contentWidth);
    const timeLines = pdf.splitTextToSize(time, contentWidth);
    const messageLines = pdf.splitTextToSize(msg.message || "", contentWidth);

    const blockHeight =
      headerLines.length * 5 +
      timeLines.length * 4 +
      messageLines.length * 5 +
      6;

    if (yPosition + blockHeight > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }

    pdf.setFontSize(10);
    pdf.text(headerLines, margin, yPosition);
    yPosition += headerLines.length * 5;

    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(timeLines, margin, yPosition);
    yPosition += timeLines.length * 4;

    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text(messageLines, margin, yPosition);
    yPosition += messageLines.length * 5 + 6;
  });

  return pdf;
}
