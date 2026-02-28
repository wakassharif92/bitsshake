import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

interface MilestoneInput {
  item: string;
  amount: number;
  sender_signature_text?: string;
  receiver_signature_text?: string;
  sender_signature_style?: string;
  receiver_signature_style?: string;
  sender_signed_by_ip?: string;
  sender_signed_by_city?: string;
  sender_signed_by_country?: string;
  sender_signed_at?: string;
  receiver_signed_by_ip?: string;
  receiver_signed_by_city?: string;
  receiver_signed_by_country?: string;
  receiver_signed_at?: string;
}

interface UpdateInvoiceMilestonesRequest {
  invoiceId: string;
  actorEmail: string;
  milestones: MilestoneInput[];
}

interface UpdateInvoiceMilestonesResponse {
  success: boolean;
  message?: string;
  status?:
    | "in_progress"
    | "draft"
    | "sent"
    | "received"
    | "completed"
    | "paid"
    | "overdue";
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateInvoiceMilestonesResponse>,
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { invoiceId, actorEmail, milestones } =
      req.body as UpdateInvoiceMilestonesRequest;

    if (!invoiceId || !actorEmail || !Array.isArray(milestones)) {
      return res.status(400).json({
        success: false,
        error: "Missing invoiceId, actorEmail, or milestones",
      });
    }

    const normalizedActorEmail = actorEmail.trim().toLowerCase();

    const normalizedMilestones = milestones
      .map((m) => ({
        item: (m.item || "").trim(),
        amount: Number(m.amount),
        sender_signature_text: (m.sender_signature_text || "").toString(),
        receiver_signature_text: (m.receiver_signature_text || "").toString(),
        sender_signature_style: (m.sender_signature_style || "cursive").toString(),
        receiver_signature_style: (m.receiver_signature_style || "cursive").toString(),
        sender_signed_by_ip: (m.sender_signed_by_ip || "").toString(),
        sender_signed_by_city: (m.sender_signed_by_city || "").toString(),
        sender_signed_by_country: (m.sender_signed_by_country || "").toString(),
        sender_signed_at: (m.sender_signed_at || "").toString(),
        receiver_signed_by_ip: (m.receiver_signed_by_ip || "").toString(),
        receiver_signed_by_city: (m.receiver_signed_by_city || "").toString(),
        receiver_signed_by_country: (m.receiver_signed_by_country || "").toString(),
        receiver_signed_at: (m.receiver_signed_at || "").toString(),
      }))
      .filter((m) => m.item);

    if (normalizedMilestones.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one milestone item is required",
      });
    }

    const invalid = normalizedMilestones.find(
      (m) => Number.isNaN(m.amount) || m.amount <= 0,
    );
    if (invalid) {
      return res.status(400).json({
        success: false,
        error: "Each milestone amount must be greater than 0",
      });
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return res
        .status(404)
        .json({ success: false, error: "Invoice not found" });
    }

    const senderEmail = (invoice.sender_signer_email || "")
      .toString()
      .trim()
      .toLowerCase();

    const adminResult = await supabaseAdmin.auth.admin.getUserById(
      invoice.admin_id as string,
    );
    const adminEmail = (adminResult.data.user?.email || "")
      .trim()
      .toLowerCase();

    const isSender = senderEmail && normalizedActorEmail === senderEmail;
    const isAdmin = adminEmail && normalizedActorEmail === adminEmail;

    if (!isSender && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Only sender or admin can edit milestones",
      });
    }

    if (
      invoice.invoice_type === "one_time" &&
      normalizedMilestones.length !== 1
    ) {
      return res.status(400).json({
        success: false,
        error: "One-time invoice must have exactly one item",
      });
    }

    const totalAmount = normalizedMilestones.reduce(
      (sum, m) => sum + Number(m.amount),
      0,
    );

    const allMilestonesFullySigned =
      normalizedMilestones.length > 0 &&
      normalizedMilestones.every(
        (m) =>
          !!(m.sender_signature_text || "").toString().trim() &&
          !!(m.receiver_signature_text || "").toString().trim(),
      );
    const nextStatus = allMilestonesFullySigned ? "completed" : "in_progress";

    const { error: updateError } = await supabaseAdmin
      .from("invoices")
      .update({
        milestones: normalizedMilestones,
        total_amount: totalAmount,
        amount: totalAmount,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: updateError.message || "Failed to update milestones",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Milestones updated successfully",
      status: nextStatus,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return res.status(500).json({ success: false, error: message });
  }
}
