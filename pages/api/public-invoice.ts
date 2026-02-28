import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { invoiceId, email } = req.query;

    if (!invoiceId || typeof invoiceId !== "string") {
      return res.status(400).json({ error: "Missing invoiceId" });
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Missing email" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (error || !invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const senderEmail = (invoice.sender_signer_email || "")
      .toString()
      .trim()
      .toLowerCase();
    const receiverEmail = (invoice.receiver_signer_email || "")
      .toString()
      .trim()
      .toLowerCase();
    const clientEmail = (invoice.client_email || "")
      .toString()
      .trim()
      .toLowerCase();

    const authorized =
      normalizedEmail === senderEmail ||
      normalizedEmail === receiverEmail ||
      normalizedEmail === clientEmail;

    if (!authorized) {
      return res.status(403).json({ error: "Not authorized for this invoice" });
    }

    return res.status(200).json({ invoice });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    return res.status(500).json({ error: message });
  }
}
