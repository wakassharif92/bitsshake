import jsPDF from "jspdf";
import { Document, Recipient, AuditLog, ChatMessage, Invoice } from "./types";

export async function generateDocumentPDF(
  document: Document,
  recipients: Recipient[],
  auditLogs: AuditLog[],
  chatSignatures: ChatMessage[] = [],
  attachedInvoices: Invoice[] = [],
) {
  const loadHeaderLogoDataUrl = async () => {
    if (typeof window !== "undefined") return null;
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const filePath = path.join(
        process.cwd(),
        "public",
        "bitsshake-logo-5.png",
      );
      const fileBuffer = await fs.readFile(filePath);
      return `data:image/png;base64,${fileBuffer.toString("base64")}`;
    } catch {
      return null;
    }
  };

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 34;
  const contentWidth = pageWidth - margin * 2;
  const cardPadding = 12;

  const decodeEntities = (input: string) =>
    input
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

  const htmlToText = (input: string) => {
    const withBreaks = input
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/\s*p\s*>/gi, "\n\n")
      .replace(/<\/\s*div\s*>/gi, "\n")
      .replace(/<\/\s*li\s*>/gi, "\n")
      .replace(/<\s*li[^>]*>/gi, "• ");
    const noTags = withBreaks.replace(/<[^>]*>/g, "");
    return decodeEntities(noTags)
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const stripHtml = (input: string) =>
    decodeEntities(
      input
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );

  const line = (label: string, value?: string | null) =>
    `${label}: ${(value || "-").toString()}`;
  const formatStatus = (status?: string | null) =>
    (status || "-").replace(/_/g, " ");

  let y = margin;
  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const drawSectionTitle = (title: string, dark = false) => {
    if (dark) {
      ensureSpace(34);
      pdf.setFillColor(17, 24, 39);
      pdf.roundedRect(margin, y, contentWidth, 26, 6, 6, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.text(title, margin + 10, y + 17);
      y += 38;
      return;
    }
    ensureSpace(26);
    pdf.setTextColor(17, 24, 39);
    pdf.setFontSize(13);
    pdf.text(title, margin, y);
    y += 12;
    pdf.setDrawColor(225, 225, 225);
    pdf.line(margin, y, margin + contentWidth, y);
    y += 14;
  };

  const drawKeyValueBlock = (rows: string[]) => {
    const wrappedRows = rows.map((row) => pdf.splitTextToSize(row, contentWidth - 16));
    const blockHeight =
      wrappedRows.reduce((sum, wrapped) => sum + wrapped.length * 12 + 2, 0) + 12;
    ensureSpace(blockHeight + 8);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(margin, y, contentWidth, blockHeight, 8, 8);
    let yy = y + 18;
    pdf.setFontSize(9);
    pdf.setTextColor(51, 65, 85);
    wrappedRows.forEach((wrapped) => {
      pdf.text(wrapped, margin + 8, yy);
      yy += wrapped.length * 12 + 2;
    });
    y += blockHeight + 10;
  };

  const drawTable = (
    headers: string[],
    rows: string[][],
    widths: number[],
    options?: { headerDark?: boolean; fontSize?: number },
  ) => {
    const headerDark = options?.headerDark ?? false;
    const fontSize = options?.fontSize ?? 8;
    const lineHeight = 10;
    const cellPaddingX = 4;
    const cellPaddingY = 6;
    const tableWidth = widths.reduce((sum, width) => sum + width, 0);

    const drawHeader = () => {
      const headerHeight = 22;
      ensureSpace(headerHeight + 2);
      let x = margin;
      headers.forEach((header, index) => {
        if (headerDark) {
          pdf.setFillColor(17, 24, 39);
          pdf.rect(x, y, widths[index], headerHeight, "F");
          pdf.setTextColor(255, 255, 255);
        } else {
          pdf.setFillColor(241, 245, 249);
          pdf.rect(x, y, widths[index], headerHeight, "F");
          pdf.setTextColor(17, 24, 39);
        }
        pdf.setDrawColor(203, 213, 225);
        pdf.rect(x, y, widths[index], headerHeight);
        pdf.setFontSize(8);
        pdf.text(header, x + cellPaddingX, y + 14);
        x += widths[index];
      });
      y += headerHeight;
    };

    if (tableWidth !== contentWidth) {
      // Keep alignment stable if width math changes later
      const difference = contentWidth - tableWidth;
      widths[widths.length - 1] += difference;
    }

    drawHeader();

    rows.forEach((row) => {
      const lineSets = row.map((cell, idx) =>
        pdf.splitTextToSize(String(cell || "-"), widths[idx] - cellPaddingX * 2),
      );
      const maxLines = Math.max(...lineSets.map((lines) => lines.length), 1);
      const rowHeight = maxLines * lineHeight + cellPaddingY * 2;

      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
        drawHeader();
      }

      let x = margin;
      lineSets.forEach((lines, idx) => {
        pdf.setFillColor(255, 255, 255);
        pdf.rect(x, y, widths[idx], rowHeight, "F");
        pdf.setDrawColor(226, 232, 240);
        pdf.rect(x, y, widths[idx], rowHeight);
        pdf.setTextColor(31, 41, 55);
        pdf.setFontSize(fontSize);
        pdf.text(lines, x + cellPaddingX, y + cellPaddingY + 8);
        x += widths[idx];
      });

      y += rowHeight;
    });

    y += 10;
  };

  type AgreementBlock =
    | { type: "text"; content: string }
    | { type: "table"; headers: string[]; rows: string[][] };

  const parseAgreementBlocks = (html: string): AgreementBlock[] => {
    if (!/<[^>]+>/.test(html || "")) {
      const plain = (html || "").trim();
      return plain ? [{ type: "text", content: plain }] : [];
    }

    const blocks: AgreementBlock[] = [];
    const tableRegex = /<table[\s\S]*?<\/table>/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const pushTextBlock = (fragment: string) => {
      const cleaned = htmlToText(fragment || "");
      if (cleaned) blocks.push({ type: "text", content: cleaned });
    };

    while ((match = tableRegex.exec(html)) !== null) {
      const before = html.slice(lastIndex, match.index);
      pushTextBlock(before);

      const tableHtml = match[0];
      const trRegex = /<tr[\s\S]*?<\/tr>/gi;
      const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const rows: string[][] = [];
      let trMatch: RegExpExecArray | null;

      while ((trMatch = trRegex.exec(tableHtml)) !== null) {
        const rowHtml = trMatch[0];
        const headerCells: string[] = [];
        const dataCells: string[] = [];
        let thMatch: RegExpExecArray | null;
        let tdMatch: RegExpExecArray | null;

        while ((thMatch = thRegex.exec(rowHtml)) !== null) {
          headerCells.push(stripHtml(thMatch[1]));
        }
        while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
          dataCells.push(stripHtml(tdMatch[1]));
        }

        const row = headerCells.length > 0 ? headerCells : dataCells;
        if (row.length > 0) rows.push(row);
      }

      if (rows.length > 0) {
        const headers = rows[0];
        const body = rows.slice(1);
        blocks.push({ type: "table", headers, rows: body });
      }

      lastIndex = match.index + tableHtml.length;
    }

    const remaining = html.slice(lastIndex);
    pushTextBlock(remaining);
    return blocks;
  };

  // Header
  ensureSpace(104);
  pdf.setFillColor(17, 24, 39);
  pdf.roundedRect(margin, y, contentWidth, 90, 10, 10, "F");
  const logoDataUrl = await loadHeaderLogoDataUrl();
  if (logoDataUrl) {
    try {
      const logoMaxW = 124;
      const logoMaxH = 36;
      const logoProps = pdf.getImageProperties(logoDataUrl);
      const ratio = Math.min(
        logoMaxW / logoProps.width,
        logoMaxH / logoProps.height,
      );
      const logoW = Math.max(1, logoProps.width * ratio);
      const logoH = Math.max(1, logoProps.height * ratio);
      const logoX = margin + contentWidth - logoW - 16;
      const logoY = y + 12;
      pdf.addImage(logoDataUrl, "PNG", logoX, logoY, logoW, logoH);
    } catch {
      // Ignore logo rendering errors to avoid blocking PDF download
    }
  }
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(21);
  pdf.text("AGREEMENT", margin + 16, y + 30);
  pdf.setFontSize(11);
  const titleLines = pdf.splitTextToSize(document.title || "Untitled Document", contentWidth - 32);
  pdf.text(titleLines, margin + 16, y + 50);
  const metaText = `Status: ${formatStatus(document.status)}   |   Generated: ${new Date().toLocaleString()}`;
  const metaLines = pdf.splitTextToSize(metaText, contentWidth - 32);
  pdf.setFontSize(9);
  pdf.text(metaLines, margin + 16, y + 72);
  y += 108;

  // Agreement content
  drawSectionTitle("Agreement Content");
  const agreementBlocks = parseAgreementBlocks(document.content || "");
  if (agreementBlocks.length === 0) {
    drawKeyValueBlock(["No agreement content available."]);
  } else {
    agreementBlocks.forEach((block) => {
      if (block.type === "text") {
        const contentLines = pdf.splitTextToSize(
          block.content,
          contentWidth - cardPadding * 2,
        );
        const contentLineHeight = 13;
        const contentBlockHeight =
          contentLines.length * contentLineHeight + cardPadding * 2;
        if (contentBlockHeight <= pageHeight - margin * 2) {
          ensureSpace(contentBlockHeight + 6);
          pdf.setDrawColor(226, 232, 240);
          pdf.roundedRect(margin, y, contentWidth, contentBlockHeight, 8, 8);
          pdf.setTextColor(31, 41, 55);
          pdf.setFontSize(10);
          pdf.text(contentLines, margin + cardPadding, y + cardPadding + 2);
          y += contentBlockHeight + 10;
        } else {
          pdf.setTextColor(31, 41, 55);
          pdf.setFontSize(10);
          contentLines.forEach((contentLine: string) => {
            ensureSpace(contentLineHeight + 2);
            pdf.text(contentLine, margin, y);
            y += contentLineHeight;
          });
          y += 8;
        }
      } else {
        const columnCount = Math.max(
          block.headers.length,
          ...block.rows.map((row) => row.length),
          1,
        );
        const normalizedHeaders = Array.from({ length: columnCount }, (_, idx) =>
          block.headers[idx] || `Column ${idx + 1}`,
        );
        const normalizedRows =
          block.rows.length > 0
            ? block.rows.map((row) =>
                Array.from({ length: columnCount }, (_, idx) => row[idx] || "-"),
              )
            : [Array.from({ length: columnCount }, () => "-")];
        const baseCol = Math.floor(contentWidth / columnCount);
        const widths = Array.from({ length: columnCount }, () => baseCol);
        widths[widths.length - 1] += contentWidth - baseCol * columnCount;
        drawTable(normalizedHeaders, normalizedRows, widths, {
          headerDark: false,
          fontSize: 8,
        });
      }
    });
  }

  // Signers
  const signers = recipients.filter((r) => r.role === "signer");
  if (signers.length > 0) {
    drawSectionTitle("Signatures");
    signers.forEach((signer, idx) => {
      drawKeyValueBlock([
        `Signer ${idx + 1}`,
        line("Email", signer.email),
        line("Signature", signer.signature_text || "Not signed"),
        line(
          "Signed At",
          signer.signed_at ? new Date(signer.signed_at).toLocaleString() : "-",
        ),
      ]);
    });
  }

  // Audit logs
  if (auditLogs.length > 0) {
    drawSectionTitle("Activity Log", true);
    const auditRows = auditLogs.map((log) => [
      log.action || "-",
      log.actor_email || "-",
      new Date(log.timestamp).toLocaleString(),
      log.ip_address || "-",
    ]);
    drawTable(
      ["Action", "Actor", "Timestamp", "IP Address"],
      auditRows,
      [120, 120, 180, 107],
      { headerDark: true, fontSize: 8 },
    );
  }

  // Signature agreement chat entries
  if (chatSignatures.length > 0) {
    drawSectionTitle("Signature Agreement");
    chatSignatures.forEach((sig) => {
      const signatureBody = sig.message
        ? sig.message.replace("[SIGNATURE]", "").trim()
        : "";
      const [sigName, sigReason] = signatureBody
        ? signatureBody.split("||").map((part) => part.trim())
        : ["", ""];
      drawKeyValueBlock([
        line("Title", sigReason ? `${sigReason} Signature` : "Signature"),
        line("Signature", sigName || "-"),
        line("Email", sig.sender_email),
        line("Name", sig.sender_name),
        line("Location", sig.sender_location),
        line("IP", sig.sender_ip),
        line("Signed At", new Date(sig.created_at).toLocaleString()),
      ]);
    });
  }

  // Attached invoices
  if (attachedInvoices.length > 0) {
    drawSectionTitle("Attached Invoices", true);
    const invoiceSummaryRows = attachedInvoices.map((invoice) => [
      invoice.invoice_number || invoice.id,
      formatStatus(invoice.status),
      invoice.client_name || "-",
      `${invoice.currency || ""} ${Number(invoice.total_amount ?? invoice.amount ?? 0).toFixed(2)}`.trim(),
      invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "-",
      invoice.invoice_type === "one_time" ? "One Time" : "Milestone",
    ]);
    drawTable(
      ["Invoice #", "Status", "Client", "Total", "Due Date", "Type"],
      invoiceSummaryRows,
      [108, 72, 120, 85, 72, 70],
      { headerDark: true, fontSize: 8 },
    );

    attachedInvoices.forEach((invoice, invoiceIndex) => {
      drawKeyValueBlock([
        `Invoice ${invoiceIndex + 1}: ${
          invoice.invoice_number || invoice.client_name || invoice.id
        }`,
        line("Status", formatStatus(invoice.status)),
        line("Client", invoice.client_name),
        line("Client Email", invoice.client_email),
        line(
          "Type",
          invoice.invoice_type === "one_time"
            ? "One Time Payment"
            : "Milestone",
        ),
        line(
          "Total Amount",
          `${invoice.currency || ""} ${Number(invoice.total_amount ?? invoice.amount ?? 0).toFixed(2)}`.trim(),
        ),
        line("Sender Email", invoice.sender_signer_email),
        line("Receiver Email", invoice.receiver_signer_email),
        line(
          "Due Date",
          invoice.due_date
            ? new Date(invoice.due_date).toLocaleDateString()
            : "-",
        ),
        line(
          "Created",
          invoice.created_at
            ? new Date(invoice.created_at).toLocaleString()
            : "-",
        ),
        line("Description", invoice.description),
      ]);

      const milestones = Array.isArray(invoice.milestones)
        ? (invoice.milestones as Array<{
            item?: string;
            amount?: number;
            sender_signature_text?: string;
            receiver_signature_text?: string;
            sender_signed_by_ip?: string;
            sender_signed_by_city?: string;
            sender_signed_by_country?: string;
            sender_signed_at?: string;
            receiver_signed_by_ip?: string;
            receiver_signed_by_city?: string;
            receiver_signed_by_country?: string;
            receiver_signed_at?: string;
          }>)
        : [];

      milestones.forEach((entry, milestoneIndex) => {
        const senderMeta = [
          `IP: ${entry.sender_signed_by_ip || "-"}`,
          `Loc: ${entry.sender_signed_by_city || "-"}, ${
            entry.sender_signed_by_country || "-"
          }`,
          `Time: ${
            entry.sender_signed_at
              ? new Date(entry.sender_signed_at).toLocaleString()
              : "-"
          }`,
        ].join("\n");
        const receiverMeta = [
          `IP: ${entry.receiver_signed_by_ip || "-"}`,
          `Loc: ${entry.receiver_signed_by_city || "-"}, ${
            entry.receiver_signed_by_country || "-"
          }`,
          `Time: ${
            entry.receiver_signed_at
              ? new Date(entry.receiver_signed_at).toLocaleString()
              : "-"
          }`,
        ].join("\n");

        if (milestoneIndex === 0) {
          drawSectionTitle(
            `Invoice ${invoice.invoice_number || invoice.id} Milestones`,
          );
        }

        drawTable(
          [
            "Milestone",
            "Amount",
            "Sender Sign",
            "Receiver Sign",
            "Sender Meta",
            "Receiver Meta",
          ],
          [
            [
              entry.item || "-",
              `${invoice.currency || ""} ${Number(entry.amount || 0).toFixed(2)}`.trim(),
              entry.sender_signature_text || "-",
              entry.receiver_signature_text || "-",
              senderMeta,
              receiverMeta,
            ],
          ],
          [110, 62, 75, 75, 102, 103],
          { headerDark: false, fontSize: 7 },
        );
      });
    });
  }

  // Footer marker
  ensureSpace(20);
  pdf.setFontSize(8);
  pdf.setTextColor(107, 114, 128);
  pdf.text("Generated by BitsShake", margin, y + 12);

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
