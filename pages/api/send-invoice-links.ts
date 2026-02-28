import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendInvoiceRequest {
  invoiceId: string;
}

interface SendInvoiceResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SendInvoiceResponse>,
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { invoiceId } = req.body as SendInvoiceRequest;

    if (!invoiceId) {
      return res
        .status(400)
        .json({ success: false, error: "Missing invoiceId" });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Email service not configured. Add RESEND_API_KEY to .env.local",
      });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("admin_id", user.id)
      .single();

    if (invoiceError || !invoice) {
      return res
        .status(404)
        .json({ success: false, error: "Invoice not found" });
    }

    const emails = [
      invoice.sender_signer_email,
      invoice.receiver_signer_email,
      invoice.client_email,
    ]
      .map((e: unknown) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
      .filter(Boolean);

    const uniqueEmails = Array.from(new Set(emails));

    if (uniqueEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No recipient emails found on this invoice",
      });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://www.bitsshake.com";
    const fromEmail = "hello@bitsoclock.com";

    const sendJobs = uniqueEmails.map(async (recipientEmail) => {
      const link = `${baseUrl}/invoices/${invoiceId}?email=${encodeURIComponent(recipientEmail)}`;
      return resend.emails.send({
        from: fromEmail,
        to: recipientEmail,
        subject: `Invoice Shared: ${invoice.invoice_number}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Invoice Shared</h2>
            <p>You have received an invoice: <strong>${invoice.invoice_number}</strong>.</p>
            <p>Client: <strong>${invoice.client_name}</strong></p>
            <p>Amount: <strong>${invoice.currency} ${Number(invoice.total_amount ?? invoice.amount ?? 0).toFixed(2)}</strong></p>
            <p style="margin-top: 24px;">
              <a href="${link}" style="background-color: #111; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Invoice
              </a>
            </p>
            <p style="margin-top: 16px; color: #666; font-size: 12px; word-break: break-all;">
              ${link}
            </p>
          </div>
        `,
      });
    });

    const results = await Promise.all(sendJobs);
    const successful = results.filter((r) => r.data?.id && !r.error).length;

    if (successful === 0) {
      return res.status(500).json({
        success: false,
        error: "Failed to send invoice emails",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Invoice shared with ${successful}/${uniqueEmails.length} recipients`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return res.status(500).json({ success: false, error: message });
  }
}
